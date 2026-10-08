import { calculateEta } from "../services/etaService.js";
import {
  assertAssignedProvider,
  assertBookingParticipant,
  locationUpdate
} from "../services/trackingService.js";

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function createTrackingController({ Booking, Tracking }) {
  return {
    start: async (req, res, next) => {
      try {
        const booking = await Booking.findById(req.params.bookingId).lean();
        if (!booking) throw httpError("Booking not found.", 404);
        assertAssignedProvider(booking, req.user.id);
        if (!["ACCEPTED", "EN_ROUTE"].includes(booking.status)) {
          throw httpError("Tracking can only start for accepted or en-route bookings.", 409);
        }
        const existingTracking = await Tracking.findOne({ booking: booking._id }).lean();
        if (existingTracking?.isActive) {
          return res.json({ success: true, tracking: existingTracking });
        }
        const now = new Date();
        const tracking = await Tracking.findOneAndUpdate(
          { booking: booking._id },
          {
            $set: {
              provider: req.user.id,
              isActive: true,
              startedAt: now,
              endedAt: null
            }
          },
          { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
        ).lean();
        return res.status(201).json({ success: true, tracking });
      } catch (error) {
        return next(error);
      }
    },

    updateLocation: async (req, res, next) => {
      try {
        const update = await locationUpdate({
          Booking,
          Tracking,
          bookingId: req.body.bookingId,
          providerId: req.user.id,
          lat: req.body.lat,
          lng: req.body.lng,
          heading: req.body.heading
        });
        const io = req.app.locals.io;
        io?.to(`booking:${req.body.bookingId}`).emit("location:update", update.eta);
        return res.json({ success: true, ...update.eta, point: update.point });
      } catch (error) {
        return next(error);
      }
    },

    latest: async (req, res, next) => {
      try {
        const booking = await Booking.findById(req.params.bookingId).lean();
        if (!booking) throw httpError("Booking not found.", 404);
        assertBookingParticipant(booking, req.user);
        const tracking = await Tracking.findOne({ booking: booking._id }).lean();
        if (!tracking?.lastLocation?.coordinates) {
          throw httpError("No provider location has been shared yet.", 404);
        }
        const [lng, lat] = tracking.lastLocation.coordinates;
        const latestPoint = tracking.points?.[tracking.points.length - 1];
        const eta = calculateEta({
          currentLocation: [lng, lat],
          destination: booking.address.location.coordinates
        });
        return res.json({
          success: true,
          isActive: tracking.isActive,
          location: { lat, lng, heading: latestPoint?.heading ?? null, at: latestPoint?.at },
          etaMinutes: eta.etaMinutes,
          distanceKm: eta.distanceKm
        });
      } catch (error) {
        return next(error);
      }
    },

    eta: async (req, res, next) => {
      try {
        const booking = await Booking.findById(req.params.bookingId).lean();
        if (!booking) throw httpError("Booking not found.", 404);
        assertBookingParticipant(booking, req.user);
        const tracking = await Tracking.findOne({ booking: booking._id }).lean();
        if (!tracking?.lastLocation?.coordinates) {
          throw httpError("No provider location has been shared yet.", 404);
        }
        const result = calculateEta({
          currentLocation: tracking.lastLocation.coordinates,
          destination: booking.address.location.coordinates
        });
        return res.json({ success: true, ...result, isActive: tracking.isActive });
      } catch (error) {
        return next(error);
      }
    },

    history: async (req, res, next) => {
      try {
        const booking = await Booking.findById(req.params.bookingId).lean();
        if (!booking) throw httpError("Booking not found.", 404);
        assertBookingParticipant(booking, req.user);
        const tracking = await Tracking.findOne({ booking: booking._id }).lean();
        return res.json({
          success: true,
          isActive: Boolean(tracking?.isActive),
          points: tracking?.points || []
        });
      } catch (error) {
        return next(error);
      }
    },

    stop: async (req, res, next) => {
      try {
        const booking = await Booking.findById(req.params.bookingId).lean();
        if (!booking) throw httpError("Booking not found.", 404);
        assertAssignedProvider(booking, req.user.id);
        const tracking = await Tracking.findOneAndUpdate(
          { booking: booking._id, provider: req.user.id, isActive: true },
          { $set: { isActive: false, endedAt: new Date() } },
          { new: true }
        ).lean();
        if (!tracking) throw httpError("No active tracking session was found.", 409);
        return res.json({ success: true, tracking });
      } catch (error) {
        return next(error);
      }
    }
  };
}
