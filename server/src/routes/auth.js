import { Router } from "express";
import Joi from "joi";
import { rateLimit } from "express-rate-limit";
import { createAuthController } from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const email = Joi.string().trim().email({ tlds: { allow: false } }).max(254);
const password = Joi.string().min(8).max(128);
const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  email: email.required(),
  phone: Joi.string().trim().pattern(/^[+]?[\d\s().-]{7,24}$/).required(),
  password: password.required(),
  role: Joi.string().valid("customer", "provider").default("customer")
});
const loginSchema = Joi.object({
  email: email.required(),
  password: Joi.string().min(1).max(128).required()
});
const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().min(1).max(128).required(),
  newPassword: password.required()
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many authentication attempts. Please try again in 15 minutes." }
});

export function createAuthRoutes(User) {
  const router = Router();
  const controller = createAuthController(User);

  router.post("/register", authLimiter, validate(registerSchema), controller.register);
  router.post("/login", authLimiter, validate(loginSchema), controller.login);
  router.get("/me", authenticate, controller.me);
  router.put("/change-password", authenticate, validate(changePasswordSchema), controller.changePassword);

  return router;
}
