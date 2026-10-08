import { createPricingService } from "../services/pricingService.js";
import Joi from "joi";

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function idOf(value) {
  return String(value?._id || value);
}

export function createPricingController({ PricingRule, PricingQuote, Service, Provider, User, Booking }) {
  const pricing = createPricingService({ PricingRule, Provider, User, Booking, Service });
  const configSchemas = {
    demand: Joi.object({
      baseMultiplier: Joi.number().positive().required(),
      referenceRatio: Joi.number().min(0).required(),
      sensitivity: Joi.number().min(0).required(),
      neutralMultiplier: Joi.number().positive().required(),
      minimumMultiplier: Joi.number().positive().required(),
      maximumMultiplier: Joi.number().positive().required(),
      radiusKm: Joi.number().positive().required(),
      lookbackMinutes: Joi.number().positive().required(),
      areaGridDegrees: Joi.number().positive().required()
    }).custom((config, helpers) => config.minimumMultiplier <= config.maximumMultiplier
      ? config : helpers.error("any.invalid")),
    distance: Joi.object({
      baseFactor: Joi.number().positive().required(),
      neutralFactor: Joi.number().positive().required(),
      includedKm: Joi.number().min(0).required(),
      perKm: Joi.number().min(0).required(),
      minimumExcessKm: Joi.number().min(0).required()
    }),
    time: Joi.object({
      normalMultiplier: Joi.number().positive().required(),
      neutralMultiplier: Joi.number().positive().required(),
      nightStartHour: Joi.number().integer().min(0).max(23).required(),
      nightEndHour: Joi.number().integer().min(0).max(23).required(),
      nightMultiplier: Joi.number().positive().required(),
      eveningStartHour: Joi.number().integer().min(0).max(23).required(),
      eveningEndHour: Joi.number().integer().min(0).max(23).required(),
      eveningMultiplier: Joi.number().positive().required(),
      timeZone: Joi.string().min(1).required()
    }),
    fee: Joi.object({
      percent: Joi.number().min(0).max(100).required(),
      neutralPercent: Joi.number().min(0).max(100).required()
    })
  };

  return {
    quote: async (req, res, next) => {
      try {
        if (req.user.role !== "customer") throw httpError("Only customers can request pricing quotes.", 403);
        const service = await Service.findOne({ _id: req.body.serviceId, isActive: true }).lean();
        if (!service) throw httpError("Service not found.", 404);
        const scheduledAt = new Date(req.body.scheduledAt);
        if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt <= new Date()) {
          throw httpError("Choose a service time in the future.", 400);
        }
        const { breakdown } = await pricing.quote({
          basePrice: service.basePrice,
          service,
          lat: req.body.lat,
          lng: req.body.lng,
          scheduledAt
        });
        const expiresAt = new Date(Date.now() + 10 * 60_000);
        const snapshot = {
          base: breakdown.base,
          demandMultiplier: breakdown.demandMultiplier,
          distanceFactor: breakdown.distanceFactor,
          timeFactor: breakdown.timeFactor,
          platformFee: breakdown.platformFee,
          total: breakdown.total
        };
        const quote = await PricingQuote.create({
          customer: req.user.id,
          service: service._id,
          location: { type: "Point", coordinates: [req.body.lng, req.body.lat] },
          scheduledAt,
          priceSnapshot: snapshot,
          breakdown,
          expiresAt
        });
        return res.status(200).json({
          success: true,
          quoteId: String(quote._id),
          expiresAt,
          breakdown
        });
      } catch (error) {
        return next(error);
      }
    },

    surge: async (req, res, next) => {
      try {
        const multiplier = await pricing.surge({ lat: Number(req.query.lat), lng: Number(req.query.lng) });
        return res.json({ success: true, multiplier });
      } catch (error) {
        return next(error);
      }
    },

    rules: async (req, res, next) => {
      try {
        const rules = await PricingRule.find({}).sort({ type: 1 }).lean();
        return res.json({ success: true, rules });
      } catch (error) {
        return next(error);
      }
    },

    updateRule: async (req, res, next) => {
      try {
        const existing = await PricingRule.findById(req.params.id).lean();
        if (!existing) throw httpError("Pricing rule not found.", 404);
        const { error: configError, value: config } = configSchemas[existing.type].validate(req.body.config, {
          abortEarly: false,
          stripUnknown: true
        });
        if (configError) {
          throw httpError(configError.details.map((detail) => detail.message).join(", "), 400);
        }
        if (existing.type === "time") {
          try {
            new Intl.DateTimeFormat("en-GB", { timeZone: config.timeZone });
          } catch {
            throw httpError("The time zone is invalid.", 400);
          }
        }
        const rule = await PricingRule.findByIdAndUpdate(
          req.params.id,
          { $set: { ...req.body, config } },
          { new: true, runValidators: true }
        ).lean();
        if (!rule) throw httpError("Pricing rule not found.", 404);
        return res.json({ success: true, rule });
      } catch (error) {
        return next(error);
      }
    },

    history: async (req, res, next) => {
      try {
        const booking = await Booking.findById(req.params.bookingId).lean();
        if (!booking) throw httpError("Booking not found.", 404);
        if (req.user.role !== "admin"
          && idOf(booking.customer) !== req.user.id
          && idOf(booking.provider) !== req.user.id) {
          throw httpError("You are not allowed to view this booking's pricing.", 403);
        }
        return res.json({ success: true, priceSnapshot: booking.priceSnapshot });
      } catch (error) {
        return next(error);
      }
    }
  };
}
