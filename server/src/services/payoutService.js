import { httpError } from "./paymentService.js";

export function providerNetAmount(payment) {
  return Math.max(0, Number((payment.amount - payment.platformFee).toFixed(2)));
}

export async function reservePayoutBalance({ Provider, providerId, amount }) {
  const provider = await Provider.findOneAndUpdate(
    {
      user: providerId,
      $expr: {
        $gte: [
          { $subtract: [{ $ifNull: ["$walletBalance", 0] }, { $ifNull: ["$walletHeldBalance", 0] }] },
          amount
        ]
      }
    },
    { $inc: { walletBalance: -amount } },
    { new: true }
  ).lean();
  if (!provider) {
    const current = await Provider.findOne({ user: providerId }).select("walletBalance walletHeldBalance").lean();
    if (!current) throw httpError("Provider wallet not found.", 404);
    throw httpError("Payout amount exceeds your available balance after dispute holds.", 409);
  }
  return provider;
}

export async function requestPayout({ Provider, Payout, providerId, amount, method, details }) {
  if (amount < 500) throw httpError("The minimum payout request is ₹500.", 400);
  const provider = await reservePayoutBalance({ Provider, providerId, amount });
  try {
    const payout = await Payout.create({
      provider: providerId,
      amount,
      method,
      details,
      status: "requested",
      requestedAt: new Date()
    });
    return {
      payout,
      walletBalance: Math.max(0, provider.walletBalance - (provider.walletHeldBalance || 0))
    };
  } catch (error) {
    const rollback = await Provider.updateOne(
      { user: providerId },
      { $inc: { walletBalance: amount } }
    );
    if (rollback.modifiedCount !== 1) {
      console.error("Unable to restore wallet balance after payout request failed.", {
        providerId,
        amount
      });
    }
    throw error;
  }
}

export async function getProviderEarnings({ Provider, Payment, Payout, providerId }) {
  const provider = await Provider.findOne({ user: providerId }).select("walletBalance walletHeldBalance").lean();
  if (!provider) throw httpError("Provider wallet not found.", 404);
  const [payments, payouts] = await Promise.all([
    Payment.find({ provider: providerId, status: { $in: ["paid", "refunded"] } })
      .select("amount platformFee refundAmount status createdAt invoiceNo").sort({ createdAt: -1 }).lean(),
    Payout.find({ provider: providerId }).sort({ requestedAt: -1 }).lean()
  ]);
  const paidPayments = payments.filter((payment) => payment.status === "paid");
  const netEarnings = (payment) => {
    const providerNet = Math.max(0, payment.amount - (payment.platformFee || 0));
    const refundRatio = Math.min(1, (payment.refundAmount || 0) / payment.amount);
    return providerNet * (1 - refundRatio);
  };
  const earnings = paidPayments.reduce((total, payment) => total + netEarnings(payment), 0);
  const paidOut = payouts
    .filter((payout) => payout.status === "paid")
    .reduce((total, payout) => total + payout.amount, 0);
  const pendingPayouts = payouts
    .filter((payout) => ["requested", "processing"].includes(payout.status))
    .reduce((total, payout) => total + payout.amount, 0);
  const byMonth = new Map();
  for (const payment of paidPayments) {
    const month = new Date(payment.createdAt).toISOString().slice(0, 7);
    byMonth.set(month, (byMonth.get(month) || 0) + netEarnings(payment));
  }
  const chart = [...byMonth.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .slice(-12)
    .map(([month, amount]) => ({ month, amount: Number(amount.toFixed(2)) }));

  return {
    walletBalance: Math.max(0, provider.walletBalance - (provider.walletHeldBalance || 0)),
    heldBalance: provider.walletHeldBalance || 0,
    earnings: Number(earnings.toFixed(2)),
    paidOut: Number(paidOut.toFixed(2)),
    pendingPayouts: Number(pendingPayouts.toFixed(2)),
    chart,
    payouts
  };
}
