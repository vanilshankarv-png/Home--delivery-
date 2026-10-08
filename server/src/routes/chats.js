import { Router } from "express";
import Joi from "joi";
import Booking from "../models/Booking.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { createChatController } from "../controllers/chatController.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const bookingParamsSchema = Joi.object({
  bookingId: Joi.string().hex().length(24).required()
});
const messageIdParamsSchema = Joi.object({
  id: Joi.string().hex().length(24).required()
});
const messageSchema = Joi.object({
  text: Joi.string().trim().max(4000).allow("").default(""),
  attachments: Joi.array().items(Joi.object({
    url: Joi.string().uri({ scheme: ["http", "https"] }).max(2048).required(),
    name: Joi.string().trim().min(1).max(160).required(),
    type: Joi.string().trim().max(120).allow("").default("")
  })).max(5).default([])
}).custom((value, helpers) => value.text || value.attachments.length
  ? value : helpers.error("any.invalid"));
const listSchema = Joi.object({
  cursor: Joi.string().hex().length(24),
  limit: Joi.number().integer().min(1).max(50).default(30)
});

export function createChatRoutes(models = { Booking, Message, User }) {
  const router = Router();
  const controller = createChatController(models);

  router.use(authenticate);
  router.get("/", controller.conversations);
  router.get(
    "/:bookingId/messages",
    validate(bookingParamsSchema, "params"),
    validate(listSchema, "query"),
    controller.messages
  );
  router.post(
    "/:bookingId/messages",
    validate(bookingParamsSchema, "params"),
    validate(messageSchema),
    controller.send
  );
  router.put(
    "/:bookingId/read",
    validate(bookingParamsSchema, "params"),
    controller.read
  );
  router.delete(
    "/messages/:id",
    validate(messageIdParamsSchema, "params"),
    controller.delete
  );

  return router;
}

export default createChatRoutes();
