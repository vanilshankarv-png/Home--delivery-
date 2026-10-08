import mongoose from "mongoose";

const pricingQuoteSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  service: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
  location: {
    type: { type: String, enum: ["Point"], default: "Point", required: true },
    coordinates: { type: [Number], required: true }
  },
  scheduledAt: { type: Date, required: true },
  priceSnapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  breakdown: { type: mongoose.Schema.Types.Mixed, required: true },
  consumedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
}, { timestamps: true });

const PricingQuote = mongoose.models.PricingQuote || mongoose.model("PricingQuote", pricingQuoteSchema);

export default PricingQuote;
