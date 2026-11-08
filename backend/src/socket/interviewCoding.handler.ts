import axios from "axios";
import type { Server, Socket } from "socket.io";
import Redis from "ioredis";
import { InterviewModel } from "../model/interview.model";
import {
  normalizeCodingLanguage,
  toClientAssignment,
} from "../services/codingAssignment.service";
import type { StoredCodingAssignment } from "../types/codingAssignment";

export const INTERVIEW_CLOSING_RESERVE_SECONDS = 5 * 60;
const JUDGE0_API_URL = process.env.JUDGE0_URL || "http://localhost:2358";
const JUDGE0_LANGUAGE_MAP: Record<string, number> = {
  javascript: 63,
  python: 71,
  cpp: 54,
};

interface CodingHandlerContext {
  io: Server;
  socket: Socket;
  interviewId: string;
  redis: Redis;
  interviewDurationMinutes: number | null;
  interviewStartedAt: number | null;
  codingAssignment: StoredCodingAssignment | null;
  allowedLanguages: string[];
  enableSandbox: boolean;
  codingActive: boolean;
  codingFinishing: boolean;
  phaseVersion: number;
  latestCode: string;
  latestLanguage: string;
  pendingTranscriptSegments: string[];
  pendingSpeechDuringCoding: boolean;
  clearQuestionRepeatTimer: () => void;
  scheduleCodingTimeout: (remainingSeconds: number) => void;
  finishCoding: (
    reason: "submitted" | "timed_out" | "disconnected" | "interview_ended",
    finalCode?: string,
    finalLanguage?: string,
  ) => Promise<void>;
}

export function registerCodingHandlers(context: CodingHandlerContext): void {
  const {
    io,
    socket,
    interviewId,
    redis,
    clearQuestionRepeatTimer,
    scheduleCodingTimeout,
    finishCoding,
  } = context;

  socket.on("start_coding", async () => {
    if (context.codingActive || context.codingFinishing) return;
    if (!context.codingAssignment) {
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
        context.interviewDurationMinutes === null ||
        context.interviewStartedAt === null
          ? 0
          : Math.max(
              0,
              context.interviewDurationMinutes * 60 -
                Math.floor((Date.now() - context.interviewStartedAt) / 1000) -
                INTERVIEW_CLOSING_RESERVE_SECONDS,
            );
      if (
        initialInterview.codingStatus === "not_started" &&
        interviewTimeRemaining <
          context.codingAssignment.public.timeLimitSeconds
      ) {
        io.to(interviewId).emit("coding:unavailable", {
          message:
            "There is not enough interview time to start the coding assignment and reserve time for closing.",
        });
        return;
      }

      const startedAt = new Date();
      if (context.pendingTranscriptSegments.length > 0) {
        context.pendingSpeechDuringCoding = true;
      }
      await InterviewModel.updateOne(
        { _id: interviewId, codingStatus: "not_started" },
        {
          $set: {
            codingStatus: "active",
            codingStartedAt: startedAt,
            codingDraft: "",
            codingLanguage: context.allowedLanguages.includes("javascript")
              ? "javascript"
              : context.allowedLanguages[0],
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

      context.codingActive = true;
      context.phaseVersion += 1;
      context.latestCode = interview.codingDraft ?? "";
      context.latestLanguage = interview.codingLanguage ?? "javascript";
      const actualStart = interview.codingStartedAt ?? startedAt;
      const codingTimeRemaining = Math.max(
        0,
        context.codingAssignment.public.timeLimitSeconds -
          Math.floor((Date.now() - actualStart.getTime()) / 1000),
      );
      const remainingSeconds = Math.min(
        codingTimeRemaining,
        interviewTimeRemaining,
      );
      clearQuestionRepeatTimer();

      io.to(interviewId).emit("phase_change", "live_coding");
      io.to(interviewId).emit("coding:started", {
        ...toClientAssignment(context.codingAssignment),
        prompt: context.codingAssignment.public.statement,
        timeLimitSeconds: remainingSeconds,
        timeLimitMinutes: Math.ceil(remainingSeconds / 60),
        allowedLanguages: context.allowedLanguages,
        language: context.latestLanguage,
        draft: context.latestCode,
      });

      scheduleCodingTimeout(remainingSeconds);
    } catch (error) {
      console.error(
        `Failed to start coding for interview ${interviewId}:`,
        error,
      );
      io.to(interviewId).emit("interview:error", {
        message: "Could not start the coding assignment.",
      });
    }
  });

  socket.on(
    "coding_draft",
    async (payload: { language?: string; code?: string } | null) => {
      if (
        !context.codingActive ||
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
      if (
        !context.allowedLanguages.includes(language) ||
        !JUDGE0_LANGUAGE_MAP[language]
      ) {
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
        context.latestCode = payload.code;
        context.latestLanguage = language;
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
    async (
      payload: {
        interviewId?: string;
        language?: string;
        code?: string;
      } | null,
    ) => {
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
      if (!context.enableSandbox) {
        socket.emit("interview:error", {
          message: "Code execution is disabled for this interview.",
        });
        return;
      }
      if (
        !context.codingActive ||
        typeof code !== "string" ||
        code.length > 100_000 ||
        !normalizedLanguage ||
        !context.allowedLanguages.includes(normalizedLanguage) ||
        !languageId
      ) {
        socket.emit("interview:error", {
          message: "The code or language is not allowed for this interview.",
        });
        return;
      }

      context.latestCode = code;
      context.latestLanguage = normalizedLanguage;
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
            stdin: context.codingAssignment?.public.examples[0]?.input ?? "",
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
        !context.codingActive ||
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
        context.latestCode = payload.code;
        context.latestLanguage = normalizeCodingLanguage(payload.language);
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
}
