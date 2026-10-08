import "dotenv/config";
import express from "express";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { rateLimit } from "express-rate-limit";
import healthRoutes from "./routes/health.js";
import User from "./models/User.js";
import { createAuthRoutes } from "./routes/auth.js";
import { createUserRoutes } from "./routes/users.js";
import { createCatalogRoutes } from "./routes/catalog.js";
import Provider from "./models/Provider.js";
import Verification from "./models/Verification.js";
import Service from "./models/Service.js";
import { createProviderRoutes } from "./routes/providers.js";
import Booking from "./models/Booking.js";
import { createBookingRoutes } from "./routes/bookings.js";
import PricingQuote from "./models/PricingQuote.js";
import PricingRule from "./models/PricingRule.js";
import { createPricingRoutes } from "./routes/pricing.js";
import Tracking from "./models/Tracking.js";
import { createTrackingRoutes } from "./routes/tracking.js";
import Message from "./models/Message.js";
import { createChatRoutes } from "./routes/chats.js";
import Payment from "./models/Payment.js";
import Payout from "./models/Payout.js";
import { createPaymentRoutes } from "./routes/payments.js";
import { createPayoutRoutes } from "./routes/payouts.js";
import Review from "./models/Review.js";
import Dispute from "./models/Dispute.js";
import { createReviewRoutes } from "./routes/reviews.js";
import { createDisputeRoutes } from "./routes/disputes.js";
import Category from "./models/Category.js";
import { createAdminRoutes } from "./routes/admin.js";
import { errorHandler } from "./middleware/error.js";

export function createApp({ UserModel = User, catalogModels, providerModels, bookingModels, pricingModels, trackingModels, chatModels, paymentModels, payoutModels, reviewModels, disputeModels, adminModels, adminStoreFile } = {}) {
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173"
  }));
  app.use(morgan("dev"));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false
  }));

  app.use("/uploads", express.static(resolve(dirname(fileURLToPath(import.meta.url)), "../uploads")));
  app.use("/api", healthRoutes);
  app.use("/api/auth", createAuthRoutes(UserModel));
  app.use("/api/users", createUserRoutes(UserModel));
  app.use("/api", createCatalogRoutes(catalogModels));
  app.use("/api/providers", createProviderRoutes(
    providerModels || { User: UserModel, Provider, Verification, Service }
  ));
  app.use("/api/bookings", createBookingRoutes(
    bookingModels || { Booking, Service, Provider, User: UserModel, PricingQuote }
  ));
  app.use("/api/pricing", createPricingRoutes(
    pricingModels || { PricingRule, PricingQuote, Service, Provider, User: UserModel, Booking }
  ));
  app.use("/api/tracking", createTrackingRoutes(trackingModels || { Booking, Tracking }));
  app.use("/api/chats", createChatRoutes(chatModels || { Booking, Message, User: UserModel }));
  app.use("/api/payments", createPaymentRoutes(
    paymentModels || { Booking, Payment, Provider, User: UserModel }
  ));
  app.use("/api/payouts", createPayoutRoutes(
    payoutModels || { Provider, Payment, Payout }
  ));
  app.use("/api/reviews", createReviewRoutes(
    reviewModels || { Booking, Review, Provider, Service }
  ));
  app.use("/api/disputes", createDisputeRoutes(
    disputeModels || { Booking, Dispute, Payment, Provider }
  ));
  app.use("/api/admin", createAdminRoutes(
    adminModels || { User: UserModel, Provider, Verification, Booking, Payment, Review, Service, Category, Dispute },
    adminStoreFile
  ));

  app.use((req, res, next) => {
    const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
    error.statusCode = 404;
    next(error);
  });

  app.use(errorHandler);

  return app;
}

export default createApp();
