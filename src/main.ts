import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import interviewRoutes from "./routes/interview.routes";
import { registerInterviewHandlers} from "./socket/interview.handler";
import connectMongoDB from "./database/mongodb";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:4000",
      "https://ai-based-job-tracker-frontend.vercel.app",
      "https://ai-based-job-tracker-frontend-gkhw3me4r.vercel.app/",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(cors());
app.use(express.json());

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

const PORT: any = process.env.PORT || 6000;
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
