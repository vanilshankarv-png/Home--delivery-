import { Router } from "express";
import Joi from "joi";
import Booking from "../models/Booking.js";
import Provider from "../models/Provider.js";
import Service from "../models/Service.js";
import User from "../models/User.js";
import PricingQuote from "../models/PricingQuote.js";
import { createBookingController } from "../controllers/bookingController.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const addressSchema = Joi.object({
  label: Joi.string().trim().max(40).allow("").default(""),
  line1: Joi.string().trim().min(2).max(160).required(),
  city: Joi.string().trim().min(2).max(80).required(),
  pincode: Joi.string().trim().min(3).max(12).required(),
  location: Joi.object({
    type: Joi.string().valid("Point").default("Point"),
    coordinates: Joi.array().ordered(
      Joi.number().min(-180).max(180).required(),
      Joi.number().min(-90).max(90).required()
    ).length(2).required()
  }).required()
});

const createSchema = Joi.object({
  service: Joi.string().hex().length(24).required(),
  provider: Joi.string().hex().length(24),
  address: Joi.alternatives().try(
    Joi.number().integer().min(0).max(19),
    addressSchema
  ).required(),
  scheduledAt: Joi.date().iso().required(),
  notes: Joi.string().trim().max(1000).allow("").default(""),
  quoteId: Joi.string().hex().length(24).required()
});
const rescheduleSchema = Joi.object({
  scheduledAt: Joi.date().iso().required()
});
const cancelSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(500).required()
});
const acceptSchema = Joi.object({
  action: Joi.string().valid("accept", "reject").required()
});
const statusSchema = Joi.object({
  status: Joi.string().valid("EN_ROUTE", "IN_PROGRESS", "COMPLETED").required()
});

export function createBookingRoutes(models = { Booking, Service, Provider, User, PricingQuote }) {
  const router = Router();
  const controller = createBookingController(models);

  router.use(authenticate);
  router.post("/", validate(createSchema), controller.create);
  router.get("/", controller.list);
  router.get("/:id", controller.detail);
  router.put("/:id/reschedule", validate(rescheduleSchema), controller.reschedule);
  router.put("/:id/cancel", validate(cancelSchema), controller.cancel);
  router.put("/:id/accept", validate(acceptSchema), controller.accept);
  router.put("/:id/status", validate(statusSchema), controller.updateStatus);

  return router;
}

export default createBookingRoutes();
