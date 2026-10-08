import mongoose from "mongoose";

const trackingPointSchema = new mongoose.Schema({
  lat: { type: Number, required: true, min: -90, max: 90 },
  lng: { type: Number, required: true, min: -180, max: 180 },
  heading: { type: Number, min: 0, max: 360, default: null },
  at: { type: Date, default: Date.now }
}, { _id: false });

const trackingSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, unique: true, index: true },
  provider: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  isActive: { type: Boolean, default: true, index: true },
  points: { type: [trackingPointSchema], default: [] },
  lastLocation: { type: mongoose.Schema.Types.Mixed, default: null },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date, default: null }
}, { timestamps: true });

const Tracking = mongoose.models.Tracking || mongoose.model("Tracking", trackingSchema);

export default Tracking;
