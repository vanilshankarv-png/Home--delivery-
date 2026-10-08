import mongoose from "mongoose";
import { canTransitionBooking } from "../utils/bookingStateMachine.js";

const MAX_PAGE_SIZE = 50;
const RESCHEDULE_CUTOFF_MS = 2 * 60 * 60 * 1000;
const cancellableStatuses = ["PENDING", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS"];
const activeStatuses = ["PENDING", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS"];

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function idOf(value) {
  return String(value?._id || value);
}

function pageNumber(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function populateBooking(query) {
  return query
    .populate("customer", "name email phone avatar")
    .populate("provider", "name email phone avatar")
    .populate("service", "title basePrice unit durationMins images category")
    .lean();
}

function emitTo(io, room, event, payload) {
  io?.to(room).emit(event, payload);
}

export function createBookingController({ Booking, Service, Provider, User, PricingQuote }) {
  async function reserveProviderSlot({ providerUserId, serviceId, bookingId, start, end }) {
    const provider = await Provider.findOne({ user: providerUserId }).lean();
    if (!provider || provider.verificationStatus !== "verified") {
      throw httpError("The selected provider is not verified.", 409);
    }
    const providerUser = await User.findById(providerUserId).select("isAvailable isBlocked").lean();
    if (!providerUser || !providerUser.isAvailable || providerUser.isBlocked) {
      throw httpError("The selected provider is not currently available.", 409);
    }
    if (!provider.skills.some((skill) => idOf(skill.service) === idOf(serviceId))) {
      throw httpError("The selected provider does not offer this service.", 409);
    }

    const update = await Provider.updateOne({
      _id: provider._id,
      $nor: [{
        bookingSlots: {
          $elemMatch: {
            start: { $lt: end },
            end: { $gt: start }
          }
        }
      }]
    }, {
      $push: { bookingSlots: { booking: bookingId, start, end } }
    });
    if (update.modifiedCount !== 1) {
      throw httpError("The provider already has a booking during this time.", 409);
    }
  }

  async function releaseProviderSlot(providerUserId, bookingId) {
    if (!providerUserId) return;
    await Provider.updateOne(
      { user: providerUserId },
      { $pull: { bookingSlots: { booking: bookingId } } }
    );
  }

  async function reserveAcceptanceSlot({ providerUserId, booking }) {
    const provider = await Provider.findOne({ user: providerUserId }).lean();
    if (!provider || provider.verificationStatus !== "verified") {
      throw httpError("Provider verification is required to accept jobs.", 403);
    }
    const providerUser = await User.findById(providerUserId).select("isAvailable isBlocked").lean();
    if (!providerUser || !providerUser.isAvailable || providerUser.isBlocked) {
      throw httpError("You are not currently available to accept jobs.", 403);
    }
    if (!provider.skills.some((skill) => idOf(skill.service) === idOf(booking.service))) {
      throw httpError("You do not have a verified skill for this service.", 403);
    }

    const update = await Provider.updateOne({
      _id: provider._id,
      $nor: [{
        bookingSlots: {
          $elemMatch: {
            start: { $lt: booking.slotEndAt },
            end: { $gt: booking.scheduledAt }
          }
        }
      }]
    }, {
      $push: {
        bookingSlots: {
          booking: booking._id,
          start: booking.scheduledAt,
          end: booking.slotEndAt
        }
      }
    });
    if (update.modifiedCount !== 1) {
      throw httpError("You already have a booking during this time.", 409);
    }
  }

  async function notifyBooking(io, booking, status) {
    const populated = await populateBooking(Booking.findById(booking._id));
    if (!populated) return;
    emitTo(io, `booking:${idOf(booking)}`, "booking:status", populated);
    return populated;
  }

  return {
    create: async (req, res, next) => {
      let reservedProviderId;
      let bookingId;
      let quoteClaimed = false;
      let bookingCreated = false;
      try {
        if (req.user.role !== "customer") throw httpError("Only customers can create bookings.", 403);
        const service = await Service.findOne({ _id: req.body.service, isActive: true }).lean();
        if (!service) throw httpError("Service not found.", 404);

        const scheduledAt = new Date(req.body.scheduledAt);
        if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt <= new Date()) {
          throw httpError("Choose a service time in the future.", 400);
        }
        const slotEndAt = new Date(scheduledAt.getTime() + service.durationMins * 60_000);
        const customer = await User.findById(req.user.id).lean();
        if (!customer || customer.isBlocked) throw httpError("Customer account is not available.", 403);

        const selectedAddress = typeof req.body.address === "number"
          ? customer.address?.[req.body.address]
          : req.body.address;
        if (!selectedAddress) throw httpError("Select or provide a service address.", 400);
        const coordinates = selectedAddress.location?.coordinates;
        if (!Array.isArray(coordinates) || coordinates.length !== 2
          || !Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1])
          || coordinates[0] < -180 || coordinates[0] > 180
          || coordinates[1] < -90 || coordinates[1] > 90) {
          throw httpError("The service address needs a valid map location.", 400);
        }

        const quote = await PricingQuote.findOne({
          _id: req.body.quoteId,
          customer: req.user.id,
          service: service._id,
          scheduledAt,
          "location.coordinates": coordinates,
          expiresAt: { $gt: new Date() },
          consumedAt: null
        }).lean();
        if (!quote) throw httpError("Pricing quote is invalid or expired. Request a new quote before booking.", 409);
        const claimedQuote = await PricingQuote.findOneAndUpdate({
          _id: quote._id,
          customer: req.user.id,
          expiresAt: { $gt: new Date() },
          consumedAt: null
        }, { $set: { consumedAt: new Date() } }, { new: true }).lean();
        if (!claimedQuote) throw httpError("Pricing quote has already been used. Request a new quote before booking.", 409);
        quoteClaimed = true;
        const priceSnapshot = quote.priceSnapshot;
        bookingId = new mongoose.Types.ObjectId();
        if (req.body.provider) {
          reservedProviderId = req.body.provider;
          await reserveProviderSlot({
            providerUserId: reservedProviderId,
            serviceId: service._id,
            bookingId,
            start: scheduledAt,
            end: slotEndAt
          });
        }

        const booking = await Booking.create({
          _id: bookingId,
          customer: req.user.id,
          provider: reservedProviderId || null,
          service: service._id,
          address: selectedAddress,
          scheduledAt,
          slotEndAt,
          notes: req.body.notes || "",
          status: "PENDING",
          priceSnapshot,
          paymentStatus: "UNPAID",
          timeline: [{ status: "PENDING", by: req.user.id }]
        });
        bookingCreated = true;

        const populated = await populateBooking(Booking.findById(booking._id));
        const io = req.app.locals.io;
        if (reservedProviderId) {
          emitTo(io, `user:${reservedProviderId}`, "job:new", populated);
        } else {
          emitTo(io, "providers", "job:new", populated);
        }
        return res.status(201).json({ success: true, booking: populated });
      } catch (error) {
        if (quoteClaimed && !bookingCreated) {
          try {
            await PricingQuote.updateOne(
              { _id: req.body.quoteId, customer: req.user.id },
              { $unset: { consumedAt: 1 } }
            );
          } catch (quoteError) {
            return next(quoteError);
          }
        }
        if (reservedProviderId && bookingId && !bookingCreated) {
          try {
            await releaseProviderSlot(reservedProviderId, bookingId);
          } catch (releaseError) {
            return next(releaseError);
          }
        }
        return next(error);
      }
    },

    list: async (req, res, next) => {
      try {
        const page = pageNumber(req.query.page, 1);
        const limit = pageNumber(req.query.limit, 10, MAX_PAGE_SIZE);
        const filter = {};
        if (req.query.status) {
          const statuses = req.query.status.split(",").map((status) => status.trim().toUpperCase());
          const allowed = ["PENDING", "ACCEPTED", "REJECTED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED", "CANCELLED", "PAID", "DISPUTED"];
          if (statuses.some((status) => !allowed.includes(status))) throw httpError("Invalid booking status filter.", 400);
          filter.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
        }

        if (req.user.role === "customer") {
          filter.customer = req.user.id;
        } else if (req.user.role === "provider") {
          const [provider, user] = await Promise.all([
            Provider.findOne({ user: req.user.id }).lean(),
            User.findById(req.user.id).lean()
          ]);
          const offset = (page - 1) * limit;
          const assignedFilter = { ...filter, provider: req.user.id };
          let openFilter = null;
          const canIncludePending = !filter.status
            || filter.status === "PENDING"
            || filter.status.$in?.includes("PENDING");
          if (canIncludePending) openFilter = { provider: null, status: "PENDING" };
          if (provider?.currentLocation?.coordinates?.length === 2) {
            if (openFilter) {
              openFilter["address.location"] = {
                $near: {
                  $geometry: provider.currentLocation,
                  $maxDistance: (provider.serviceRadiusKm || 15) * 1000
                }
              };
            }
          } else if (user?.address?.[0]?.location?.coordinates?.length === 2) {
            if (openFilter) {
              openFilter["address.location"] = {
                $near: {
                  $geometry: user.address[0].location,
                  $maxDistance: 15_000
                }
              };
            }
          } else {
            const [assigned, total] = await Promise.all([
              populateBooking(Booking.find(assignedFilter)
                .sort({ scheduledAt: -1 }).skip(offset).limit(limit)),
              Booking.countDocuments(assignedFilter)
            ]);
            return res.json({ success: true, bookings: assigned, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
          }

          const [assigned, open, assignedCount, openCount] = await Promise.all([
            populateBooking(Booking.find(assignedFilter)
              .sort({ scheduledAt: -1 }).limit(offset + limit)),
            openFilter
              ? populateBooking(Booking.find(openFilter)
                .sort({ scheduledAt: -1 }).limit(offset + limit))
              : [],
            Booking.countDocuments(assignedFilter),
            openFilter ? Booking.countDocuments(openFilter) : 0
          ]);
          const bookings = [...assigned, ...open]
            .sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt))
            .slice(offset, offset + limit);
          const total = assignedCount + openCount;
          return res.json({ success: true, bookings, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
        } else if (req.user.role !== "admin") {
          throw httpError("You are not authorized to view bookings.", 403);
        }

        const [bookings, total] = await Promise.all([
          populateBooking(Booking.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)),
          Booking.countDocuments(filter)
        ]);
        return res.json({ success: true, bookings, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
      } catch (error) {
        return next(error);
      }
    },

    detail: async (req, res, next) => {
      try {
        const booking = await populateBooking(Booking.findById(req.params.id));
        if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });
        const isParticipant = [booking.customer, booking.provider].filter(Boolean).some((user) => idOf(user) === req.user.id);
        if (req.user.role !== "admin" && !isParticipant) {
          throw httpError("You are not authorized to view this booking.", 403);
        }
        return res.json({ success: true, booking });
      } catch (error) {
        return next(error);
      }
    },

    reschedule: async (req, res, next) => {
      try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });
        if (idOf(booking.customer) !== req.user.id) throw httpError("Only the customer can reschedule this booking.", 403);
        if (!["PENDING", "ACCEPTED"].includes(booking.status)) {
          throw httpError("This booking can no longer be rescheduled.", 409);
        }
        if (booking.scheduledAt.getTime() - Date.now() <= RESCHEDULE_CUTOFF_MS) {
          throw httpError("Bookings can only be rescheduled more than two hours before the scheduled time.", 409);
        }

        const service = await Service.findById(booking.service).lean();
        const scheduledAt = new Date(req.body.scheduledAt);
        if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt <= new Date()) {
          throw httpError("Choose a service time in the future.", 400);
        }
        const slotEndAt = new Date(scheduledAt.getTime() + service.durationMins * 60_000);
        if (booking.provider) {
          const provider = await Provider.findOne({ user: booking.provider }).lean();
          const update = await Provider.updateOne({
            _id: provider?._id,
            bookingSlots: { $elemMatch: { booking: booking._id } },
            $nor: [{
              bookingSlots: {
                $elemMatch: {
                  booking: { $ne: booking._id },
                  start: { $lt: slotEndAt },
                  end: { $gt: scheduledAt }
                }
              }
            }]
          }, {
            $set: {
              "bookingSlots.$.start": scheduledAt,
              "bookingSlots.$.end": slotEndAt
            }
          });
          if (update.modifiedCount !== 1) {
            throw httpError("The provider is not available at the new time.", 409);
          }
        }

        const updated = await Booking.findOneAndUpdate(
          { _id: booking._id, status: booking.status },
          {
            $set: { scheduledAt, slotEndAt },
            $push: { timeline: { status: booking.status, by: req.user.id } }
          },
          { new: true, runValidators: true }
        );
        if (!updated) throw httpError("Booking changed while it was being rescheduled. Reload and try again.", 409);
        const populated = await notifyBooking(req.app.locals.io, updated, booking.status);
        return res.json({ success: true, booking: populated });
      } catch (error) {
        return next(error);
      }
    },

    cancel: async (req, res, next) => {
      try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });
        const isParticipant = [booking.customer, booking.provider].filter(Boolean).some((user) => idOf(user) === req.user.id);
        if (req.user.role !== "admin" && !isParticipant) throw httpError("You are not authorized to cancel this booking.", 403);
        if (!cancellableStatuses.includes(booking.status)) throw httpError("This booking can no longer be cancelled.", 409);

        const updated = await Booking.findOneAndUpdate(
          { _id: booking._id, status: booking.status },
          {
            $set: { status: "CANCELLED", cancelReason: req.body.reason },
            $push: { timeline: { status: "CANCELLED", by: req.user.id } }
          },
          { new: true, runValidators: true }
        );
        if (!updated) throw httpError("Booking changed before it could be cancelled.", 409);
        if (booking.provider) await releaseProviderSlot(booking.provider, booking._id);
        const populated = await notifyBooking(req.app.locals.io, updated, "CANCELLED");
        return res.json({ success: true, booking: populated });
      } catch (error) {
        return next(error);
      }
    },

    accept: async (req, res, next) => {
      let reserved = false;
      let booking;
      try {
        if (req.user.role !== "provider") throw httpError("Only providers can respond to jobs.", 403);
        booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });
        if (booking.provider && idOf(booking.provider) !== req.user.id) {
          throw httpError("This booking is assigned to another provider.", 403);
        }

        if (req.body.action === "accept" && !booking.provider) {
          await reserveAcceptanceSlot({ providerUserId: req.user.id, booking });
          reserved = true;
        }

        const nextStatus = req.body.action === "accept" ? "ACCEPTED" : "REJECTED";
        if (!canTransitionBooking(booking.status, nextStatus)) {
          throw httpError(`A ${booking.status} booking cannot be ${req.body.action}ed.`, 409);
        }
        const filter = { _id: booking._id, status: "PENDING" };
        if (req.body.action === "accept" && !booking.provider) filter.provider = null;
        const updated = await Booking.findOneAndUpdate(
          filter,
          {
            $set: { provider: req.user.id, status: nextStatus },
            $push: { timeline: { status: nextStatus, by: req.user.id } }
          },
          { new: true, runValidators: true }
        );
        if (!updated) throw httpError("Another provider has already responded to this job.", 409);

        if (req.body.action === "reject") {
          await releaseProviderSlot(req.user.id, booking._id);
        }
        const populated = await notifyBooking(req.app.locals.io, updated, nextStatus);
        return res.json({ success: true, booking: populated });
      } catch (error) {
        if (reserved && booking) {
          try {
            await releaseProviderSlot(req.user.id, booking._id);
          } catch (releaseError) {
            return next(releaseError);
          }
        }
        return next(error);
      }
    },

    updateStatus: async (req, res, next) => {
      try {
        if (req.user.role !== "provider") throw httpError("Only providers can update job status.", 403);
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });
        if (idOf(booking.provider) !== req.user.id) throw httpError("Only the assigned provider can update this booking.", 403);
        if (!["EN_ROUTE", "IN_PROGRESS", "COMPLETED"].includes(req.body.status)) {
          throw httpError("Provider status must be EN_ROUTE, IN_PROGRESS, or COMPLETED.", 400);
        }
        if (!canTransitionBooking(booking.status, req.body.status)) {
          throw httpError(`Cannot change booking from ${booking.status} to ${req.body.status}.`, 409);
        }

        const updated = await Booking.findOneAndUpdate(
          { _id: booking._id, status: booking.status, provider: req.user.id },
          {
            $set: { status: req.body.status },
            $push: { timeline: { status: req.body.status, by: req.user.id } }
          },
          { new: true, runValidators: true }
        );
        if (!updated) throw httpError("Booking changed before the status update. Reload and try again.", 409);
        const populated = await notifyBooking(req.app.locals.io, updated, req.body.status);
        return res.json({ success: true, booking: populated });
      } catch (error) {
        return next(error);
      }
    }
  };
}

export { activeStatuses };
