import jwt from "jsonwebtoken";

export function attachBookingSockets(io, { Booking }) {
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
    } catch (error) {
      return next(new Error("Invalid or expired token."));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;
    socket.join(`user:${user.id}`);
    if (user.role === "provider") socket.join("providers");

    socket.on("booking:leave", (bookingId) => {
      if (typeof bookingId === "string" && /^[\da-f]{24}$/i.test(bookingId)) {
        socket.leave(`booking:${bookingId}`);
      }
    });

    socket.on("booking:join", async (bookingId, acknowledge = () => {}) => {
      if (typeof bookingId !== "string" || !/^[\da-f]{24}$/i.test(bookingId)) {
        acknowledge({ success: false, message: "Invalid booking id." });
        return;
      }

      try {
        const booking = await Booking.findById(bookingId).select("customer provider").lean();
        if (!booking) {
          acknowledge({ success: false, message: "Booking not found." });
          return;
        }
        const isParticipant = [booking.customer, booking.provider]
          .filter(Boolean)
          .some((participant) => String(participant) === user.id);
        if (user.role !== "admin" && !isParticipant) {
          acknowledge({ success: false, message: "You are not allowed to join this booking room." });
          return;
        }
        socket.join(`booking:${bookingId}`);
        acknowledge({ success: true });
      } catch (error) {
        console.error("Unable to authorize booking socket room:", error);
        acknowledge({ success: false, message: "Unable to join booking updates." });
      }
    });
  });
}

export default attachBookingSockets;
