const MAX_PAGE_SIZE = 50;
const MAX_DISTANCE_METERS = 15_000;

function parsePositiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function parseCoordinate(value, minimum, maximum) {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) return null;
  return parsed;
}

async function serviceFilter(query, Category) {
  const filter = { isActive: true };
  if (query.category) {
    if (/^[\da-f]{24}$/i.test(query.category)) {
      filter.category = query.category;
    } else {
      const category = await Category.findOne({ slug: query.category }).select("_id").lean();
      filter.category = category?._id || null;
    }
  }

  const price = {};
  if (query.minPrice !== undefined) price.$gte = Number(query.minPrice);
  if (query.maxPrice !== undefined) price.$lte = Number(query.maxPrice);
  if (Object.keys(price).length) filter.basePrice = price;
  return filter;
}

function serviceSort(sort) {
  if (sort === "price") return { basePrice: 1, title: 1 };
  if (sort === "rating") return { rating: -1, bookingsCount: -1 };
  return { bookingsCount: -1, rating: -1 };
}

function invalidQuery(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

export function createCatalogController({ Category, Service, Provider }) {
  return {
    categories: async (req, res, next) => {
      try {
        const categories = await Category.find().sort({ name: 1 }).lean();
        return res.json({ success: true, categories });
      } catch (error) {
        return next(error);
      }
    },

    listServices: async (req, res, next) => {
      try {
        if (req.query.sort && !["price", "rating", "popular"].includes(req.query.sort)) {
          throw invalidQuery("sort must be price, rating, or popular.");
        }
        const minPrice = req.query.minPrice === undefined ? undefined : Number(req.query.minPrice);
        const maxPrice = req.query.maxPrice === undefined ? undefined : Number(req.query.maxPrice);
        if ((minPrice !== undefined && (!Number.isFinite(minPrice) || minPrice < 0))
          || (maxPrice !== undefined && (!Number.isFinite(maxPrice) || maxPrice < 0))) {
          throw invalidQuery("Price filters must be non-negative numbers.");
        }
        if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
          throw invalidQuery("minPrice cannot be greater than maxPrice.");
        }

        const page = parsePositiveInteger(req.query.page, 1, Number.MAX_SAFE_INTEGER);
        const limit = parsePositiveInteger(req.query.limit, 12, MAX_PAGE_SIZE);
        const filter = await serviceFilter(req.query, Category);
        const [services, total] = await Promise.all([
          Service.find(filter)
            .populate("category", "name slug icon")
            .sort(serviceSort(req.query.sort))
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
          Service.countDocuments(filter)
        ]);

        return res.json({
          success: true,
          services,
          pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
      } catch (error) {
        return next(error);
      }
    },

    searchServices: async (req, res, next) => {
      try {
        if (req.query.lat !== undefined && parseCoordinate(req.query.lat, -90, 90) === null) {
          throw invalidQuery("lat must be between -90 and 90.");
        }
        if (req.query.lng !== undefined && parseCoordinate(req.query.lng, -180, 180) === null) {
          throw invalidQuery("lng must be between -180 and 180.");
        }
        if ((req.query.lat === undefined) !== (req.query.lng === undefined)) {
          throw invalidQuery("Provide both lat and lng coordinates.");
        }

        const filter = { ...await serviceFilter(req.query, Category) };
        const longitude = parseCoordinate(req.query.lng, -180, 180);
        const latitude = parseCoordinate(req.query.lat, -90, 90);
        if (longitude !== undefined && latitude !== undefined) {
          const providerSkills = await Provider.aggregate([
            {
              $geoNear: {
                near: { type: "Point", coordinates: [longitude, latitude] },
                key: "currentLocation",
                distanceField: "distanceMeters",
                maxDistance: MAX_DISTANCE_METERS,
                spherical: true,
                query: { verificationStatus: "verified" }
              }
            },
            { $limit: 500 },
            {
              $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "user"
              }
            },
            { $unwind: "$user" },
            { $match: { "user.isAvailable": true, "user.isBlocked": { $ne: true } } },
            { $unwind: "$skills" },
            { $group: { _id: "$skills.service" } }
          ]);
          filter._id = { $in: providerSkills.map(({ _id }) => _id) };
        }
        if (req.query.sort && !["price", "rating", "popular"].includes(req.query.sort)) {
          throw invalidQuery("sort must be price, rating, or popular.");
        }
        const minPrice = req.query.minPrice === undefined ? undefined : Number(req.query.minPrice);
        const maxPrice = req.query.maxPrice === undefined ? undefined : Number(req.query.maxPrice);
        if ((minPrice !== undefined && (!Number.isFinite(minPrice) || minPrice < 0))
          || (maxPrice !== undefined && (!Number.isFinite(maxPrice) || maxPrice < 0))) {
          throw invalidQuery("Price filters must be non-negative numbers.");
        }
        if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
          throw invalidQuery("minPrice cannot be greater than maxPrice.");
        }
        if (minPrice !== undefined || maxPrice !== undefined) {
          filter.basePrice = {};
          if (minPrice !== undefined) filter.basePrice.$gte = minPrice;
          if (maxPrice !== undefined) filter.basePrice.$lte = maxPrice;
        }
        const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
        if (q) filter.$text = { $search: q };
        const page = parsePositiveInteger(req.query.page, 1, Number.MAX_SAFE_INTEGER);
        const limit = parsePositiveInteger(req.query.limit, 30, MAX_PAGE_SIZE);
        const services = await Service.find(filter)
          .populate("category", "name slug icon")
          .sort(req.query.sort
            ? serviceSort(req.query.sort)
            : q ? { score: { $meta: "textScore" } } : serviceSort("popular"))
          .skip((page - 1) * limit)
          .limit(limit)
          .lean();
        const total = await Service.countDocuments(filter);

        return res.json({
          success: true,
          services,
          pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
      } catch (error) {
        return next(error);
      }
    },

    popularServices: async (req, res, next) => {
      try {
        const services = await Service.find({ isActive: true })
          .populate("category", "name slug icon")
          .sort({ bookingsCount: -1, rating: -1 })
          .limit(10)
          .lean();
        return res.json({ success: true, services });
      } catch (error) {
        return next(error);
      }
    },

    serviceDetail: async (req, res, next) => {
      try {
        const service = await Service.findOne({ _id: req.params.id, isActive: true })
          .populate("category", "name slug icon description")
          .lean();
        if (!service) {
          return res.status(404).json({ success: false, message: "Service not found." });
        }
        return res.json({ success: true, service });
      } catch (error) {
        return next(error);
      }
    },

    nearbyProviders: async (req, res, next) => {
      try {
        const longitude = parseCoordinate(req.query.lng, -180, 180);
        const latitude = parseCoordinate(req.query.lat, -90, 90);
        if (longitude === undefined || latitude === undefined) {
          throw invalidQuery("Provide lat and lng to find nearby providers.");
        }
        if (longitude === null || latitude === null) {
          throw invalidQuery("Provider search coordinates are invalid.");
        }

        const serviceExists = await Service.exists({ _id: req.params.id, isActive: true });
        if (!serviceExists) {
          return res.status(404).json({ success: false, message: "Service not found." });
        }

        const providers = await Provider.aggregate([
          {
            $geoNear: {
              near: { type: "Point", coordinates: [longitude, latitude] },
              key: "currentLocation",
              distanceField: "distanceMeters",
              maxDistance: MAX_DISTANCE_METERS,
              spherical: true,
              query: {
                verificationStatus: "verified",
                "skills.service": serviceExists._id
              }
            }
          },
          {
            $lookup: {
              from: "users",
              localField: "user",
              foreignField: "_id",
              as: "user"
            }
          },
          { $unwind: "$user" },
          { $match: { "user.isAvailable": true, "user.isBlocked": { $ne: true } } },
          {
            $project: {
              _id: 1,
              ratingAvg: 1,
              ratingCount: 1,
              badges: 1,
              isAvailable: "$user.isAvailable",
              distanceKm: { $divide: ["$distanceMeters", 1000] },
              user: { _id: "$user._id", name: "$user.name", avatar: "$user.avatar" }
            }
          },
          { $limit: 30 }
        ]);

        return res.json({ success: true, providers });
      } catch (error) {
        return next(error);
      }
    }
  };
}
