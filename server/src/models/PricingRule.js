import mongoose from "mongoose";

const pricingRuleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  type: { type: String, enum: ["demand", "distance", "time", "fee"], required: true, index: true },
  config: { type: mongoose.Schema.Types.Mixed, required: true, default: {} },
  isActive: { type: Boolean, default: true, index: true }
}, { timestamps: true });

const PricingRule = mongoose.models.PricingRule || mongoose.model("PricingRule", pricingRuleSchema);

export default PricingRule;
