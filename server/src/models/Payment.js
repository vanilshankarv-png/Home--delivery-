import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  provider: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  platformFee: { type: Number, required: true, min: 0, default: 0 },
  currency: { type: String, required: true, uppercase: true, default: "INR" },
  razorpayOrderId: { type: String, required: true, unique: true, index: true },
  razorpayPaymentId: { type: String, default: null, index: true },
  signature: { type: String, default: null, select: false },
  status: { type: String, enum: ["created", "paid", "failed", "refunded"], default: "created", index: true },
  refundId: { type: String, default: null },
  refundAmount: { type: Number, min: 0, default: 0 },
  invoiceNo: { type: String, required: true, unique: true },
  isMock: { type: Boolean, default: false },
  payoutHeld: { type: Boolean, default: false, index: true },
  payoutHoldDispute: { type: mongoose.Schema.Types.ObjectId, ref: "Dispute", default: null }
}, { timestamps: { createdAt: true, updatedAt: true } });

paymentSchema.index({ customer: 1, createdAt: -1 });
paymentSchema.index({ provider: 1, status: 1, createdAt: -1 });

const Payment = mongoose.models.Payment || mongoose.model("Payment", paymentSchema);

export default Payment;
