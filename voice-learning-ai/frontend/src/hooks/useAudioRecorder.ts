"use client";
import { useRef, useState, useCallback } from "react";

export function useAudioRecorder() {
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [volume, setVolume] = useState(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    // Volume meter via Web Audio API
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const measureVolume = () => {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const v of data) sum += Math.abs(v - 128);
      setVolume(sum / data.length / 128);
      animFrameRef.current = requestAnimationFrame(measureVolume);
    };
    measureVolume();

    chunks.current = [];
    const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
    mr.ondataavailable = (e) => chunks.current.push(e.data);
    mr.start(100);
    mediaRecorder.current = mr;
    setIsRecording(true);
  }, []);

  const stop = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      cancelAnimationFrame(animFrameRef.current);
      setVolume(0);
      const mr = mediaRecorder.current!;
      mr.onstop = () => {
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        resolve(blob);
      };
      mr.stop();
      mr.stream.getTracks().forEach((t) => t.stop());
      setIsRecording(false);
    });
  }, []);

  return { start, stop, isRecording, volume };
}
