import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({
  label: { type: String, trim: true, maxlength: 40 },
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

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  phone: { type: String, required: true, trim: true, maxlength: 24 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["customer", "provider", "admin"], default: "customer", required: true },
  avatar: { type: String, trim: true, maxlength: 2048 },
  address: { type: [addressSchema], default: [] },
  isAvailable: { type: Boolean, default: false },
  isBlocked: { type: Boolean, default: false }
}, { timestamps: { createdAt: true, updatedAt: true } });

userSchema.index({ "address.location": "2dsphere" });

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
