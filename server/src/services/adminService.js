import { createGatewayRefund, createRazorpayClient, httpError } from "./paymentService.js";
import { providerNetAmount } from "./payoutService.js";
import { randomUUID } from "node:crypto";

const OPEN_BOOKING_STATUSES = ["PENDING", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS"];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function utcStartOfDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function getAdminDashboard({ User, Provider, Verification, Booking, Payment, Review, Service, Dispute }, now = new Date()) {
  const today = utcStartOfDay(now);
  const week = new Date(today);
  week.setUTCDate(week.getUTCDate() - ((week.getUTCDay() + 6) % 7));
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const last30Days = new Date(today);
  last30Days.setUTCDate(last30Days.getUTCDate() - 29);
  const refundedAmount = {
    $cond: [
      { $eq: ["$status", "refunded"] },
      "$amount",
      { $ifNull: ["$refundAmount", 0] }
    ]
  };
  const netRevenue = { $subtract: ["$amount", refundedAmount] };

  const [
    totalUsers,
    totalProviders,
    pendingVerifications,
    bookingsByStatus,
    revenueByPeriod,
    averageRatingResult,
    topServices,
    bookingsPerDay,
    openDisputes
  ] = await Promise.all([
    User.countDocuments(),
    Provider.countDocuments(),
    Verification.countDocuments({ status: "pending" }),
    Booking.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Payment.aggregate([
      { $match: { status: { $in: ["paid", "refunded"] }, createdAt: { $gte: week } } },
      { $group: {
        _id: null,
        today: { $sum: { $cond: [{ $gte: ["$createdAt", today] }, netRevenue, 0] } },
        week: { $sum: { $cond: [{ $gte: ["$createdAt", week] }, netRevenue, 0] } },
        month: { $sum: { $cond: [{ $gte: ["$createdAt", month] }, netRevenue, 0] } }
      } }
    ]),
    Review.aggregate([{ $group: { _id: null, average: { $avg: "$rating" } } }]),
    Booking.aggregate([
      { $group: { _id: "$service", bookings: { $sum: 1 }, revenue: { $sum: "$priceSnapshot.total" } } },
      { $sort: { bookings: -1 } },
      { $limit: 5 },
      { $lookup: { from: Service.collection.name, localField: "_id", foreignField: "_id", as: "service" } },
      { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, serviceId: "$_id", title: "$service.title", bookings: 1, revenue: 1 } }
    ]),
    Booking.aggregate([
      { $match: { createdAt: { $gte: last30Days, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) } } },
      { $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } },
        count: { $sum: 1 }
      } },
      { $sort: { _id: 1 } }
    ]),
    Dispute.find({ status: { $in: ["open", "under_review"] } })
      .populate("booking", "status scheduledAt priceSnapshot")
      .populate("raisedBy", "name email")
      .populate("against", "name email")
      .sort({ createdAt: 1 })
      .limit(100)
      .lean()
  ]);

  const revenue = revenueByPeriod[0] || { today: 0, week: 0, month: 0 };
  const statusCounts = Object.fromEntries(bookingsByStatus.map(({ _id, count }) => [_id, count]));
  for (const status of ["PENDING", "ACCEPTED", "REJECTED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED", "CANCELLED", "PAID", "DISPUTED"]) {
    if (statusCounts[status] === undefined) statusCounts[status] = 0;
  }
  const dailyCounts = new Map(bookingsPerDay.map(({ _id, count }) => [_id, count]));
  const dailyBookings = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(last30Days);
    date.setUTCDate(date.getUTCDate() + index);
    const day = date.toISOString().slice(0, 10);
    return { date: day, bookings: dailyCounts.get(day) || 0 };
  });

  return {
    kpis: {
      totalUsers,
      totalProviders,
      pendingVerifications,
      averageRating: Number((averageRatingResult[0]?.average || 0).toFixed(2)),
      revenue: {
        today: revenue.today || 0,
        week: revenue.week || 0,
        month: revenue.month || 0
      }
    },
    bookingsByStatus: statusCounts,
    topServices,
    bookingsPerDay: dailyBookings,
    openDisputes
  };
}

