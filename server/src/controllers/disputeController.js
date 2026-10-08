import { httpError } from "../services/paymentService.js";
import { holdBookingPayout } from "../services/disputeService.js";
import { storeUploadedFile } from "../services/fileStorageService.js";

function idOf(value) {
  return String(value?._id || value);
}

async function storeEvidence(files, storeFile) {
  return Promise.all((files || []).map((file) => storeFile(file)));
}

function completionTime(booking) {
  const completed = [...(booking.timeline || [])].reverse().find((entry) => entry.status === "COMPLETED");
  return completed?.at || booking.updatedAt || null;
}

export function createDisputeController({ Booking, Dispute, Payment, Provider }, storeFile = storeUploadedFile) {
  return {
    create: async (req, res, next) => {
      let dispute;
      let booking;
      try {
        booking = await Booking.findById(req.body.bookingId).lean();
        if (!booking) throw httpError("Booking not found.", 404);
        const customerId = idOf(booking.customer);
        const providerId = idOf(booking.provider);
        if (![customerId, providerId].includes(req.user.id)) {
          throw httpError("Only booking participants can raise a dispute.", 403);
        }
        if (!["COMPLETED", "PAID"].includes(booking.status)) {
          throw httpError("A dispute can only be raised for a completed booking.", 409);
        }
        const completedAt = completionTime(booking);
        const completedAtMs = new Date(completedAt).getTime();
        if (!completedAt || !Number.isFinite(completedAtMs)
          || Date.now() - completedAtMs > 48 * 60 * 60 * 1000) {
          throw httpError("Disputes must be raised within 48 hours of completion.", 409);
        }

        const evidence = await storeEvidence(req.files, storeFile);
        try {
          dispute = await Dispute.create({
            booking: booking._id,
            raisedBy: req.user.id,
            against: req.user.id === customerId ? booking.provider : booking.customer,
            reason: req.body.reason,
            description: req.body.description,
            evidence
          });
        } catch (error) {
          if (error.code === 11000) throw httpError("A dispute has already been raised for this booking.", 409);
          throw error;
        }

        const updatedBooking = await Booking.findOneAndUpdate(
          { _id: booking._id, status: { $in: ["COMPLETED", "PAID"] } },
          {
            $set: { status: "DISPUTED" },
            $push: { timeline: { status: "DISPUTED", by: req.user.id, at: new Date() } }
          },
          { new: true, runValidators: true }
        ).lean();
        if (!updatedBooking) throw httpError("Booking state changed while opening the dispute.", 409);

        await holdBookingPayout({
          Payment,
          Provider,
          bookingId: booking._id,
          providerId: booking.provider,
          disputeId: dispute._id
        });
        return res.status(201).json({ success: true, dispute });
      } catch (error) {
        if (dispute && booking) {
          await Dispute.deleteOne({ _id: dispute._id });
          await Booking.updateOne(
            { _id: booking._id, status: "DISPUTED" },
            {
              $set: { status: booking.status },
              $pull: { timeline: { status: "DISPUTED", by: req.user.id } }
            }
          );
        }
        return next(error);
      }
    },

    mine: async (req, res, next) => {
      try {
        const disputes = await Dispute.find({
          $or: [{ raisedBy: req.user.id }, { against: req.user.id }]
        })
          .populate({
            path: "booking",
            select: "status scheduledAt service",
            populate: { path: "service", select: "title" }
          })
          .populate("raisedBy", "name avatar")
          .populate("against", "name avatar")
          .sort({ createdAt: -1 })
          .lean();
        return res.json({ success: true, disputes });
      } catch (error) {
        return next(error);
      }
    },

    respond: async (req, res, next) => {
      try {
        const dispute = await Dispute.findById(req.params.id);
        if (!dispute) throw httpError("Dispute not found.", 404);
        if (idOf(dispute.against) !== req.user.id) {
          throw httpError("Only the other booking participant can respond to this dispute.", 403);
        }
        if (!["open", "under_review"].includes(dispute.status)) {
          throw httpError("This dispute is no longer accepting responses.", 409);
        }

        const evidence = await storeEvidence(req.files, storeFile);
        const updated = await Dispute.findOneAndUpdate(
          { _id: dispute._id, status: { $in: ["open", "under_review"] } },
          {
            $set: { status: "under_review" },
            $push: {
              responses: {
                by: req.user.id,
                text: req.body.text,
                evidence,
                at: new Date()
              }
            }
          },
          { new: true, runValidators: true }
        );
        if (!updated) throw httpError("Dispute state changed; refresh and try again.", 409);
        return res.json({ success: true, dispute: updated });
      } catch (error) {
        return next(error);
      }
    }
  };
}
