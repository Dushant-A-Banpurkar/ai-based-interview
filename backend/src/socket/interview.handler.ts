import { Socket, Server } from "socket.io";
import { DeepgramClient } from "@deepgram/sdk";
import { VoiceMetricsSchema } from "../schemas/interviewSocket.schema";
import * as dotenv from "dotenv";
import Redis from "ioredis";
import axios from "axios";
import type {
  CodingContext,
  InterviewPromptContext,
} from "../services/interviewAssistant.service";
import {
  generateInterviewerResponse,
  InterviewerProviderError,
} from "../services/interviewAssistant.service";
import { InterviewModel } from "../model/interview.model";
import {
  normalizeCodingLanguage,
  selectCodingAssignment,
  toClientAssignment,
} from "../services/codingAssignment.service";
import type { StoredCodingAssignment } from "../types/codingAssignment";
import { finalizeCodingSubmission } from "../services/codingSubmission.service";

dotenv.config();

const redis = new Redis(process.env.REDIS_URL!);
const JUDGE0_API_URL = process.env.JUDGE0_URL || "http://localhost:2358";
const JUDGE0_LANGUAGE_MAP: Record<string, number> = {
  javascript: 63,
  python: 71,
  cpp: 54,
};
const INTERVIEW_CLOSING_RESERVE_SECONDS = 5 * 60;
const interviewCodingFinalizers = new Map<
  string,
  Set<() => Promise<void>>
>();

export async function finalizeActiveCodingForInterview(
  interviewId: string,
): Promise<void> {
  const finalizers = [...(interviewCodingFinalizers.get(interviewId) ?? [])];
  await Promise.all(finalizers.map((finalize) => finalize()));
}

function toPcmBuffer(chunk: unknown): Buffer | null {
  if (Buffer.isBuffer(chunk)) return chunk;
  if (chunk instanceof ArrayBuffer) return Buffer.from(chunk);
  if (ArrayBuffer.isView(chunk)) {
    return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  }
  return null;
}

