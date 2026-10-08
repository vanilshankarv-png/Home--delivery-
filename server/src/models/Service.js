import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true, index: true },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  basePrice: { type: Number, required: true, min: 0 },
  unit: { type: String, enum: ["per visit", "per hour"], default: "per visit" },
  durationMins: { type: Number, required: true, min: 15 },
  images: [{ type: String, trim: true }],
  tags: [{ type: String, trim: true, lowercase: true }],
  rating: { type: Number, default: 0, min: 0, max: 5 },
  ratingCount: { type: Number, default: 0, min: 0 },
  bookingsCount: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

serviceSchema.index({ title: "text", tags: "text", description: "text" });

const Service = mongoose.models.Service || mongoose.model("Service", serviceSchema);

export default Service;
