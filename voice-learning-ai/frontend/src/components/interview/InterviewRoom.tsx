"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, PhoneOff, Send, Volume2 } from "lucide-react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useInterview, ScoreBreakdown } from "@/hooks/useInterview";
import { Waveform } from "./Waveform";
import { ScoreOverlay } from "./ScoreOverlay";

interface Props {
  sessionId: number;
  topic: string;
  onEnd: () => void;
}

export function InterviewRoom({ sessionId, topic, onEnd }: Props) {
  const recorder = useAudioRecorder();
  const interview = useInterview(sessionId);

  const [currentQ, setCurrentQ] = useState<{ text: string; index: number; total: number; difficulty: string } | null>(null);
  const [lastScore, setLastScore] = useState<ScoreBreakdown | null>(null);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState("Connecting...");
  const [isComplete, setIsComplete] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [processingSeconds, setProcessingSeconds] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    interview.connect();
    return () => interview.disconnect();
  }, []);

  useEffect(() => {
    for (const event of interview.events) {
      if (event.type === "question") {
        setCurrentQ({ text: event.text, index: event.index, total: event.total, difficulty: event.difficulty });
        setLastScore(null);
        setTranscript("");
        setProcessingSeconds(null);
        setStatus("Interviewer is speaking...");
      }
      if (event.type === "status") setStatus(event.message);
      if (event.type === "transcript") setTranscript(event.text);
      if (event.type === "score") {
        setLastScore(event.score);
        setProcessingSeconds(null);
        setStatus("Review your feedback — the next question will follow shortly.");
      }
      if (event.type === "session_complete") {
        setIsComplete(true);
        setFinalScore(event.final_score);
      }
    }
  }, [interview.events]);

  const submitRecording = useCallback(async () => {
    if (!recorder.isRecording || submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const blob = await recorder.stop();
      setProcessingSeconds(30);
      setStatus("Submitting answer for feedback...");
      await interview.sendAudio(blob);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [interview.sendAudio, recorder.isRecording, recorder.stop]);

  useEffect(() => {
    if (processingSeconds === null || processingSeconds <= 0) return;

    const timer = window.setInterval(() => {
      setProcessingSeconds((seconds) =>
        seconds === null ? null : Math.max(0, seconds - 1)
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, [processingSeconds]);

  async function handleRecord() {
    if (recorder.isRecording || isSubmitting || processingSeconds !== null) return;
    await recorder.start();
    setStatus("Recording — take as long as you need, then click Submit.");
  }

  if (isComplete) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-950 text-white gap-6">
        <div className="text-5xl font-bold text-green-400">{finalScore.toFixed(0)}<span className="text-2xl text-gray-400">/100</span></div>
        <p className="text-xl text-gray-300">Session complete</p>
        <button onClick={onEnd} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-white font-medium">
          View Full Report
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm font-medium text-gray-200">Voice Learning AI — {topic}</span>
        </div>
        {currentQ && (
          <span className="text-sm text-gray-400">
            Question {currentQ.index + 1} / {currentQ.total}
          </span>
        )}
        <button onClick={() => { interview.sendControl("end"); onEnd(); }}
          className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm">
          <PhoneOff size={14} /> End
        </button>
      </div>

      {/* Main split — video panels */}
      <div className="flex flex-1 gap-0 overflow-hidden">
        {/* Left — AI Interviewer */}
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-900 relative border-r border-gray-800">
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-4xl mb-4 shadow-2xl">
            🤖
          </div>
          <p className="text-gray-400 text-sm mb-3">AI Interviewer</p>
          <Waveform active={status === "Interviewer is speaking..."} volume={0.6} color="#60a5fa" />
          {currentQ && (
            <div className="absolute bottom-6 left-6 right-6 bg-gray-800/80 backdrop-blur rounded-xl p-4 text-sm text-gray-200 leading-relaxed">
              {currentQ.text}
              <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                currentQ.difficulty === "Hard" ? "bg-red-900 text-red-300" :
                currentQ.difficulty === "Medium" ? "bg-yellow-900 text-yellow-300" :
                "bg-green-900 text-green-300"
              }`}>{currentQ.difficulty}</span>
            </div>
          )}
        </div>

        {/* Right — You */}
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-850 relative" style={{ background: "#111827" }}>
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-4xl mb-4 shadow-2xl">
            👤
          </div>
          <p className="text-gray-400 text-sm mb-3">You</p>
          <Waveform active={recorder.isRecording} volume={recorder.volume} color="#34d399" />
          {transcript && (
            <div className="absolute bottom-6 left-6 right-6 bg-gray-800/80 backdrop-blur rounded-xl p-4 text-sm text-gray-300 leading-relaxed italic">
              "{transcript}"
            </div>
          )}
        </div>
      </div>

      {/* Score overlay */}
      {lastScore && <ScoreOverlay score={lastScore} />}

      {/* Bottom control bar */}
      <div className="flex items-center justify-between px-8 py-4 bg-gray-900 border-t border-gray-800">
        <div className="text-xs text-gray-500">
          {recorder.isRecording
            ? "Recording — no time limit"
            : processingSeconds !== null
              ? processingSeconds > 0
                ? `Processing feedback: ${processingSeconds}s`
                : "Still processing feedback..."
              : status}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRecord}
            disabled={recorder.isRecording || isSubmitting || processingSeconds !== null}
            className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-all disabled:cursor-not-allowed ${
              recorder.isRecording
                ? "bg-red-600 scale-110 animate-pulse"
                : "bg-gray-700 hover:bg-gray-600 disabled:opacity-40"
            }`}
            aria-label="Start recording"
          >
            <Mic size={22} />
          </button>

          <button
            onClick={submitRecording}
            disabled={!recorder.isRecording || isSubmitting}
            className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-medium"
          >
            <Send size={16} />
            {isSubmitting ? "Submitting..." : "Submit answer"}
          </button>
        </div>

        <div className="text-xs text-gray-500 flex items-center gap-1">
          <Volume2 size={14} /> Local AI
        </div>
      </div>
    </div>
  );
}