export const registerInterviewHandlers = async (io: Server, socket: Socket) => {
  const interviewId = socket.handshake.query.interviewId as string;
  socket.join(interviewId);
  let interviewDurationMinutes: number | null = null;
  let interviewStartedAt: number | null = null;
  let dgConnection: any = null;
  const pendingAudioChunks: Buffer[] = [];
  const maxPendingAudioChunks = 8;
  let audioDropWarningLogged = false;
  let deepgramUnavailable = false;
  let firstAudioChunkLogged = false;
  let firstDeepgramMessageLogged = false;
  let interviewerQueue = Promise.resolve();
  let answerSilenceTimer: ReturnType<typeof setTimeout> | null = null;
  let questionRepeatTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingTranscriptSegments: string[] = [];
  let pendingSpeechDuringCoding = false;
  let lastInterviewerQuestion = "";
  let interviewPromptContext: InterviewPromptContext | null = null;
  let codingAssignment: StoredCodingAssignment | null = null;
  let allowedLanguages: string[] = [];
  let enableSandbox = true;
  let interviewStartHandled = false;
  let interviewStartInProgress = false;
  let phaseVersion = 0;
  let codingActive = false;
  let codingFinishing = false;
  let latestCode = "";
  let latestLanguage = "javascript";
  let codingTimeout: ReturnType<typeof setTimeout> | null = null;

  const finishCoding = async (
    reason: "submitted" | "timed_out" | "disconnected" | "interview_ended",
    finalCode?: string,
    finalLanguage?: string,
  ): Promise<void> => {
    if (!codingActive || codingFinishing || !codingAssignment) return;
    codingFinishing = true;

    const code = finalCode ?? latestCode;
    const language = finalLanguage ?? latestLanguage;
    try {
      const submission = await finalizeCodingSubmission(
        interviewId,
        reason,
        code,
        language,
      );
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
        await redis.rpush(
          `interview:${interviewId}:transcript`,
          JSON.stringify({
            sender: "ai",
            text: `Coding assignment: ${assignment.statement}`,
            timestamp: Date.now(),
          }),
          JSON.stringify({
            sender: "candidate",
            text: `Coding ${finalReason}. Language: ${language}. Code:\n${code}`,
            timestamp: Date.now(),
          }),
        );
      } catch (error) {
        console.error(
          `Failed to add coding submission to transcript ${interviewId}:`,
          error,
        );
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
        const rawTranscript = await redis.lrange(
          `interview:${interviewId}:transcript`,
          -20,
          -1,
        );
        const conversation = rawTranscript
          .map((entry) => JSON.parse(entry))
          .filter(
            (entry): entry is { sender: "ai" | "candidate"; text: string } =>
              (entry.sender === "ai" || entry.sender === "candidate") &&
              typeof entry.text === "string",
          );

        const codingContext: CodingContext = {
          problemPrompt: assignment.statement,
          language,
          sourceCode: submission.sourceCode ?? code,
          outcome: submission.submissionStatus,
          timeSpentSeconds,
          testSummary: submission.testSummary,
        };
        if (
          interviewDurationMinutes === null ||
          interviewStartedAt === null ||
          !interviewPromptContext
        ) {
          throw new Error("Interview context is unavailable after coding.");
        }
        const remainingMinutes = Math.max(
          0,
          Math.ceil(
            interviewDurationMinutes -
              (Date.now() - interviewStartedAt) / 60_000,
          ),
        );
        const aiText = await generateInterviewerResponse(
          conversation,
          interviewDurationMinutes,
          remainingMinutes,
          interviewPromptContext,
          codingContext,
        );
        await redis.rpush(
          `interview:${interviewId}:transcript`,
          JSON.stringify({
            sender: "ai",
            text: aiText,
            timestamp: Date.now(),
          }),
        );
        io.to(interviewId).emit("ai_transcript", {
          role: "ai",
          text: aiText,
          timestamp: Date.now(),
        });
        lastInterviewerQuestion = aiText;
        scheduleQuestionRepeat();
      } catch (error: unknown) {
        console.error(
          `Failed to generate interview follow-up after coding for interview ${interviewId}`,
          error,
        );
        io.to(interviewId).emit("interview:error", {
          message:
            "The submission was saved, but the interviewer could not continue.",
        });
      }

      io.to(interviewId).emit("coding:completed", {
        reason: finalReason,
        submissionStatus: submission.submissionStatus,
        testSummary: submission.testSummary,
      });
      io.to(interviewId).emit("phase_change", "technical_qa");
    } catch (error: unknown) {
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

  const scheduleCodingTimeout = (remainingSeconds: number) => {
    if (codingTimeout) clearTimeout(codingTimeout);
    codingTimeout = setTimeout(() => {
      void finishCoding("timed_out").catch((error: unknown) => {
        console.error(
          `Failed to save timed-out coding submission for interview ${interviewId}:`,
          error,
        );
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
    if (!lastInterviewerQuestion) return;

    questionRepeatTimer = setTimeout(() => {
      const repeatedQuestion = `I haven't heard a response yet. Let me repeat the question: ${lastInterviewerQuestion}`;
      io.to(interviewId).emit("ai_transcript", {
        role: "ai",
        text: repeatedQuestion,
        timestamp: Date.now(),
      });
      void redis
        .rpush(
          `interview:${interviewId}:transcript`,
          JSON.stringify({
            sender: "ai",
            text: repeatedQuestion,
            timestamp: Date.now(),
          }),
        )
        .catch((error) => {
          console.error(
            `Failed to save repeated question for interview ${interviewId}:`,
            error,
          );
        });
      scheduleQuestionRepeat();
    }, 12000);
  };

  const queueCandidateAnswer = (
    answer: string,
    generateResponse: boolean,
  ) => {
    const queuedPhaseVersion = phaseVersion;
    interviewerQueue = interviewerQueue
      .then(async () => {
        await redis.rpush(
          `interview:${interviewId}:transcript`,
          JSON.stringify({
            sender: "candidate",
            text: answer,
            timestamp: Date.now(),
          }),
        );
        if (
          !generateResponse ||
          codingActive ||
          queuedPhaseVersion !== phaseVersion
        ) {
          return;
        }

        const recentTranscript = await redis.lrange(
          `interview:${interviewId}:transcript`,
          -20,
          -1,
        );
        const conversation = recentTranscript
          .map((entry) => JSON.parse(entry))
          .filter(
            (entry): entry is { sender: "ai" | "candidate"; text: string } =>
              (entry.sender === "ai" || entry.sender === "candidate") &&
              typeof entry.text === "string",
          );
        if (interviewDurationMinutes === null || interviewStartedAt === null) {
          throw new Error("Interview duration or start time is unavailable.");
        }
        if (!interviewPromptContext) {
          throw new Error("Interview focus context is unavailable.");
        }

        const elapsedMinutes = (Date.now() - interviewStartedAt) / 60_000;
        const remainingMinutes = Math.max(
          0,
          Math.ceil(interviewDurationMinutes - elapsedMinutes),
        );

        const aiText = await generateInterviewerResponse(
          conversation,
          interviewDurationMinutes,
          remainingMinutes,
          interviewPromptContext,
        );
        if (codingActive || queuedPhaseVersion !== phaseVersion) return;

        await redis.rpush(
          `interview:${interviewId}:transcript`,
          JSON.stringify({
            sender: "ai",
            text: aiText,
            timestamp: Date.now(),
          }),
        );
        io.to(interviewId).emit("ai_transcript", {
          role: "ai",
          text: aiText,
          timestamp: Date.now(),
        });
        lastInterviewerQuestion = aiText;
        scheduleQuestionRepeat();
      })
      .catch((error: unknown) => {
        console.error(
          `Interviewer response generation failed for interview ${interviewId}:`,
          error,
        );
        io.to(interviewId).emit("interview:error", {
          message:
            error instanceof InterviewerProviderError
              ? error.userMessage
              : "The interviewer could not generate a response. Please try again.",
        });
      });
  };

  const flushPendingCandidateSpeech = () => {
    const answer = pendingTranscriptSegments.join(" ").trim();
    pendingTranscriptSegments = [];
    pendingSpeechDuringCoding = false;
    if (answer) queueCandidateAnswer(answer, false);
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
  const finalizers =
    interviewCodingFinalizers.get(interviewId) ?? new Set<() => Promise<void>>();
  finalizers.add(finalizeOnInterviewEnd);
  interviewCodingFinalizers.set(interviewId, finalizers);

  // 1. Register socket listeners immediately so early events are not missed
  socket.on("audio:stream", (rawChunk: unknown) => {
    const chunk = toPcmBuffer(rawChunk);
    if (!chunk?.length || chunk.length % 2 !== 0) {
      console.warn(
        `Rejected invalid PCM audio chunk for interview ${interviewId}.`,
      );
      return;
    }

    if (dgConnection?.readyState === 1) {
      try {
        dgConnection.sendMedia(chunk);
      } catch (error) {
        console.error(
          `Failed to forward audio to Deepgram for interview ${interviewId}:`,
          error,
        );
        return;
      }
      if (!firstAudioChunkLogged) {
        console.info(
          `Forwarding PCM audio to Deepgram for interview ${interviewId} (${chunk.length} bytes per chunk).`,
        );
        firstAudioChunkLogged = true;
      }
      return;
    }

    if (
      deepgramUnavailable ||
      (dgConnection && dgConnection.readyState === 3)
    ) {
      if (!audioDropWarningLogged) {
        console.warn(
          `Discarding audio because Deepgram is unavailable for interview ${interviewId}.`,
        );
        audioDropWarningLogged = true;
      }
      return;
    }

    if (pendingAudioChunks.length === maxPendingAudioChunks) {
      pendingAudioChunks.shift();
      if (!audioDropWarningLogged) {
        console.warn(
          `Audio chunks dropped while Deepgram was unavailable for interview ${interviewId}.`,
        );
        audioDropWarningLogged = true;
      }
    }
    pendingAudioChunks.push(chunk);
  });

  socket.on("meyda_telemetry", async (data) => {
    const parse = VoiceMetricsSchema.safeParse({ ...data, interviewId });
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
      await redis.rpush(
        `interview:${interviewId}:telemetry`,
        JSON.stringify(parse.data),
      );
      await redis.expire(`interview:${interviewId}:telemetry`, 86400);
    } catch (error) {
      console.error(
        `Failed to store audio telemetry for interview ${interviewId}:`,
        error,
      );
    }
  });

  socket.on("start_interview", async () => {
    if (interviewStartHandled || interviewStartInProgress) return;
    interviewStartInProgress = true;
    let shouldGreet = false;
    try {
      let interview = await InterviewModel.findById(interviewId);

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
        const started = await InterviewModel.updateOne(
          { _id: interviewId, status: "scheduled" },
          {
            $set: {
              status: "live",
              interviewStartedAt: now,
            },
          },
        );
        shouldGreet = started.modifiedCount === 1;
        interview = await InterviewModel.findById(interviewId);
        if (!interview) throw new Error("Interview session disappeared.");
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
      allowedLanguages = (interview.allowedLanguages ?? []).map(
        normalizeCodingLanguage,
      );
      enableSandbox = interview.enableSandbox;

      if (interview.durationMinutes === 15) {
        codingAssignment = null;
      } else {
        codingAssignment = interview.codingAssignment ?? null;
        if (!codingAssignment) {
          const codingTimeLimitSeconds =
            interview.durationMinutes === 30 ? 8 * 60 : 15 * 60;
          codingAssignment = selectCodingAssignment({
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
        const codingTimeRemaining = Math.max(
          0,
          codingAssignment.public.timeLimitSeconds -
            Math.floor((Date.now() - startedAt) / 1000),
        );
        const interviewTimeRemaining = Math.max(
          0,
          interviewDurationMinutes * 60 -
            Math.floor((Date.now() - interviewStartedAt) / 1000) -
            INTERVIEW_CLOSING_RESERVE_SECONDS,
        );
        const remainingSeconds = Math.min(
          codingTimeRemaining,
          interviewTimeRemaining,
        );
        io.to(interviewId).emit("phase_change", "live_coding");
        io.to(interviewId).emit("coding:started", {
          ...toClientAssignment(codingAssignment),
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
    } catch (error: unknown) {
      console.error(`Failed to load interview ${interviewId}:`, error);
      io.to(interviewId).emit("interview:error", {
        message: "Could not load the interview session.",
      });
      return;
    } finally {
      interviewStartInProgress = false;
    }

    if (!shouldGreet) return;
    const greetingText =
      "Hello! Let's get started with your technical assessment. Can you walk me through your background?";

    try {
      await redis.rpush(
        `interview:${interviewId}:transcript`,
        JSON.stringify({
          sender: "ai",
          text: greetingText,
          timestamp: Date.now(),
        }),
      );
    } catch (error) {
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

  socket.on("start_coding", async () => {
    if (codingActive || codingFinishing) return;
    if (!codingAssignment) {
      io.to(interviewId).emit("coding:unavailable", {
        message: "No coding assignment is available for this interview.",
      });
      return;
    }

    try {
      const initialInterview = await InterviewModel.findById(interviewId);
      if (!initialInterview || initialInterview.codingStatus === "completed") {
        io.to(interviewId).emit("coding:unavailable", {
          message: "This coding assignment has already been completed.",
        });
        return;
      }

      const interviewTimeRemaining =
        interviewDurationMinutes === null || interviewStartedAt === null
          ? 0
          : Math.max(
              0,
              interviewDurationMinutes * 60 -
                Math.floor((Date.now() - interviewStartedAt) / 1000) -
                INTERVIEW_CLOSING_RESERVE_SECONDS,
            );
      if (
        initialInterview.codingStatus === "not_started" &&
        interviewTimeRemaining < codingAssignment.public.timeLimitSeconds
      ) {
        io.to(interviewId).emit("coding:unavailable", {
          message:
            "There is not enough interview time to start the coding assignment and reserve time for closing.",
        });
        return;
      }

      const startedAt = new Date();
      if (pendingTranscriptSegments.length > 0) {
        pendingSpeechDuringCoding = true;
      }
      await InterviewModel.updateOne(
        { _id: interviewId, codingStatus: "not_started" },
        {
          $set: {
            codingStatus: "active",
            codingStartedAt: startedAt,
            codingDraft: "",
            codingLanguage: allowedLanguages.includes("javascript")
              ? "javascript"
              : allowedLanguages[0],
          },
        },
      );

      const interview = await InterviewModel.findById(interviewId);
      if (!interview || interview.codingStatus === "completed") {
        io.to(interviewId).emit("coding:unavailable", {
          message: "This coding assignment has already been completed.",
        });
        return;
      }

      codingActive = true;
      phaseVersion += 1;
      latestCode = interview.codingDraft ?? "";
      latestLanguage = interview.codingLanguage ?? "javascript";
      const actualStart = interview.codingStartedAt ?? startedAt;
      const codingTimeRemaining = Math.max(
        0,
        codingAssignment.public.timeLimitSeconds -
          Math.floor((Date.now() - actualStart.getTime()) / 1000),
      );
      const remainingSeconds = Math.min(
        codingTimeRemaining,
        interviewTimeRemaining,
      );
      clearQuestionRepeatTimer();

      io.to(interviewId).emit("phase_change", "live_coding");
      io.to(interviewId).emit("coding:started", {
        ...toClientAssignment(codingAssignment),
        prompt: codingAssignment.public.statement,
        timeLimitSeconds: remainingSeconds,
        timeLimitMinutes: Math.ceil(remainingSeconds / 60),
        allowedLanguages,
        language: latestLanguage,
        draft: latestCode,
      });

      scheduleCodingTimeout(remainingSeconds);
    } catch (error) {
      console.error(`Failed to start coding for interview ${interviewId}:`, error);
      io.to(interviewId).emit("interview:error", {
        message: "Could not start the coding assignment.",
      });
    }
  });

  socket.on("audio:telemetry", (rawPayload) => {
    const parse = VoiceMetricsSchema.safeParse(rawPayload);
    if (!parse.success) return;
  });

  socket.on(
    "coding_draft",
    async (payload: { language?: string; code?: string } | null) => {
      if (
        !codingActive ||
        !payload ||
        typeof payload.code !== "string" ||
        payload.code.length > 100_000 ||
        typeof payload.language !== "string"
      ) {
        socket.emit("interview:error", {
          message: "Invalid coding draft.",
        });
        return;
      }

      const language = normalizeCodingLanguage(payload.language);
      if (!allowedLanguages.includes(language) || !JUDGE0_LANGUAGE_MAP[language]) {
        socket.emit("interview:error", {
          message: "This language is not allowed for the coding assignment.",
        });
        return;
      }

      try {
        const saved = await InterviewModel.updateOne(
          { _id: interviewId, codingStatus: "active" },
          {
            $set: {
              codingDraft: payload.code,
              codingLanguage: language,
            },
          },
        );
        if (saved.matchedCount !== 1) {
          socket.emit("interview:error", {
            message: "There is no active coding assignment.",
          });
          return;
        }
        latestCode = payload.code;
        latestLanguage = language;
      } catch (error) {
        console.error(
          `Failed to persist coding draft for interview ${interviewId}:`,
          error,
        );
        socket.emit("interview:error", {
          message: "Could not save the coding draft.",
        });
      }
    },
  );

  socket.on(
    "sandbox_execute",
    async (payload: {
      interviewId?: string;
      language?: string;
      code?: string;
    } | null) => {
      if (!payload) {
        socket.emit("interview:error", {
          message: "Invalid code execution request.",
        });
        return;
      }
      const { language, code } = payload;
      const normalizedLanguage =
        typeof language === "string"
          ? normalizeCodingLanguage(language)
          : undefined;
      const languageId = normalizedLanguage
        ? JUDGE0_LANGUAGE_MAP[normalizedLanguage]
        : undefined;
      if (!enableSandbox) {
        socket.emit("interview:error", {
          message: "Code execution is disabled for this interview.",
        });
        return;
      }
      if (
        !codingActive ||
        typeof code !== "string" ||
        code.length > 100_000 ||
        !normalizedLanguage ||
        !allowedLanguages.includes(normalizedLanguage) ||
        !languageId
      ) {
        socket.emit("interview:error", {
          message: "The code or language is not allowed for this interview.",
        });
        return;
      }

      latestCode = code;
      latestLanguage = normalizedLanguage;
      try {
        const saved = await InterviewModel.updateOne(
          { _id: interviewId, codingStatus: "active" },
          {
            $set: {
              codingDraft: code,
              codingLanguage: normalizedLanguage,
            },
          },
        );
        if (saved.matchedCount !== 1) {
          socket.emit("interview:error", {
            message: "There is no active coding assignment.",
          });
          return;
        }
        const submissionResponse = await axios.post(
          `${JUDGE0_API_URL}/submissions?base64_encoded=false&wait=true`,
          {
            source_code: code,
            language_id: languageId,
            stdin: codingAssignment?.public.examples[0]?.input ?? "",
          },
          { timeout: 20_000 },
        );
        const { stdout, stderr, compile_output, message, status } =
          submissionResponse.data;

        const finalStdout = stdout || null;
        const finalStderr = stderr || compile_output || message || null;

        socket.emit("sandbox_result", {
          stdout: finalStdout,
          stderr: finalStderr,
          status: {
            id: status?.id ?? -1,
            description: status?.description ?? "Unknown",
          },
        });

        await redis.rpush(
          `interview:${interviewId}:code`,
          JSON.stringify({
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
          }),
        );
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Unknown execution error";
        console.error("Judge0 Execution Error:", message);
        socket.emit("sandbox_result", {
          stdout: null,
          stderr: `Execution System Error: ${message}`,
          error: "Execution failed",
        });
      }
    },
  );
  socket.on(
    "submit_coding",
    async (payload: { language?: string; code?: string } | null) => {
      if (
        !codingActive ||
        !payload ||
        typeof payload.code !== "string" ||
        payload.code.length > 100_000 ||
        typeof payload.language !== "string"
      ) {
        socket.emit("coding:submission_failed", {
          message: "There is no valid active coding submission to save.",
        });
        io.to(interviewId).emit("interview:error", {
          message: "There is no valid active coding submission to save.",
        });
        return;
      }

      try {
        latestCode = payload.code;
        latestLanguage = normalizeCodingLanguage(payload.language);
        await finishCoding("submitted", payload.code, payload.language);
      } catch (error: unknown) {
        console.error(
          `Failed to save coding submission for interview ${interviewId}:`,
          error,
        );
        socket.emit("coding:submission_failed", {
          message: "Could not save the coding submission. Please try again.",
        });
        io.to(interviewId).emit("interview:error", {
          message: "Could not save the coding submission.",
        });
      }
    },
  );
  socket.on("disconnect", () => {
    finalizers.delete(finalizeOnInterviewEnd);
    if (finalizers.size === 0) interviewCodingFinalizers.delete(interviewId);
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
        .catch((error: unknown) => {
          console.error(
            `Failed to finalize coding on disconnect ${interviewId}:`,
            error,
          );
        });
    }
    if (dgConnection) {
      dgConnection.close();
    }
  });

  // 2. Initialize Deepgram connection asynchronously
  try {
    const deepgram = new DeepgramClient({
      apiKey: process.env.DEEPGRAM_API_KEY!,
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

    dgConnection.on("error", (error: Error) => {
      deepgramUnavailable = true;
      console.error(
        `Deepgram connection error for interview ${interviewId}:`,
        error,
      );
    });
    dgConnection.on("close", () => {
      deepgramUnavailable = true;
    });

    dgConnection.on("message", (data: any) => {
      if (!firstDeepgramMessageLogged) {
        console.info(
          `Received the first Deepgram response for interview ${interviewId}.`,
        );
        firstDeepgramMessageLogged = true;
      }

      if (data?.type === "SpeechStarted") {
        clearQuestionRepeatTimer();
        return;
      }

      const transcript = data?.channel?.alternatives?.[0]?.transcript?.trim();
      if (transcript && data.is_final) {
        clearQuestionRepeatTimer();
        if (codingActive) pendingSpeechDuringCoding = true;
        pendingTranscriptSegments.push(transcript);
        const answerInProgress = pendingTranscriptSegments.join(" ");
        io.to(interviewId).emit("stt:transcript", {
          transcript: answerInProgress,
          isFinal: false,
        });

        if (answerSilenceTimer) clearTimeout(answerSilenceTimer);
        answerSilenceTimer = setTimeout(() => {
          answerSilenceTimer = null;
          const answer = pendingTranscriptSegments.join(" ").trim();
          pendingTranscriptSegments = [];
          const generateResponse =
            !pendingSpeechDuringCoding && !codingActive;
          pendingSpeechDuringCoding = false;
          if (!answer) return;

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

    let openTimeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        connectionOpened,
        new Promise<never>((_, reject) => {
          openTimeout = setTimeout(
            () =>
              reject(
                new Error(
                  `Timed out waiting for Deepgram to open for interview ${interviewId}`,
                ),
              ),
            15000,
          );
        }),
      ]);
    } finally {
      if (openTimeout) clearTimeout(openTimeout);
    }

    if (connectionToOpen.readyState !== 1) {
      throw new Error(
        `Deepgram connection did not remain open for interview ${interviewId}`,
      );
    }

    deepgramUnavailable = false;
    console.log(
      "Deepgram connection successfully opened for interview: " + interviewId,
    );

    while (pendingAudioChunks.length > 0 && connectionToOpen.readyState === 1) {
      const chunk = pendingAudioChunks[0];
      connectionToOpen.sendMedia(chunk);
      pendingAudioChunks.shift();
    }

    if (pendingAudioChunks.length > 0) {
      console.warn(
        `Discarding ${pendingAudioChunks.length} buffered audio chunks because Deepgram is not ready for interview ${interviewId}.`,
      );
      pendingAudioChunks.length = 0;
    }
    audioDropWarningLogged = false;
  } catch (err) {
    console.error("Deepgram connection initialization error:", err);
    deepgramUnavailable = true;
    pendingAudioChunks.length = 0;
    dgConnection?.close();
    dgConnection = null;
  }
};
