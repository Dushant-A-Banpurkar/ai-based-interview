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
const interviewAssistant_service_1 = require("../services/interviewAssistant.service");
const interview_model_1 = require("../model/interview.model");
dotenv.config();
const redis = new ioredis_1.default(process.env.REDIS_URL);
const JUDGE0_API_URL = process.env.JUDGE0_URL || "http://localhost:2358";
const JUDGE0_LANGUAGE_MAP = {
    javascript: 63,
    python: 71,
    cpp: 54,
};
function toPcmBuffer(chunk) {
    if (Buffer.isBuffer(chunk))
        return chunk;
    if (chunk instanceof ArrayBuffer)
        return Buffer.from(chunk);
    if (ArrayBuffer.isView(chunk)) {
        return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    }
    return null;
}
const CODING_ASSIGNMENT = [
    {
        problemId: "two-sum",
        prompt: "Given an array of integers and a target, return the indices of two numbers that add up to the target.",
        difficulty: "beginner",
        minimumInterviewMinutes: 30,
        timeLimitMinutes: 8,
    },
    {
        problemId: "valid-parentheses",
        prompt: "Given a string containing parentheses, determine whether the brackets are balanced.",
        difficulty: "medium",
        minimumInterviewMinutes: 30,
        timeLimitMinutes: 8,
    },
    {
        problemId: "longest-substring",
        prompt: "Given a string, return the length of its longest substring without repeating characters.",
        difficulty: "hard",
        minimumInterviewMinutes: 30,
        timeLimitMinutes: 10,
    },
    {
        problemId: "graph-shortest-path",
        prompt: "Given a weighted graph and two vertices, find the minimum-cost path between them.",
        difficulty: "extreme",
        minimumInterviewMinutes: 50,
        timeLimitMinutes: 15,
    },
];
function getCodingAssignment(durationMinutes, difficulty) {
    if (durationMinutes === 15)
        return null;
    return (CODING_ASSIGNMENT.find((assignment) => assignment.difficulty === difficulty &&
        assignment.minimumInterviewMinutes <= durationMinutes) ?? null);
}
const registerInterviewHandlers = async (io, socket) => {
    const interviewId = socket.handshake.query.interviewId;
    socket.join(interviewId);
    let interviewDurationMinutes = null;
    let interviewStartedAt = null;
    let dgConnection = null;
    const pendingAudioChunks = [];
    const maxPendingAudioChunks = 8;
    let audioDropWarningLogged = false;
    let deepgramUnavailable = false;
    let firstAudioChunkLogged = false;
    let firstDeepgramMessageLogged = false;
    let interviewerQueue = Promise.resolve();
    let answerSilenceTimer = null;
    let questionRepeatTimer = null;
    let pendingTranscriptSegments = [];
    let lastInterviewerQuestion = "";
    let codingAssignment = null;
    let codingActive = false;
    let codingFinishing = false;
    let codingStartedAt = null;
    let latestCode = "";
    let latestLanguage = "javascript";
    let pendingCodingContext = null;
    let codingTimeout = null;
    const finishCoding = async (reason, finalCode, finalLanguage) => {
        if (!codingActive || codingFinishing || !codingAssignment)
            return;
        codingFinishing = true;
        const code = finalCode ?? latestCode;
        const language = finalLanguage ?? latestLanguage;
        const languageId = JUDGE0_LANGUAGE_MAP[language] ?? 63;
        const timeSpentSeconds = codingStartedAt === null
            ? 0
            : Math.floor((Date.now() - codingStartedAt) / 1000);
        try {
            await interview_model_1.CodeSubmissionModel.create({
                interviewId,
                languageId,
                sourceCode: code,
                problemId: codingAssignment.problemId,
                problemPrompt: codingAssignment.prompt,
                submissionStatus: reason === "timed_out" ? "timed_out" : "attempted",
                timeSpentSeconds,
            });
            await redis.rpush(`interview:${interviewId}:transcript`, JSON.stringify({
                sender: "ai",
                text: `Coding assignment: ${codingAssignment.prompt}`,
                timestamp: Date.now(),
            }), JSON.stringify({
                sender: "candidate",
                text: `Coding ${reason}. Language: ${language}. Code:\n${code}`,
                timestamp: Date.now(),
            }));
            codingActive = false;
            codingFinishing = false;
            if (codingTimeout) {
                clearTimeout(codingTimeout);
                codingTimeout = null;
            }
            const remainingMinutes = interviewDurationMinutes === null || interviewStartedAt === null
                ? 0
                : Math.max(0, Math.ceil(interviewDurationMinutes -
                    (Date.now() - interviewStartedAt) / 60_000));
            try {
                const rawTranscript = await redis.lrange(`interview:${interviewId}:transcript`, -20, -1);
                const conversation = rawTranscript
                    .map((entry) => JSON.parse(entry))
                    .filter((entry) => (entry.sender === "ai" || entry.sender === "candidate") &&
                    typeof entry.text === "string");
                const codingContext = {
                    problemPrompt: codingAssignment.prompt,
                    language,
                    sourceCode: code,
                    outcome: reason === "timed_out" ? "timed_out" : "attempted",
                    timeSpentSeconds,
                };
                pendingCodingContext = codingContext;
                const aiText = await (0, interviewAssistant_service_1.generateInterviewerResponse)(conversation, interviewDurationMinutes ?? 0, remainingMinutes, codingContext);
                await redis.rpush(`interview:${interviewId}:transcript`, JSON.stringify({
                    sender: "ai",
                    text: aiText,
                    timestamp: Date.now(),
                }));
                io.to(interviewId).emit("ai_transcript", {
                    role: "ai",
                    text: aiText,
                    timestamp: Date.now(),
                });
            }
            catch (error) {
                console.error(`Failed to generate interview follow-up after coding for interview ${interviewId}`, error);
                io.to(interviewId).emit("interview:error", {
                    message: "The submission was saved, but the interviewer could not continue.",
                });
            }
            io.to(interviewId).emit("coding:completed", {
                reason,
                submissionStatus: reason === "timed_out" ? "timed_out" : "attempted",
            });
            io.to(interviewId).emit("phase_change", "technical_qa");
        }
        catch (error) {
            codingFinishing = false;
            throw error;
        }
    };
    const clearQuestionRepeatTimer = () => {
        if (questionRepeatTimer) {
            clearTimeout(questionRepeatTimer);
            questionRepeatTimer = null;
        }
    };
    const scheduleQuestionRepeat = () => {
        clearQuestionRepeatTimer();
        if (!lastInterviewerQuestion)
            return;
        questionRepeatTimer = setTimeout(() => {
            const repeatedQuestion = `I haven't heard a response yet. Let me repeat the question: ${lastInterviewerQuestion}`;
            io.to(interviewId).emit("ai_transcript", {
                role: "ai",
                text: repeatedQuestion,
                timestamp: Date.now(),
            });
            void redis
                .rpush(`interview:${interviewId}:transcript`, JSON.stringify({
                sender: "ai",
                text: repeatedQuestion,
                timestamp: Date.now(),
            }))
                .catch((error) => {
                console.error(`Failed to save repeated question for interview ${interviewId}:`, error);
            });
            scheduleQuestionRepeat();
        }, 12000);
    };
    const queueCandidateAnswer = (answer) => {
        interviewerQueue = interviewerQueue
            .then(async () => {
            await redis.rpush(`interview:${interviewId}:transcript`, JSON.stringify({
                sender: "candidate",
                text: answer,
                timestamp: Date.now(),
            }));
            if (codingActive)
                return;
            const recentTranscript = await redis.lrange(`interview:${interviewId}:transcript`, -20, -1);
            const conversation = recentTranscript
                .map((entry) => JSON.parse(entry))
                .filter((entry) => (entry.sender === "ai" || entry.sender === "candidate") &&
                typeof entry.text === "string");
            if (interviewDurationMinutes === null || interviewStartedAt === null) {
                throw new Error("Interview duration or start time is unavailable.");
            }
            const elapsedMinutes = (Date.now() - interviewStartedAt) / 60_000;
            const remainingMinutes = Math.max(0, Math.ceil(interviewDurationMinutes - elapsedMinutes));
            const aiText = await (0, interviewAssistant_service_1.generateInterviewerResponse)(conversation, interviewDurationMinutes, remainingMinutes, pendingCodingContext ?? undefined);
            await redis.rpush(`interview:${interviewId}:transcript`, JSON.stringify({
                sender: "ai",
                text: aiText,
                timestamp: Date.now(),
            }));
            io.to(interviewId).emit("ai_transcript", {
                role: "ai",
                text: aiText,
                timestamp: Date.now(),
            });
            lastInterviewerQuestion = aiText;
            scheduleQuestionRepeat();
            pendingCodingContext = null;
        })
            .catch((error) => {
            console.error(`Interviewer response generation failed for interview ${interviewId}:`, error);
            io.to(interviewId).emit("interview:error", {
                message: error instanceof interviewAssistant_service_1.InterviewerProviderError
                    ? error.userMessage
                    : "The interviewer could not generate a response. Please try again.",
            });
        });
    };
    // 1. Register socket listeners immediately so early events are not missed
    socket.on("audio:stream", (rawChunk) => {
        const chunk = toPcmBuffer(rawChunk);
        if (!chunk?.length || chunk.length % 2 !== 0) {
            console.warn(`Rejected invalid PCM audio chunk for interview ${interviewId}.`);
            return;
        }
        if (dgConnection?.readyState === 1) {
            try {
                dgConnection.sendMedia(chunk);
            }
            catch (error) {
                console.error(`Failed to forward audio to Deepgram for interview ${interviewId}:`, error);
                return;
            }
            if (!firstAudioChunkLogged) {
                console.info(`Forwarding PCM audio to Deepgram for interview ${interviewId} (${chunk.length} bytes per chunk).`);
                firstAudioChunkLogged = true;
            }
            return;
        }
        if (deepgramUnavailable ||
            (dgConnection && dgConnection.readyState === 3)) {
            if (!audioDropWarningLogged) {
                console.warn(`Discarding audio because Deepgram is unavailable for interview ${interviewId}.`);
                audioDropWarningLogged = true;
            }
            return;
        }
        if (pendingAudioChunks.length === maxPendingAudioChunks) {
            pendingAudioChunks.shift();
            if (!audioDropWarningLogged) {
                console.warn(`Audio chunks dropped while Deepgram was unavailable for interview ${interviewId}.`);
                audioDropWarningLogged = true;
            }
        }
        pendingAudioChunks.push(chunk);
    });
    socket.on("meyda_telemetry", async (data) => {
        const parse = interviewSocket_schema_1.VoiceMetricsSchema.safeParse({ ...data, interviewId });
        if (!parse.success || !parse.data) {
            console.log("Telemetry validation failed: ", parse);
            return;
        }
        io.to(interviewId).emit("meyda_tick", {
            rms: parse.data.rms,
            spectralCentroid: parse.data.spectralCentroid,
            zcr: parse.data.zcr,
        });
        try {
            await redis.rpush(`interview:${interviewId}:telemetry`, JSON.stringify(parse.data));
            await redis.expire(`interview:${interviewId}:telemetry`, 86400);
        }
        catch (error) {
            console.error(`Failed to store audio telemetry for interview ${interviewId}:`, error);
        }
    });
    socket.on("start_interview", async () => {
        try {
            const interview = await interview_model_1.InterviewModel.findById(interviewId).select("durationMinutes difficultyMode");
            if (!interview) {
                io.to(interviewId).emit("interview:error", {
                    message: "Interview session not found.",
                });
                return;
            }
            interviewDurationMinutes = interview.durationMinutes;
            if (interviewStartedAt === null) {
                interviewStartedAt = Date.now();
            }
            codingAssignment =
                interview.durationMinutes === 15
                    ? null
                    : await getCodingAssignment(interview.durationMinutes, interview.difficultyMode);
        }
        catch (error) {
            console.error(`Failed to load interview ${interviewId}:`, error);
            io.to(interviewId).emit("interview:error", {
                message: "Could not load the interview session.",
            });
            return;
        }
        const greetingText = "Hello! Let's get started with your technical assessment. Can you walk me through your background?";
        io.to(interviewId).emit("ai_transcript", {
            role: "ai",
            text: greetingText,
            timestamp: Date.now(),
        });
        await redis.rpush(`interview:${interviewId}:transcript`, JSON.stringify({
            sender: "ai",
            text: greetingText,
            timestamp: Date.now(),
        }));
        lastInterviewerQuestion = greetingText;
        scheduleQuestionRepeat();
    });
    socket.on("start_coding", () => {
        if (!codingAssignment) {
            io.to(interviewId).emit("coding:unavailable", {
                message: "No coding assignment is available for this interview.",
            });
            return;
        }
        codingActive = true;
        codingFinishing = false;
        codingStartedAt = Date.now();
        latestCode = "";
        clearQuestionRepeatTimer();
        io.to(interviewId).emit("phase_change", "live_coding");
        io.to(interviewId).emit("coding:started", {
            problemId: codingAssignment.problemId,
            prompt: codingAssignment.prompt,
            timeLimitMinutes: codingAssignment.timeLimitMinutes,
        });
        codingTimeout = setTimeout(() => {
            void finishCoding("timed_out").catch((error) => {
                console.error(`Failed to save timed_out coding submission for interview ${interviewId}:`, error);
                io.to(interviewId).emit("interview:error", {
                    message: "Could not save the coding submission.",
                });
            });
        }, codingAssignment.timeLimitMinutes * 60_000);
    });
    socket.on("audio:telemetry", (rawPayload) => {
        const parse = interviewSocket_schema_1.VoiceMetricsSchema.safeParse(rawPayload);
        if (!parse.success)
            return;
    });
    socket.on("sandbox_execute", async (payload) => {
        const { interviewId, language, code } = payload;
        if (!interviewId)
            return;
        const languageId = JUDGE0_LANGUAGE_MAP[language] || 63;
        if (codingActive) {
            latestCode = code;
            latestLanguage = language;
        }
        try {
            const submissionResponse = await axios_1.default.post(`${JUDGE0_API_URL}/submissions?base64_encoded=false&wait=true`, {
                source_code: code,
                language_id: languageId,
            });
            const { stdout, stderr, compile_output, message, status } = submissionResponse.data;
            const finalStdout = stdout || null;
            const finalStderr = stderr || compile_output || message || null;
            io.to(interviewId).emit("sandbox_result", {
                stdout: finalStdout,
                stderr: finalStderr,
            });
            await redis.rpush(`interview:${interviewId}:code`, JSON.stringify({
                language,
                code,
                sandboxResult: {
                    stdout: finalStdout,
                    stderr: finalStderr,
                    status: {
                        id: status?.id ?? -1,
                        description: status?.description ?? "Unknown",
                    },
                },
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
    socket.on("submit_coding", async (payload) => {
        if (!codingActive) {
            io.to(interviewId).emit("interview:error", {
                message: "There is no active coding assignment to submit.",
            });
            return;
        }
        try {
            await finishCoding("submitted", payload.code, payload.language);
        }
        catch (error) {
            console.error(`Failed to save coding submission for interview ${interviewId}:`, error);
            io.to(interviewId).emit("interview:error", {
                message: "Could not save the coding submission.",
            });
        }
    });
    socket.on("disconnect", () => {
        pendingAudioChunks.length = 0;
        pendingTranscriptSegments = [];
        deepgramUnavailable = true;
        clearQuestionRepeatTimer();
        if (answerSilenceTimer) {
            clearTimeout(answerSilenceTimer);
            answerSilenceTimer = null;
        }
        if (dgConnection) {
            dgConnection.close();
        }
    });
    // 2. Initialize Deepgram connection asynchronously
    try {
        const deepgram = new sdk_1.DeepgramClient({
            apiKey: process.env.DEEPGRAM_API_KEY,
        });
        dgConnection = await deepgram.listen.v1.createConnection({
            model: "nova-3",
            language: "en",
            encoding: "linear16",
            sample_rate: 16000,
            interim_results: "true",
            endpointing: 1000,
            utterance_end_ms: 1000,
            vad_events: "true",
        });
        dgConnection.on("error", (error) => {
            deepgramUnavailable = true;
            console.error(`Deepgram connection error for interview ${interviewId}:`, error);
        });
        dgConnection.on("close", () => {
            deepgramUnavailable = true;
        });
        dgConnection.on("message", (data) => {
            if (!firstDeepgramMessageLogged) {
                console.info(`Received the first Deepgram response for interview ${interviewId}.`);
                firstDeepgramMessageLogged = true;
            }
            if (data?.type === "SpeechStarted") {
                clearQuestionRepeatTimer();
                return;
            }
            const transcript = data?.channel?.alternatives?.[0]?.transcript?.trim();
            if (transcript && data.is_final) {
                clearQuestionRepeatTimer();
                pendingTranscriptSegments.push(transcript);
                const answerInProgress = pendingTranscriptSegments.join(" ");
                io.to(interviewId).emit("stt:transcript", {
                    transcript: answerInProgress,
                    isFinal: false,
                });
                if (answerSilenceTimer)
                    clearTimeout(answerSilenceTimer);
                answerSilenceTimer = setTimeout(() => {
                    answerSilenceTimer = null;
                    const answer = pendingTranscriptSegments.join(" ").trim();
                    pendingTranscriptSegments = [];
                    if (!answer)
                        return;
                    io.to(interviewId).emit("stt:transcript", {
                        transcript: answer,
                        isFinal: true,
                    });
                    queueCandidateAnswer(answer);
                    if (codingActive) {
                        return;
                    }
                }, 20000);
            }
        });
        const connectionToOpen = dgConnection;
        const connectionOpened = connectionToOpen.waitForOpen();
        connectionToOpen.connect();
        let openTimeout;
        try {
            await Promise.race([
                connectionOpened,
                new Promise((_, reject) => {
                    openTimeout = setTimeout(() => reject(new Error(`Timed out waiting for Deepgram to open for interview ${interviewId}`)), 15000);
                }),
            ]);
        }
        finally {
            if (openTimeout)
                clearTimeout(openTimeout);
        }
        if (connectionToOpen.readyState !== 1) {
            throw new Error(`Deepgram connection did not remain open for interview ${interviewId}`);
        }
        deepgramUnavailable = false;
        console.log("Deepgram connection successfully opened for interview: " + interviewId);
        while (pendingAudioChunks.length > 0 && connectionToOpen.readyState === 1) {
            const chunk = pendingAudioChunks[0];
            connectionToOpen.sendMedia(chunk);
            pendingAudioChunks.shift();
        }
        if (pendingAudioChunks.length > 0) {
            console.warn(`Discarding ${pendingAudioChunks.length} buffered audio chunks because Deepgram is not ready for interview ${interviewId}.`);
            pendingAudioChunks.length = 0;
        }
        audioDropWarningLogged = false;
    }
    catch (err) {
        console.error("Deepgram connection initialization error:", err);
        deepgramUnavailable = true;
        pendingAudioChunks.length = 0;
        dgConnection?.close();
        dgConnection = null;
    }
};
exports.registerInterviewHandlers = registerInterviewHandlers;
