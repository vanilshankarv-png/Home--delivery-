import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../src/app.js";

process.env.JWT_SECRET = "test-only-tracking-secret";

const customerId = "222222222222222222222222";
const providerId = "111111111111111111111111";
const otherProviderId = "333333333333333333333333";
const bookingId = "aaaaaaaaaaaaaaaaaaaaaaaa";

class FakeQuery {
  constructor(value) {
    this.value = value;
  }

  select() { return this; }
  lean() { return Promise.resolve(this.value); }
}

function makeContext() {
  const booking = {
    _id: bookingId,
    customer: customerId,
    provider: providerId,
    status: "EN_ROUTE",
    address: {
      location: { type: "Point", coordinates: [83.2185, 17.6868] }
    }
  };
  let tracking = null;
  const Booking = {
    findById: () => new FakeQuery(booking)
  };
  const Tracking = {
    findOne: () => new FakeQuery(tracking),
    findOneAndUpdate(filter, update, options = {}) {
      const eligible = !filter.isActive || tracking?.isActive;
      if (!tracking && options.upsert) tracking = { booking: bookingId, points: [] };
      if (!tracking || !eligible) return new FakeQuery(null);
      Object.assign(tracking, update.$set || {});
      if (update.$push?.points) tracking.points.push(update.$push.points);
      return new FakeQuery(tracking);
    }
  };
  const app = createApp({ trackingModels: { Booking, Tracking } });
  const token = (id, role) => ({
    Authorization: `Bearer ${jwt.sign({ sub: id, role }, process.env.JWT_SECRET)}`
  });
  return {
    app,
    getTracking: () => tracking,
    customerAuth: token(customerId, "customer"),
    providerAuth: token(providerId, "provider"),
    otherProviderAuth: token(otherProviderId, "provider")
  };
}

describe("live tracking APIs", () => {
  let context;

  beforeEach(() => { context = makeContext(); });

  it("starts provider tracking, saves REST fallback locations, exposes ETA and breadcrumbs, then stops", async () => {
    const started = await request(context.app)
      .post(`/api/tracking/${bookingId}/start`)
      .set(context.providerAuth);
    const update = await request(context.app)
      .put("/api/tracking/location")
      .set(context.providerAuth)
      .send({ bookingId, lat: 17.7, lng: 83.22, heading: 120 });
    const latest = await request(context.app)
      .get(`/api/tracking/${bookingId}`)
      .set(context.customerAuth);
    const eta = await request(context.app)
      .get(`/api/tracking/${bookingId}/eta`)
      .set(context.customerAuth);
    const history = await request(context.app)
      .get(`/api/tracking/${bookingId}/history`)
      .set(context.providerAuth);
    const stopped = await request(context.app)
      .post(`/api/tracking/${bookingId}/stop`)
      .set(context.providerAuth);

    expect(started.status).toBe(201);
    expect(update.status).toBe(200);
    expect(update.body).toEqual(expect.objectContaining({
      success: true,
      lat: 17.7,
      lng: 83.22,
      distanceKm: expect.any(Number),
      etaMinutes: expect.any(Number)
    }));
    expect(latest.status).toBe(200);
    expect(latest.body.location).toEqual(expect.objectContaining({ lat: 17.7, lng: 83.22, heading: 120 }));
    expect(eta.status).toBe(200);
    expect(eta.body.averageSpeedKmh).toBe(25);
    expect(history.status).toBe(200);
    expect(history.body.points).toHaveLength(1);
    expect(stopped.status).toBe(200);
    expect(stopped.body.tracking.isActive).toBe(false);
    expect(context.getTracking().endedAt).toBeInstanceOf(Date);
  });

  it("restricts start and location sharing to the assigned provider and reads to participants", async () => {
    const wrongProviderStart = await request(context.app)
      .post(`/api/tracking/${bookingId}/start`)
      .set(context.otherProviderAuth);
    const notParticipant = await request(context.app)
      .get(`/api/tracking/${bookingId}/history`)
      .set(context.otherProviderAuth);
    const locationWithoutStart = await request(context.app)
      .put("/api/tracking/location")
      .set(context.providerAuth)
      .send({ bookingId, lat: 17.7, lng: 83.22 });

    expect(wrongProviderStart.status).toBe(403);
    expect(notParticipant.status).toBe(403);
    expect(locationWithoutStart.status).toBe(409);
  });

  it("requires authentication and validates coordinates", async () => {
    const unauthenticated = await request(context.app).get(`/api/tracking/${bookingId}/history`);
    const invalid = await request(context.app)
      .put("/api/tracking/location")
      .set(context.providerAuth)
      .send({ bookingId, lat: 91, lng: 0 });

    expect(unauthenticated.status).toBe(401);
    expect(invalid.status).toBe(400);
  });
});
