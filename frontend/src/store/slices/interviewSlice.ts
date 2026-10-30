import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface CodingAssignment {
  problemId: string;
  title: string;
  statement: string;
  roleAlignment: string[];
  skillAlignment: string[];
  supportedLanguages: string[];
  difficulty: "beginner" | "medium" | "hard" | "extreme";
  examples: Array<{ input: string; output: string; explanation?: string }>;
  constraints: string[];
  functionSignature: string;
  timeLimitSeconds: number;
}

export type CodingStatus =
  | "idle"
  | "starting"
  | "active"
  | "completed"
  | "unavailable";
export type CodingSubmissionState = "idle" | "pending" | "failed";

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
  candidateDraft: string;
  mediaTicks: MediaTicks | null;
  timer: number;
  sandboxOutput: string;
  sandboxExecutionPending: boolean;
  codingStatus: CodingStatus;
  codingAssignment: CodingAssignment | null;
  codingSecondsRemaining: number;
  codingCompletionReason: string | null;
  codingUnavailableMessage: string | null;
  codingLanguage: string;
  codingDraft: string;
  codingDraftInitialized: boolean;
  codingAllowedLanguages: string[];
  codingSubmissionState: CodingSubmissionState;
  codingResultStatus: "attempted" | "solved" | "timed_out" | null;
  codingTestSummary: { passed: number; total: number } | null;
}

const initialState: InterviewState = {
  interviewId: null,
  connectionStatus: "idle",
  phase: "lobby",
  transcriptBuffer: [],
  candidateDraft: "",
  mediaTicks: null,
  timer: 0,
  sandboxOutput: "Sandbox ready. Output will appear here...",
  sandboxExecutionPending: false,
  codingStatus: "idle",
  codingAssignment: null,
  codingSecondsRemaining: 0,
  codingCompletionReason: null,
  codingUnavailableMessage: null,
  codingLanguage: "javascript",
  codingDraft: "",
  codingDraftInitialized: false,
  codingAllowedLanguages: [],
  codingSubmissionState: "idle",
  codingResultStatus: null,
  codingTestSummary: null,
};

const interviewSlice = createSlice({
  name: "interview",
  initialState,
  reducers: {
    setTargetSession: (
      state,
      action: PayloadAction<{ interviewId: string }>,
    ) => {
      if (state.interviewId !== action.payload.interviewId) {
        state.phase = "lobby";
        state.transcriptBuffer = [];
        state.candidateDraft = "";
        state.sandboxOutput = "Sandbox ready. Output will appear here...";
        state.sandboxExecutionPending = false;
        state.codingStatus = "idle";
        state.codingAssignment = null;
        state.codingSecondsRemaining = 0;
        state.codingCompletionReason = null;
        state.codingUnavailableMessage = null;
        state.codingLanguage = "javascript";
        state.codingDraft = "";
        state.codingDraftInitialized = false;
        state.codingAllowedLanguages = [];
        state.codingSubmissionState = "idle";
        state.codingResultStatus = null;
        state.codingTestSummary = null;
      }
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
    setCandidateDraft: (state, action: PayloadAction<string>) => {
      state.candidateDraft = action.payload;
    },
    updateMediaTicks: (state, action: PayloadAction<MediaTicks>) => {
      state.mediaTicks = action.payload;
    },
    setTimer: (state, action: PayloadAction<number>) => {
      state.timer = action.payload;
    },
    setCodingStartRequested: (state) => {
      state.codingStatus = "starting";
      state.codingUnavailableMessage = null;
    },
    setCodingStarted: (
      state,
      action: PayloadAction<{
        assignment: CodingAssignment;
        timeLimitSeconds: number;
        language?: string;
        draft?: string;
        allowedLanguages?: string[];
      }>,
    ) => {
      state.codingStatus = "active";
      state.codingAssignment = action.payload.assignment;
      state.codingSecondsRemaining = Math.max(
        0,
        action.payload.timeLimitSeconds,
      );
      state.codingLanguage = action.payload.language ?? "javascript";
      state.codingDraft = action.payload.draft ?? "";
      state.codingDraftInitialized = Boolean(action.payload.draft);
      state.codingAllowedLanguages = action.payload.allowedLanguages ?? [];
      state.codingCompletionReason = null;
      state.codingUnavailableMessage = null;
      state.codingSubmissionState = "idle";
      state.codingResultStatus = null;
      state.codingTestSummary = null;
    },
    setCodingCompleted: (
      state,
      action: PayloadAction<{
        reason: string;
        submissionStatus?: "attempted" | "solved" | "timed_out";
        testSummary?: { passed: number; total: number };
      }>,
    ) => {
      state.codingStatus = "completed";
      state.codingSecondsRemaining = 0;
      state.codingCompletionReason = action.payload.reason;
      state.codingSubmissionState = "idle";
      state.codingResultStatus = action.payload.submissionStatus ?? null;
      state.codingTestSummary = action.payload.testSummary ?? null;
    },
    setCodingUnavailable: (state, action: PayloadAction<string>) => {
      state.codingStatus = "unavailable";
      state.codingUnavailableMessage = action.payload;
    },
    setCodingSubmissionState: (
      state,
      action: PayloadAction<CodingSubmissionState>,
    ) => {
      state.codingSubmissionState = action.payload;
    },
    tickCodingTimer: (state) => {
      if (state.codingStatus === "active") {
        state.codingSecondsRemaining = Math.max(
          0,
          state.codingSecondsRemaining - 1,
        );
      }
    },
    setCodingDraft: (
      state,
      action: PayloadAction<{ code: string; language: string }>,
    ) => {
      state.codingDraft = action.payload.code;
      state.codingDraftInitialized = true;
      state.codingLanguage = action.payload.language;
    },
    resetCodingState: (state) => {
      state.codingStatus = "idle";
      state.codingAssignment = null;
      state.codingSecondsRemaining = 0;
      state.codingCompletionReason = null;
      state.codingUnavailableMessage = null;
      state.codingLanguage = "javascript";
      state.codingDraft = "";
      state.codingDraftInitialized = false;
      state.codingAllowedLanguages = [];
      state.codingSubmissionState = "idle";
      state.codingResultStatus = null;
      state.codingTestSummary = null;
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
    setSandboxExecutionPending: (state, action: PayloadAction<boolean>) => {
      state.sandboxExecutionPending = action.payload;
    },
  },
});

export const {
  setTargetSession,
  setConnectionStatus,
  setPhase,
  updateSandboxOutput,
  appendTranscript,
  setCandidateDraft,
  updateMediaTicks,
  setTimer,
  resetSession,
  setCodingStartRequested,
  setCodingStarted,
  setCodingCompleted,
  setCodingUnavailable,
  setCodingSubmissionState,
  tickCodingTimer,
  setCodingDraft,
  resetCodingState,
  setSandboxExecutionPending,
} = interviewSlice.actions;

export default interviewSlice.reducer;
