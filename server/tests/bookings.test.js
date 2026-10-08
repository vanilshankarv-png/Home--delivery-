import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../src/app.js";

process.env.JWT_SECRET = "test-only-booking-secret";

const customerId = "222222222222222222222222";
const providerId = "111111111111111111111111";
const otherProviderId = "333333333333333333333333";
const serviceId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const quoteSnapshot = {
  base: 400,
  demandMultiplier: 1,
  distanceFactor: 1,
  timeFactor: 1,
  platformFee: 40,
  total: 440
};

class FakeQuery {
  constructor(value) {
    this.value = value;
  }

  populate() { return this; }
  sort() { return this; }
  skip() { return this; }
  limit() { return this; }
  select() { return this; }
  lean() { return Promise.resolve(this.value); }
  then(resolve, reject) { return Promise.resolve(this.value).then(resolve, reject); }
}

function makeApp() {
  const bookings = new Map();
  const slots = new Map([[providerId, []], [otherProviderId, []]]);
  const users = new Map([
    [customerId, { _id: customerId, role: "customer", isBlocked: false, address: [] }],
    [providerId, { _id: providerId, role: "provider", isAvailable: true, isBlocked: false }],
    [otherProviderId, { _id: otherProviderId, role: "provider", isAvailable: true, isBlocked: false }]
  ]);
  const quotes = new Map();
  const consumedQuotes = new Set();

  function matchBooking(booking, filter = {}) {
    if (filter._id && String(filter._id) !== String(booking._id)) return false;
    if (filter.status && (typeof filter.status === "string"
      ? booking.status !== filter.status
      : !filter.status.$in?.includes(booking.status))) return false;
    if (filter.customer && String(booking.customer) !== String(filter.customer)) return false;
    if (filter.provider !== undefined && String(booking.provider || "") !== String(filter.provider || "")) return false;
    return true;
  }

  const Booking = {
    async create(fields) {
      const booking = { ...fields, _id: String(fields._id), createdAt: new Date() };
      bookings.set(booking._id, booking);
      return booking;
    },
    findById(id) {
      return new FakeQuery(bookings.get(String(id)) || null);
    },
    find(filter = {}) {
      return new FakeQuery([...bookings.values()].filter((booking) => matchBooking(booking, filter)));
    },
    async countDocuments(filter = {}) {
      return [...bookings.values()].filter((booking) => matchBooking(booking, filter)).length;
    },
    findOneAndUpdate(filter, update) {
      const booking = bookings.get(String(filter._id));
      if (!booking || (filter.status && booking.status !== filter.status)) return new FakeQuery(null);
      if (filter.provider === null && booking.provider) return new FakeQuery(null);
      Object.assign(booking, update.$set || {});
      for (const [key, value] of Object.entries(update.$push || {})) {
        if (key === "timeline") booking.timeline.push(value);
      }
      return new FakeQuery(booking);
    }
  };

  const Service = {
    findOne: () => new FakeQuery({
      _id: serviceId,
      title: "Tap repair",
      basePrice: 400,
      durationMins: 60,
      isActive: true
    }),
    findById: () => new FakeQuery({ durationMins: 60 })
  };

  const Provider = {
    findOne({ user }) {
      const entry = slots.get(String(user));
      if (!entry) return new FakeQuery(null);
      return new FakeQuery({
        _id: `profile-${user}`,
        user,
        verificationStatus: "verified",
        skills: [{ service: serviceId }],
        currentLocation: { type: "Point", coordinates: [83.2, 17.7] },
        serviceRadiusKm: 15
      });
    },
    async updateOne(filter, update) {
      const profileId = String(filter._id || "").replace("profile-", "");
      const providerSlots = slots.get(profileId);
      if (!providerSlots) return { modifiedCount: 0 };
      if (update.$push?.bookingSlots) {
        const next = update.$push.bookingSlots;
        const overlaps = providerSlots.some((slot) => slot.start < next.end && slot.end > next.start);
        if (overlaps) return { modifiedCount: 0 };
        providerSlots.push(next);
        return { modifiedCount: 1 };
      }
      if (update.$pull?.bookingSlots) {
        const remaining = providerSlots.filter((slot) => String(slot.booking) !== String(update.$pull.bookingSlots.booking));
        providerSlots.splice(0, providerSlots.length, ...remaining);
        return { modifiedCount: 1 };
      }
      if (update.$set?.["bookingSlots.$.start"]) {
        const bookingId = String(filter.bookingSlots.$elemMatch.booking);
        const current = providerSlots.find((slot) => String(slot.booking) === bookingId);
        if (!current) return { modifiedCount: 0 };
        const conflict = providerSlots.some((slot) => String(slot.booking) !== bookingId
          && slot.start < update.$set["bookingSlots.$.end"]
          && slot.end > update.$set["bookingSlots.$.start"]);
        if (conflict) return { modifiedCount: 0 };
        current.start = update.$set["bookingSlots.$.start"];
        current.end = update.$set["bookingSlots.$.end"];
        return { modifiedCount: 1 };
      }
      return { modifiedCount: 0 };
    }
  };

  const User = {
    findById(id) {
      const user = users.get(String(id));
      return new FakeQuery(user ? { ...user, select: undefined } : null);
    }
  };

  const PricingQuote = {
    findOne(filter) {
      let quote = quotes.get(String(filter._id));
      if (!quote) {
        quote = {
          _id: String(filter._id),
          customer: customerId,
          service: serviceId,
          scheduledAt: filter.scheduledAt,
          location: { coordinates: filter["location.coordinates"] },
          priceSnapshot: quoteSnapshot
        };
        quotes.set(String(filter._id), quote);
      }
      return new FakeQuery(consumedQuotes.has(String(filter._id)) ? null : quote);
    },
    findOneAndUpdate(filter) {
      const id = String(filter._id);
      if (consumedQuotes.has(id)) return new FakeQuery(null);
      consumedQuotes.add(id);
      return new FakeQuery(quotes.get(id));
    },
    async updateOne(filter, update) {
      if (update.$unset?.consumedAt) consumedQuotes.delete(String(filter._id));
      return { modifiedCount: 1 };
    }
  };

  const tokenFor = (id, role) => jwt.sign({ sub: id, role }, process.env.JWT_SECRET);
  const app = createApp({ bookingModels: { Booking, Service, Provider, User, PricingQuote } });
  const events = [];
  app.locals.io = {
    to(room) {
      return { emit: (event, payload) => events.push({ room, event, payload }) };
    }
  };
  return {
    app,
    bookings,
    slots,
    events,
    customerAuth: { Authorization: `Bearer ${tokenFor(customerId, "customer")}` },
    providerAuth: { Authorization: `Bearer ${tokenFor(providerId, "provider")}` },
    otherProviderAuth: { Authorization: `Bearer ${tokenFor(otherProviderId, "provider")}` }
  };
}

