/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import Meyda from "meyda";
import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";

interface TelementryOptions {
  enabled?: boolean;
  bufferSize?: 512 | 1024 | 2048;
}

export function useMeydaTelemetry({
  enabled = true,
  bufferSize = 512,
}: TelementryOptions = {}) {
  const dispatch = useDispatch();
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<any>(null);
  const analyzerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;
    async function initAudio() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        streamRef.current = stream;

        const AudiaContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;

        const audioCtx = new AudiaContextClass();
        audioContextRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);

        const analyzer = Meyda.createMeydaAnalyzer({
          audioContext: audioCtx,
          source: source,
          bufferSize: bufferSize,
          featureExtractors: ["rms", "spectralCentroid", "zcr"],
          callback: (features: any) => {
            if (features) {
              dispatch({
                type: "socket/emit",
                payload: {
                  event: "meyda_telemetry",
                  data: {
                    rms: features.rms ?? 0,
                    spectralCentroid: features.spectralCentroid ?? 0,
                    zcr: features.zcr ?? 0,
                    timestamp: Date.now(),
                  },
                },
              });
            }
          },
        });
        analyzer.start();
        analyzerRef.current = analyzer;
        if (isMounted) setIsListening(true);
      } catch (err: any) {
        console.error("Meyda telemetry setup error: ", err);
        if (isMounted) {
          setError(err.message || "Microphone access denied or unavailable");
          setIsListening(false);
        }
      }
    }

    initAudio();

    return () => {
      isMounted = false;
      if (analyzerRef.current) {
        try {
          analyzerRef.current.stop();
        } catch {}
      }
      if (sourceRef.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        sourceRef.current.disconnect();
      }
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      setIsListening(false);
    };
  }, [enabled, bufferSize, dispatch]);
  return { isListening, error };
}
