import mongoose from "mongoose";
import * as dotenv from "dotenv";

dotenv.config();
const mongodbURI:any=process.env.MONGODB_URI;
const connectMongoDB = async ():Promise<void> => {
  try {
    if (!mongodbURI) {
      console.log("mongodburi");
      throw new Error("MONGODB_URI is missing from environment variable");
    }

    mongoose.connection.on("connected", () => {
      console.log("MongoDB event: connected");
    });

    mongoose.connection.on("error", (error: any) => {
      console.error("MongoDB event: connection error: ", error.message);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB event: Disconnected from database.");
    });

    const connect = await mongoose.connect(mongodbURI, {
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      family: 4,
    });

    console.log(`MongoDb Connected: ${connect.connection.host}`);

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
