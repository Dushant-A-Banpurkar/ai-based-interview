import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import interviewRoutes from "./routes/interview.routes";
import { registerInterviewHandlers } from "./socket/interview.handler";
import connectMongoDB from "./database/mongodb";
import Redis from "ioredis";
import * as dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const app = express();
const httpServer = createServer(app);

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://ai-based-interview-pi.vercel.app",
  "https://ai-based-interview-git-main-dushant-banpurkar-s-projects.vercel.app",
  ...(process.env.FRONTEND_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
];

const isAllowedOrigin = (origin: string) => {
  try {
    const requestUrl = new URL(origin);

    return allowedOrigins.some((allowedOrigin) => {
      const allowedUrl = new URL(allowedOrigin);
      const sameHost =
        requestUrl.hostname === allowedUrl.hostname ||
        requestUrl.hostname.endsWith(`.${allowedUrl.hostname}`);

      return (
        requestUrl.protocol === allowedUrl.protocol &&
        sameHost &&
        (allowedUrl.port === "" || requestUrl.port === allowedUrl.port)
      );
    });
  } catch {
    return false;
  }
};

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

const io = new Server(httpServer, {
  cors: corsOptions,
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

app.get("/ready", (_req, res) => {
  const mongoReady = mongoose.connection.readyState === 1;
  res.status(mongoReady ? 200 : 503).json({
    status: mongoReady ? "ready" : "not_ready",
    checks: {
      mongodb: mongoReady ? "connected" : "disconnected",
    },
  });
});

app.use("/api/interviews", interviewRoutes);

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  registerInterviewHandlers(io, socket);

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT: any = process.env.PORT || 5000;
async function startServer() {
  try {
    if (!process.env.DEEPGRAM_API_KEY?.trim()) {
      throw new Error(
        "DEEPGRAM_API_KEY is missing. Set it in the backend environment or backend/.env.",
      );
    }
    console.log("Deepgram API key loaded from the backend environment.");

    await connectMongoDB();
    await import("./workers/interview.worker.js");
    httpServer.listen(PORT, () => {
      console.log(`AI Interview Backend running on port ${PORT}`);
    });
    const renderUrl = process.env.RENDER!;
    const backupUrl=process.env.RENDER_BACKUP!;
    setInterval(
      async () => {
        try {
          const response = await fetch(renderUrl!);
          const response2=await fetch(backupUrl!);
          console.log(`Keep-alive ping successful of Main Server: ${response.status}`);
          console.log(`Keep-alive ping successful of BackUp Server: ${response2.status}`)
        } catch (error: any) {
          console.error(`Keep-alive ping failed:`, error.message);
        }
      },
      14 * 60 * 1000,
    );
  } catch (error: any) {
    console.error("Failed to initialize backend server: ", error.message);
  }
}
startServer();
