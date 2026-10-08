import "dotenv/config";
import { createServer } from "node:http";
import { Server } from "socket.io";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import Booking from "./models/Booking.js";
import { attachBookingSockets } from "./sockets/booking.js";
import PricingRule from "./models/PricingRule.js";
import Provider from "./models/Provider.js";
import Service from "./models/Service.js";
import User from "./models/User.js";
import { watchSurgeAreas } from "./services/pricingService.js";
import Tracking from "./models/Tracking.js";
import { attachTrackingSockets } from "./sockets/tracking.js";
import Message from "./models/Message.js";
import { attachChatSockets } from "./sockets/chat.js";

const port = Number(process.env.PORT) || 5000;
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});
let surgeInterval;

app.locals.io = io;

attachBookingSockets(io, { Booking });
attachTrackingSockets(io, { Booking, Tracking });
attachChatSockets(io, { Booking, Message });

async function startServer() {
  if (process.env.MONGO_URI) {
    await connectDB();
    surgeInterval = watchSurgeAreas({
      io,
      PricingRule,
      Provider,
      User,
      Booking,
      Service
    });
  } else {
    console.warn("MONGO_URI is not set; starting without a database connection.");
  }

  httpServer.listen(port, () => {
    console.info(`Home Delivery API listening on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error("Server startup failed:", error);
  process.exitCode = 1;
});

function shutdown() {
  if (surgeInterval) clearInterval(surgeInterval);
  io.close();
  httpServer.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
