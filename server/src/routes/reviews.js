import { Router } from "express";
import Joi from "joi";
import Booking from "../models/Booking.js";
import Review from "../models/Review.js";
import Provider from "../models/Provider.js";
import Service from "../models/Service.js";
import { createReviewController } from "../controllers/reviewController.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const createSchema = Joi.object({
  bookingId: Joi.string().hex().length(24).required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().trim().max(2000).allow("").default(""),
  tags: Joi.array().items(Joi.string().trim().min(1).max(40)).max(8).unique().default([])
});
const providerParams = Joi.object({ id: Joi.string().hex().length(24).required() });
const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10)
});

export function createReviewRoutes(models = { Booking, Review, Provider, Service }) {
  const router = Router();
  const controller = createReviewController(models);

  router.get("/provider/:id", validate(providerParams, "params"), validate(querySchema, "query"), controller.providerReviews);
  router.post("/", authenticate, validate(createSchema), controller.create);
  return router;
}

export default createReviewRoutes();
