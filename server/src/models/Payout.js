import mongoose from "mongoose";

const payoutSchema = new mongoose.Schema({
  provider: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  amount: { type: Number, required: true, min: 500 },
  status: { type: String, enum: ["requested", "processing", "paid", "rejected"], default: "requested", index: true },
  method: { type: String, enum: ["upi", "bank"], required: true },
  details: {
    upiId: { type: String, trim: true, maxlength: 120 },
    accountHolder: { type: String, trim: true, maxlength: 100 },
    accountNumber: { type: String, trim: true, maxlength: 34 },
    ifsc: { type: String, trim: true, uppercase: true, maxlength: 11 }
  },
  requestedAt: { type: Date, default: Date.now },
  processedAt: { type: Date, default: null }
}, { timestamps: false });

payoutSchema.index({ provider: 1, requestedAt: -1 });

const Payout = mongoose.models.Payout || mongoose.model("Payout", payoutSchema);

export default Payout;
