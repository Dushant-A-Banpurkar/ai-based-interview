"use client";

import CodeSandbox from "@/src/components/editor/CodeSandbox";
import AudioVisualizer from "@/src/components/interview/AudioVisualizer";
import { useMeydaTelemetry } from "@/src/hooks/useMeydaTelemetry";
import {
  selectCandidateDraft,
  selectCodingCompletionReason,
  selectCodingResultStatus,
  selectCodingStatus,
  selectCodingTestSummary,
  selectCodingUnavailableMessage,
  selectInterviewPhase,
  selectTranscript,
} from "@/src/store/selectors/interviewSelectors";
import {
  setCodingStartRequested,
  setTargetSession,
} from "@/src/store/slices/interviewSlice";
import React, { use, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function LiveInterviewPage({ params }: PageProps) {
  const { id: interviewId } = use(params);

  const dispatch = useDispatch();
  const phase = useSelector(selectInterviewPhase);
  const transcript = useSelector(selectTranscript);
  const candidateDraft = useSelector(selectCandidateDraft);
  const codingStatus = useSelector(selectCodingStatus);
  const codingCompletionReason = useSelector(selectCodingCompletionReason);
  const codingResultStatus = useSelector(selectCodingResultStatus);
  const codingTestSummary = useSelector(selectCodingTestSummary);
  const codingUnavailableMessage = useSelector(
    selectCodingUnavailableMessage,
  );

  useEffect(() => {
    if (interviewId) {
      dispatch(setTargetSession({ interviewId }));
      dispatch({ type: "socket/connect", payload: { interviewId } });
    }
    return () => {
      dispatch({ type: "socket/disconnect" });
    };
  }, [dispatch, interviewId]);

  const { isListening, error: micError } = useMeydaTelemetry({ enabled: true });

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden selection:bg-blue-500/20">
      <div className="w-1/2 border-r border-slate-800 p-6 flex flex-col bg-slate-950">
        <header className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Session ID:{" "}
            <span className="font-mono text-base text-slate-400">
              {interviewId}
            </span>
          </h2>
          <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-800 rounded-full px-3 py-1.5 shadow-inner">
            <span
              className={`h-2.5 w-2.5 rounded-full shadow-lg transition-all duration-300 ${
                isListening
                  ? "bg-emerald-500 animate-pulse shadow-emerald-500/50"
                  : "bg-red-500 shadow-red-500/50"
              }`}
            />
            <span className="text-xs font-mono text-slate-300 font-medium">
              {isListening ? "Mic Live (Meyda Active)" : "Mic Inactive"}
            </span>
          </div>
        </header>

        {micError && (
          <div className="mb-4 rounded-xl bg-red-950/30 border border-red-500/30 p-4 text-sm text-red-400 shadow-lg leading-relaxed">
            {micError}
          </div>
        )}

        <div className="flex-1 bg-slate-900/40 rounded-xl p-5 border border-slate-800/80 mb-6 overflow-y-auto shadow-inner backdrop-blur-sm">
          <div className="space-y-4" aria-live="polite">
            {transcript.length === 0 && !candidateDraft ? (
              <p className="text-slate-500 text-xs tracking-wide italic animate-pulse">
                Waiting for the interviewer and candidate to speak...
              </p>
            ) : (
              <>
                {transcript.map((message, index) => (
                  <div
                    key={`${message.role}-${message.timestamp}-${index}`}
                    className={`max-w-[85%] rounded-xl p-3 ${
                      message.role === "ai"
                        ? "bg-blue-950/50 text-blue-100"
                        : "ml-auto bg-slate-800 text-slate-100"
                    }`}
                  >
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-70">
                      {message.role === "ai" ? "Interviewer" : "You"}
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.text}
                    </p>
                  </div>
                ))}
                {candidateDraft && (
                  <div className="ml-auto max-w-[85%] rounded-xl bg-slate-800/70 p-3 text-slate-300">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-70">
                      You · listening
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {candidateDraft}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="space-y-3 bg-slate-900/20 p-4 rounded-xl border border-slate-900 shadow-inner">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest">
            Real-Time Acoustic Telemetry
          </p>
          <AudioVisualizer />
        </div>
      </div>

      <div className="w-1/2 flex flex-col bg-slate-950">
        {codingStatus === "active" || phase === "live_coding" ? (
          <CodeSandbox />
        ) : codingStatus === "completed" ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-950/40 text-emerald-300">
              ✓
            </div>
            <h2 className="mb-2 text-lg font-semibold text-slate-200">
              Coding submission complete
            </h2>
            <p className="max-w-sm text-sm leading-relaxed text-slate-400">
              {codingCompletionReason === "timed_out"
                ? "Time expired. Your latest saved code was submitted."
                : codingCompletionReason === "interview_ended"
                  ? "Your interview ended and the coding submission was saved."
                  : "Your final code was saved. The interviewer will continue with a follow-up."}
            </p>
            {codingResultStatus && (
              <p className="mt-3 text-xs text-slate-500">
                Result: {codingResultStatus}
                {codingTestSummary
                  ? ` · ${codingTestSummary.passed}/${codingTestSummary.total} private tests passed`
                  : ""}
              </p>
            )}
          </div>
        ) : codingStatus === "unavailable" ? (
          <div
            role="status"
            className="flex flex-1 flex-col items-center justify-center p-8 text-center"
          >
            <h2 className="mb-2 text-lg font-semibold text-slate-200">
              Coding assignment unavailable
            </h2>
            <p className="max-w-sm text-sm leading-relaxed text-slate-400">
              {codingUnavailableMessage}
            </p>
          </div>
        ) : codingStatus === "starting" ? (
          <div
            role="status"
            className="flex flex-1 items-center justify-center text-sm text-slate-400"
          >
            Waiting for the interviewer to start the coding assignment…
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center bg-radial from-slate-900/40 via-transparent to-transparent">
            <div className="h-12 w-12 rounded-2xl border border-slate-800 bg-slate-900/50 flex items-center justify-center text-slate-400 font-mono text-lg font-bold shadow-md mb-4">
              {"</>"}
            </div>
            <p className="text-lg font-semibold text-slate-300 mb-2 tracking-tight">
              Coding Workspace
            </p>
            <p className="text-sm text-slate-500 max-w-xs leading-relaxed mx-auto">
              Your coding workspace is ready when you are. Start the coding
              phase to open the editor and run code in the sandbox.
            </p>
            <button
              type="button"
              onClick={() => {
                dispatch(setCodingStartRequested());
                dispatch({
                  type: "socket/emit",
                  payload: {
                    event: "start_coding",
                    data: { interviewId },
                  },
                });
              }}
              className="mt-6 rounded-xl border border-blue-500 bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              Start coding exercise
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
