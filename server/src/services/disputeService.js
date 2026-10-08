import { providerNetAmount } from "./payoutService.js";

export async function holdBookingPayout({ Payment, Provider, bookingId, providerId, disputeId }) {
  const payment = await Payment.findOne({
    booking: bookingId,
    provider: providerId,
    status: "paid",
    payoutHeld: { $ne: true }
  });
  if (!payment) return null;

  const claimed = await Payment.findOneAndUpdate(
    { _id: payment._id, status: "paid", payoutHeld: { $ne: true } },
    { $set: { payoutHeld: true, payoutHoldDispute: disputeId } },
    { new: true }
  );
  if (!claimed) return null;

  const heldAmount = providerNetAmount(payment);
  try {
    const result = await Provider.updateOne(
      { user: providerId },
      { $inc: { walletHeldBalance: heldAmount } }
    );
    if (result.modifiedCount !== 1) throw new Error("Provider wallet was not found while holding disputed earnings.");
  } catch (error) {
    await Payment.updateOne(
      { _id: payment._id, payoutHeld: true, payoutHoldDispute: disputeId },
      { $set: { payoutHeld: false }, $unset: { payoutHoldDispute: 1 } }
    );
    throw error;
  }

  return { amount: heldAmount, paymentId: payment._id };
}
