import { createSelector } from "@reduxjs/toolkit";
import { RootState } from "../store";




const selectInterviewState=(state:RootState)=>state.interview;

export const selectConnectionStatus = createSelector(
  [selectInterviewState],
  (state) => state.connectionStatus
);

export const selectInterviewPhase = createSelector(
  [selectInterviewState],
  (state) => state.phase
);

export const selectTranscript = createSelector(
  [selectInterviewState],
  (state) => state.transcriptBuffer
);
export const selectLiveRms=createSelector(
    [selectInterviewState],
    (state)=>state.mediaTicks?.rms||0
)