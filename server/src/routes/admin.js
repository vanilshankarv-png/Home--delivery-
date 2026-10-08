import { Router } from "express";
import Joi from "joi";
import Booking from "../models/Booking.js";
import Category from "../models/Category.js";
import Dispute from "../models/Dispute.js";
import Payment from "../models/Payment.js";
import Provider from "../models/Provider.js";
import Review from "../models/Review.js";
import Service from "../models/Service.js";
import User from "../models/User.js";
import Verification from "../models/Verification.js";
import { createAdminController } from "../controllers/adminController.js";
import { authenticate } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/role.js";
import { upload } from "../middleware/upload.js";
import { validate } from "../middleware/validate.js";

const usersQuery = Joi.object({
  search: Joi.string().trim().max(120).allow(""),
  role: Joi.string().valid("customer", "provider", "admin"),
  status: Joi.string().valid("active", "blocked"),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});
const userIdParams = Joi.object({ id: Joi.string().hex().length(24).required() });
const userStatusBody = Joi.object({ isBlocked: Joi.boolean().required() });
const disputeParams = Joi.object({ id: Joi.string().hex().length(24).required() });
const resolutionBody = Joi.object({
  action: Joi.string().valid("refund", "partial_refund", "dismiss").required(),
  amount: Joi.number().positive().precision(2),
  note: Joi.string().trim().max(1000).allow("").default("")
}).when(Joi.object({ action: Joi.valid("partial_refund").required() }).unknown(), {
  then: Joi.object({ amount: Joi.number().positive().precision(2).required() })
});

export function createAdminRoutes(
  models = { User, Provider, Verification, Booking, Payment, Review, Service, Category, Dispute },
  storeFile
) {
  const router = Router();
  const controller = createAdminController(models, storeFile);
  router.use(authenticate, authorizeRoles("admin"));
  router.get("/dashboard", controller.dashboard);
  router.get("/users", validate(usersQuery, "query"), controller.users);
  router.put("/users/:id/status", validate(userIdParams, "params"), validate(userStatusBody), controller.updateUserStatus);
  router.post("/services", upload.array("images", 5), controller.saveCatalogItem);
  router.put("/disputes/:id/resolve", validate(disputeParams, "params"), validate(resolutionBody), controller.resolveDispute);
  return router;
}

export default createAdminRoutes();
