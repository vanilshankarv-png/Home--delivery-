import mongoose from "mongoose";

const addressSnapshotSchema = new mongoose.Schema({
  label: { type: String, trim: true, maxlength: 40, default: "" },
  line1: { type: String, required: true, trim: true, maxlength: 160 },
  city: { type: String, required: true, trim: true, maxlength: 80 },
  pincode: { type: String, required: true, trim: true, maxlength: 12 },
  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point"
    },
    coordinates: {
      type: [Number],
      validate: {
        validator: (coordinates) => coordinates.length === 2
          && coordinates[0] >= -180 && coordinates[0] <= 180
          && coordinates[1] >= -90 && coordinates[1] <= 90,
        message: "Location coordinates must be [longitude, latitude]."
      }
    }
  }
}, { _id: false });

const priceSnapshotSchema = new mongoose.Schema({
  base: { type: Number, required: true, min: 0 },
  demandMultiplier: { type: Number, default: 1, min: 0 },
  distanceFactor: { type: Number, default: 1, min: 0 },
  timeFactor: { type: Number, default: 1, min: 0 },
  platformFee: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 }
}, { _id: false });

const timelineEntrySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ["PENDING", "ACCEPTED", "REJECTED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED", "CANCELLED", "PAID", "DISPUTED"],
    required: true
  },
  at: { type: Date, default: Date.now },
  by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { _id: false });

const bookingSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  provider: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  service: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
  address: { type: addressSnapshotSchema, required: true },
  scheduledAt: { type: Date, required: true, index: true },
  slotEndAt: { type: Date, required: true },
  notes: { type: String, trim: true, maxlength: 1000, default: "" },
  status: {
    type: String,
    enum: ["PENDING", "ACCEPTED", "REJECTED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED", "CANCELLED", "PAID", "DISPUTED"],
    default: "PENDING",
    index: true
  },
  priceSnapshot: { type: priceSnapshotSchema, required: true },
  paymentStatus: { type: String, enum: ["UNPAID", "PENDING", "PAID", "REFUNDED"], default: "UNPAID" },
  timeline: { type: [timelineEntrySchema], default: [] },
  cancelReason: { type: String, trim: true, maxlength: 500, default: "" }
}, { timestamps: true });

bookingSchema.index({ "address.location": "2dsphere" });
bookingSchema.index({ provider: 1, scheduledAt: 1, slotEndAt: 1 });
bookingSchema.index({ customer: 1, createdAt: -1 });

const Booking = mongoose.models.Booking || mongoose.model("Booking", bookingSchema);

export default Booking;
