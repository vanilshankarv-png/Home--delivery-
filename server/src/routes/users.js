import { Router } from "express";
import Joi from "joi";
import { createUserController } from "../controllers/userController.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const addressSchema = Joi.object({
  label: Joi.string().trim().max(40).allow(""),
  line1: Joi.string().trim().min(2).max(160).required(),
  city: Joi.string().trim().min(2).max(80).required(),
  pincode: Joi.string().trim().min(3).max(12).required(),
  location: Joi.object({
    type: Joi.string().valid("Point").required(),
    coordinates: Joi.array().ordered(
      Joi.number().min(-180).max(180).required(),
      Joi.number().min(-90).max(90).required()
    ).length(2).required()
  })
});
const profileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80),
  phone: Joi.string().trim().pattern(/^[+]?[\d\s().-]{7,24}$/),
  avatar: Joi.string().uri({ scheme: ["http", "https"] }).max(2048).allow(""),
  address: Joi.array().items(addressSchema).max(20),
  isAvailable: Joi.boolean()
}).min(1);

export function createUserRoutes(User) {
  const router = Router();
  const controller = createUserController(User);
  router.put("/profile", authenticate, validate(profileSchema), controller.updateProfile);
  return router;
}
