const EARTH_RADIUS_KM = 6371.0088;
const RULE_TYPES = ["demand", "distance", "time", "fee"];

function roundMoney(amount) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function distanceBetweenKm(first, second) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const [firstLng, firstLat] = first;
  const [secondLng, secondLat] = second;
  const latitudeDelta = radians(secondLat - firstLat);
  const longitudeDelta = radians(secondLng - firstLng);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(firstLat)) * Math.cos(radians(secondLat))
    * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function getRulesByType(rules) {
  const result = Object.fromEntries(RULE_TYPES.map((type) => [type, null]));
  for (const rule of rules) {
    if (!RULE_TYPES.includes(rule.type)) continue;
    if (result[rule.type]) throw new Error(`Multiple pricing rules are configured for ${rule.type}.`);
    result[rule.type] = { config: rule.config, isActive: rule.isActive };
  }
  const missing = RULE_TYPES.filter((type) => !result[type]);
  if (missing.length) throw new Error(`Pricing rules are missing: ${missing.join(", ")}.`);
  return result;
}

export function calculatePricing({ basePrice, scheduledAt, distanceKm, openRequests, availableProviders, rules }) {
  const config = getRulesByType(rules);
  const demand = config.demand.config;
  const distance = config.distance.config;
  const time = config.time.config;
  const fee = config.fee.config;

  const demandRatio = availableProviders > 0 ? openRequests / availableProviders : (openRequests > 0 ? Infinity : 0);
  const demandMultiplier = config.demand.isActive
    ? clamp(
      demand.baseMultiplier + demand.sensitivity * (demandRatio - demand.referenceRatio),
      demand.minimumMultiplier,
      demand.maximumMultiplier
    )
    : demand.neutralMultiplier;
  const distanceFactor = config.distance.isActive && Number.isFinite(distanceKm)
    ? distance.baseFactor + distance.perKm * Math.max(distance.minimumExcessKm, distanceKm - distance.includedKm)
    : distance.neutralFactor;
  const hourFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: time.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  const timeParts = hourFormatter.formatToParts(new Date(scheduledAt));
  const localMinutes = Number(timeParts.find((part) => part.type === "hour").value) * 60
    + Number(timeParts.find((part) => part.type === "minute").value);
  const isNight = localMinutes >= time.nightStartHour * 60 || localMinutes < time.nightEndHour * 60;
  const isEvening = localMinutes >= time.eveningStartHour * 60
    && localMinutes <= time.eveningEndHour * 60;
  const timeFactor = !config.time.isActive ? time.neutralMultiplier
    : isNight ? time.nightMultiplier
      : isEvening ? time.eveningMultiplier : time.normalMultiplier;
  const subtotal = roundMoney(basePrice * demandMultiplier * distanceFactor * timeFactor);
  const platformFee = roundMoney(subtotal * (config.fee.isActive ? fee.percent : fee.neutralPercent) / 100);
  const total = roundMoney(subtotal + platformFee);

  return {
    base: roundMoney(basePrice),
    demandMultiplier,
    distanceFactor,
    distanceKm: Number.isFinite(distanceKm) ? roundMoney(distanceKm) : null,
    timeFactor,
    platformFee,
    subtotal,
    total
  };
}

