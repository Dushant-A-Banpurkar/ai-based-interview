import { configureStore } from "@reduxjs/toolkit";
import interviewReducer from "./slices/interviewSlice";
import { socketMiddleware } from "./middleware/socketMiddleware";

export const store = configureStore({
  reducer: {
    interview: interviewReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(socketMiddleware),
});

export type RootState=ReturnType<typeof store.getState>;
export type AppDispatch=typeof store.dispatch;