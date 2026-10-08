import jwt from "jsonwebtoken";
import { attachTrackingSockets } from "../src/sockets/tracking.js";

process.env.JWT_SECRET = "test-only-tracking-socket-secret";

const bookingId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const providerId = "111111111111111111111111";
const customerId = "222222222222222222222222";

class FakeQuery {
  constructor(value) {
    this.value = value;
  }

  select() { return this; }
  lean() { return Promise.resolve(this.value); }
}

function makeSocket(userId, role, io, booking, Tracking) {
  const listeners = new Map();
  const token = jwt.sign({ sub: userId, role }, process.env.JWT_SECRET);
  const socket = {
    handshake: { auth: { token } },
    data: {},
    rooms: new Set(),
    on: (event, callback) => listeners.set(event, callback),
    join: async (room) => socket.rooms.add(room),
    leave: (room) => socket.rooms.delete(room)
  };
  const middlewares = io.middlewares;
  return {
    socket,
    async connect() {
      for (const middleware of middlewares) {
        await new Promise((resolve, reject) => middleware(socket, (error) => error ? reject(error) : resolve()));
      }
      io.handlers.connection(socket);
    },
    event: (name) => listeners.get(name),
    Tracking
  };
}

describe("tracking Socket.io events", () => {
  it("authenticates participants and saves/broadcasts provider locations with a three-second throttle", async () => {
    const booking = {
      _id: bookingId,
      customer: customerId,
      provider: providerId,
      status: "EN_ROUTE",
      address: { location: { coordinates: [83.2185, 17.6868] } }
    };
    const points = [];
    const tracking = {
      booking: bookingId,
      provider: providerId,
      isActive: true,
      points,
      lastLocation: null
    };
    const emits = [];
    const io = {
      middlewares: [],
      handlers: {},
      use(callback) { this.middlewares.push(callback); },
      on(event, callback) { this.handlers[event] = callback; },
      to(room) {
        return { emit: (event, payload) => emits.push({ room, event, payload }) };
      }
    };
    const Booking = {
      findById: () => new FakeQuery(booking)
    };
    const Tracking = {
      findOneAndUpdate(filter, update) {
        if (!tracking.isActive || String(filter.provider) !== providerId) return new FakeQuery(null);
        points.push(update.$push.points);
        tracking.lastLocation = update.$set.lastLocation;
        return new FakeQuery(tracking);
      }
    };
    attachTrackingSockets(io, { Booking, Tracking });
    const provider = makeSocket(providerId, "provider", io, booking, Tracking);
    await provider.connect();

    const joined = await new Promise((resolve) => provider.event("join:booking")(bookingId, resolve));
    const location = { bookingId, lat: 17.7, lng: 83.22, heading: 120 };
    const first = await new Promise((resolve) => provider.event("provider:location")(location, resolve));
    const throttled = await new Promise((resolve) => provider.event("provider:location")(location, resolve));

    expect(joined.success).toBe(true);
    expect(provider.socket.rooms.has(`booking:${bookingId}`)).toBe(true);
    expect(first.success).toBe(true);
    expect(throttled.success).toBe(false);
    expect(points).toHaveLength(1);
    expect(emits[0]).toEqual(expect.objectContaining({
      room: `booking:${bookingId}`,
      event: "location:update",
      payload: expect.objectContaining({ lat: 17.7, lng: 83.22, etaMinutes: expect.any(Number) })
    }));
  });

  it("rejects unauthenticated sockets and users outside a booking room", async () => {
    const booking = { _id: bookingId, customer: customerId, provider: providerId };
    const io = {
      middlewares: [],
      handlers: {},
      use(callback) { this.middlewares.push(callback); },
      on(event, callback) { this.handlers[event] = callback; }
    };
    const Booking = { findById: () => new FakeQuery(booking) };
    const Tracking = {};
    attachTrackingSockets(io, { Booking, Tracking });
    const stranger = makeSocket("333333333333333333333333", "customer", io, booking, Tracking);
    await stranger.connect();

    const denied = await new Promise((resolve) => stranger.event("join:booking")(bookingId, resolve));
    expect(denied.success).toBe(false);
    expect(stranger.socket.rooms.has(`booking:${bookingId}`)).toBe(false);
  });
});
