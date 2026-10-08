import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../src/app.js";
import { resolveAdminDispute } from "../src/services/adminService.js";

process.env.JWT_SECRET = "test-only-admin-secret";

const adminId = "111111111111111111111111";
const customerId = "222222222222222222222222";
const providerId = "333333333333333333333333";
const bookingId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const disputeId = "bbbbbbbbbbbbbbbbbbbbbbbb";

function auth(role = "admin", id = adminId) {
  return { Authorization: `Bearer ${jwt.sign({ sub: id, role }, process.env.JWT_SECRET)}` };
}

function query(value) {
  return {
    select() { return this; },
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    lean: async () => value,
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
  };
}

describe("admin APIs", () => {
  test("restricts every admin route to the admin role", async () => {
    const app = createApp();
    await request(app).get("/api/admin/dashboard").set(auth("customer", customerId)).expect(403);
    await request(app).get("/api/admin/users").set(auth("provider", providerId)).expect(403);
  });

  test("lists users using role, status, search, and pagination filters", async () => {
    let receivedFilter;
    const User = {
      find(filter) {
        receivedFilter = filter;
        return query([{ _id: customerId, name: "Casey", isBlocked: true }]);
      },
      countDocuments: async () => 1
    };
    const app = createApp({ adminModels: { User } });
    const response = await request(app)
      .get("/api/admin/users?search=casey&role=customer&status=blocked&page=2&limit=5")
      .set(auth())
      .expect(200);

    expect(receivedFilter.role).toBe("customer");
    expect(receivedFilter.isBlocked).toBe(true);
    expect(receivedFilter.$or[0].name).toBeInstanceOf(RegExp);
    expect(response.body.pagination).toEqual({ page: 2, limit: 5, total: 1, pages: 1 });
  });

  test("returns dashboard KPIs, revenue, service leaders, statuses, and a full 30-day series", async () => {
    const many = (value) => ({
      populate() { return this; },
      sort() { return this; },
      limit() { return this; },
      lean: async () => value
    });
    const Booking = {
      aggregate: async (pipeline) => {
        if (pipeline.some((stage) => stage.$lookup)) return [{ title: "Tap repair", bookings: 3, revenue: 1500 }];
        if (pipeline.some((stage) => stage.$match?.createdAt)) return [{ _id: new Date().toISOString().slice(0, 10), count: 2 }];
        return [{ _id: "COMPLETED", count: 3 }];
      }
    };
    const app = createApp({
      adminModels: {
        User: { countDocuments: async () => 20 },
        Provider: { countDocuments: async () => 5 },
        Verification: { countDocuments: async () => 2 },
        Booking,
        Payment: { aggregate: async () => [{ today: 100, week: 600, month: 1900 }] },
        Review: { aggregate: async () => [{ average: 4.6 }] },
        Service: { collection: { name: "services" } },
        Dispute: { find: () => many([]) }
      }
    });
    const { body } = await request(app).get("/api/admin/dashboard").set(auth()).expect(200);
    expect(body.kpis).toMatchObject({
      totalUsers: 20,
      totalProviders: 5,
      pendingVerifications: 2,
      averageRating: 4.6,
      revenue: { today: 100, week: 600, month: 1900 }
    });
    expect(body.bookingsPerDay).toHaveLength(30);
    expect(body.topServices[0].title).toBe("Tap repair");
    expect(body.bookingsByStatus.COMPLETED).toBe(3);
  });

  test("blocking an account cancels open bookings and emits booking updates", async () => {
    const emitted = [];
    const User = {
      findOneAndUpdate: () => query({ _id: customerId, name: "Casey", role: "customer", isBlocked: true })
    };
    const Booking = {
      find: () => ({
        select: () => ({ lean: async () => [{ _id: bookingId, status: "ACCEPTED" }] })
      }),
      updateMany: async (_filter, update) => {
        expect(update.$set.status).toBe("CANCELLED");
        return { modifiedCount: 1 };
      }
    };
    const app = createApp({ adminModels: { User, Booking } });
    app.locals.io = { to: (room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }) };
    const response = await request(app)
      .put(`/api/admin/users/${customerId}/status`)
      .set(auth())
      .send({ isBlocked: true })
      .expect(200);

    expect(response.body.cancelledBookings).toBe(1);
    expect(emitted).toEqual([{
      room: `booking:${bookingId}`,
      event: "booking:status",
      payload: { _id: bookingId, status: "CANCELLED" }
    }]);
  });

  test("creates a catalog category through the shared catalog endpoint", async () => {
    let created;
    const Category = { create: async (fields) => (created = { _id: "category-1", ...fields }) };
    const app = createApp({ adminModels: { Category } });
    const response = await request(app)
      .post("/api/admin/services")
      .set(auth())
      .send({ kind: "category", name: "Electrical", slug: "electrical", icon: "Zap" })
      .expect(201);
    expect(created).toMatchObject({ name: "Electrical", slug: "electrical", icon: "Zap" });
    expect(response.body.kind).toBe("category");
  });

  test("requires an amount for a partial refund", async () => {
    const app = createApp();
    await request(app)
      .put(`/api/admin/disputes/${disputeId}/resolve`)
      .set(auth())
      .send({ action: "partial_refund" })
      .expect(400);
  });

  test("dismisses a dispute, restores booking status, and notifies both participants", async () => {
    const dispute = { _id: disputeId, booking: bookingId, raisedBy: customerId, against: providerId, status: "open" };
    const booking = { _id: bookingId, provider: providerId, paymentStatus: "PAID", status: "DISPUTED" };
    const emitted = [];
    const Dispute = {
      findById: async () => dispute,
      findOneAndUpdate: async (_filter, update) => {
        Object.assign(dispute, update.$set);
        return dispute;
      }
    };
    const Booking = {
      findById: async () => booking,
      findOneAndUpdate: async (_filter, update) => {
        Object.assign(booking, update.$set);
        return booking;
      }
    };
    const result = await resolveAdminDispute({
      Dispute,
      Booking,
      Payment: { findOne: async () => null },
      Provider: {},
      disputeId,
      adminId,
      action: "dismiss",
      note: "The service was delivered as agreed.",
      io: { to: (room) => ({ emit: (event) => emitted.push({ room, event }) }) },
      razorpay: null
    });
    expect(result.dispute.status).toBe("dismissed");
    expect(booking.status).toBe("PAID");
    expect(emitted.filter(({ event }) => event === "dispute:resolved")).toHaveLength(3);
  });

  test("partial refund reconciles only the provider share and releases the dispute hold", async () => {
    const dispute = { _id: disputeId, booking: bookingId, raisedBy: customerId, against: providerId, status: "under_review" };
    const booking = { _id: bookingId, provider: providerId, paymentStatus: "PAID", status: "DISPUTED" };
    const payment = {
      _id: "payment-1", booking: bookingId, provider: providerId,
      amount: 1100, platformFee: 100, refundAmount: 0, status: "paid",
      refundId: null, payoutHeld: true, razorpayPaymentId: "pay-1", isMock: false
    };
    const walletChanges = [];
    const Dispute = {
      findById: async () => dispute,
      findOneAndUpdate: async (_filter, update) => {
        Object.assign(dispute, update.$set);
        return dispute;
      },
      updateOne: async () => ({ modifiedCount: 1 })
    };
    const Booking = {
      findById: async () => booking,
      findOneAndUpdate: async (_filter, update) => {
        Object.assign(booking, update.$set);
        return booking;
      }
    };
    const Payment = {
      findOne: async () => payment,
      findOneAndUpdate: async (_filter, update) => {
        Object.assign(payment, update.$set);
        return payment;
      },
      updateOne: async (_filter, update) => {
        Object.assign(payment, update.$set || {});
        if (update.$unset) Object.keys(update.$unset).forEach((key) => delete payment[key]);
        return { modifiedCount: 1 };
      }
    };
    const result = await resolveAdminDispute({
      Dispute,
      Booking,
      Payment,
      Provider: { updateOne: async (_filter, update) => {
        walletChanges.push(update.$inc);
        return { modifiedCount: 1 };
      } },
      disputeId,
      adminId,
      action: "partial_refund",
      amount: 220,
      note: "Partial refund for the documented issue.",
      razorpay: { payments: { refund: async (_paymentId, options) => ({ id: "refund-1", amount: options.amount }) } }
    });
    expect(result.refund.amount).toBe(220);
    expect(walletChanges).toEqual([{ walletHeldBalance: -1000, walletBalance: -200 }]);
    expect(payment.refundAmount).toBe(220);
    expect(payment.payoutHeld).toBe(false);
    expect(booking.status).toBe("PAID");
  });
});
