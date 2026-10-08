import { calculateEta } from "./etaService.js";

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function idOf(value) {
  return String(value?._id || value);
}

export function assertBookingParticipant(booking, user) {
  const participant = [booking.customer, booking.provider]
    .filter(Boolean)
    .some((id) => idOf(id) === user.id);
  if (!participant) throw httpError("You are not allowed to access this tracking session.", 403);
}

export function assertAssignedProvider(booking, userId) {
  if (!booking.provider || idOf(booking.provider) !== userId) {
    throw httpError("Only the assigned provider can update this tracking session.", 403);
  }
}

export function assertCoordinates({ lat, lng, heading }) {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90
    || !Number.isFinite(lng) || lng < -180 || lng > 180
    || (heading !== undefined && heading !== null
      && (!Number.isFinite(heading) || heading < 0 || heading > 360))) {
    throw httpError("Valid latitude, longitude, and heading are required.", 400);
  }
}

export async function saveTrackingPoint({ Tracking, bookingId, providerId, lat, lng, heading }) {
  assertCoordinates({ lat, lng, heading });
  const point = { lat, lng, heading: heading ?? null, at: new Date() };
  const tracking = await Tracking.findOneAndUpdate(
    { booking: bookingId, provider: providerId, isActive: true },
    {
      $set: { lastLocation: { type: "Point", coordinates: [lng, lat] } },
      $push: { points: point }
    },
    { new: true, runValidators: true }
  ).lean();
  if (!tracking) throw httpError("Live tracking is not active for this booking.", 409);
  return { tracking, point };
}

export async function locationUpdate({ Booking, Tracking, bookingId, providerId, lat, lng, heading }) {
  const booking = await Booking.findById(bookingId).lean();
  if (!booking) throw httpError("Booking not found.", 404);
  assertAssignedProvider(booking, providerId);
  if (!["ACCEPTED", "EN_ROUTE"].includes(booking.status)) {
    throw httpError("Location sharing is only available while the booking is accepted or en route.", 409);
  }
  const { tracking, point } = await saveTrackingPoint({
    Tracking,
    bookingId,
    providerId,
    lat,
    lng,
    heading
  });
  const destination = booking.address?.location?.coordinates;
  const eta = destination?.length === 2
    ? calculateEta({ currentLocation: [lng, lat], destination })
    : { distanceKm: null, etaMinutes: null, averageSpeedKmh: 25 };
  return {
    booking,
    tracking,
    point,
    eta: {
      lat,
      lng,
      heading: heading ?? null,
      eta: eta.etaMinutes,
      etaMinutes: eta.etaMinutes,
      distanceKm: eta.distanceKm
    }
  };
}
