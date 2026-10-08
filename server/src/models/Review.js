import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, unique: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  provider: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  service: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true, index: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true, maxlength: 2000, default: "" },
  tags: [{ type: String, trim: true, maxlength: 40 }]
}, { timestamps: { createdAt: true, updatedAt: false } });

reviewSchema.index({ provider: 1, createdAt: -1 });
reviewSchema.index({ service: 1, createdAt: -1 });

const Review = mongoose.models.Review || mongoose.model("Review", reviewSchema);

export default Review;
