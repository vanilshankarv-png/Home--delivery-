import { Router } from "express";
import Joi from "joi";
import Payment from "../models/Payment.js";
import Payout from "../models/Payout.js";
import Provider from "../models/Provider.js";
import { createPayoutController } from "../controllers/payoutController.js";
import { authenticate } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/role.js";
import { validate } from "../middleware/validate.js";

const requestSchema = Joi.object({
  amount: Joi.number().precision(2).min(500).required(),
  method: Joi.string().valid("upi", "bank").required(),
  details: Joi.alternatives().conditional("method", {
    is: "upi",
    then: Joi.object({
      upiId: Joi.string().trim().pattern(/^[\w.-]+@[\w.-]+$/).max(120).required()
    }).required(),
    otherwise: Joi.object({
      accountHolder: Joi.string().trim().min(2).max(100).required(),
      accountNumber: Joi.string().trim().pattern(/^[A-Za-z0-9-]{6,34}$/).required(),
      ifsc: Joi.string().trim().uppercase().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/).required()
    }).required()
  })
});

export function createPayoutRoutes(models = { Provider, Payment, Payout }) {
  const router = Router();
  const controller = createPayoutController(models);

  router.use(authenticate, authorizeRoles("provider"));
  router.get("/", controller.list);
  router.post("/request", validate(requestSchema), controller.request);

  return router;
}

export default createPayoutRoutes();
