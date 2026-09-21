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
      if (socket) socket.disconnect();

      const { interviewId } = action.payload;
      store.dispatch(setConnectionStatus("connecting"));

      socket = io(process.env.NEXT_PUBLIC_SOCKET_URL, {
        query: { interviewId },
        transports: ["websocket"],
      });

      socket.on("connect", () =>
        store.dispatch(setConnectionStatus("connected")),
      );
      socket.on("disconnect", () =>
        store.dispatch(setConnectionStatus("disconnected")),
      );

      socket.on(
        "phase_change",
        (newPhase: "lobby" | "technical_qa" | "live_coding" | "closing") => {
          store.dispatch(setPhase(newPhase));
        },
      );

      socket.on("meyda_tick", (metrics: any) => {
        store.dispatch(updateMediaTicks(metrics));
      });
    }

    if (action.type === "socket/disconnect" && socket) {
      socket.disconnect();
      socket = null;
    }
    if (action.type === "socket/emit" && socket) {
      const { event, data } = action.payload;
      socket.emit(event, data);
    }
    return next(action);
  };
};
