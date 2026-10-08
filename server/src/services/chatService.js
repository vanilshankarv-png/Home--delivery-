const CHAT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function isSafeAttachmentUrl(value) {
  if (typeof value !== "string") return false;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function idOf(value) {
  return String(value?._id || value);
}

export function chatDisabledReason(booking, now = new Date()) {
  if (booking.status === "CANCELLED") return "Chat is disabled for cancelled bookings.";
  const completedAt = (booking.timeline || [])
    .filter((entry) => entry.status === "COMPLETED")
    .map((entry) => new Date(entry.at))
    .sort((first, second) => second - first)[0];
  if (completedAt && now.getTime() - completedAt.getTime() >= CHAT_WINDOW_MS) {
    return "Chat is available for seven days after booking completion.";
  }
  return null;
}

export function assertChatAvailable(booking, now) {
  const reason = chatDisabledReason(booking, now);
  if (reason) {
    const error = new Error(reason);
    error.statusCode = 409;
    throw error;
  }
}

export function assertChatParticipant(booking, userId) {
  const participants = [booking.customer, booking.provider].filter(Boolean);
  if (!participants.some((participant) => idOf(participant) === userId)) {
    const error = new Error("Only booking participants can access this chat.");
    error.statusCode = 403;
    throw error;
  }
  if (!booking.provider) {
    const error = new Error("Chat becomes available after a provider accepts the booking.");
    error.statusCode = 409;
    throw error;
  }
}

export async function createBookingMessage({ Booking, Message, bookingId, senderId, text, attachments = [] }) {
  const booking = await Booking.findById(bookingId).lean();
  if (!booking) {
    const error = new Error("Booking not found.");
    error.statusCode = 404;
    throw error;
  }
  assertChatParticipant(booking, senderId);
  assertChatAvailable(booking);
  const normalizedText = typeof text === "string" ? text.trim() : "";
  if (!normalizedText && attachments.length === 0) {
    const error = new Error("A message needs text or at least one attachment.");
    error.statusCode = 400;
    throw error;
  }
  if (normalizedText.length > 4000 || attachments.length > 5
    || attachments.some((attachment) => (
      typeof attachment?.url !== "string" || attachment.url.length > 2048
      || typeof attachment?.name !== "string" || !attachment.name.trim() || attachment.name.length > 160
      || (attachment.type != null && (typeof attachment.type !== "string" || attachment.type.length > 120))
      || !isSafeAttachmentUrl(attachment.url)
    ))) {
    const error = new Error("Message text or attachments are invalid.");
    error.statusCode = 400;
    throw error;
  }
  const receiver = idOf(booking.customer) === senderId ? booking.provider : booking.customer;
  const message = await Message.create({
    booking: booking._id,
    sender: senderId,
    receiver,
    text: normalizedText,
    attachments
  });
  return { booking, message, receiver: idOf(receiver) };
}

export async function markBookingMessagesRead({ Booking, Message, bookingId, userId }) {
  const booking = await Booking.findById(bookingId).lean();
  if (!booking) {
    const error = new Error("Booking not found.");
    error.statusCode = 404;
    throw error;
  }
  assertChatParticipant(booking, userId);
  assertChatAvailable(booking);
  const readAt = new Date();
  const result = await Message.updateMany(
    { booking: booking._id, receiver: userId, readAt: null, deletedAt: null },
    { $set: { readAt } }
  );
  return { booking, readAt, modifiedCount: result.modifiedCount ?? result.nModified ?? 0 };
}
