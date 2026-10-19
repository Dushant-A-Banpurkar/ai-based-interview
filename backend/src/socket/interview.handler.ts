import { Socket, Server } from "socket.io";
import { DeepgramClient } from "@deepgram/sdk";
import { VoiceMetricsSchema } from "../schemas/interviewSocket.schema";
import * as dotenv from "dotenv";
import Redis from "ioredis";
import axios from "axios";
import {
  generateInterviewerResponse,
  InterviewerProviderError,
} from "../services/interviewAssistant.service";
import { InterviewModel } from "../model/interview.model";
dotenv.config();

const redis = new Redis(process.env.REDIS_URL!);
const JUDGE0_API_URL = process.env.JUDGE0_URL || "http://localhost:2358";
const JUDGE0_LANGUAGE_MAP: Record<string, number> = {
  javascript: 63,
  python: 71,
  cpp: 54,
};

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
  let lastInterviewerQuestion = "";

  const clearQuestionRepeatTimer = () => {
    if (questionRepeatTimer) {
      clearTimeout(questionRepeatTimer);
      questionRepeatTimer = null;
    }
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

  const queueCandidateAnswer = (answer: string) => {
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

        const elapsedMinutes = (Date.now() - interviewStartedAt) / 60_000;
        const remainingMinutes = Math.max(
          0,
          Math.ceil(interviewDurationMinutes - elapsedMinutes),
        );

        const aiText = await generateInterviewerResponse(
          conversation,
          interviewDurationMinutes,
          remainingMinutes,
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
    try {
      const interview =
        await InterviewModel.findById(interviewId).select("durationMinutes");

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
    } catch (error: any) {
      console.error(`Failed to load interview ${interviewId}:`, error);
      io.to(interviewId).emit("interview:error", {
        message: "Could not load the interview session.",
      });
      return;
    }
    const greetingText =
      "Hello! Let's get started with your technical assessment. Can you walk me through your background?";

    io.to(interviewId).emit("ai_transcript", {
      role: "ai",
      text: greetingText,
      timestamp: Date.now(),
    });

    await redis.rpush(
      `interview:${interviewId}:transcript`,
      JSON.stringify({
        sender: "ai",
        text: greetingText,
        timestamp: Date.now(),
      }),
    );
    lastInterviewerQuestion = greetingText;
    scheduleQuestionRepeat();
  });

  socket.on("start_coding", () => {
    io.to(interviewId).emit("phase_change", "live_coding");
  });

  socket.on("audio:telemetry", (rawPayload) => {
    const parse = VoiceMetricsSchema.safeParse(rawPayload);
    if (!parse.success) return;
  });

  socket.on(
    "sandbox_execute",
    async (payload: {
      interviewId: string;
      language: string;
      code: string;
    }) => {
      const { interviewId, language, code } = payload;
      if (!interviewId) return;
      const languageId = JUDGE0_LANGUAGE_MAP[language] || 63;

      try {
        const submissionResponse = await axios.post(
          `${JUDGE0_API_URL}/submissions?base64_encoded=false&wait=true`,
          {
            source_code: code,
            language_id: languageId,
          },
        );
        const { stdout, stderr, compile_output, message } =
          submissionResponse.data;

        const finalStdout = stdout || null;
        const finalStderr = stderr || compile_output || message || null;

        io.to(interviewId).emit("sandbox_result", {
          stdout: finalStdout,
          stderr: finalStderr,
        });

        await redis.rpush(
          `interview:${interviewId}:code`,
          JSON.stringify({
            language,
            code,
            sandboxResult: {
              stdout: finalStdout,
              stderr: finalStderr,
              status: { id: 0, description: "Accepted" },
            },
            timestamp: Date.now(),
          }),
        );
      } catch (error: any) {
        console.error("Judge0 Execution Error:", error.message);
        io.to(interviewId).emit("sandbox_result", {
          stdout: null,
          stderr: `Execution System Error: ${error.message}`,
          error: "Execution failed",
        });
      }
    },
  );

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
          if (!answer) return;

          io.to(interviewId).emit("stt:transcript", {
            transcript: answer,
            isFinal: true,
          });
          queueCandidateAnswer(answer);
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
