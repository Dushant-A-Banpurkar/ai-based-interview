"use client";

import React from "react";

export default function LiveInterviewPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden">
      <div className="w-1/2 border-r border-slate-800 p-6 flex flex-col">
        <header className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold">Session ID: {params.id}</h2>
          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-mono">
            Live Stream Connected
          </span>
        </header>

        <div className="flex-1 bg-slate-900 rounded-xl p-4 border border-slate-800 mb-4 overflow-y-auto">
          <p className="text-slate-400 text-sm">
            Transcript stream will appear here....
          </p>
        </div>
        <div className="h-24 bg-slate-900 rounded-xl border border-slate-800 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
            Audio Telemetry (Meyda)
          </p>
        </div>
      </div>
      <div className="w-1/2 flex flex-col">
        <div className="flex-1">
          <div className="h-full flex items-center justify-center text-slate-600">
            Monaco Sandbox Editor Container
          </div>
        </div>
      </div>
    </div>
  );
}
