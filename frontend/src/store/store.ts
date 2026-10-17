import { configureStore } from "@reduxjs/toolkit";
import { socketMiddleware } from "./middleware/socketMiddleware";
import interviewReducer from "./slices/interviewSlice";

export const store = configureStore({
  reducer: {
    interview: interviewReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ["socket/audioStream", "socket/emit"],
        ignoredActionPaths: ["payload.data"],
      },
    }).concat(socketMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;