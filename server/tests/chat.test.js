import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../src/app.js";
import { attachChatSockets } from "../src/sockets/chat.js";

process.env.JWT_SECRET = "test-only-chat-secret";

const customerId = "222222222222222222222222";
const providerId = "111111111111111111111111";
const strangerId = "333333333333333333333333";
const bookingId = "aaaaaaaaaaaaaaaaaaaaaaaa";

class FakeQuery {
  constructor(value) {
    this.value = value;
  }

  populate() { return this; }
  select() { return this; }
  sort() { return this; }
  limit() { return this; }
  lean() { return Promise.resolve(this.value); }
  then(resolve, reject) { return Promise.resolve(this.value).then(resolve, reject); }
}

function makeContext({ status = "ACCEPTED", completedAt = null } = {}) {
  const booking = {
    _id: bookingId,
    customer: customerId,
    provider: providerId,
    status,
    service: { _id: "dddddddddddddddddddddddd", title: "Tap repair" },
    timeline: completedAt ? [{ status: "COMPLETED", at: completedAt }] : []
  };
  const messages = [];
  const events = [];

  const Booking = {
    findById: () => new FakeQuery(booking),
    find: () => new FakeQuery([booking])
  };
  const Message = {
    async create(fields) {
      const message = {
        ...fields,
        _id: new mongoose.Types.ObjectId().toString(),
        createdAt: new Date(Date.now() + messages.length),
        readAt: null,
        deletedAt: null,
        async save() {}
      };
      messages.push(message);
      return message;
    },
    findById(id) {
      return new FakeQuery(messages.find((message) => String(message._id) === String(id)) || null);
    },
    findOne(filter) {
      const results = messages.filter((message) => (
        (!filter._id || String(message._id) === String(filter._id))
        && (!filter.booking || String(message.booking) === String(filter.booking))
        && (!filter.deletedAt || !message.deletedAt)
      )).sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));
      return new FakeQuery(results[0] || null);
    },
    find(filter) {
      let results = messages.filter((message) => (
        String(message.booking) === String(filter.booking) && !message.deletedAt
      ));
      if (filter.$or) {
        const cursorDate = filter.$or[0].createdAt.$lt;
        results = results.filter((message) => new Date(message.createdAt) < new Date(cursorDate));
      }
      results.sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));
      return new FakeQuery(results);
    },
    async countDocuments(filter) {
      return messages.filter((message) => (
        String(message.booking) === String(filter.booking)
        && String(message.receiver) === String(filter.receiver)
        && !message.readAt
        && !message.deletedAt
      )).length;
    },
    async updateMany(filter, update) {
      let modifiedCount = 0;
      for (const message of messages) {
        if (String(message.booking) === String(filter.booking)
          && String(message.receiver) === String(filter.receiver)
          && !message.readAt && !message.deletedAt) {
          message.readAt = update.$set.readAt;
          modifiedCount += 1;
        }
      }
      return { modifiedCount };
    }
  };
  const User = {
    findById(id) {
      const user = id === customerId
        ? { _id: customerId, name: "Customer" }
        : id === providerId ? { _id: providerId, name: "Provider" } : null;
      return new FakeQuery(user);
    }
  };
  const app = createApp({ chatModels: { Booking, Message, User } });
  app.locals.io = {
    to(room) {
      return { emit: (event, payload) => events.push({ room, event, payload }) };
    }
  };
  const auth = (id, role) => ({
    Authorization: `Bearer ${jwt.sign({ sub: id, role }, process.env.JWT_SECRET)}`
  });
  return {
    app,
    booking,
    messages,
    events,
    customerAuth: auth(customerId, "customer"),
    providerAuth: auth(providerId, "provider"),
    strangerAuth: auth(strangerId, "customer")
  };
}

