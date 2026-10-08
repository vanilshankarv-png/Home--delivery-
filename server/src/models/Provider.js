import mongoose from "mongoose";
import { calculateProviderBadges } from "../services/badgeService.js";

const skillSchema = new mongoose.Schema({
  service: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
  level: { type: String, enum: ["Bronze", "Silver", "Gold"], default: "Bronze" },
  yearsExperience: { type: Number, min: 0, default: 0 }
}, { _id: false });

const badgeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  level: { type: String, enum: ["Bronze", "Silver", "Gold", "Verified"] }
}, { _id: false });

const bookingSlotSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
  start: { type: Date, required: true },
  end: { type: Date, required: true }
}, { _id: false });

const providerSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  skills: { type: [skillSchema], default: [] },
  badges: { type: [badgeSchema], default: [] },
  verificationStatus: { type: String, enum: ["none", "pending", "verified", "rejected"], default: "none", index: true },
  ratingAvg: { type: Number, min: 0, max: 5, default: 0 },
  ratingCount: { type: Number, min: 0, default: 0 },
  jobsDone: { type: Number, min: 0, default: 0 },
  walletHeldBalance: { type: Number, min: 0, default: 0 },
  currentLocation: {
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
        message: "Current location coordinates must be [longitude, latitude]."
      }
    }
  },
  serviceRadiusKm: { type: Number, min: 1, max: 100, default: 15 },
  walletBalance: { type: Number, min: 0, default: 0 },
  bookingSlots: { type: [bookingSlotSchema], default: [] }
}, { timestamps: true });

providerSchema.pre("save", function updateBadgesBeforeSave() {
  if (this.isNew || this.isModified("verificationStatus") || this.isModified("skills")
    || this.isModified("ratingAvg") || this.isModified("jobsDone")) {
    this.badges = calculateProviderBadges(this);
  }
});

providerSchema.pre(["findOneAndUpdate", "updateOne"], async function updateBadgesForQuery() {
  const update = this.getUpdate();
  if (!update || Array.isArray(update)) return;

  const operators = ["$set", "$inc", "$unset"];
  const updatedFields = { ...update };
  for (const operator of operators) Object.assign(updatedFields, update[operator] || {});
  const badgeInputPaths = Object.keys(updatedFields).filter((path) => (
    path === "verificationStatus" || path.startsWith("verificationStatus.")
    || path === "skills" || path.startsWith("skills.")
    || path === "ratingAvg" || path.startsWith("ratingAvg.")
    || path === "jobsDone" || path.startsWith("jobsDone.")
  ));
  if (!badgeInputPaths.length) return;

  const current = await this.model.findOne(this.getQuery()).lean();
  if (!current) return;

  const nextProvider = { ...current, ...(update.$set || {}) };
  for (const [path, amount] of Object.entries(update.$inc || {})) {
    if (["ratingAvg", "jobsDone"].includes(path)) {
      nextProvider[path] = Number(nextProvider[path] || 0) + Number(amount);
    }
  }
  for (const path of Object.keys(update.$unset || {})) {
    if (["verificationStatus", "skills", "ratingAvg", "jobsDone"].includes(path)) delete nextProvider[path];
  }
  Object.assign(nextProvider, Object.fromEntries(
    Object.entries(update).filter(([path]) => !path.startsWith("$"))
  ));

  const directFields = Object.fromEntries(Object.entries(update).filter(([path]) => !path.startsWith("$")));
  const nextUpdate = {
    ...update,
    $set: { ...directFields, ...(update.$set || {}), badges: calculateProviderBadges(nextProvider) }
  };
  for (const path of Object.keys(directFields)) delete nextUpdate[path];
  this.setUpdate(nextUpdate);
});

providerSchema.index({ currentLocation: "2dsphere" });
providerSchema.index({ "skills.service": 1, verificationStatus: 1 });

const Provider = mongoose.models.Provider || mongoose.model("Provider", providerSchema);

export default Provider;