export async function listAdminUsers({ User, search, role, status, page, limit }) {
  const filter = {};
  if (role) filter.role = role;
  if (status === "blocked") filter.isBlocked = true;
  if (status === "active") filter.isBlocked = false;
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: regex }, { email: regex }, { phone: regex }];
  }
  const [users, total] = await Promise.all([
    User.find(filter)
      .select("name email phone role avatar isBlocked isAvailable createdAt")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter)
  ]);
  return { users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function setUserStatus({ User, Booking, Provider, userId, isBlocked, io, adminId }) {
  const user = await User.findOneAndUpdate(
    { _id: userId, role: { $ne: "admin" } },
    { $set: { isBlocked } },
    { new: true }
  ).select("name email role isBlocked");
  if (!user) throw httpError("User not found or admin accounts cannot be blocked.", 404);
  if (!isBlocked) return { user, cancelledBookings: 0 };
  if (user.role === "provider") {
    await User.updateOne({ _id: userId }, { $set: { isAvailable: false } });
  }

  const openBookings = await Booking.find({
    status: { $in: OPEN_BOOKING_STATUSES },
    $or: [{ customer: userId }, { provider: userId }]
  }).select("_id status").lean();
  const ids = openBookings.map((booking) => booking._id);
  let cancelledBookings = 0;
  if (ids.length) {
    const cancelledAt = new Date();
    const cancellation = await Booking.updateMany(
      { _id: { $in: ids }, status: { $in: OPEN_BOOKING_STATUSES } },
      {
        $set: { status: "CANCELLED", cancelReason: "Cancelled by admin because an account was blocked." },
        $push: { timeline: { status: "CANCELLED", by: adminId, at: cancelledAt } }
      }
    );
    cancelledBookings = cancellation.modifiedCount;
    if (user.role === "provider") {
      await Provider.updateOne(
        { user: userId },
        { $pull: { bookingSlots: { booking: { $in: ids } } } }
      );
    }
    for (const booking of openBookings) {
      io?.to(`booking:${String(booking._id)}`).emit("booking:status", {
        _id: String(booking._id),
        status: "CANCELLED"
      });
    }
  }
  return { user, cancelledBookings };
}

export async function upsertAdminCatalogItem({ Category, Service, kind, id, fields, imageFiles, storeFile }) {
  const Model = kind === "category" ? Category : Service;
  const update = { ...fields };
  if (imageFiles.length) {
    if (kind !== "service") throw httpError("Images can only be attached to services.", 400);
    update.images = [...(fields.images || []), ...await Promise.all(imageFiles.map((file) => storeFile(file, "catalog/services")))];
  }
  if (id) {
    const item = await Model.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true });
    if (!item) throw httpError("Catalog item not found.", 404);
    return { item, kind, updated: true };
  }
  const item = await Model.create(update);
  return { item, kind, updated: false };
}

async function refundPayment({ Payment, payment, amount, disputeId, razorpay }) {
  const existingRefundAmount = Number(payment.refundAmount || 0);
  const remaining = Number((payment.amount - existingRefundAmount).toFixed(2));
  if (amount <= 0 || amount > remaining) throw httpError("Refund amount exceeds the remaining captured payment.", 409);
  const claimId = `pending:${disputeId}`;
  const claim = await Payment.findOneAndUpdate(
    {
      _id: payment._id,
      status: "paid",
      refundAmount: existingRefundAmount,
      $or: [{ refundId: null }, { refundId: { $exists: false } }]
    },
    { $set: { refundId: claimId } },
    { new: true }
  );
  if (!claim) throw httpError("Payment is already being refunded or has changed.", 409);

  let refund;
  try {
    refund = await createGatewayRefund({ razorpay, payment, amount });
  } catch (error) {
    await Payment.updateOne(
      { _id: payment._id, refundId: claimId },
      { $unset: { refundId: 1 } }
    );
    throw error;
  }
  const totalRefunded = Number((existingRefundAmount + amount).toFixed(2));
  const fullyRefunded = totalRefunded >= payment.amount;
  const finalized = await Payment.updateOne(
    { _id: payment._id, refundId: claimId },
    {
      $set: {
        refundId: refund.id,
        refundAmount: totalRefunded,
        ...(fullyRefunded ? { status: "refunded" } : {})
      }
    }
  );
  if (finalized.modifiedCount !== 1) {
    console.error("Gateway refund succeeded but payment record finalization failed.", {
      paymentId: String(payment._id),
      refundId: refund.id
    });
    throw httpError("Refund submitted but payment reconciliation needs admin attention.", 500);
  }
  return { amount, totalRefunded, fullyRefunded, refundId: refund.id };
}

