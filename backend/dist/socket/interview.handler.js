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
exports.finalizeActiveCodingForInterview = finalizeActiveCodingForInterview;
const sdk_1 = require("@deepgram/sdk");
const interviewSocket_schema_1 = require("../schemas/interviewSocket.schema");
const dotenv = __importStar(require("dotenv"));
const ioredis_1 = __importDefault(require("ioredis"));
const interviewAssistant_service_1 = require("../services/interviewAssistant.service");
const interview_model_1 = require("../model/interview.model");
const codingAssignment_service_1 = require("../services/codingAssignment.service");
const codingSubmission_service_1 = require("../services/codingSubmission.service");
const interviewCoding_handler_1 = require("./interviewCoding.handler");
dotenv.config();
const redis = new ioredis_1.default(process.env.REDIS_URL);
const interviewCodingFinalizers = new Map();
async function finalizeActiveCodingForInterview(interviewId) {
    const finalizers = [...(interviewCodingFinalizers.get(interviewId) ?? [])];
    await Promise.all(finalizers.map((finalize) => finalize()));
}
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
    let pendingSpeechDuringCoding = false;
    let lastInterviewerQuestion = "";
    let lastCandidateSpeechObservedAt = 0;
    let interviewPromptContext = null;
    let codingAssignment = null;
    let allowedLanguages = [];
    let enableSandbox = true;
    let interviewStartHandled = false;
    let interviewStartInProgress = false;
    let phaseVersion = 0;
    let codingActive = false;
    let codingFinishing = false;
    let latestCode = "";
    let latestLanguage = "javascript";
    let codingTimeout = null;
    const finishCoding = async (reason, finalCode, finalLanguage) => {
        if (!codingActive || codingFinishing || !codingAssignment)
            return;
        codingFinishing = true;
        const code = finalCode ?? latestCode;
        const language = finalLanguage ?? latestLanguage;
        try {
            const submission = await (0, codingSubmission_service_1.finalizeCodingSubmission)(interviewId, reason, code, language);
            if (!submission) {
                codingActive = false;
                codingFinishing = false;
                if (codingTimeout) {
                    clearTimeout(codingTimeout);
                    codingTimeout = null;
                }
                return;
            }
            const timeSpentSeconds = submission.timeSpentSeconds ?? 0;
            const assignment = codingAssignment.public;
            codingActive = false;
            codingFinishing = false;
            phaseVersion += 1;
            if (codingTimeout) {
                clearTimeout(codingTimeout);
                codingTimeout = null;
            }
            const finalReason = reason === "submitted" ? "submitted" : reason;
            try {
                await redis.rpush(`interview:${interviewId}:transcript`, JSON.stringify({
                    sender: "ai",
                    text: `Coding assignment: ${assignment.statement}`,
                    timestamp: Date.now(),
                }), JSON.stringify({
                    sender: "candidate",
                    text: `Coding ${finalReason}. Language: ${language}. Code:\n${code}`,
                    timestamp: Date.now(),
                }));
            }
            catch (error) {
                console.error(`Failed to add coding submission to transcript ${interviewId}:`, error);
            }
            if (reason === "interview_ended") {
                io.to(interviewId).emit("coding:completed", {
                    reason,
                    submissionStatus: submission.submissionStatus,
                    testSummary: submission.testSummary,
                });
                return;
            }
            try {
                const rawTranscript = await redis.lrange(`interview:${interviewId}:transcript`, -20, -1);
                const conversation = rawTranscript
                    .map((entry) => JSON.parse(entry))
                    .filter((entry) => (entry.sender === "ai" || entry.sender === "candidate") &&
                    typeof entry.text === "string");
                const codingContext = {
                    problemPrompt: assignment.statement,
                    language,
                    sourceCode: submission.sourceCode ?? code,
                    outcome: submission.submissionStatus,
                    timeSpentSeconds,
                    testSummary: submission.testSummary,
                };
                if (interviewDurationMinutes === null ||
                    interviewStartedAt === null ||
                    !interviewPromptContext) {
                    throw new Error("Interview context is unavailable after coding.");
                }
                const remainingMinutes = Math.max(0, Math.ceil(interviewDurationMinutes -
                    (Date.now() - interviewStartedAt) / 60_000));
                const aiText = await (0, interviewAssistant_service_1.generateInterviewerResponse)(conversation, interviewDurationMinutes, remainingMinutes, interviewPromptContext, codingContext);
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
            }
            catch (error) {
                console.error(`Failed to generate interview follow-up after coding for interview ${interviewId}`, error);
                io.to(interviewId).emit("interview:error", {
                    message: "The submission was saved, but the interviewer could not continue.",
                });
            }
            io.to(interviewId).emit("coding:completed", {
                reason: finalReason,
                submissionStatus: submission.submissionStatus,
                testSummary: submission.testSummary,
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
    const scheduleCodingTimeout = (remainingSeconds) => {
        if (codingTimeout)
            clearTimeout(codingTimeout);
        codingTimeout = setTimeout(() => {
            void finishCoding("timed_out").catch((error) => {
                console.error(`Failed to save timed-out coding submission for interview ${interviewId}:`, error);
                io.to(interviewId).emit("coding:submission_failed", {
                    message: "Could not save your timed-out coding submission. Please try submitting again.",
                });
                io.to(interviewId).emit("interview:error", {
                    message: "Could not save the coding submission.",
                });
            });
        }, Math.max(0, remainingSeconds) * 1000);
    };
    const scheduleQuestionRepeat = () => {
        clearQuestionRepeatTimer();
        if (!lastInterviewerQuestion)
            return;
        const now = Date.now();
        if (pendingTranscriptSegments.length > 0 ||
            (lastCandidateSpeechObservedAt > 0 && now - lastCandidateSpeechObservedAt < 15000)) {
            return;
        }
        questionRepeatTimer = setTimeout(() => {
            questionRepeatTimer = null;
            const nowAfterDelay = Date.now();
            if (pendingTranscriptSegments.length > 0 ||
                (lastCandidateSpeechObservedAt > 0 &&
                    nowAfterDelay - lastCandidateSpeechObservedAt < 15000)) {
                return;
            }
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
        }, 12000);
    };
    const queueCandidateAnswer = (answer, generateResponse) => {
        const queuedPhaseVersion = phaseVersion;
        interviewerQueue = interviewerQueue
            .then(async () => {
            clearQuestionRepeatTimer();
            lastCandidateSpeechObservedAt = Date.now();
            await redis.rpush(`interview:${interviewId}:transcript`, JSON.stringify({
                sender: "candidate",
                text: answer,
                timestamp: Date.now(),
            }));
            if (!generateResponse ||
                codingActive ||
                queuedPhaseVersion !== phaseVersion) {
                return;
            }
            const recentTranscript = await redis.lrange(`interview:${interviewId}:transcript`, -20, -1);
            const conversation = recentTranscript
                .map((entry) => JSON.parse(entry))
                .filter((entry) => (entry.sender === "ai" || entry.sender === "candidate") &&
                typeof entry.text === "string");
            if (interviewDurationMinutes === null || interviewStartedAt === null) {
                throw new Error("Interview duration or start time is unavailable.");
            }
            if (!interviewPromptContext) {
                throw new Error("Interview focus context is unavailable.");
            }
            const elapsedMinutes = (Date.now() - interviewStartedAt) / 60_000;
            const remainingMinutes = Math.max(0, Math.ceil(interviewDurationMinutes - elapsedMinutes));
            const aiText = await (0, interviewAssistant_service_1.generateInterviewerResponse)(conversation, interviewDurationMinutes, remainingMinutes, interviewPromptContext);
            if (codingActive || queuedPhaseVersion !== phaseVersion)
                return;
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
    const flushPendingCandidateSpeech = () => {
        const answer = pendingTranscriptSegments.join(" ").trim();
        pendingTranscriptSegments = [];
        pendingSpeechDuringCoding = false;
        if (answer)
            queueCandidateAnswer(answer, false);
    };
    const finalizeOnInterviewEnd = async () => {
        clearQuestionRepeatTimer();
        if (codingTimeout) {
            clearTimeout(codingTimeout);
            codingTimeout = null;
        }
        if (answerSilenceTimer) {
            clearTimeout(answerSilenceTimer);
            answerSilenceTimer = null;
        }
        flushPendingCandidateSpeech();
        await interviewerQueue;
        await finishCoding("interview_ended");
    };
    const finalizers = interviewCodingFinalizers.get(interviewId) ?? new Set();
    finalizers.add(finalizeOnInterviewEnd);
    interviewCodingFinalizers.set(interviewId, finalizers);
    (0, interviewCoding_handler_1.registerCodingHandlers)({
        io,
        socket,
        interviewId,
        redis,
        get interviewDurationMinutes() {
            return interviewDurationMinutes;
        },
        get interviewStartedAt() {
            return interviewStartedAt;
        },
        get codingAssignment() {
            return codingAssignment;
        },
        get allowedLanguages() {
            return allowedLanguages;
        },
        get enableSandbox() {
            return enableSandbox;
        },
        get codingActive() {
            return codingActive;
        },
        set codingActive(value) {
            codingActive = value;
        },
        get codingFinishing() {
            return codingFinishing;
        },
        get phaseVersion() {
            return phaseVersion;
        },
        set phaseVersion(value) {
            phaseVersion = value;
        },
        get latestCode() {
            return latestCode;
        },
        set latestCode(value) {
            latestCode = value;
        },
        get latestLanguage() {
            return latestLanguage;
        },
        set latestLanguage(value) {
            latestLanguage = value;
        },
        get pendingTranscriptSegments() {
            return pendingTranscriptSegments;
        },
        get pendingSpeechDuringCoding() {
            return pendingSpeechDuringCoding;
        },
        set pendingSpeechDuringCoding(value) {
            pendingSpeechDuringCoding = value;
        },
        clearQuestionRepeatTimer,
        scheduleCodingTimeout,
        finishCoding,
    });
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
        if (interviewStartHandled || interviewStartInProgress)
            return;
        interviewStartInProgress = true;
        let shouldGreet = false;
        try {
            let interview = await interview_model_1.InterviewModel.findById(interviewId);
            if (!interview) {
                io.to(interviewId).emit("interview:error", {
                    message: "Interview session not found.",
                });
                return;
            }
            if (interview.status === "processing" || interview.status === "completed") {
                io.to(interviewId).emit("interview:error", {
                    message: "This interview has already ended.",
                });
                return;
            }
            if (interview.status === "scheduled") {
                const now = new Date();
                const started = await interview_model_1.InterviewModel.updateOne({ _id: interviewId, status: "scheduled" }, {
                    $set: {
                        status: "live",
                        interviewStartedAt: now,
                    },
                });
                shouldGreet = started.modifiedCount === 1;
                interview = await interview_model_1.InterviewModel.findById(interviewId);
                if (!interview)
                    throw new Error("Interview session disappeared.");
            }
            interviewDurationMinutes = interview.durationMinutes;
            interviewStartedAt =
                interview.interviewStartedAt?.getTime() ?? Date.now();
            interviewPromptContext = {
                roleTitle: interview.roleTitle,
                targetSkills: interview.targetSkills ?? [],
                jobDescription: interview.jobDescription,
                difficultyMode: interview.difficultyMode,
                resumeText: interview.resumeText ?? "",
            };
            allowedLanguages = (interview.allowedLanguages ?? []).map(codingAssignment_service_1.normalizeCodingLanguage);
            enableSandbox = interview.enableSandbox;
            if (interview.durationMinutes === 15) {
                codingAssignment = null;
            }
            else {
                codingAssignment = interview.codingAssignment ?? null;
                if (!codingAssignment) {
                    const codingTimeLimitSeconds = interview.durationMinutes === 30 ? 8 * 60 : 15 * 60;
                    codingAssignment = (0, codingAssignment_service_1.selectCodingAssignment)({
                        roleTitle: interview.roleTitle,
                        targetSkills: interview.targetSkills ?? [],
                        jobDescription: interview.jobDescription,
                        difficultyMode: interview.difficultyMode,
                        allowedLanguages,
                        codingTimeLimitSeconds,
                    });
                    if (codingAssignment) {
                        interview.codingAssignment = codingAssignment;
                        await interview.save();
                    }
                }
            }
            if (interview.codingStatus === "active" && codingAssignment) {
                codingActive = true;
                phaseVersion += 1;
                latestCode = interview.codingDraft ?? "";
                latestLanguage = interview.codingLanguage ?? "javascript";
                const startedAt = interview.codingStartedAt?.getTime() ?? Date.now();
                const codingTimeRemaining = Math.max(0, codingAssignment.public.timeLimitSeconds -
                    Math.floor((Date.now() - startedAt) / 1000));
                const interviewTimeRemaining = Math.max(0, interviewDurationMinutes * 60 -
                    Math.floor((Date.now() - interviewStartedAt) / 1000) -
                    interviewCoding_handler_1.INTERVIEW_CLOSING_RESERVE_SECONDS);
                const remainingSeconds = Math.min(codingTimeRemaining, interviewTimeRemaining);
                io.to(interviewId).emit("phase_change", "live_coding");
                io.to(interviewId).emit("coding:started", {
                    ...(0, codingAssignment_service_1.toClientAssignment)(codingAssignment),
                    prompt: codingAssignment.public.statement,
                    timeLimitSeconds: remainingSeconds,
                    timeLimitMinutes: Math.ceil(remainingSeconds / 60),
                    allowedLanguages,
                    language: latestLanguage,
                    draft: latestCode,
                });
                scheduleCodingTimeout(remainingSeconds);
            }
            interviewStartHandled = true;
        }
        catch (error) {
            console.error(`Failed to load interview ${interviewId}:`, error);
            io.to(interviewId).emit("interview:error", {
                message: "Could not load the interview session.",
            });
            return;
        }
        finally {
            interviewStartInProgress = false;
        }
        if (!shouldGreet)
            return;
        const greetingText = "Hello! Let's get started with your technical assessment. Can you walk me through your background?";
        try {
            await redis.rpush(`interview:${interviewId}:transcript`, JSON.stringify({
                sender: "ai",
                text: greetingText,
                timestamp: Date.now(),
            }));
        }
        catch (error) {
            console.error(`Failed to save interview greeting ${interviewId}:`, error);
            io.to(interviewId).emit("interview:error", {
                message: "Could not start the interview.",
            });
            return;
        }
        io.to(interviewId).emit("ai_transcript", {
            role: "ai",
            text: greetingText,
            timestamp: Date.now(),
        });
        lastInterviewerQuestion = greetingText;
        scheduleQuestionRepeat();
    });
    socket.on("audio:telemetry", (rawPayload) => {
        const parse = interviewSocket_schema_1.VoiceMetricsSchema.safeParse(rawPayload);
        if (!parse.success)
            return;
    });
    socket.on("disconnect", () => {
        finalizers.delete(finalizeOnInterviewEnd);
        if (finalizers.size === 0)
            interviewCodingFinalizers.delete(interviewId);
        pendingAudioChunks.length = 0;
        flushPendingCandidateSpeech();
        deepgramUnavailable = true;
        clearQuestionRepeatTimer();
        if (answerSilenceTimer) {
            clearTimeout(answerSilenceTimer);
            answerSilenceTimer = null;
        }
        if (codingTimeout) {
            clearTimeout(codingTimeout);
            codingTimeout = null;
        }
        if (codingActive) {
            void interviewerQueue
                .then(() => finishCoding("disconnected"))
                .catch((error) => {
                console.error(`Failed to finalize coding on disconnect ${interviewId}:`, error);
            });
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
                lastCandidateSpeechObservedAt = Date.now();
                return;
            }
            const transcript = data?.channel?.alternatives?.[0]?.transcript?.trim();
            if (transcript && data.is_final) {
                clearQuestionRepeatTimer();
                lastCandidateSpeechObservedAt = Date.now();
                if (codingActive)
                    pendingSpeechDuringCoding = true;
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
                    lastCandidateSpeechObservedAt = Date.now();
                    const answer = pendingTranscriptSegments.join(" ").trim();
                    pendingTranscriptSegments = [];
                    const generateResponse = !pendingSpeechDuringCoding && !codingActive;
                    pendingSpeechDuringCoding = false;
                    if (!answer)
                        return;
                    io.to(interviewId).emit("stt:transcript", {
                        transcript: answer,
                        isFinal: true,
                    });
                    queueCandidateAnswer(answer, generateResponse);
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
