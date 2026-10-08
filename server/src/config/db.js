import mongoose from "mongoose";

export async function connectDB() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI is required to connect to MongoDB.");
  }

  const connection = await mongoose.connect(mongoUri);
  console.info(`MongoDB connected: ${connection.connection.host}`);
  return connection;
}