describe("booking chat APIs", () => {
  it("lists conversations, sends messages, pages history, marks read, and soft deletes", async () => {
    const context = makeContext();
    const sent = await request(context.app)
      .post(`/api/chats/${bookingId}/messages`)
      .set(context.customerAuth)
      .send({ text: "Hello provider" });
    const second = await request(context.app)
      .post(`/api/chats/${bookingId}/messages`)
      .set(context.providerAuth)
      .send({ text: "On my way" });
    const page = await request(context.app)
      .get(`/api/chats/${bookingId}/messages?limit=1`)
      .set(context.customerAuth);
    const olderPage = await request(context.app)
      .get(`/api/chats/${bookingId}/messages?limit=1&cursor=${page.body.nextCursor}`)
      .set(context.customerAuth);
    const conversations = await request(context.app)
      .get("/api/chats")
      .set(context.customerAuth);
    const read = await request(context.app)
      .put(`/api/chats/${bookingId}/read`)
      .set(context.customerAuth);
    const deleted = await request(context.app)
      .delete(`/api/chats/messages/${sent.body.message._id}`)
      .set(context.customerAuth);

    expect(sent.status).toBe(201);
    expect(second.status).toBe(201);
    expect(sent.body.message.receiver).toBe(providerId);
    expect(page.body.messages).toHaveLength(1);
    expect(page.body.messages[0].text).toBe("On my way");
    expect(page.body.hasMore).toBe(true);
    expect(olderPage.body.messages[0].text).toBe("Hello provider");
    expect(conversations.body.conversations[0].unreadCount).toBe(1);
    expect(read.body.modifiedCount).toBe(1);
    expect(deleted.status).toBe(200);
    expect(deleted.body.message.deletedAt).toBeTruthy();
    expect(context.events.some((event) => event.event === "chat:message")).toBe(true);
    expect(context.events.some((event) => event.event === "chat:read")).toBe(true);
    expect(context.events.some((event) => event.event === "chat:deleted")).toBe(true);
  });

  it("enforces booking participants and disables chat after cancellation or seven days", async () => {
    const context = makeContext();
    const stranger = await request(context.app)
      .get(`/api/chats/${bookingId}/messages`)
      .set(context.strangerAuth);
    const cancelled = makeContext({ status: "CANCELLED" });
    const cancelledSend = await request(cancelled.app)
      .post(`/api/chats/${bookingId}/messages`)
      .set(cancelled.customerAuth)
      .send({ text: "Still there?" });
    const expired = makeContext({
      status: "PAID",
      completedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    });
    const expiredRead = await request(expired.app)
      .put(`/api/chats/${bookingId}/read`)
      .set(expired.customerAuth);
    const ownInbox = await request(context.app)
      .get("/api/chats")
      .set(context.customerAuth);

    expect(stranger.status).toBe(403);
    expect(cancelledSend.status).toBe(409);
    expect(expiredRead.status).toBe(409);
    expect(ownInbox.status).toBe(200);
  });

  it("requires authentication and permits deleting only a sender's own message", async () => {
    const context = makeContext();
    const sent = await request(context.app)
      .post(`/api/chats/${bookingId}/messages`)
      .set(context.customerAuth)
      .send({ text: "Private message" });
    const unauthenticated = await request(context.app).get("/api/chats");
    const forbiddenDelete = await request(context.app)
      .delete(`/api/chats/messages/${sent.body.message._id}`)
      .set(context.providerAuth);

    expect(unauthenticated.status).toBe(401);
    expect(forbiddenDelete.status).toBe(403);
  });

  it("validates text and attachment payloads", async () => {
    const context = makeContext();
    const empty = await request(context.app)
      .post(`/api/chats/${bookingId}/messages`)
      .set(context.customerAuth)
      .send({ text: "  " });
    const invalidAttachment = await request(context.app)
      .post(`/api/chats/${bookingId}/messages`)
      .set(context.customerAuth)
      .send({ attachments: [{ url: "javascript:alert(1)", name: "unsafe" }] });
    const attachmentMessage = await request(context.app)
      .post(`/api/chats/${bookingId}/messages`)
      .set(context.customerAuth)
      .send({ attachments: [{ url: "https://example.test/document.pdf", name: "document.pdf" }] });

    expect(empty.status).toBe(400);
    expect(invalidAttachment.status).toBe(400);
    expect(attachmentMessage.status).toBe(201);
  });

  it("rejects deletion after five minutes", async () => {
    const context = makeContext();
    const sent = await request(context.app)
      .post(`/api/chats/${bookingId}/messages`)
      .set(context.customerAuth)
      .send({ text: "Too old to remove" });
    context.messages[0].createdAt = new Date(Date.now() - 6 * 60 * 1000);
    const response = await request(context.app)
      .delete(`/api/chats/messages/${sent.body.message._id}`)
      .set(context.customerAuth);

    expect(response.status).toBe(409);
  });
});

describe("booking chat socket events", () => {
  it("authenticates sockets, persists messages, broadcasts typing and read receipts", async () => {
    const context = makeContext();
    const middlewares = [];
    const handlers = {};
    const io = {
      use(callback) { middlewares.push(callback); },
      on(event, callback) { handlers[event] = callback; },
      to(room) {
        return { emit: (event, payload) => context.events.push({ room, event, payload }) };
      }
    };
    attachChatSockets(io, {
      Booking: { findById: () => new FakeQuery(context.booking) },
      Message: {
        ...context.app.locals.chatMessageModel,
        create: async (fields) => ({
          ...fields,
          _id: new mongoose.Types.ObjectId().toString(),
          createdAt: new Date()
        }),
        findById: () => new FakeQuery({
          _id: new mongoose.Types.ObjectId().toString(),
          booking: bookingId,
          sender: customerId,
          receiver: providerId,
          text: "Socket hello",
          createdAt: new Date()
        }),
        updateMany: async () => ({ modifiedCount: 1 })
      }
    });
    const token = jwt.sign({ sub: customerId, role: "customer" }, process.env.JWT_SECRET);
    const listeners = new Map();
    const socket = {
      handshake: { auth: { token } },
      data: {},
      rooms: new Set([`booking:${bookingId}`]),
      join: (room) => socket.rooms.add(room),
      on: (event, callback) => listeners.set(event, callback)
    };
    await new Promise((resolve, reject) => middlewares[0](socket, (error) => error ? reject(error) : resolve()));
    handlers.connection(socket);
    const sendAck = await new Promise((resolve) => listeners.get("chat:send")({
      bookingId,
      text: "Socket hello",
      clientMessageId: "local-1"
    }, resolve));
    listeners.get("chat:typing")({ bookingId, isTyping: true });
    const readAck = await new Promise((resolve) => listeners.get("chat:read")({ bookingId }, resolve));

    expect(sendAck.success).toBe(true);
    expect(readAck.success).toBe(true);
    expect(context.events.some((event) => event.event === "chat:message")).toBe(true);
    expect(context.events.some((event) => event.event === "chat:typing" && event.room === `user:${providerId}`)).toBe(true);
    expect(context.events.some((event) => event.event === "chat:read")).toBe(true);
  });
});
