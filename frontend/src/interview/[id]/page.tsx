"use client";

import CodeSandbox from "@/src/components/editor/CodeSandbox";
import AudioVisualizer from "@/src/components/interview/AudioVisualizer";
import { useMeydaTelemetry } from "@/src/hooks/useMeydaTelemetry";
import { selectInterviewPhase } from "@/src/store/selectors/interviewSelectors";
import React, { use, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function LiveInterviewPage({ params }: PageProps) {
  const { id: interviewId } = use(params);

  const dispatch = useDispatch();
  const phase = useSelector(selectInterviewPhase);

  useEffect(() => {
    if (interviewId) {
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
          <p className="text-slate-500 text-xs tracking-wide italic animate-pulse">
            Transcript stream synced via Redux middleware... Awaiting server
            packet transmission loops.
          </p>
        </div>

        <div className="space-y-3 bg-slate-900/20 p-4 rounded-xl border border-slate-900 shadow-inner">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest">
            Real-Time Acoustic Telemetry
          </p>
          <AudioVisualizer />
        </div>
      </div>

      <div className="w-1/2 flex flex-col bg-slate-950">
        {phase === "live_coding" ? (
          <CodeSandbox />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center bg-radial from-slate-900/40 via-transparent to-transparent">
            <div className="h-12 w-12 rounded-2xl border border-slate-800 bg-slate-900/50 flex items-center justify-center text-slate-400 font-mono text-lg font-bold shadow-md mb-4">
              {"</>"}
            </div>
            <p className="text-lg font-semibold text-slate-300 mb-2 tracking-tight">
              Coding Workspace Locked
            </p>
            <p className="text-sm text-slate-500 max-w-xs leading-relaxed mx-auto">
              The secure environment sandbox will trigger open automatically
              when the backend orchestrator advances the interview phase.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
