import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface TranscriptMessage {
  role: "ai" | "candidate";
  text: string;
  timestamp: number;
}

export interface MediaTicks {
  rms: number;
  spectralCentroid: number;
  zcr: number;
}

export interface InterviewState {
  connectionStatus: "idle" | "connecting" | "connected" | "disconnected";
  phase: "lobby" | "technical_qa" | "live_coding" | "closing";
  transcriptBuffer: TranscriptMessage[];
  mediaTicks: MediaTicks | null;
  timer: number;
}

const initialState: InterviewState = {
  connectionStatus: "idle",
  phase: "lobby",
  transcriptBuffer: [],
  mediaTicks: null,
  timer: 0,
};

const interviewSlice = createSlice({
  name: "interview",
  initialState,
  reducers: {
    setConnectionStatus: (
      state,
      action: PayloadAction<InterviewState["connectionStatus"]>,
    ) => {
      state.connectionStatus = action.payload;
    },
    setPhase: (state, action: PayloadAction<InterviewState["phase"]>) => {
      state.phase = action.payload;
    },
    appendTranscript: (state, action: PayloadAction<TranscriptMessage>) => {
      state.transcriptBuffer.push(action.payload);
    },
    updateMediaTicks: (state, action: PayloadAction<MediaTicks>) => {
      state.mediaTicks = action.payload;
    },
    setTimer: (state, action: PayloadAction<number>) => {
      state.timer = action.payload;
    },
    resetSession: () => initialState,
  },
});

export const{
    setConnectionStatus,
    setPhase,
    appendTranscript,
    updateMediaTicks,
    setTimer,
    resetSession
}=interviewSlice.actions;

export default interviewSlice.reducer;
