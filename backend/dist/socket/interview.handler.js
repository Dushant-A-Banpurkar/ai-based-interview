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
exports.registerInterviewHandlers = void 0;
const sdk_1 = require("@deepgram/sdk");
const interviewSocket_schema_1 = require("../schemas/interviewSocket.schema");
const dotenv = __importStar(require("dotenv"));
const ioredis_1 = __importDefault(require("ioredis"));
const axios_1 = __importDefault(require("axios"));
dotenv.config();
const redis = new ioredis_1.default(process.env.REDIS_URL);
const JUDGE0_API_URL = process.env.JUDGE0_URL || "http://localhost:2358";
const JUDGE0_LANGUAGE_MAP = {
    javascript: 63,
    python: 71,
    cpp: 54,
};
const registerInterviewHandlers = async (io, socket) => {
    const interviewId = socket.handshake.query.interviewId;
    const deepgram = new sdk_1.DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY });
    const dgConnection = await deepgram.listen.v1.createConnection({
        model: "nova-3",
        language: "en",
        encoding: "linear16",
        sample_rate: 16000,
    });
    dgConnection.on("message", (data) => {
        const transcript = data.channel.alternatives[0]?.transcript;
        if (transcript && data.is_final) {
            io.to(interviewId).emit("stt:transcript", { transcript, isFinal: true });
            redis.rpush(`interview:${interviewId}:transcript`, JSON.stringify({ transcript, timestamp: Date.now() }));
        }
    });
    socket.on("audio:stream", (chunk) => {
        if (dgConnection.readyState === 1) {
            dgConnection.sendMedia(chunk);
        }
    });
    socket.on("audio:telemetry", (rawPayload) => {
        const parse = interviewSocket_schema_1.VoiceMetricsSchema.safeParse(rawPayload);
        if (!parse.success)
            return;
        const metrics = parse.data;
    });
    socket.on("meyda_telemetry", async (data) => {
        const parse = interviewSocket_schema_1.VoiceMetricsSchema.safeParse(data);
        if (!parse.success)
            return;
        const metrics = parse.data;
        await redis.rpush(`interview:${interviewId}:telemetry`, JSON.stringify(metrics));
        await redis.expire(`interview:${interviewId}:telemetry`, 86400);
    });
    socket.on("sandbox_execute", async (payload) => {
        const { interviewId, language, code } = payload;
        if (!interviewId)
            return;
        const languageId = JUDGE0_LANGUAGE_MAP[language] || 63;
        try {
            const submissionResponse = await axios_1.default.post(`${JUDGE0_API_URL}/submissions?base64_encoded=false&wait=true`, {
                source_code: code,
                language_id: languageId,
            });
            const { stdout, stderr, compile_output, message } = submissionResponse.data;
            const finalStdout = stdout || null;
            const finalStderr = stderr || compile_output || message || null;
            io.to(interviewId).emit("sandbox_result", {
                stdout: finalStdout,
                stderr: finalStderr,
            });
            await redis.rpush(`interview:${interviewId}:code`, JSON.stringify({
                language,
                code,
                stdout: finalStdout,
                stderr: finalStderr,
                timestamp: Date.now(),
            }));
        }
        catch (error) {
            console.error("Judge0 Execution Error:", error.message);
            io.to(interviewId).emit("sandbox_result", {
                stdout: null,
                stderr: `Execution System Error: ${error.message}`,
                error: "Execution failed",
            });
        }
    });
    socket.on("disconnect", () => {
        dgConnection.close();
    });
};
exports.registerInterviewHandlers = registerInterviewHandlers;
