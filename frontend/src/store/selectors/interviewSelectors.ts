import { createSelector } from "@reduxjs/toolkit";
import { RootState } from "../store";

const selectInterviewState = (state: RootState) => state.interview;

export const selectActiveInterviewId = createSelector(
  [selectInterviewState],
  (interview) => interview.interviewId,
);
export const selectConnectionStatus = createSelector(
  [selectInterviewState],
  (state) => state.connectionStatus,
);

export const selectInterviewPhase = createSelector(
  [selectInterviewState],
  (state) => state.phase,
);

export const selectSandboxOutput = (state: RootState) =>
  state.interview.sandboxOutput || "Sandbox ready. Output will appear here...";

export const selectTranscript = createSelector(
  [selectInterviewState],
  (state) => state.transcriptBuffer,
);
export const selectLiveRms = createSelector(
  [selectInterviewState],
  (state) => state.mediaTicks?.rms || 0,
);
