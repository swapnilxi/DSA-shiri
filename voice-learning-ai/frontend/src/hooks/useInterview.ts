"use client";
import { useRef, useState, useCallback } from "react";
import { WS_URL } from "@/lib/api";

export type InterviewEvent =
  | { type: "session_config"; follow_up_mode: boolean }
  | { type: "question"; index: number; total: number; text: string; topic: string; difficulty: string }
  | { type: "interviewer_message"; text: string; mode: string; question_index: number | null; round: number | null }
  | { type: "followup_state"; round: number; max_rounds: number; question_index: number }
  | { type: "followup_report"; report: InterviewFollowupReport }
  | { type: "audio_start" }
  | { type: "audio_end" }
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

export interface InterviewFollowupTurn {
  round: number;
  interviewer_prompt: string;
  candidate_answer: string;
  understanding_score: number;
  coach_feedback: string;
  deeper_explanation: string;
  hint: string;
  next_question: string;
  what_they_now_understand: string[];
  remaining_gaps: string[];
}

export interface InterviewFollowupReport {
  understanding_score: number;
  overall_assessment: string;
  strengths: string[];
  remaining_gaps: string[];
  concepts_mastered: string[];
  concepts_to_review: string[];
  recommended_drills: string[];
  ideal_answer_extension: string;
  rounds_completed?: number;
  turns?: InterviewFollowupTurn[];
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
        pushEvent({ type: "audio_start" });
        await playAudio(msg.data);
        pushEvent({ type: "audio_end" });
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
    await new Promise<void>((resolve) => {
      const source = audioCtx.current!.createBufferSource();
      source.buffer = decoded;
      source.connect(audioCtx.current!.destination);
      source.onended = () => resolve();
      source.start();
    });
  }

  return { connect, disconnect, sendAudio, sendControl, events, connected };
}
