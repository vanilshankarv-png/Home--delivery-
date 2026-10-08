import jwt from "jsonwebtoken";
import Booking from "../models/Booking.js";
import Message from "../models/Message.js";
import {
  assertChatAvailable,
  assertChatParticipant,
  createBookingMessage,
  markBookingMessagesRead
} from "../services/chatService.js";

function populatedMessage(query) {
  return query.populate("sender", "name avatar").populate("receiver", "name avatar").lean();
}

export function attachChatSockets(io, models = { Booking, Message }) {
  const { Booking: BookingModel, Message: MessageModel } = models;

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
    socket.join(`user:${socket.data.user.id}`);

    socket.on("chat:send", async (payload, acknowledge) => {
      const done = typeof acknowledge === "function" ? acknowledge : () => {};
      const { bookingId, text, attachments, clientMessageId } = payload && typeof payload === "object" ? payload : {};
      if (typeof bookingId !== "string" || !/^[\da-f]{24}$/i.test(bookingId)) {
        done({ success: false, message: "Invalid booking id." });
        return;
      }
      try {
        const result = await createBookingMessage({
          Booking: BookingModel,
          Message: MessageModel,
          bookingId,
          senderId: socket.data.user.id,
          text,
          attachments: Array.isArray(attachments) ? attachments : []
        });
        const message = await populatedMessage(MessageModel.findById(result.message._id));
        io.to(`booking:${bookingId}`).emit("chat:message", { ...message, clientMessageId });
        io.to(`user:${result.receiver}`).emit("chat:notification", { bookingId, message });
        done({ success: true, message, clientMessageId });
      } catch (error) {
        done({ success: false, message: error.message || "Unable to send chat message." });
      }
    });

    socket.on("chat:typing", async (payload) => {
      const { bookingId, isTyping } = payload && typeof payload === "object" ? payload : {};
      if (typeof bookingId !== "string" || !/^[\da-f]{24}$/i.test(bookingId)
        || !socket.rooms.has(`booking:${bookingId}`)) return;
      try {
        const booking = await BookingModel.findById(bookingId).lean();
        if (!booking) return;
        assertChatParticipant(booking, socket.data.user.id);
        assertChatAvailable(booking);
        const receiver = String(booking.customer) === socket.data.user.id
          ? String(booking.provider)
          : String(booking.customer);
        io.to(`user:${receiver}`).emit("chat:typing", {
          bookingId,
          userId: socket.data.user.id,
          isTyping: Boolean(isTyping)
        });
      } catch (error) {
        console.error("Unable to authorize chat typing event:", error);
        socket.emit("chat:error", { bookingId, message: "Typing status could not be sent." });
      }
    });

    socket.on("chat:read", async (payload, acknowledge) => {
      const done = typeof acknowledge === "function" ? acknowledge : () => {};
      const { bookingId } = payload && typeof payload === "object" ? payload : {};
      if (typeof bookingId !== "string" || !/^[\da-f]{24}$/i.test(bookingId)) {
        done({ success: false, message: "Invalid booking id." });
        return;
      }
      try {
        const result = await markBookingMessagesRead({
          Booking: BookingModel,
          Message: MessageModel,
          bookingId,
          userId: socket.data.user.id
        });
        const receipt = {
          bookingId,
          userId: socket.data.user.id,
          readAt: result.readAt,
          modifiedCount: result.modifiedCount
        };
        io.to(`booking:${bookingId}`).emit("chat:read", receipt);
        done({ success: true, ...receipt });
      } catch (error) {
        done({ success: false, message: error.message || "Unable to mark chat as read." });
      }
    });
  });
}

export default attachChatSockets;
