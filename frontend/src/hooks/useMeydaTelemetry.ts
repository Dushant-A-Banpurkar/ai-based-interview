/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import Meyda from "meyda";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { selectActiveInterviewId } from "@/src/store/selectors/interviewSelectors";

interface TelementryOptions {
  enabled?: boolean;
  bufferSize?: 512 | 1024 | 2048;
}

export function useMeydaTelemetry({
  enabled = true,
  bufferSize = 512,
}: TelementryOptions = {}) {
  const dispatch = useDispatch();
  const interviewId = useSelector(selectActiveInterviewId);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<any>(null);
  const analyzerRef = useRef<any>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!enabled || !interviewId) return;

    let isMounted = true;
    async function initAudio() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000, // Deepgram optimal sample rate
          },
        });
        streamRef.current = stream;

        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;

        const audioCtx = new AudioContextClass({ sampleRate: 16000 });
        audioContextRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);
        sourceRef.current = source;

        // 1. Setup Meyda Analyzer for Audio Telemetry
        const analyzer = Meyda.createMeydaAnalyzer({
          audioContext: audioCtx,
          source: source,
          bufferSize: bufferSize,
          featureExtractors: ["rms", "spectralCentroid", "zcr"],
          callback: (features: any) => {
            if (features && isMounted) {
              dispatch({
                type: "socket/emit",
                payload: {
                  event: "meyda_telemetry",
                  data: {
                    interviewId,
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

        // 2. Setup ScriptProcessor to stream raw audio PCM chunks to Deepgram via backend
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (!isMounted) return;
          const inputData = e.inputBuffer.getChannelData(0);
          
          // Convert Float32Array to Int16Array (PCM 16-bit) required by Deepgram
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }

          // Emit raw audio buffer chunk to backend socket
          dispatch({
            type: "socket/emit",
            payload: {
              event: "audio:stream",
              data: pcm16.buffer,
            },
          });
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);

        if (isMounted) setIsListening(true);
      } catch (err: any) {
        console.error("Meyda telemetry & audio stream setup error: ", err);
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
      if (processorRef.current && audioContextRef.current) {
        try {
          processorRef.current.disconnect();
        } catch {}
      }
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch {}
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
  }, [enabled, bufferSize, dispatch, interviewId]);

  return { isListening, error };
}