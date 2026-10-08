import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema({
  url: { type: String, required: true, trim: true, maxlength: 2048 },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  type: { type: String, trim: true, maxlength: 120, default: "" }
}, { _id: false });

const messageSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, trim: true, maxlength: 4000, default: "" },
  attachments: { type: [attachmentSchema], default: [] },
  readAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null }
}, { timestamps: { createdAt: true, updatedAt: false } });

messageSchema.index({ booking: 1, createdAt: -1, _id: -1 });
messageSchema.index({ receiver: 1, readAt: 1, deletedAt: 1 });

const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);

export default Message;
