"use client";

import CodeSandbox from "@/src/components/editor/CodeSandbox";
import AudioVisualizer from "@/src/components/interview/AudioVisualizer";
import { useMeydaTelemetry } from "@/src/hooks/useMeydaTelemetry";
import { selectInterviewPhase } from "@/src/store/selectors/interviewSelectors";
import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

export default function LiveInterviewPage({
  params,
}: {
  params: { id: string };
}) {
  const dispatch = useDispatch();
  const phase = useSelector(selectInterviewPhase);

  useEffect(() => {
    dispatch({ type: "socket/connect", payload: { interviewId: params.id } });
    return () => {
      dispatch({ type: "socket/disconnect" });
    };
  }, [dispatch, params.id]);

  const { isListening, error: micError } = useMeydaTelemetry({ enabled: true });
  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden">
      <div className="w-1/2 border-r border-slate-800 p-6 flex flex-col">
        <header className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Session ID: {params.id}</h2>
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${isListening ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}
            />
            <span className="text-xs font-mono text-slate-400">
              {isListening ? "Mic Live (Meyda Active)" : "Mic Inactive"}
            </span>
          </div>
        </header>

        {micError && (
          <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
            {micError}
          </div>
        )}

        <div className="flex-1 bg-slate-900 rounded-xl p-4 border border-slate-800 mb-4 overflow-y-auto">
          <p className="text-slate-400 text-sm">
            Transcript stream synced via Redux middleware...
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-slate-500 uppercase tracking-wider">
            Real-Time Acoustic Telemetry
          </p>
          <AudioVisualizer />
        </div>
      </div>

      <div className="w-1/2 flex flex-col">
        {phase === "live_coding" ? (
          <CodeSandbox />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 bg-slate-950 p-8 text-center">
            <p className="text-lg font-medium text-slate-400 mb-1">
              Coding Round Locked
            </p>
            <p className="text-sm">
              The sandbox will unlock automatically when the backend
              orchestrator shifts the interview phase.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