function bookingPayload({ provider } = {}) {
  const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  return {
    quoteId: Math.floor(new Date(scheduledAt).getTime()).toString(16).padStart(24, "0"),
    service: serviceId,
    ...(provider ? { provider } : {}),
    address: {
      label: "Home",
      line1: "10 Main Street",
      city: "Visakhapatnam",
      pincode: "530001",
      location: { type: "Point", coordinates: [83.2185, 17.6868] }
    },
    scheduledAt,
    notes: "Please call on arrival."
  };
}

describe("booking lifecycle APIs", () => {
  let context;

  beforeEach(() => { context = makeApp(); });

  async function createOpenBooking() {
    const response = await request(context.app)
      .post("/api/bookings")
      .set(context.customerAuth)
      .send(bookingPayload());
    expect(response.status).toBe(201);
    return response.body.booking;
  }

  it("requires authentication and creates bookings with a price snapshot", async () => {
    const unauthenticated = await request(context.app).get("/api/bookings");
    const created = await request(context.app)
      .post("/api/bookings")
      .set(context.customerAuth)
      .send(bookingPayload());

    expect(unauthenticated.status).toBe(401);
    expect(created.status).toBe(201);
    expect(created.body.booking.status).toBe("PENDING");
    expect(created.body.booking.priceSnapshot).toEqual({
      base: 400,
      demandMultiplier: 1,
      distanceFactor: 1,
      timeFactor: 1,
      platformFee: 40,
      total: 440
    });
    expect(context.events).toContainEqual(expect.objectContaining({
      room: "providers",
      event: "job:new"
    }));
  });

  it("requires a valid quote before booking", async () => {
    const payload = bookingPayload();
    delete payload.quoteId;
    const response = await request(context.app)
      .post("/api/bookings")
      .set(context.customerAuth)
      .send(payload);

    expect(response.status).toBe(400);
  });

  it("prevents overlapping reservations for a specifically selected provider", async () => {
    const first = await request(context.app)
      .post("/api/bookings")
      .set(context.customerAuth)
      .send(bookingPayload({ provider: providerId }));
    const second = await request(context.app)
      .post("/api/bookings")
      .set(context.customerAuth)
      .send(bookingPayload({ provider: providerId }));

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
  });

  it("lists customer bookings and lets participants read booking details", async () => {
    const booking = await createOpenBooking();
    const list = await request(context.app).get("/api/bookings").set(context.customerAuth);
    const detail = await request(context.app).get(`/api/bookings/${booking._id}`).set(context.customerAuth);
    const forbidden = await request(context.app).get(`/api/bookings/${booking._id}`).set(context.otherProviderAuth);

    expect(list.status).toBe(200);
    expect(list.body.bookings).toHaveLength(1);
    expect(detail.status).toBe(200);
    expect(forbidden.status).toBe(403);
  });

  it("reschedules a booking more than two hours before its slot", async () => {
    const booking = await createOpenBooking();
    const nextDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const response = await request(context.app)
      .put(`/api/bookings/${booking._id}/reschedule`)
      .set(context.customerAuth)
      .send({ scheduledAt: nextDate });

    expect(response.status).toBe(200);
    expect(new Date(response.body.booking.scheduledAt).toISOString()).toBe(nextDate);
  });

  it("cancels bookings for a participant and records the reason", async () => {
    const booking = await createOpenBooking();
    const response = await request(context.app)
      .put(`/api/bookings/${booking._id}/cancel`)
      .set(context.customerAuth)
      .send({ reason: "Plans have changed." });

    expect(response.status).toBe(200);
    expect(response.body.booking.status).toBe("CANCELLED");
    expect(response.body.booking.cancelReason).toBe("Plans have changed.");
  });

  it("allows the first eligible provider to accept and rejects later responses", async () => {
    const booking = await createOpenBooking();
    const accepted = await request(context.app)
      .put(`/api/bookings/${booking._id}/accept`)
      .set(context.providerAuth)
      .send({ action: "accept" });
    const raced = await request(context.app)
      .put(`/api/bookings/${booking._id}/accept`)
      .set(context.otherProviderAuth)
      .send({ action: "accept" });

    expect(accepted.status).toBe(200);
    expect(accepted.body.booking.status).toBe("ACCEPTED");
    expect(accepted.body.booking.provider).toBe(providerId);
    expect(raced.status).toBe(403);
  });

  it("validates provider status transitions through completion", async () => {
    const booking = await createOpenBooking();
    await request(context.app)
      .put(`/api/bookings/${booking._id}/accept`)
      .set(context.providerAuth)
      .send({ action: "accept" });
    const enRoute = await request(context.app)
      .put(`/api/bookings/${booking._id}/status`)
      .set(context.providerAuth)
      .send({ status: "EN_ROUTE" });
    const inProgress = await request(context.app)
      .put(`/api/bookings/${booking._id}/status`)
      .set(context.providerAuth)
      .send({ status: "IN_PROGRESS" });
    const completed = await request(context.app)
      .put(`/api/bookings/${booking._id}/status`)
      .set(context.providerAuth)
      .send({ status: "COMPLETED" });

    expect(enRoute.body.booking.status).toBe("EN_ROUTE");
    expect(inProgress.body.booking.status).toBe("IN_PROGRESS");
    expect(completed.body.booking.status).toBe("COMPLETED");
  });
});
