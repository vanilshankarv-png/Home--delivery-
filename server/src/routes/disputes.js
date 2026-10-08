import { Router } from "express";
import Joi from "joi";
import Booking from "../models/Booking.js";
import Dispute from "../models/Dispute.js";
import Payment from "../models/Payment.js";
import Provider from "../models/Provider.js";
import { createDisputeController } from "../controllers/disputeController.js";
import { authenticate } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { validate } from "../middleware/validate.js";
import { storeUploadedFile } from "../services/fileStorageService.js";

const createSchema = Joi.object({
  bookingId: Joi.string().hex().length(24).required(),
  reason: Joi.string().valid("poor_service", "no_show", "overcharge", "damage", "other").required(),
  description: Joi.string().trim().min(10).max(3000).required()
});
const respondSchema = Joi.object({
  text: Joi.string().trim().min(1).max(2000).required()
});
const idParams = Joi.object({ id: Joi.string().hex().length(24).required() });

export function createDisputeRoutes(
  models = { Booking, Dispute, Payment, Provider },
  storeFile = storeUploadedFile
) {
  const router = Router();
  const controller = createDisputeController(models, storeFile);

  router.use(authenticate);
  router.post("/", upload.array("evidence", 5), validate(createSchema), controller.create);
  router.get("/mine", controller.mine);
  router.put("/:id/respond", validate(idParams, "params"), upload.array("evidence", 5), validate(respondSchema), controller.respond);
  return router;
}

export default createDisputeRoutes();
