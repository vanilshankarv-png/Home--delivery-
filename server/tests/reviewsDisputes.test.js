import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../src/app.js";

process.env.JWT_SECRET = "test-only-reviews-disputes-secret";

const customerId = "111111111111111111111111";
const providerId = "222222222222222222222222";
const bookingId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const disputeId = "bbbbbbbbbbbbbbbbbbbbbbbb";
const serviceId = "cccccccccccccccccccccccc";

const tokenFor = (id) => jwt.sign({ sub: id, role: id === providerId ? "provider" : "customer" }, process.env.JWT_SECRET);

describe("review and dispute APIs", () => {
  test("accepts a customer review and recalculates ratings", async () => {
    const booking = {
      _id: bookingId,
      customer: customerId,
      provider: providerId,
      service: serviceId,
      status: "COMPLETED"
    };
    const provider = { ratingAvg: 0, ratingCount: 0, save: async function save() { return this; } };
    const updates = [];
    const Review = {
      create: async (fields) => ({ _id: "review-1", ...fields }),
      aggregate: async ([match]) => match.$match.provider
        ? [{ average: 4.5, count: 2 }]
        : [{ average: 4, count: 3 }]
    };
    const app = createApp({
      reviewModels: {
        Booking: { findById: () => ({ lean: async () => booking }) },
        Review,
        Provider: { findOne: async () => provider },
        Service: { updateOne: async (...args) => { updates.push(args); return { matchedCount: 1 }; } }
      }
    });

    const response = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${tokenFor(customerId)}`)
      .send({ bookingId, rating: 5, comment: "Excellent work", tags: ["On time"] });

    expect(response.status).toBe(201);
    expect(response.body.ratings.provider).toEqual({ ratingAvg: 4.5, ratingCount: 2 });
    expect(provider.ratingAvg).toBe(4.5);
    expect(updates[0][1].$set).toEqual({ rating: 4, ratingCount: 3 });
  });

  test("serves public provider reviews with a rating distribution and pagination", async () => {
    const provider = { user: providerId, ratingAvg: 4.5, ratingCount: 2 };
    const reviewRows = [{ _id: "review-1", rating: 5 }];
    const reviewQuery = {
      populate() { return this; },
      sort() { return this; },
      skip() { return this; },
      limit() { return this; },
      lean: async () => reviewRows
    };
    const app = createApp({
      reviewModels: {
        Booking: {},
        Review: {
          find: () => reviewQuery,
          countDocuments: async () => 2,
          aggregate: async () => [{ _id: 5, count: 1 }, { _id: 4, count: 1 }]
        },
        Provider: { findById: async () => provider, findOne: async () => provider },
        Service: {}
      }
    });

    const response = await request(app)
      .get(`/api/reviews/provider/${providerId}?page=1&limit=1`)
      .expect(200);
    expect(response.body.reviews).toEqual(reviewRows);
    expect(response.body.ratingDistribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 });
    expect(response.body.pagination).toEqual({ page: 1, limit: 1, total: 2, pages: 2 });
  });

  test("opens a timely dispute, changes booking status, and holds paid provider earnings", async () => {
    const booking = {
      _id: bookingId,
      customer: customerId,
      provider: providerId,
      service: serviceId,
      status: "PAID",
      updatedAt: new Date(),
      timeline: [{ status: "COMPLETED", at: new Date(), by: providerId }]
    };
    const payment = { _id: "payment-1", amount: 1100, platformFee: 100, status: "paid", payoutHeld: false };
    let dispute;
    let heldBalance = 0;
    const Booking = {
      findById: () => ({ lean: async () => booking }),
      findOneAndUpdate: (_filter, update) => ({
        lean: async () => {
          booking.status = update.$set.status;
          booking.timeline.push(update.$push.timeline);
          return booking;
        }
      }),
      updateOne: async () => ({ modifiedCount: 1 })
    };
    const Dispute = {
      create: async (fields) => (dispute = { _id: disputeId, ...fields, status: "open", responses: [] }),
      findById: async () => dispute,
      findOneAndUpdate: async (_filter, update) => {
        dispute.status = update.$set.status;
        dispute.responses.push(update.$push.responses);
        return dispute;
      },
      deleteOne: async () => ({ deletedCount: 1 })
    };
    const Payment = {
      findOne: async () => payment,
      findOneAndUpdate: async (_filter, update) => {
        Object.assign(payment, update.$set);
        return payment;
      },
      updateOne: async () => ({ modifiedCount: 1 })
    };
    const Provider = {
      updateOne: async (_filter, update) => {
        heldBalance += update.$inc.walletHeldBalance;
        return { modifiedCount: 1 };
      }
    };
    const app = createApp({
      disputeModels: { Booking, Dispute, Payment, Provider }
    });

    const created = await request(app)
      .post("/api/disputes")
      .set("Authorization", `Bearer ${tokenFor(customerId)}`)
      .field("bookingId", bookingId)
      .field("reason", "poor_service")
      .field("description", "The repair failed shortly after the visit.")
      .expect(201);

    expect(created.body.dispute._id).toBe(disputeId);
    expect(booking.status).toBe("DISPUTED");
    expect(payment.payoutHeld).toBe(true);
    expect(heldBalance).toBe(1000);

    const response = await request(app)
      .put(`/api/disputes/${disputeId}/respond`)
      .set("Authorization", `Bearer ${tokenFor(providerId)}`)
      .field("text", "I can return and inspect the repair.")
      .expect(200);
    expect(response.body.dispute.status).toBe("under_review");
    expect(response.body.dispute.responses).toHaveLength(1);
  });

  test("rejects disputes outside the 48-hour completion window", async () => {
    const app = createApp({
      disputeModels: {
        Booking: {
          findById: () => ({ lean: async () => ({
            _id: bookingId,
            customer: customerId,
            provider: providerId,
            status: "COMPLETED",
            timeline: [{ status: "COMPLETED", at: new Date(Date.now() - 49 * 60 * 60 * 1000) }]
          }) })
        },
        Dispute: {},
        Payment: {},
        Provider: {}
      }
    });

    await request(app)
      .post("/api/disputes")
      .set("Authorization", `Bearer ${tokenFor(customerId)}`)
      .field("bookingId", bookingId)
      .field("reason", "other")
      .field("description", "This dispute was submitted too late.")
      .expect(409);
  });
});
