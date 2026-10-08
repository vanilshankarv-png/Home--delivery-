import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../src/app.js";

process.env.JWT_SECRET = "test-only-payments-secret";
process.env.MOCK_PAYMENTS = "true";

const customerId = "111111111111111111111111";
const otherCustomerId = "222222222222222222222222";
const providerId = "333333333333333333333333";
const bookingId = "aaaaaaaaaaaaaaaaaaaaaaaa";

function tokenFor(userId) {
  return jwt.sign({ sub: userId, role: "customer" }, process.env.JWT_SECRET);
}

function createPaymentApp() {
  const booking = {
    _id: bookingId,
    customer: customerId,
    provider: providerId,
    status: "COMPLETED",
    paymentStatus: "UNPAID",
    priceSnapshot: { base: 500, platformFee: 50, total: 550 },
    timeline: []
  };
  let payment;
  const Booking = {
    findById: () => ({ lean: async () => booking }),
    updateOne: async (_filter, update) => {
      Object.assign(booking, update.$set);
      return { modifiedCount: 1 };
    },
    findOneAndUpdate: (filter, update) => ({
      lean: async () => {
        if (booking.status !== filter.status || booking.paymentStatus === "PAID") return null;
        Object.assign(booking, update.$set);
        booking.timeline.push(update.$push.timeline);
        return booking;
      }
    })
  };
  const Payment = {
    create: async (fields) => (payment = { _id: "444444444444444444444444", ...fields }),
    findOne: async (filter) => payment?.razorpayOrderId === filter.razorpayOrderId
      && payment.customer === filter.customer ? payment : null,
    findOneAndUpdate: async (filter, update) => {
      if (!payment || payment._id !== filter._id) return null;
      const allowed = filter.status?.$in || [filter.status];
      if (!allowed.includes(payment.status)) return null;
      Object.assign(payment, update.$set);
      return payment;
    },
    updateOne: async (_filter, update) => {
      if (update.$set) Object.assign(payment, update.$set);
      return { modifiedCount: 1 };
    }
  };
  let walletBalance = 0;
  const Provider = {
    updateOne: async () => {
      walletBalance += 500;
      return { modifiedCount: 1 };
    }
  };

  return {
    app: createApp({ paymentModels: { Booking, Payment, Provider } }),
    getBooking: () => booking,
    getPayment: () => payment,
    getWalletBalance: () => walletBalance
  };
}

describe("payment APIs", () => {
  test("creates the order from the saved booking total and credits the provider once", async () => {
    const fixture = createPaymentApp();
    const auth = { Authorization: `Bearer ${tokenFor(customerId)}` };
    const orderResponse = await request(fixture.app)
      .post("/api/payments/create-order")
      .set(auth)
      .send({ bookingId, amount: 1 });

    expect(orderResponse.status).toBe(201);
    expect(orderResponse.body.payment.amount).toBe(550);
    expect(orderResponse.body.payment.mockPayment.razorpay_payment_id)
      .toBe(`pay_mock_${orderResponse.body.payment.razorpayOrderId}`);

    const verifyResponse = await request(fixture.app)
      .post("/api/payments/verify")
      .set(auth)
      .send({
        razorpay_order_id: orderResponse.body.payment.razorpayOrderId,
        ...orderResponse.body.payment.mockPayment
      });

    expect(verifyResponse.status).toBe(200);
    expect(fixture.getPayment().status).toBe("paid");
    expect(fixture.getBooking().status).toBe("PAID");
    expect(fixture.getWalletBalance()).toBe(500);
    await request(fixture.app)
      .post("/api/payments/verify")
      .set(auth)
      .send({
        razorpay_order_id: orderResponse.body.payment.razorpayOrderId,
        ...orderResponse.body.payment.mockPayment
      })
      .expect(200);
    expect(fixture.getWalletBalance()).toBe(500);
  });

  test("prevents a different customer from creating an order for the booking", async () => {
    const fixture = createPaymentApp();
    await request(fixture.app)
      .post("/api/payments/create-order")
      .set({ Authorization: `Bearer ${tokenFor(otherCustomerId)}` })
      .send({ bookingId })
      .expect(403);
  });
});
