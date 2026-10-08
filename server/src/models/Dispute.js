import mongoose from "mongoose";

const responseSchema = new mongoose.Schema({
  by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, required: true, trim: true, maxlength: 2000 },
  evidence: [{ type: String, trim: true }],
  at: { type: Date, default: Date.now }
}, { _id: true });

const resolutionSchema = new mongoose.Schema({
  action: { type: String, enum: ["refund", "partial_refund", "dismiss"], required: true },
  amount: { type: Number, min: 0, default: 0 },
  note: { type: String, trim: true, maxlength: 1000, default: "" }
}, { _id: false });

const disputeSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, unique: true },
  raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  against: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  reason: {
    type: String,
    enum: ["poor_service", "no_show", "overcharge", "damage", "other"],
    required: true
  },
  description: { type: String, required: true, trim: true, maxlength: 3000 },
  evidence: [{ type: String, trim: true }],
  status: {
    type: String,
    enum: ["open", "under_review", "resolved", "dismissed"],
    default: "open",
    index: true
  },
  resolutionClaimId: { type: String, default: null, select: false },
  responses: { type: [responseSchema], default: [] },
  resolution: { type: resolutionSchema, default: null }
}, { timestamps: { createdAt: true, updatedAt: true } });

disputeSchema.index({ raisedBy: 1, createdAt: -1 });
disputeSchema.index({ against: 1, createdAt: -1 });

const Dispute = mongoose.models.Dispute || mongoose.model("Dispute", disputeSchema);

export default Dispute;
