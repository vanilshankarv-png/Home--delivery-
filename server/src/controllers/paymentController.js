import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  createGatewayOrder,
  createGatewayRefund,
  createMockSignature,
  createRazorpayClient,
  generateInvoiceNo,
  httpError,
  isMockPaymentsEnabled,
  verifyPaymentSignature
} from "../services/paymentService.js";
import { providerNetAmount } from "../services/payoutService.js";

function idOf(value) {
  return String(value?._id || value);
}

function mockSecret() {
  return process.env.JWT_SECRET || "home-delivery-mock-payment";
}

function verifyMockSignature(orderId, paymentId, signature) {
  const expected = Buffer.from(createMockSignature(orderId, paymentId, mockSecret()), "hex");
  let supplied;
  try {
    supplied = Buffer.from(signature || "", "hex");
  } catch {
    return false;
  }
  return supplied.length === expected.length && timingSafeEqual(expected, supplied);
}

export function createPaymentController({ Booking, Payment, Provider, User, razorpay, mockPayments = isMockPaymentsEnabled() }) {
  const gateway = razorpay === undefined ? createRazorpayClient() : razorpay;

  return {
    createOrder: async (req, res, next) => {
      try {
        if (req.user.role !== "customer") throw httpError("Only customers can pay for bookings.", 403);
        const booking = await Booking.findById(req.body.bookingId).lean();
        if (!booking) throw httpError("Booking not found.", 404);
        if (idOf(booking.customer) !== req.user.id) throw httpError("Only the booking customer can pay.", 403);
        if (booking.status !== "COMPLETED") throw httpError("Only completed bookings can be paid.", 409);
        if (booking.paymentStatus === "PAID" || booking.status === "PAID") {
          throw httpError("This booking has already been paid.", 409);
        }
        if (!booking.provider) throw httpError("A provider must be assigned before payment.", 409);
        const amount = Number(booking.priceSnapshot?.total);
        const platformFee = Number(booking.priceSnapshot?.platformFee || 0);
        if (!Number.isFinite(amount) || amount <= 0 || platformFee < 0 || platformFee > amount) {
          throw httpError("The booking price snapshot is invalid.", 409);
        }
        const order = await createGatewayOrder({
          razorpay: gateway,
          mock: mockPayments,
          amount,
          currency: "INR",
          receipt: `hd-${String(booking._id)}-${randomBytes(4).toString("hex")}`
        });
        const payment = await Payment.create({
          booking: booking._id,
          customer: req.user.id,
          provider: booking.provider,
          amount,
          platformFee,
          currency: "INR",
          razorpayOrderId: order.id,
          invoiceNo: generateInvoiceNo(),
          status: "created",
          isMock: mockPayments
        });
        await Booking.updateOne(
          { _id: booking._id, paymentStatus: { $ne: "PAID" } },
          { $set: { paymentStatus: "PENDING" } }
        );
        return res.status(201).json({
          success: true,
          payment: {
            _id: payment._id,
            booking: booking._id,
            amount,
            currency: "INR",
            razorpayOrderId: order.id,
            invoiceNo: payment.invoiceNo,
            status: payment.status,
            isMock: mockPayments,
            keyId: mockPayments ? null : process.env.RAZORPAY_KEY_ID,
            ...(mockPayments && {
              mockPayment: {
                razorpay_payment_id: `pay_mock_${order.id}`,
                razorpay_signature: createMockSignature(order.id, `pay_mock_${order.id}`, mockSecret())
              }
            })
          }
        });
      } catch (error) {
        return next(error);
      }
    },

    verify: async (req, res, next) => {
      try {
        const payment = await Payment.findOne({
          razorpayOrderId: req.body.razorpay_order_id,
          customer: req.user.id
        });
        if (!payment) throw httpError("Payment order not found.", 404);
        if (payment.status === "paid") {
          return res.json({ success: true, payment, alreadyVerified: true });
        }
        if (req.body.status === "failed") {
          const failed = await Payment.findOneAndUpdate(
            { _id: payment._id, status: "created" },
            { $set: { status: "failed" } },
            { new: true }
          );
          if (!failed) throw httpError("This payment was already processed.", 409);
          await Booking.updateOne(
            { _id: payment.booking, paymentStatus: "PENDING" },
            { $set: { paymentStatus: "UNPAID" } }
          );
          return res.json({ success: true, payment: failed });
        }
        if (!["created", "failed"].includes(payment.status)) {
          throw httpError("This payment cannot be verified.", 409);
        }

        const mockVerification = mockPayments && payment.isMock
          && req.body.razorpay_payment_id === `pay_mock_${payment.razorpayOrderId}`
          && verifyMockSignature(payment.razorpayOrderId, req.body.razorpay_payment_id, req.body.razorpay_signature);
        const signatureValid = payment.isMock
          ? mockVerification
          : verifyPaymentSignature({
            orderId: payment.razorpayOrderId,
            paymentId: req.body.razorpay_payment_id,
            signature: req.body.razorpay_signature,
            secret: process.env.RAZORPAY_KEY_SECRET
          });
        if (!signatureValid) throw httpError("Payment signature verification failed.", 400);

        const booking = await Booking.findById(payment.booking).lean();
        if (!booking || idOf(booking.customer) !== req.user.id
          || idOf(booking.provider) !== idOf(payment.provider)) {
          throw httpError("Payment booking ownership could not be verified.", 409);
        }
        if (booking.status !== "COMPLETED" || booking.paymentStatus === "PAID") {
          throw httpError("This booking is not eligible for payment.", 409);
        }

        const claim = await Payment.findOneAndUpdate(
          { _id: payment._id, status: { $in: ["created", "failed"] } },
          {
            $set: {
              status: "paid",
              razorpayPaymentId: req.body.razorpay_payment_id,
              signature: req.body.razorpay_signature
            }
          },
          { new: true }
        );
        if (!claim) throw httpError("Payment was already processed.", 409);

        const walletCredit = providerNetAmount(payment);
        try {
          const bookingUpdate = await Booking.findOneAndUpdate(
            { _id: booking._id, status: "COMPLETED", paymentStatus: { $ne: "PAID" } },
            {
              $set: { status: "PAID", paymentStatus: "PAID" },
              $push: { timeline: { status: "PAID", by: req.user.id } }
            },
            { new: true, runValidators: true }
          ).lean();
          if (!bookingUpdate) throw httpError("Booking payment state changed; refresh and verify its current status.", 409);
          const walletUpdate = await Provider.updateOne(
            { user: payment.provider },
            { $inc: { walletBalance: walletCredit } }
          );
          if (walletUpdate.modifiedCount !== 1) throw httpError("Provider wallet could not be credited.", 500);
        } catch (error) {
          await Payment.updateOne(
            { _id: payment._id, status: "paid" },
            { $set: { status: "created" }, $unset: { razorpayPaymentId: 1, signature: 1 } }
          );
          throw error;
        }

        const io = req.app.locals.io;
        io?.to(`booking:${idOf(payment.booking)}`).emit("booking:status", {
          _id: idOf(payment.booking),
          status: "PAID",
          paymentStatus: "PAID"
        });
        return res.json({ success: true, payment: claim });
      } catch (error) {
        return next(error);
      }
    },

    history: async (req, res, next) => {
      try {
        const filter = req.user.role === "admin"
          ? {}
          : req.user.role === "provider"
            ? { provider: req.user.id }
            : { customer: req.user.id };
        const payments = await Payment.find(filter)
          .populate({
            path: "booking",
            select: "status scheduledAt service",
            populate: { path: "service", select: "title" }
          })
          .populate("customer", "name email")
          .populate("provider", "name")
          .sort({ createdAt: -1 })
          .lean();
        return res.json({ success: true, payments });
      } catch (error) {
        return next(error);
      }
    },

    detail: async (req, res, next) => {
      try {
        const payment = await Payment.findById(req.params.id)
          .populate("booking")
          .populate("booking.service", "title")
          .populate("customer", "name email phone")
          .populate("provider", "name email")
          .lean();
        if (!payment) throw httpError("Payment not found.", 404);
        const isParticipant = [payment.customer, payment.provider].some((user) => idOf(user) === req.user.id);
        if (req.user.role !== "admin" && !isParticipant) throw httpError("You cannot view this invoice.", 403);
        return res.json({ success: true, payment });
      } catch (error) {
        return next(error);
      }
    },

    refund: async (req, res, next) => {
      try {
        const payment = await Payment.findById(req.params.id);
        if (!payment) throw httpError("Payment not found.", 404);
        const booking = await Booking.findById(payment.booking).lean();
        if (!booking) throw httpError("Booking not found.", 404);
        const isAdmin = req.user.role === "admin";
        const cancellationOrDispute = ["CANCELLED", "DISPUTED"].includes(booking.status)
          && idOf(booking.customer) === req.user.id;
        if (!isAdmin && !cancellationOrDispute) throw httpError("Refunds require an admin or a cancelled/disputed booking.", 403);
        if (payment.status === "refunded") {
          if (payment.refundId === "pending") throw httpError("A refund is already being processed.", 409);
          return res.json({ success: true, payment, alreadyRefunded: true });
        }
        if (payment.status !== "paid") throw httpError("Only paid transactions can be refunded.", 409);
        const refundClaim = await Payment.findOneAndUpdate(
          { _id: payment._id, status: "paid" },
          { $set: { status: "refunded", refundId: "pending" } },
          { new: true }
        );
        if (!refundClaim) throw httpError("Payment was changed while the refund was processing.", 409);
        let refund;
        try {
          refund = await createGatewayRefund({
            razorpay: gateway,
            payment,
            amount: payment.amount
          });
        } catch (error) {
          const restored = await Payment.updateOne(
            { _id: payment._id, status: "refunded", refundId: "pending" },
            { $set: { status: "paid" }, $unset: { refundId: 1 } }
          );
          if (restored.modifiedCount !== 1) {
            console.error("Unable to restore payment after refund gateway failure.", {
              paymentId: String(payment._id)
            });
          }
          throw error;
        }
        const updatedPayment = await Payment.findOneAndUpdate(
          { _id: payment._id, status: "refunded", refundId: "pending" },
          { $set: { refundId: refund.id, refundAmount: payment.amount } },
          { new: true }
        ).lean();
        if (!updatedPayment) {
          console.error("Refund completed but payment record could not be finalized.", {
            paymentId: String(payment._id),
            refundId: refund.id
          });
          throw httpError("Refund completed, but payment reconciliation needs admin attention.", 500);
        }

        const netAmount = providerNetAmount(payment);
        const walletFilter = { user: payment.provider, walletBalance: { $gte: netAmount } };
        const walletInc = { walletBalance: -netAmount };
        if (payment.payoutHeld) {
          walletFilter.walletHeldBalance = { $gte: netAmount };
          walletInc.walletHeldBalance = -netAmount;
        }
        const walletUpdate = await Provider.updateOne(
          walletFilter,
          { $inc: walletInc }
        );
        if (walletUpdate.modifiedCount !== 1) {
          console.error("Refund processed but provider wallet reversal failed.", {
            paymentId: String(payment._id),
            refundId: refund.id
          });
          throw httpError("Refund processed, but provider wallet reconciliation needs admin attention.", 500);
        }
        if (payment.payoutHeld) {
          await Payment.updateOne(
            { _id: payment._id, payoutHeld: true },
            { $set: { payoutHeld: false }, $unset: { payoutHoldDispute: 1 } }
          );
        }
        await Booking.updateOne(
          { _id: booking._id },
          { $set: { paymentStatus: "REFUNDED" } }
        );
        return res.json({ success: true, payment: updatedPayment });
      } catch (error) {
        return next(error);
      }
    }
  };
}
