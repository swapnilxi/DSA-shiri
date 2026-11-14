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
  const connectTimer = useRef<number | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const [events, setEvents] = useState<InterviewEvent[]>([]);
  const [connected, setConnected] = useState(false);

  const pushEvent = (e: InterviewEvent) =>
    setEvents((prev) => [...prev, e]);

  const connect = useCallback(() => {
    if (!sessionId) return;

    // Reuse a live socket — React StrictMode (mount → cleanup → mount) and
    // re-renders must never open a second connection for the same session.
    const existing = ws.current;
    if (existing && (existing.readyState === WebSocket.CONNECTING || existing.readyState === WebSocket.OPEN)) {
      return;
    }
    ws.current = null; // stale CLOSING/CLOSED socket — replace it

    // Defer creation by a tick so an immediate unmount (StrictMode, Fast
    // Refresh, fast navigation) cancels it instead of leaving a socket that
    // connects after we are gone.
    if (connectTimer.current !== null) window.clearTimeout(connectTimer.current);
    connectTimer.current = window.setTimeout(() => {
      connectTimer.current = null;

      const socket = new WebSocket(`${WS_URL}/interview/ws/${sessionId}`);
      socket.binaryType = "arraybuffer";

      socket.onopen = () => setConnected(true);
      socket.onclose = () => {
        setConnected(false);
        // Only clear the ref if this socket is still the active one.
        if (ws.current === socket) ws.current = null;
      };
      socket.onerror = () => {
        pushEvent({
          type: "status",
          message: "Lost the connection to the interview server. Check that the backend is running on port 8000.",
        });
      };

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
    }, 0);
  }, [sessionId]);

  const sendAudio = useCallback(async (blob: Blob) => {
    const socket = ws.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      pushEvent({
        type: "status",
        message: "Could not send the recording — the connection is not open. Click Reconnect and try again.",
      });
      return;
    }
    const buf = await blob.arrayBuffer();
    socket.send(buf);
  }, []);

  const sendControl = useCallback((action: string) => {
    const socket = ws.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ action }));
    return true;
  }, []);

  const disconnect = useCallback(() => {
    if (connectTimer.current !== null) {
      window.clearTimeout(connectTimer.current);
      connectTimer.current = null;
    }

    const socket = ws.current;
    ws.current = null; // idempotent: a second call is a no-op
    if (!socket) return;

    // Detach handlers so a late open/close cannot update unmounted state.
    socket.onopen = null;
    socket.onclose = null;
    socket.onerror = null;
    socket.onmessage = null;

    if (socket.readyState === WebSocket.CONNECTING) {
      // Never abort the handshake itself: closing a CONNECTING socket makes
      // the browser log "WebSocket is closed before the connection is
      // established". Close it the instant it opens instead.
      socket.onopen = () => socket.close();
      return;
    }
    try {
      // close() is non-blocking — it queues a CLOSE frame and returns. We pass
      // 1000 (normal) so the backend tears the session down immediately instead
      // of treating it as an abnormal drop.
      socket.close(1000);
    } catch {
      /* socket already gone */
    }
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
