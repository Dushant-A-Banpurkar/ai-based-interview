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


const allowedOrigins = [
  "http://localhost:3000",
  "https://ai-based-interview-pi.vercel.app/",
  "https://ai-based-interview-git-main-dushant-banpurkar-s-projects.vercel.app",
];

// Unified CORS options for Express & Socket.IO
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
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
    const renderUrl = process.env.render!;
    setInterval(
    async () => {
      try {
        const response = await fetch(renderUrl!);
        console.log(`Keep-alive ping successful: ${response.status}`);
      } catch (error:any) {
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
