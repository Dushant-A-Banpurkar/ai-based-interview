"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import {
  ShieldAlert,
  Sparkles,
  Wifi,
  WifiOff,
  Mic,
  MicOff,
} from "lucide-react";
import { toast } from "sonner";

import { useMeydaTelemetry } from "@/src/hooks/useMeydaTelemetry";
import { useInterviewStatus } from "@/src/hooks/useInterviewStatus";
import { setPhase } from "@/src/store/slices/interviewSlice";
import {
  selectConnectionStatus,
  selectLiveRms,
} from "@/src/store/selectors/interviewSelectors";

import { Spinner } from "@/components/ui/spinner";
import AudioVisualizer from "@/src/components/interview/AudioVisualizer";

export default function SetupPage() {
  const params = useParams();
  const router = useRouter();
  const dispatch = useDispatch();
  const interviewId = params.id as string;

  const {
    data: interviewData,
    isLoading: isQueryLoading,
    error: queryError,
  } = useInterviewStatus(interviewId);

  const connectionStatus = useSelector(selectConnectionStatus);
  const liveRms = useSelector(selectLiveRms);

  const { isListening, error: micError } = useMeydaTelemetry({
    enabled: true,
    bufferSize: 512,
  });

  useEffect(() => {
    if (!interviewId) return;

    dispatch({
      type: "socket/connect",
      payload: { interviewId },
    });

    return () => {
      dispatch({
        type: "socket/disconnect",
      });
    };
  }, [interviewId, dispatch]);

  if (isQueryLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-white">
        <Spinner className="size-8 animate-[spin_2s_linear_infinite] text-blue-500" />

        <p className="animate-pulse text-sm tracking-wide text-slate-400">
          Initializing interview session parameters...
        </p>
      </div>
    );
  }

  if (queryError || !interviewData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-6 text-center text-white">
        <div className="mb-4 rounded-full border border-red-800 bg-red-950/40 p-4 text-red-400">
          <ShieldAlert className="size-10" />
        </div>

        <h1 className="mb-2 text-xl font-bold tracking-tight">
          Session Load Error
        </h1>

        <p className="mb-6 max-w-md text-sm text-slate-400">
          {queryError?.message ||
            "The requested interview session record does not exist or has expired."}
        </p>

        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="rounded-xl border border-slate-800 bg-slate-900 px-5 py-2.5 text-sm font-medium transition duration-200 hover:bg-slate-800"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const handleLaunchSession = () => {
    if (connectionStatus !== "connected") {
      toast.error(
        "Network connection is not ready. Please wait until the server connection is established.",
      );
      return;
    }

    if (micError || !isListening) {
      toast.error(
        "Microphone access is required. Please allow microphone permissions and try again.",
      );
      return;
    }

    toast.success("Launching interview environment. Good luck!");

    dispatch(setPhase("technical_qa"));

    router.push(`/interview/${interviewId}`);
  };

  const formattedRms =
    typeof liveRms === "number" ? liveRms.toFixed(4) : "0.0000";

  const isReady = connectionStatus === "connected" && isListening && !micError;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-white selection:bg-blue-500/30 selection:text-blue-200">
      <div className="grid w-full max-w-4xl grid-cols-1 gap-6 md:grid-cols-5">
        <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-md md:col-span-3">
          <div className="pointer-events-none absolute right-0 top-0 p-6 opacity-5">
            <Sparkles className="size-48 text-blue-500" />
          </div>

          <div>
            <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-400">
              Staging Lobby Area
            </span>

            <h1 className="mt-4 bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-3xl font-bold leading-tight tracking-tight text-transparent">
              {interviewData.roleTitle || "Technical Assessment Session"}
            </h1>

            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
              Welcome. Please check your streaming indicators, telemetry
              parameters, and audio hardware settings below before launching the
              live environment.
            </p>

            <div className="mt-8 max-w-xs space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-slate-800/50 bg-slate-950/40 p-3.5">
                <div className="flex items-center gap-3">
                  {connectionStatus === "connected" ? (
                    <Wifi className="size-5 text-emerald-400" />
                  ) : (
                    <WifiOff className="size-5 animate-pulse text-amber-500" />
                  )}

                  <span className="text-sm font-medium text-slate-300">
                    Server Link Status
                  </span>
                </div>

                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                    connectionStatus === "connected"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-amber-500/10 text-amber-400"
                  }`}
                >
                  {connectionStatus}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-800/50 bg-slate-950/40 p-3.5">
                <div className="flex items-center gap-3">
                  {isListening ? (
                    <Mic className="size-5 text-blue-400" />
                  ) : (
                    <MicOff className="size-5 animate-pulse text-rose-500" />
                  )}

                  <span className="text-sm font-medium text-slate-300">
                    Microphone Input
                  </span>
                </div>

                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    isListening
                      ? "bg-blue-500/10 text-blue-400"
                      : "bg-rose-500/10 text-rose-400"
                  }`}
                >
                  {isListening ? "Streaming Active" : "Hardware Muted"}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLaunchSession}
            disabled={!isReady}
            className="mt-10 w-full transform rounded-xl border border-blue-500 bg-gradient-to-r from-blue-600 to-indigo-600 py-4 text-sm font-semibold tracking-wide text-white shadow-lg shadow-blue-600/10 transition duration-300 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:transform-none disabled:border-slate-800 disabled:bg-gradient-to-r disabled:from-slate-900 disabled:to-slate-900 disabled:text-slate-500 disabled:shadow-none md:mt-0"
          >
            {isReady ? "Start Live Assessment" : "Complete System Checks"}
          </button>
        </div>

        <div className="relative flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 shadow-2xl md:col-span-2">
          {micError ? (
            <div className="p-4 text-center">
              <ShieldAlert className="mx-auto mb-2 size-8 animate-bounce text-rose-500" />

              <p className="text-sm font-medium text-rose-400">
                Audio Node Handshake Blocked
              </p>

              <p className="mx-auto mt-1 max-w-[200px] text-xs text-slate-500">
                Please grant microphone access in your browser settings to
                continue the evaluation session.
              </p>
            </div>
          ) : isListening ? (
            <div className="flex h-full w-full flex-col items-center justify-between gap-6 py-4">
              <span className="text-xs font-medium uppercase tracking-widest text-slate-500">
                Real-Time Telemetry Feed
              </span>

              <div className="flex w-full flex-1 items-center justify-center">
                <AudioVisualizer />
              </div>

              <div className="text-center">
                <p className="text-xs font-medium text-slate-400">
                  Microphone Frequency Active
                </p>

                <p className="mt-0.5 font-mono text-[10px] text-slate-600">
                  RMS Energy: {formattedRms}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 p-4 text-center">
              <Spinner className="size-6 animate-pulse text-slate-600" />

              <p className="text-xs text-slate-500">
                Awaiting audio capture stream node allocation approval...
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
