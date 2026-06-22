"use client";
import { useRef, useState, useCallback } from "react";
import { WS_URL } from "@/lib/api";

export type InterviewEvent =
  | { type: "question"; index: number; total: number; text: string; topic: string; difficulty: string }
  | { type: "transcript"; text: string }
  | { type: "score"; score: ScoreBreakdown }
  | { type: "status"; message: string }
  | { type: "session_complete"; final_score: number; session_id: number }
  | { type: "error"; message: string };

export interface ScoreBreakdown {
  technical_correctness: number;
  depth_completeness: number;
  communication_clarity: number;
  problem_solving: number;
  total: number;
  llm_feedback: string;
  follow_up_asked?: string;
}

export function useInterview(sessionId: number | null) {
  const ws = useRef<WebSocket | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const [events, setEvents] = useState<InterviewEvent[]>([]);
  const [connected, setConnected] = useState(false);

  const pushEvent = (e: InterviewEvent) =>
    setEvents((prev) => [...prev, e]);

  const connect = useCallback(() => {
    if (!sessionId || ws.current) return;

    const socket = new WebSocket(`${WS_URL}/interview/ws/${sessionId}`);
    socket.binaryType = "arraybuffer";

    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);

    socket.onmessage = async (msg) => {
      if (msg.data instanceof ArrayBuffer) {
        // Audio from server (TTS) — play it
        await playAudio(msg.data);
      } else {
        const event: InterviewEvent = JSON.parse(msg.data);
        pushEvent(event);
      }
    };

    ws.current = socket;
  }, [sessionId]);

  const sendAudio = useCallback(async (blob: Blob) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;
    const buf = await blob.arrayBuffer();
    ws.current.send(buf);
  }, []);

  const sendControl = useCallback((action: string) => {
    ws.current?.send(JSON.stringify({ action }));
  }, []);

  const disconnect = useCallback(() => {
    ws.current?.close();
    ws.current = null;
  }, []);

  async function playAudio(buf: ArrayBuffer) {
    if (!audioCtx.current) {
      audioCtx.current = new AudioContext();
    }
    const decoded = await audioCtx.current.decodeAudioData(buf.slice(0));
    const source = audioCtx.current.createBufferSource();
    source.buffer = decoded;
    source.connect(audioCtx.current.destination);
    source.start();
  }

  return { connect, disconnect, sendAudio, sendControl, events, connected };
}
