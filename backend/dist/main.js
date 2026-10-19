"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const interview_routes_1 = __importDefault(require("./routes/interview.routes"));
const interview_handler_1 = require("./socket/interview.handler");
const mongodb_1 = __importDefault(require("./database/mongodb"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const allowedOrigins = [
    "http://localhost:3000",
    "https://ai-based-interview-pi.vercel.app",
    "https://ai-based-interview-git-main-dushant-banpurkar-s-projects.vercel.app",
];
// Unified CORS options for Express & Socket.IO
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.some((o) => origin.startsWith(o))) {
            callback(null, true);
        }
        else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
};
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json());
const io = new socket_io_1.Server(httpServer, {
    cors: corsOptions,
});
app.get("/health", (req, res) => {
    res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});
app.use("/api/interviews", interview_routes_1.default);
io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);
    (0, interview_handler_1.registerInterviewHandlers)(io, socket);
    socket.on("disconnect", () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});
const PORT = process.env.PORT || 5000;
async function startServer() {
    try {
        if (!process.env.DEEPGRAM_API_KEY?.trim()) {
            throw new Error("DEEPGRAM_API_KEY is missing. Set it in the backend environment or backend/.env.");
        }
        console.log("Deepgram API key loaded from the backend environment.");
        await (0, mongodb_1.default)();
        httpServer.listen(PORT, () => {
            console.log(`AI Interview Backend running on port ${PORT}`);
        });
        const renderUrl = process.env.render;
        setInterval(async () => {
            try {
                const response = await fetch(renderUrl);
                console.log(`Keep-alive ping successful: ${response.status}`);
            }
            catch (error) {
                console.error(`Keep-alive ping failed:`, error.message);
            }
        }, 14 * 60 * 1000);
    }
    catch (error) {
        console.error("Failed to initialize backend server: ", error.message);
    }
}
startServer();
