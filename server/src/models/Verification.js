import mongoose from "mongoose";

const verificationSkillSchema = new mongoose.Schema({
  service: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
  certificateUrl: { type: String, required: true },
  yearsExperience: { type: Number, min: 0, max: 60, required: true }
}, { _id: false });

const verificationSchema = new mongoose.Schema({
  provider: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  idProofUrl: { type: String, required: true },
  addressProofUrl: { type: String, required: true },
  skills: { type: [verificationSkillSchema], default: [] },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
  adminNote: { type: String, trim: true, maxlength: 1000, default: "" },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  reviewedAt: { type: Date }
}, { timestamps: true });

const Verification = mongoose.models.Verification || mongoose.model("Verification", verificationSchema);

export default Verification;
