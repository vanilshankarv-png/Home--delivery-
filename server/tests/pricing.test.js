import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../src/app.js";

process.env.JWT_SECRET = "test-only-pricing-secret";

const customerId = "222222222222222222222222";
const adminId = "111111111111111111111111";
const otherId = "333333333333333333333333";
const serviceId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const bookingId = "bbbbbbbbbbbbbbbbbbbbbbbb";
const ruleId = "cccccccccccccccccccccccc";

class FakeQuery {
  constructor(value) {
    this.value = value;
  }

  select() { return this; }
  sort() { return this; }
  lean() { return Promise.resolve(this.value); }
}

const rules = [
  { _id: "demand", name: "Area demand", type: "demand", isActive: true, config: { baseMultiplier: 1, referenceRatio: 1, sensitivity: 0.15, neutralMultiplier: 1, minimumMultiplier: 1, maximumMultiplier: 2.5, radiusKm: 10, lookbackMinutes: 30, areaGridDegrees: 0.1 } },
  { _id: "distance", name: "Provider distance", type: "distance", isActive: true, config: { baseFactor: 1, neutralFactor: 1, includedKm: 3, perKm: 0.05, minimumExcessKm: 0 } },
  { _id: "time", name: "Time of day", type: "time", isActive: true, config: { normalMultiplier: 1, neutralMultiplier: 1, nightStartHour: 22, nightEndHour: 6, nightMultiplier: 1.2, eveningStartHour: 18, eveningEndHour: 21, eveningMultiplier: 1.1, timeZone: "Asia/Kolkata" } },
  { _id: ruleId, name: "Platform fee", type: "fee", isActive: true, config: { percent: 10, neutralPercent: 0 } }
];

function makeContext() {
  const service = { _id: serviceId, category: "category-id", basePrice: 400, durationMins: 60, isActive: true };
  const booking = { _id: bookingId, customer: customerId, provider: null, priceSnapshot: { base: 400, demandMultiplier: 1, distanceFactor: 1, timeFactor: 1, platformFee: 40, total: 440 } };
  const PricingRule = {
    find: () => new FakeQuery(rules),
    findById: (id) => new FakeQuery(rules.find((rule) => rule._id === id) || null),
    findByIdAndUpdate: (id, update) => new FakeQuery({
      ...rules.find((rule) => rule._id === id),
      ...update.$set
    })
  };
  const PricingQuote = {
    async create(fields) {
      return { ...fields, _id: "dddddddddddddddddddddddd" };
    }
  };
  const Service = {
    findOne: () => new FakeQuery(service),
    find: () => new FakeQuery([])
  };
  const Provider = { find: () => new FakeQuery([]) };
  const User = { find: () => new FakeQuery([]) };
  const Booking = {
    countDocuments: async () => 0,
    findById: () => new FakeQuery(booking)
  };
  const app = createApp({
    pricingModels: { PricingRule, PricingQuote, Service, Provider, User, Booking }
  });
  const auth = (id, role) => ({
    Authorization: `Bearer ${jwt.sign({ sub: id, role }, process.env.JWT_SECRET)}`
  });
  return { app, customerAuth: auth(customerId, "customer"), adminAuth: auth(adminId, "admin"), otherAuth: auth(otherId, "customer") };
}

describe("dynamic pricing APIs", () => {
  let context;

  beforeEach(() => { context = makeContext(); });

  it("issues an authenticated ten-minute quote with a complete breakdown", async () => {
    const scheduledAt = new Date("2099-01-01T12:00:00+05:30").toISOString();
    const response = await request(context.app)
      .post("/api/pricing/quote")
      .set(context.customerAuth)
      .send({ serviceId, lat: 17.6868, lng: 83.2185, scheduledAt });

    expect(response.status).toBe(200);
    expect(response.body.quoteId).toBe("dddddddddddddddddddddddd");
    expect(response.body.breakdown).toEqual(expect.objectContaining({
      base: 400,
      demandMultiplier: 1,
      distanceFactor: 1,
      timeFactor: 1,
      platformFee: 40,
      total: 440
    }));
    expect(new Date(response.body.expiresAt).getTime() - Date.now()).toBeGreaterThan(9 * 60_000);
    expect(new Date(response.body.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(10 * 60_000);
  });

  it("leaves area surge public while protecting admin rules and customer price history", async () => {
    const publicSurge = await request(context.app).get("/api/pricing/surge?lat=17.6868&lng=83.2185");
    const unauthenticatedQuote = await request(context.app)
      .post("/api/pricing/quote")
      .send({ serviceId, lat: 17.6868, lng: 83.2185, scheduledAt: "2099-01-01T00:00:00.000Z" });
    const deniedRules = await request(context.app).get("/api/pricing/rules").set(context.otherAuth);
    const adminRules = await request(context.app).get("/api/pricing/rules").set(context.adminAuth);
    const ownHistory = await request(context.app).get(`/api/pricing/history/${bookingId}`).set(context.customerAuth);
    const deniedHistory = await request(context.app).get(`/api/pricing/history/${bookingId}`).set(context.otherAuth);

    expect(publicSurge.status).toBe(200);
    expect(publicSurge.body.multiplier).toBe(1);
    expect(unauthenticatedQuote.status).toBe(401);
    expect(deniedRules.status).toBe(403);
    expect(adminRules.status).toBe(200);
    expect(adminRules.body.rules).toHaveLength(4);
    expect(ownHistory.status).toBe(200);
    expect(ownHistory.body.priceSnapshot.total).toBe(440);
    expect(deniedHistory.status).toBe(403);
  });

  it("allows admins to edit pricing rule configuration", async () => {
    const response = await request(context.app)
      .put(`/api/pricing/rules/${ruleId}`)
      .set(context.adminAuth)
      .send({ config: { percent: 12, neutralPercent: 0 }, isActive: true });

    expect(response.status).toBe(200);
    expect(response.body.rule.config).toEqual({ percent: 12, neutralPercent: 0 });
  });
});