export function createPricingService({ PricingRule, Provider, User, Booking, Service }) {
  async function loadRules() {
    const rules = await PricingRule.find({}).lean();
    getRulesByType(rules);
    return rules;
  }

  async function getAreaContext({ lat, lng, service, scheduledAt, rules }) {
    const configs = getRulesByType(rules);
    const radiusKm = configs.demand.config.radiusKm;
    const now = new Date();
    const windowStart = new Date(now.getTime() - configs.demand.config.lookbackMinutes * 60_000);
    const center = [lng, lat];
    const services = service
      ? await Service.find({ category: service.category, isActive: true }).select("_id").lean()
      : [];
    const categoryServiceIds = services.map((item) => item._id);
    const providerFilter = { verificationStatus: "verified" };
    if (service) providerFilter["skills.service"] = { $in: categoryServiceIds };
    const profiles = await Provider.find(providerFilter).lean();
    const matchingServiceIds = new Set(categoryServiceIds.map(String));
    const matchingProfiles = profiles.filter((profile) => (
      (!service || (profile.skills || []).some((skill) => matchingServiceIds.has(String(skill.service))))
      && profile.currentLocation?.coordinates?.length === 2
    ));
    const userIds = matchingProfiles.map((profile) => profile.user);
    const availableUsers = await User.find({
      _id: { $in: userIds },
      isAvailable: true,
      isBlocked: false
    }).select("_id").lean();
    const availableIds = new Set(availableUsers.map((user) => String(user._id)));
    const availableProfiles = matchingProfiles.filter((profile) => {
      const userId = String(profile.user?._id || profile.user);
      if (!availableIds.has(userId)) return false;
      const distance = distanceBetweenKm(center, profile.currentLocation.coordinates);
      const serviceRadiusKm = Number(profile.serviceRadiusKm);
      if (!Number.isFinite(serviceRadiusKm) || distance > serviceRadiusKm) return false;
      return !scheduledAt || !profile.bookingSlots?.some((slot) => (
        new Date(slot.start) < new Date(scheduledAt.getTime() + (service?.durationMins || 0) * 60_000)
        && new Date(slot.end) > scheduledAt
      ));
    });
    const availableProviders = availableProfiles.filter((profile) => (
      distanceBetweenKm(center, profile.currentLocation.coordinates) <= radiusKm
    )).length;
    let bookingFilter = { status: "PENDING", createdAt: { $gte: windowStart } };
    if (service) {
      bookingFilter.service = { $in: categoryServiceIds };
    }
    const openRequests = await Booking.countDocuments(bookingFilter);
    const distanceKm = availableProfiles.reduce((nearest, profile) => {
      const distance = distanceBetweenKm(center, profile.currentLocation.coordinates);
      return nearest === null || distance < nearest ? distance : nearest;
    }, null);
    return { openRequests, availableProviders, distanceKm };
  }

  async function quote({ basePrice, lat, lng, scheduledAt, service }) {
    const rules = await loadRules();
    const context = await getAreaContext({ lat, lng, service, scheduledAt, rules });
    const breakdown = calculatePricing({
      basePrice,
      scheduledAt,
      ...context,
      rules
    });
    return { breakdown, rules };
  }

  async function surge({ lat, lng }) {
    const rules = await loadRules();
    const context = await getAreaContext({ lat, lng, rules });
    return calculatePricing({
      basePrice: 0,
      scheduledAt: new Date(),
      ...context,
      rules
    }).demandMultiplier;
  }

  return { loadRules, getAreaContext, quote, surge };
}

export function watchSurgeAreas({ io, PricingRule, Provider, User, Booking, Service }) {
  const pricing = createPricingService({ PricingRule, Provider, User, Booking, Service });
  let previous = new Map();

  async function refresh() {
    const rules = await pricing.loadRules();
    const demand = getRulesByType(rules).demand.config;
    const profiles = await Provider.find({ verificationStatus: "verified" })
      .select("currentLocation").lean();
    const openBookings = await Booking.find({
      status: "PENDING",
      createdAt: { $gte: new Date(Date.now() - demand.lookbackMinutes * 60_000) }
    }).select("address.location").lean();
    const areas = new Map();
    const locations = [
      ...profiles.map((profile) => profile.currentLocation),
      ...openBookings.map((booking) => booking.address?.location)
    ];
    for (const location of locations) {
      const coordinates = location?.coordinates;
      if (!coordinates || coordinates.length !== 2) continue;
      const [lng, lat] = coordinates;
      const areaLat = Math.floor(lat / demand.areaGridDegrees) * demand.areaGridDegrees
        + demand.areaGridDegrees / 2;
      const areaLng = Math.floor(lng / demand.areaGridDegrees) * demand.areaGridDegrees
        + demand.areaGridDegrees / 2;
      const roundedLat = Number(areaLat.toFixed(5));
      const roundedLng = Number(areaLng.toFixed(5));
      areas.set(`${roundedLat},${roundedLng}`, { lat: roundedLat, lng: roundedLng });
    }

    const next = new Map();
    for (const [key, area] of areas) {
      const multiplier = await pricing.surge(area);
      next.set(key, multiplier);
      if ((previous.get(key) ?? demand.baseMultiplier) !== multiplier) {
        io.emit("surge:update", { ...area, multiplier });
      }
    }
    for (const key of previous.keys()) {
      if (areas.has(key)) continue;
      const [lat, lng] = key.split(",").map(Number);
      io.emit("surge:update", { lat, lng, multiplier: demand.baseMultiplier });
    }
    previous = next;
  }

  const interval = setInterval(() => {
    refresh().catch((error) => console.error("Unable to refresh area surge pricing:", error));
  }, 60_000);
  refresh().catch((error) => console.error("Unable to initialize area surge pricing:", error));
  return interval;
}
