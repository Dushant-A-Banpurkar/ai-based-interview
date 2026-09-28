"use client";

import { selectLiveRms } from "@/src/store/selectors/interviewSelectors";
import { useSelector } from "react-redux";

export default function Audio() {
  const rawRms = useSelector(selectLiveRms);

  const volumePercentage = Math.min(Math.max(rawRms * 150, 5), 100);

  return (
    <div className="flex w-full items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-5 shadow-xl">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 border border-slate-700/50 shadow-inner">
        <svg
          className={`h-5 w-5 transition-colors duration-200 ${volumePercentage > 12 ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]" : "text-slate-500"}`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
        </svg>
      </div>

      <div className="flex h-10 flex-1 items-end gap-1.5 overflow-hidden px-1">
        {[...Array(24)].map((_, i) => {
          const waveFactor = 0.4 + 0.6 * Math.sin((i / 23) * Math.PI);
          const currentBarHeight = volumePercentage * waveFactor;

          return (
            <div
              key={i}
              style={{
                height: `${currentBarHeight}%`,
              }}
              className={`w-full rounded-full transition-all duration-75 ease-out ${
                volumePercentage > 12
                  ? "bg-gradient-to-t from-emerald-600 to-emerald-400 opacity-100 shadow-[0_0_4px_rgba(52,211,153,0.2)]"
                  : "bg-slate-700 opacity-40"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
