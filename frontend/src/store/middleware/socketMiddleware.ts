/* eslint-disable @typescript-eslint/no-explicit-any */
import { Middleware } from "@reduxjs/toolkit";
import { io, Socket } from "socket.io-client";
import {
  setConnectionStatus,
  setPhase,
  updateMediaTicks,
} from "../slices/interviewSlice";

export const socketMiddleware: Middleware = (store) => {
  let socket: Socket | null = null;

  return (next) => (action: any) => {
    if (action.type === "socket/connect") {
      if (socket) {
        socket.off("connect");
        socket.off("disconnect");
        socket.off("phase_change");
        socket.off("meyda_tick");
        socket.disconnect();
        socket = null;
      }

      const { interviewId } = action.payload;
      if (!interviewId) {
        console.error(
          "Socket Connect Blocked: Missing interviewId in action payload.",
        );
        return next(action);
      }
      store.dispatch(setConnectionStatus("connecting"));

      socket = io(process.env.NEXT_PUBLIC_SOCKET_URL, {
        query: { interviewId },
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 5,
      });

      socket.on("connect", () => {
        store.dispatch(setConnectionStatus("connected"));
      });

      socket.on("disconnect", () => {
        store.dispatch(setConnectionStatus("disconnected"));
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
          store.dispatch({
            type: "interview/updateSandboxOutput",
            payload: result,
          });
        },
      );
    }

    if (action.type === "socket/disconnect" && socket) {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("phase_change");
      socket.off("meyda_tick");
      socket.disconnect();
      socket = null;
    }
    if (action.type === "socket/emit") {
      if (socket && socket.connected) {
        const { event, data } = action.payload;
        socket.emit(event, data);
      } else {
        console.warn(
          `Socket Emit Blocked: Socket connection is currently inactive. Dropped event: ${action.payload?.event}`,
        );
      }
    }
    return next(action);
  };
};
