import mongoose from "mongoose";
import {
  assertChatAvailable,
  assertChatParticipant,
  chatDisabledReason,
  createBookingMessage,
  idOf,
  markBookingMessagesRead
} from "../services/chatService.js";

const MAX_PAGE_SIZE = 50;
const DELETE_WINDOW_MS = 5 * 60 * 1000;

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function populateMessage(query) {
  return query.populate("sender", "name avatar").populate("receiver", "name avatar");
}

export function createChatController({ Booking, Message, User }) {
  return {
    conversations: async (req, res, next) => {
      try {
        const bookings = await Booking.find({
          $or: [{ customer: req.user.id }, { provider: req.user.id }]
        }).populate("service", "title").sort({ updatedAt: -1 }).lean();
        const conversations = await Promise.all(bookings.map(async (booking) => {
          const peerId = idOf(booking.customer) === req.user.id ? booking.provider : booking.customer;
          const [peer, lastMessage, unreadCount] = await Promise.all([
            User.findById(peerId).select("name avatar phone").lean(),
            populateMessage(Message.findOne({ booking: booking._id, deletedAt: null })
              .sort({ createdAt: -1, _id: -1 })).lean(),
            Message.countDocuments({
              booking: booking._id,
              receiver: req.user.id,
              readAt: null,
              deletedAt: null
            })
          ]);
          return {
            booking: {
              _id: booking._id,
              status: booking.status,
              completedAt: [...(booking.timeline || [])].reverse().find((entry) => entry.status === "COMPLETED")?.at || null,
              service: booking.service,
              customer: booking.customer,
              provider: booking.provider
            },
            participant: peer,
            lastMessage: lastMessage || null,
            unreadCount,
            disabledReason: chatDisabledReason(booking)
          };
        }));
        return res.json({ success: true, conversations });
      } catch (error) {
        return next(error);
      }
    },

    messages: async (req, res, next) => {
      try {
        const booking = await Booking.findById(req.params.bookingId).lean();
        if (!booking) throw httpError("Booking not found.", 404);
        assertChatParticipant(booking, req.user.id);
        assertChatAvailable(booking);
        const limit = Math.max(1, Math.min(Number.parseInt(req.query.limit, 10) || 30, MAX_PAGE_SIZE));
        const filter = { booking: booking._id, deletedAt: null };
        if (req.query.cursor) {
          if (!mongoose.isValidObjectId(req.query.cursor)) throw httpError("Invalid message cursor.", 400);
          const cursor = await Message.findOne({ _id: req.query.cursor, booking: booking._id }).lean();
          if (!cursor) throw httpError("Message cursor not found.", 400);
          filter.$or = [
            { createdAt: { $lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, _id: { $lt: cursor._id } }
          ];
        }
        const results = await populateMessage(
          Message.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1)
        ).lean();
        const hasMore = results.length > limit;
        const page = results.slice(0, limit);
        const nextCursor = hasMore ? String(page[page.length - 1]._id) : null;
        return res.json({
          success: true,
          messages: page.reverse(),
          nextCursor,
          hasMore
        });
      } catch (error) {
        return next(error);
      }
    },

    send: async (req, res, next) => {
      try {
        const result = await createBookingMessage({
          Booking,
          Message,
          bookingId: req.params.bookingId,
          senderId: req.user.id,
          text: req.body.text,
          attachments: req.body.attachments || []
        });
        const message = await populateMessage(Message.findById(result.message._id)).lean();
        req.app.locals.io?.to(`booking:${req.params.bookingId}`).emit("chat:message", message);
        req.app.locals.io?.to(`user:${result.receiver}`).emit("chat:notification", {
          bookingId: req.params.bookingId,
          message
        });
        return res.status(201).json({ success: true, message });
      } catch (error) {
        return next(error);
      }
    },

    read: async (req, res, next) => {
      try {
        const result = await markBookingMessagesRead({
          Booking,
          Message,
          bookingId: req.params.bookingId,
          userId: req.user.id
        });
        const receipt = {
          bookingId: req.params.bookingId,
          userId: req.user.id,
          readAt: result.readAt,
          modifiedCount: result.modifiedCount
        };
        req.app.locals.io?.to(`booking:${req.params.bookingId}`).emit("chat:read", receipt);
        return res.json({ success: true, ...receipt });
      } catch (error) {
        return next(error);
      }
    },

    delete: async (req, res, next) => {
      try {
        const message = await Message.findById(req.params.id);
        if (!message) throw httpError("Message not found.", 404);
        const booking = await Booking.findById(message.booking).lean();
        if (!booking) throw httpError("Booking not found.", 404);
        assertChatParticipant(booking, req.user.id);
        assertChatAvailable(booking);
        if (idOf(message.sender) !== req.user.id) throw httpError("You can only delete your own messages.", 403);
        if (Date.now() - new Date(message.createdAt).getTime() > DELETE_WINDOW_MS) {
          throw httpError("Messages can only be deleted within five minutes of sending.", 409);
        }
        message.deletedAt = new Date();
        await message.save();
        const deleted = { _id: String(message._id), bookingId: String(message.booking), deletedAt: message.deletedAt };
        req.app.locals.io?.to(`booking:${String(message.booking)}`).emit("chat:deleted", deleted);
        return res.json({ success: true, message: deleted });
      } catch (error) {
        return next(error);
      }
    }
  };
}
