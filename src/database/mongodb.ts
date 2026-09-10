import mongoose from "mongoose";
import * as dotenv from "dotenv";

dotenv.config();

const connectMongoDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.log("mongodburi");
      throw new Error("MONGODB_URI is missing from environment variable");
    }
    const connect = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      family: 4,
    });

    console.log(`MongoDb Connected: ${connect.connection.host}`);

    mongoose.connection.on("Connected", () => {
      console.log("MongoDB event: connected");
    });

    mongoose.connection.on("Error", (error: any) => {
      console.error("MongoDB event: connection error: ", error.message);
    });

    mongoose.connection.on("Warning", () => {
      console.warn("MongoDB event: Disconnected");
    });

    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      console.log("MongoDB closed on app termination");
      process.exit(0);
    });
  } catch (error: any) {
    console.error("Something went wrong on MongoDB connection", error.message);
    process.exit(1);
  }
};

export default connectMongoDB;
