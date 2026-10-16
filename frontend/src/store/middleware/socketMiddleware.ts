/* eslint-disable @typescript-eslint/no-explicit-any */
import { Middleware } from "@reduxjs/toolkit";
import { io, Socket } from "socket.io-client";
import {
  appendTranscript,
  setConnectionStatus,
  setPhase,
  updateMediaTicks,
  updateSandboxOutput,
} from "../slices/interviewSlice";

export const socketMiddleware: Middleware = (store) => {
  let socket: Socket | null = null;

  let disconnectTimeout: NodeJS.Timeout | null = null;
  let messageQueue: Array<{ event: string; data: any }> = [];

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
          socket.off("meyda_tick");
          socket.off("sandbox_result");
          socket.disconnect();
          socket = null;
        }
      }, 500);
    }

    if (action.type === "socket/emit") {
      const { event, data } = action.payload;

      if (socket && socket.connected) {
        socket.emit(event, data);
      } else {
        messageQueue.push({ event, data });
        console.warn(
          `Socket Emit Buffered: Socket connection is currently inactive. Buffered event: ${event}`,
        );
      }
    }
    return next(action);
  };
};
