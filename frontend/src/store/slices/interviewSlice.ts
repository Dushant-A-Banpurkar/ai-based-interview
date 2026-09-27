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
  interviewId: string | null;
  connectionStatus: "idle" | "connecting" | "connected" | "disconnected";
  phase: "lobby" | "technical_qa" | "live_coding" | "closing";
  transcriptBuffer: TranscriptMessage[];
  mediaTicks: MediaTicks | null;
  timer: number;
  sandboxOutput: string;
}

const initialState: InterviewState = {
  interviewId: null,
  connectionStatus: "idle",
  phase: "lobby",
  transcriptBuffer: [],
  mediaTicks: null,
  timer: 0,
  sandboxOutput: "Sandbox ready. Output will appear here...",
};

const interviewSlice = createSlice({
  name: "interview",
  initialState,
  reducers: {
    setTargetSession: (
      state,
      action: PayloadAction<{ interviewId: string }>,
    ) => {
      state.interviewId = action.payload.interviewId;
    },
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
    updateSandboxOutput: (
      state,
      action: PayloadAction<{
        stdout: string | null;
        stderr: string | null;
        error?: string;
      }>,
    ) => {
      const { stdout, stderr, error } = action.payload;

      if (error) {
        state.sandboxOutput = `Execution Error: ${error}`;
      } else if (stderr) {
        state.sandboxOutput = `Standard Error:\n${stderr}`;
      } else {
        state.sandboxOutput =
          stdout || "Code executed successfully with zero output.";
      }
    },
  },
});

export const {
  setTargetSession,
  setConnectionStatus,
  setPhase,
  updateSandboxOutput,
  appendTranscript,
  updateMediaTicks,
  setTimer,
  resetSession,
} = interviewSlice.actions;

export default interviewSlice.reducer;
