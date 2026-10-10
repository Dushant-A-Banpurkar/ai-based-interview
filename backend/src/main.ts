import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import interviewRoutes from "./routes/interview.routes";
import { registerInterviewHandlers } from "./socket/interview.handler";
import connectMongoDB from "./database/mongodb";
import Redis from "ioredis";
import * as dotenv from "dotenv";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const redis = new Redis(process.env.REDIS_URL!);
// console.log(redis);
// redis.on("connect", async () => {
//   try {
//     console.log(
//       "Connected to Redis Cloud safely! Adjusting eviction strategy...",
//     );
//     await redis.config("SET", "maxmemory-policy", "noeviction");
//     console.log("Eviction configuration set to noeviction successfully.");
//   } catch (error) {
//     console.error("Failed to change configuration policy dynamically:", error);
//   }
// });
const allowedOrigins = [
  "http://localhost:3000",
  "https://ai-based-job-tracker-frontend.vercel.app",
  "https://ai-based-job-tracker-frontend-gkhw3me4r.vercel.app",
];

// Unified CORS options for Express & Socket.IO
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server requests or matching origins (handling optional trailing slashes)
    if (!origin || allowedOrigins.some((o) => origin.startsWith(o))) {
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
    await connectMongoDB();
    httpServer.listen(PORT, () => {
      console.log(`AI Interview Backend running on port ${PORT}`);
    });
  } catch (error: any) {
    console.error("Failed to initialize backend server: ", error.message);
  }
}
startServer();
