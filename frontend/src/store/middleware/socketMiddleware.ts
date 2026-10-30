/* eslint-disable @typescript-eslint/no-explicit-any */
import { Middleware } from "@reduxjs/toolkit";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import {
  appendTranscript,
  setCodingCompleted,
  setCodingStarted,
  setCodingSubmissionState,
  setCodingUnavailable,
  setCandidateDraft,
  setConnectionStatus,
  setPhase,
  setSandboxExecutionPending,
  updateMediaTicks,
  updateSandboxOutput,
} from "../slices/interviewSlice";

export const socketMiddleware: Middleware = (store) => {
  let socket: Socket | null = null;

  let disconnectTimeout: NodeJS.Timeout | null = null;
  let messageQueue: Array<{ event: string; data: any }> = [];
  let audioDropWarningLogged = false;

  return (next) => (action: any) => {
    if (action.type === "socket/connect") {
      if (disconnectTimeout) {
        clearTimeout(disconnectTimeout);
        disconnectTimeout = null;
      }

      const { interviewId } = action.payload;
      if (!interviewId) {
        console.error(
          "Socket Connect Blocked: Missing interviewId in action payload.",
        );
        return next(action);
      }

      if (!socket) {
        store.dispatch(setConnectionStatus("connecting"));

        socket = io(
          process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000",
          {
            query: { interviewId },
            transports: ["websocket"],
            reconnection: true,
            reconnectionAttempts: 5,
          },
        );

        socket.on("connect", () => {
          store.dispatch(setConnectionStatus("connected"));
          audioDropWarningLogged = false;
          socket?.emit("start_interview", { interviewId });

          if (messageQueue.length > 0) {
            messageQueue.forEach(({ event, data }) => {
              socket?.emit(event, data);
            });
            messageQueue = [];
          }
        });

        socket.on("disconnect", () => {
          store.dispatch(setConnectionStatus("disconnected"));
        });

        socket.on(
          "ai_transcript",
          (message: { role: "ai"; text: string; timestamp: number }) => {
            store.dispatch(appendTranscript(message));
            if ("speechSynthesis" in window) {
              window.speechSynthesis.cancel();
              const utterance = new SpeechSynthesisUtterance(message.text);
              utterance.lang = "en-US";
              utterance.rate = 1.0;
              utterance.pitch = 1.0;
              window.speechSynthesis.speak(utterance);
            }
          },
        );

        socket.on(
          "stt:transcript",
          (message: { transcript: string; isFinal: boolean }) => {
            if (!message.isFinal) {
              store.dispatch(setCandidateDraft(message.transcript));
            } else if (message.transcript.trim()) {
              store.dispatch(
                appendTranscript({
                  role: "candidate",
                  text: message.transcript,
                  timestamp: Date.now(),
                }),
              );
              store.dispatch(setCandidateDraft(""));
            }
          },
        );

        socket.on("interview:error", (error: { message: string }) => {
          store.dispatch(setSandboxExecutionPending(false));
          console.error("Interview processing error:", error.message);
          toast.error(error.message);
        });

        socket.on("ai_audio_chunk", (audioBase64: string) => {
          const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
          audio
            .play()
            .catch((err) => console.error("Audio playback error:", err));
        });

        socket.on(
          "phase_change",
          (newPhase: "lobby" | "technical_qa" | "live_coding" | "closing") => {
            store.dispatch(setPhase(newPhase));
          },
        );

        socket.on(
          "coding:started",
          (payload: {
            problemId: string;
            title: string;
            statement: string;
            roleAlignment: string[];
            skillAlignment: string[];
            supportedLanguages: string[];
            difficulty: "beginner" | "medium" | "hard" | "extreme";
            examples: Array<{
              input: string;
              output: string;
              explanation?: string;
            }>;
            constraints: string[];
            functionSignature: string;
            timeLimitSeconds: number;
            timeLimitMinutes?: number;
            allowedLanguages?: string[];
            language?: string;
            draft?: string;
          }) => {
            store.dispatch(
              setCodingStarted({
                assignment: {
                  problemId: payload.problemId,
                  title: payload.title,
                  statement: payload.statement,
                  roleAlignment: payload.roleAlignment ?? [],
                  skillAlignment: payload.skillAlignment ?? [],
                  supportedLanguages: payload.supportedLanguages ?? [],
                  difficulty: payload.difficulty,
                  examples: payload.examples ?? [],
                  constraints: payload.constraints ?? [],
                  functionSignature: payload.functionSignature ?? "",
                  timeLimitSeconds: payload.timeLimitSeconds,
                },
                timeLimitSeconds:
                  payload.timeLimitSeconds ??
                  (payload.timeLimitMinutes ?? 0) * 60,
                language: payload.language,
                draft: payload.draft,
                allowedLanguages: payload.allowedLanguages,
              }),
            );
          },
        );

        socket.on(
          "coding:completed",
          (payload: {
            reason?: string;
            submissionStatus?: "attempted" | "solved" | "timed_out";
            testSummary?: { passed: number; total: number };
          }) => {
            store.dispatch(
              setCodingCompleted({
                reason: payload.reason ?? payload.submissionStatus ?? "completed",
                submissionStatus: payload.submissionStatus,
                testSummary: payload.testSummary,
              }),
            );
            toast.success(
              payload.reason === "timed_out"
                ? "Coding time ended. Your code was submitted."
                : "Coding submission saved.",
            );
          },
        );

        socket.on("coding:submission_failed", (payload: { message?: string }) => {
          store.dispatch(setCodingSubmissionState("failed"));
          toast.error(payload.message ?? "Could not save your coding submission.");
        });

        socket.on(
          "coding:unavailable",
          (payload: { message?: string }) => {
            store.dispatch(
              setCodingUnavailable(
                payload.message ?? "No coding assignment is available.",
              ),
            );
          },
        );

        socket.on("meyda_tick", (metrics: any) => {
          store.dispatch(updateMediaTicks(metrics));
        });

        socket.on(
          "sandbox_result",
          (result: {
            stdout: string | null;
            stderr: string | null;
            error?: string;
          }) => {
            store.dispatch(updateSandboxOutput(result));
            store.dispatch(setSandboxExecutionPending(false));
          },
        );
      }
    }

    if (action.type === "socket/disconnect" && socket) {
      disconnectTimeout = setTimeout(() => {
        if (socket) {
          socket.off("connect");
          socket.off("disconnect");
          socket.off("phase_change");
          socket.off("coding:started");
          socket.off("coding:completed");
          socket.off("coding:submission_failed");
          socket.off("coding:unavailable");
          socket.off("ai_transcript");
          socket.off("stt:transcript");
          socket.off("interview:error");
          socket.off("meyda_tick");
          socket.off("sandbox_result");
          socket.disconnect();
          socket = null;
        }
      }, 500);
    }

    if (action.type === "socket/emit") {
      const { event, data } = action.payload;

      if (event === "sandbox_execute") {
        store.dispatch(setSandboxExecutionPending(true));
      }

      if (socket && socket.connected) {
        socket.emit(event, data);
      } else if (event === "audio:stream") {
        if (!audioDropWarningLogged) {
          console.warn(
            "Audio stream chunk dropped while socket is disconnected.",
          );
          audioDropWarningLogged = true;
        }
      } else {
        messageQueue.push({ event, data });
        console.warn(
          `Socket Emit Buffered: Socket connection is currently inactive. Buffered event: ${event}`,
        );
      }
    }

    if (action.type === "socket/audioStream") {
      if (socket && socket.connected) {
        socket.emit("audio:stream", action.payload);
      } else if (!audioDropWarningLogged) {
        console.warn(
          "Audio stream chunk dropped while socket is disconnected.",
        );
        audioDropWarningLogged = true;
      }
    }

    return next(action);
  };
};
