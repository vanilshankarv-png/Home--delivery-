import jwt from "jsonwebtoken";
import Booking from "../models/Booking.js";
import Tracking from "../models/Tracking.js";
import { locationUpdate } from "../services/trackingService.js";

const LOCATION_THROTTLE_MS = 3000;

export function attachTrackingSockets(io, models = { Booking, Tracking }) {
  const lastLocationAt = new Map();
  const { Booking: BookingModel, Tracking: TrackingModel } = models;

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string" || !token || !process.env.JWT_SECRET) {
      return next(new Error("Authentication required."));
    }
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.user = {
        id: String(payload.sub || payload.id),
        role: payload.role
      };
      return next();
    } catch {
      return next(new Error("Invalid or expired token."));
    }
  });

  io.on("connection", (socket) => {
    socket.on("leave:booking", (bookingId) => {
      if (typeof bookingId === "string" && /^[\da-f]{24}$/i.test(bookingId)) {
        socket.leave(`booking:${bookingId}`);
      }
    });

    socket.on("join:booking", async (bookingId, acknowledge) => {
      const done = typeof acknowledge === "function" ? acknowledge : () => {};
      if (typeof bookingId !== "string" || !/^[\da-f]{24}$/i.test(bookingId)) {
        done({ success: false, message: "Invalid booking id." });
        return;
      }
      try {
        const booking = await BookingModel.findById(bookingId).select("customer provider").lean();
        if (!booking) {
          done({ success: false, message: "Booking not found." });
          return;
        }
        const allowed = [booking.customer, booking.provider]
          .filter(Boolean)
          .some((id) => String(id) === socket.data.user.id);
        if (!allowed) {
          done({ success: false, message: "You are not allowed to join this booking room." });
          return;
        }
        await socket.join(`booking:${bookingId}`);
        done({ success: true });
      } catch (error) {
        console.error("Unable to authorize tracking socket room:", error);
        done({ success: false, message: "Unable to join tracking updates." });
      }
    });

    socket.on("provider:location", async (payload, acknowledge) => {
      const done = typeof acknowledge === "function" ? acknowledge : () => {};
      if (socket.data.user.role !== "provider") {
        done({ success: false, message: "Only providers can share location." });
        return;
      }
      const { bookingId, lat, lng, heading } = payload && typeof payload === "object" ? payload : {};
      if (typeof bookingId !== "string" || !/^[\da-f]{24}$/i.test(bookingId)) {
        done({ success: false, message: "Invalid booking id." });
        return;
      }
      const throttleKey = `${socket.data.user.id}:${bookingId}`;
      const now = Date.now();
      const previousUpdate = lastLocationAt.get(throttleKey) || 0;
      if (now - previousUpdate < LOCATION_THROTTLE_MS) {
        done({ success: false, message: "Location updates are limited to one every three seconds." });
        return;
      }
      try {
        const update = await locationUpdate({
          Booking: BookingModel,
          Tracking: TrackingModel,
          bookingId,
          providerId: socket.data.user.id,
          lat,
          lng,
          heading
        });
        lastLocationAt.set(throttleKey, now);
        io.to(`booking:${bookingId}`).emit("location:update", update.eta);
        done({ success: true, ...update.eta });
      } catch (error) {
        done({ success: false, message: error.message || "Unable to save provider location." });
      }
    });
  });
}

export default attachTrackingSockets;
