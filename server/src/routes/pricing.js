import { Router } from "express";
import Joi from "joi";
import Booking from "../models/Booking.js";
import PricingQuote from "../models/PricingQuote.js";
import PricingRule from "../models/PricingRule.js";
import Provider from "../models/Provider.js";
import Service from "../models/Service.js";
import User from "../models/User.js";
import { createPricingController } from "../controllers/pricingController.js";
import { authenticate } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/role.js";
import { validate } from "../middleware/validate.js";

const quoteSchema = Joi.object({
  serviceId: Joi.string().hex().length(24).required(),
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
  scheduledAt: Joi.date().iso().required()
});
const coordinatesSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required()
});
const updateRuleSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  config: Joi.object().unknown(true).required(),
  isActive: Joi.boolean()
}).min(1);

export function createPricingRoutes(models = { PricingRule, PricingQuote, Service, Provider, User, Booking }) {
  const router = Router();
  const controller = createPricingController(models);

  router.get("/surge", validate(coordinatesSchema, "query"), controller.surge);
  router.post("/quote", authenticate, validate(quoteSchema), controller.quote);
  router.get("/rules", authenticate, authorizeRoles("admin"), controller.rules);
  router.put("/rules/:id", authenticate, authorizeRoles("admin"), validate(updateRuleSchema), controller.updateRule);
  router.get(
    "/history/:bookingId",
    authenticate,
    validate(Joi.object({ bookingId: Joi.string().hex().length(24).required() }), "params"),
    controller.history
  );

  return router;
}

export default createPricingRoutes();
