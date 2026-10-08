import { Router } from "express";
import Joi from "joi";
import Booking from "../models/Booking.js";
import Payment from "../models/Payment.js";
import Provider from "../models/Provider.js";
import User from "../models/User.js";
import { createPaymentController } from "../controllers/paymentController.js";
import { authenticate } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/role.js";
import { validate } from "../middleware/validate.js";

const createOrderSchema = Joi.object({
  bookingId: Joi.string().hex().length(24).required()
});
const verifySchema = Joi.object({
  razorpay_order_id: Joi.string().trim().min(1).max(160).required(),
  razorpay_payment_id: Joi.string().trim().max(160).allow(""),
  razorpay_signature: Joi.string().trim().max(512).allow(""),
  status: Joi.string().valid("failed")
});
const idSchema = Joi.object({ id: Joi.string().hex().length(24).required() });

export function createPaymentRoutes(models = { Booking, Payment, Provider, User }) {
  const router = Router();
  const controller = createPaymentController(models);

  router.use(authenticate);
  router.post("/create-order", validate(createOrderSchema), controller.createOrder);
  router.post("/verify", validate(verifySchema), controller.verify);
  router.get("/history", controller.history);
  router.get("/:id", validate(idSchema, "params"), controller.detail);
  router.post(
    "/:id/refund",
    validate(idSchema, "params"),
    authorizeRoles("admin", "customer"),
    controller.refund
  );
  return router;
}

export default createPaymentRoutes();
