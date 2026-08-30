import { Socket, Server } from "socket.io";
import { DeepgramClient } from "@deepgram/sdk";
import {
  VoiceMetricsSchema,
  CodeSubmissionSchema,
} from "../schemas/interviewSocket.schema";
import * as dotenv from "dotenv";

dotenv.config();

const registerInterviewHandlers=async (io: Server, socket: Socket)=> {
  const interviewId = socket.handshake.query.interviewId as string;
  const deepgram = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY });
  const dgConnection = await deepgram.listen.v1.createConnection({
    model: "nova-3",
    language: "en",
    encoding: "linear16",
    sample_rate: 16000,
  });

  dgConnection.on('message', (data: any) => {
    const transcript = data.channel.alternatives[0]?.transcript;
    if (transcript && data.is_final) {
      io.to(interviewId).emit("stt:transcript", { transcript, isFinal: true });
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

  socket.on("disconnect", () => {
    dgConnection.close();
  });
}
