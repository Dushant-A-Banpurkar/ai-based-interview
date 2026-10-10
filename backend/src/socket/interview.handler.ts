import { Socket, Server } from "socket.io";
import { DeepgramClient } from "@deepgram/sdk";
import { VoiceMetricsSchema } from "../schemas/interviewSocket.schema";
import * as dotenv from "dotenv";
import Redis from "ioredis";
import axios from "axios";

dotenv.config();

const redis = new Redis(process.env.REDIS_URL!);
const JUDGE0_API_URL = process.env.JUDGE0_URL || "http://localhost:2358";
const JUDGE0_LANGUAGE_MAP: Record<string, number> = {
  javascript: 63,
  python: 71,
  cpp: 54,
};

export const registerInterviewHandlers = async (io: Server, socket: Socket) => {
  const interviewId = socket.handshake.query.interviewId as string;
  const deepgram = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY });
  const dgConnection = await deepgram.listen.v1.createConnection({
    model: "nova-3",
    language: "en",
    encoding: "linear16",
    sample_rate: 16000,
  });

  dgConnection.on("message", (data: any) => {
    const transcript = data.channel.alternatives[0]?.transcript;
    if (transcript && data.is_final) {
      io.to(interviewId).emit("stt:transcript", { transcript, isFinal: true });
      redis.rpush(
        `interview:${interviewId}:transcript`,
        JSON.stringify({ transcript, timestamp: Date.now() }),
      );
    }
  });

  socket.on("audio:stream", (chunk: Buffer) => {
    if (dgConnection.readyState === 1) {
      dgConnection.sendMedia(chunk);
    }
  });

  socket.on("audio:telemetry", (rawPayload) => {
    const parse = VoiceMetricsSchema.safeParse(rawPayload);
    if (!parse.success) return;
    const metrics = parse.data;
  });

  socket.on("meyda_telemetry", async (data) => {
    const parse = VoiceMetricsSchema.safeParse(data);
    if (!parse.success) return;
    const metrics = parse.data;
    await redis.rpush(
      `interview:${interviewId}:telemetry`,
      JSON.stringify(metrics),
    );
    await redis.expire(`interview:${interviewId}:telemetry`, 86400);
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
            stdout: finalStdout,
            stderr: finalStderr,
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
    dgConnection.close();
  });
};