export async function resolveAdminDispute({
  Dispute,
  Booking,
  Payment,
  Provider,
  disputeId,
  adminId,
  action,
  amount,
  note,
  io,
  razorpay = createRazorpayClient()
}) {
  const dispute = await Dispute.findById(disputeId);
  if (!dispute) throw httpError("Dispute not found.", 404);
  if (!["open", "under_review"].includes(dispute.status)) throw httpError("This dispute has already been resolved.", 409);
  const claimId = randomUUID();
  const resolutionClaim = await Dispute.findOneAndUpdate(
    { _id: dispute._id, status: { $in: ["open", "under_review"] }, resolutionClaimId: null },
    { $set: { resolutionClaimId: claimId } },
    { new: true }
  );
  if (!resolutionClaim) throw httpError("Another administrator is already resolving this dispute.", 409);
  const releaseResolutionClaim = () => Dispute.updateOne(
    { _id: dispute._id, resolutionClaimId: claimId },
    { $unset: { resolutionClaimId: 1 } }
  );
  let booking;
  try {
    booking = await Booking.findById(dispute.booking);
  } catch (error) {
    await releaseResolutionClaim();
    throw error;
  }
  if (!booking) {
    await releaseResolutionClaim();
    throw httpError("Disputed booking not found.", 404);
  }

  let payment;
  try {
    payment = await Payment.findOne({ booking: booking._id, status: "paid" });
  } catch (error) {
    await releaseResolutionClaim();
    throw error;
  }
  let refundResult = null;
  let providerAdjustment = 0;
  let releasedHold = 0;
  if (action !== "dismiss") {
    if (!payment) {
      await releaseResolutionClaim();
      throw httpError("A captured payment is required to issue a refund.", 409);
    }
    const refundAmount = action === "refund" ? payment.amount - Number(payment.refundAmount || 0) : amount;
    try {
      refundResult = await refundPayment({ Payment, payment, amount: refundAmount, disputeId, razorpay });
    } catch (error) {
      await releaseResolutionClaim();
      throw error;
    }
    providerAdjustment = providerNetAmount(payment) * refundAmount / payment.amount;
    if (payment.payoutHeld) releasedHold = providerNetAmount(payment);
  } else if (payment?.payoutHeld) {
    releasedHold = providerNetAmount(payment);
  }

  if (releasedHold > 0 || providerAdjustment > 0) {
    const inc = {};
    if (releasedHold > 0) inc.walletHeldBalance = -releasedHold;
    if (providerAdjustment > 0) inc.walletBalance = -providerAdjustment;
    const filter = { user: booking.provider };
    if (providerAdjustment > 0) filter.walletBalance = { $gte: providerAdjustment };
    if (releasedHold > 0) filter.walletHeldBalance = { $gte: releasedHold };
    let walletUpdate;
    try {
      walletUpdate = await Provider.updateOne(filter, { $inc: inc });
    } catch (error) {
      if (!refundResult) await releaseResolutionClaim();
      throw error;
    }
    if (walletUpdate.modifiedCount !== 1) {
      console.error("Dispute wallet reconciliation failed.", {
        disputeId: String(dispute._id),
        paymentId: payment ? String(payment._id) : null,
        providerAdjustment,
        releasedHold
      });
      if (!refundResult) await releaseResolutionClaim();
      throw httpError(
        refundResult
          ? "Refund was submitted but provider wallet reconciliation needs admin attention."
          : "Provider wallet could not release the dispute hold.",
        500
      );
    }
    if (payment?.payoutHeld) {
      await Payment.updateOne(
        { _id: payment._id, payoutHeld: true },
        { $set: { payoutHeld: false }, $unset: { payoutHoldDispute: 1 } }
      );
    }
  }

  const nextBookingStatus = action === "dismiss"
    ? (booking.paymentStatus === "PAID" ? "PAID" : "COMPLETED")
    : refundResult.fullyRefunded ? "COMPLETED" : "PAID";
  const resolution = {
    action,
    amount: action === "dismiss" ? 0 : refundResult.amount,
    note
  };
  const resolved = await Dispute.findOneAndUpdate(
    { _id: dispute._id, status: { $in: ["open", "under_review"] }, resolutionClaimId: claimId },
    {
      $set: { status: action === "dismiss" ? "dismissed" : "resolved", resolution },
      $unset: { resolutionClaimId: 1 }
    },
    { new: true }
  );
  if (!resolved) throw httpError("Dispute was resolved by another administrator.", 409);

  const bookingSet = {
    status: nextBookingStatus,
    ...(refundResult?.fullyRefunded ? { paymentStatus: "REFUNDED" } : {})
  };
  const updatedBooking = await Booking.findOneAndUpdate(
    { _id: booking._id, status: "DISPUTED" },
    {
      $set: bookingSet,
      $push: { timeline: { status: nextBookingStatus, by: adminId, at: new Date() } }
    },
    { new: true, runValidators: true }
  );
  if (!updatedBooking) {
    console.error("Dispute resolution saved but booking state could not be restored.", {
      disputeId: String(dispute._id),
      bookingId: String(booking._id)
    });
    throw httpError("Dispute resolution saved but booking reconciliation needs admin attention.", 500);
  }

  const event = {
    disputeId: String(dispute._id),
    bookingId: String(booking._id),
    status: resolved.status,
    resolution
  };
  for (const participantId of [dispute.raisedBy, dispute.against]) {
    io?.to(`user:${String(participantId)}`).emit("dispute:resolved", event);
  }
  io?.to(`booking:${String(booking._id)}`).emit("dispute:resolved", event);
  io?.to(`booking:${String(booking._id)}`).emit("booking:status", {
    _id: String(booking._id),
    status: nextBookingStatus,
    paymentStatus: refundResult?.fullyRefunded ? "REFUNDED" : booking.paymentStatus
  });
  return { dispute: resolved, booking: updatedBooking, refund: refundResult };
}

export { OPEN_BOOKING_STATUSES };
