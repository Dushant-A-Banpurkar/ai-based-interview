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
export const selectSandboxExecutionPending = (state: RootState) =>
  state.interview.sandboxExecutionPending;
export const selectCodingStatus = (state: RootState) =>
  state.interview.codingStatus;
export const selectCodingAssignment = (state: RootState) =>
  state.interview.codingAssignment;
export const selectCodingSecondsRemaining = (state: RootState) =>
  state.interview.codingSecondsRemaining;
export const selectCodingCompletionReason = (state: RootState) =>
  state.interview.codingCompletionReason;
export const selectCodingUnavailableMessage = (state: RootState) =>
  state.interview.codingUnavailableMessage;
export const selectCodingLanguage = (state: RootState) =>
  state.interview.codingLanguage;
export const selectCodingDraft = (state: RootState) =>
  state.interview.codingDraft;
export const selectCodingDraftInitialized = (state: RootState) =>
  state.interview.codingDraftInitialized;
export const selectCodingAllowedLanguages = (state: RootState) =>
  state.interview.codingAllowedLanguages;
export const selectCodingSubmissionState = (state: RootState) =>
  state.interview.codingSubmissionState;
export const selectCodingResultStatus = (state: RootState) =>
  state.interview.codingResultStatus;
export const selectCodingTestSummary = (state: RootState) =>
  state.interview.codingTestSummary;

export const selectTranscript = createSelector(
  [selectInterviewState],
  (state) => state.transcriptBuffer,
);
export const selectCandidateDraft = createSelector(
  [selectInterviewState],
  (state) => state.candidateDraft,
);
export const selectLiveRms = createSelector(
  [selectInterviewState],
  (state) => state.mediaTicks?.rms || 0,
);
