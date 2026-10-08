import { Router } from "express";
import Joi from "joi";
import Booking from "../models/Booking.js";
import Tracking from "../models/Tracking.js";
import { createTrackingController } from "../controllers/trackingController.js";
import { authenticate } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/role.js";
import { validate } from "../middleware/validate.js";

const bookingParamsSchema = Joi.object({
  bookingId: Joi.string().hex().length(24).required()
});
const locationSchema = Joi.object({
  bookingId: Joi.string().hex().length(24).required(),
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
  heading: Joi.number().min(0).max(360).allow(null)
});

export function createTrackingRoutes(models = { Booking, Tracking }) {
  const router = Router();
  const controller = createTrackingController(models);

  router.use(authenticate);
  router.post(
    "/:bookingId/start",
    authorizeRoles("provider"),
    validate(bookingParamsSchema, "params"),
    controller.start
  );
  router.put(
    "/location",
    authorizeRoles("provider"),
    validate(locationSchema),
    controller.updateLocation
  );
  router.get("/:bookingId/eta", validate(bookingParamsSchema, "params"), controller.eta);
  router.get("/:bookingId/history", validate(bookingParamsSchema, "params"), controller.history);
  router.post("/:bookingId/stop", authorizeRoles("provider"), validate(bookingParamsSchema, "params"), controller.stop);
  router.get("/:bookingId", validate(bookingParamsSchema, "params"), controller.latest);

  return router;
}

export default createTrackingRoutes();
