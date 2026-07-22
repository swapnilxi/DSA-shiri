"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, PhoneOff, Send, Volume2, FileText, X } from "lucide-react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { InterviewFollowupReport, useInterview, ScoreBreakdown } from "@/hooks/useInterview";
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
  const [isInterviewerSpeaking, setIsInterviewerSpeaking] = useState(false);
  const [followUpMode, setFollowUpMode] = useState(false);
  const [spokenText, setSpokenText] = useState("");
  const [followUpRound, setFollowUpRound] = useState<number | null>(null);
  const [latestFollowUpReport, setLatestFollowUpReport] = useState<InterviewFollowupReport | null>(null);
  const [showEndModal, setShowEndModal] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const submittingRef = useRef(false);
  const processedEvents = useRef(0);
  const followUpModeRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const s = (totalSeconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  useEffect(() => {
    interview.connect();
    return () => interview.disconnect();
  }, []);

  useEffect(() => {
    const nextEvents = interview.events.slice(processedEvents.current);
    processedEvents.current = interview.events.length;
    for (const event of nextEvents) {
      if (event.type === "session_config") {
        followUpModeRef.current = event.follow_up_mode;
        setFollowUpMode(event.follow_up_mode);
      }
      if (event.type === "audio_start") {
        setIsInterviewerSpeaking(true);
        setStatus("Interviewer is speaking...");
      }
      if (event.type === "audio_end") {
        setIsInterviewerSpeaking(false);
        setStatus((current) => current === "Interviewer is speaking..." ? "Your turn." : current);
      }
      if (event.type === "interviewer_message") {
        setIsInterviewerSpeaking(true);
        setSpokenText(event.text);
        if (event.mode === "followup" || event.mode === "followup_summary") {
          setFollowUpRound(event.round);
        }
        if (event.mode === "question") {
          setFollowUpRound(null);
          setLatestFollowUpReport(null);
        }
      }
      if (event.type === "question") {
        setCurrentQ({ text: event.text, index: event.index, total: event.total, difficulty: event.difficulty });
        setLastScore(null);
        setTranscript("");
        setProcessingSeconds(null);
        setSpokenText("");
        setFollowUpRound(null);
        setLatestFollowUpReport(null);
      }
      if (event.type === "status") setStatus(event.message);
      if (event.type === "transcript") setTranscript(event.text);
      if (event.type === "score") {
        setLastScore(event.score);
        setProcessingSeconds(null);
        setStatus(followUpModeRef.current ? "Score saved. Entering follow-up mode..." : "Review your feedback — the next question will follow shortly.");
      }
      if (event.type === "followup_state") {
        setFollowUpRound(event.round);
      }
      if (event.type === "followup_report") {
        setLatestFollowUpReport(event.report);
        setStatus("Saved follow-up report for this question.");
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
      setProcessingSeconds(followUpModeRef.current ? null : 30);
      setStatus("Submitting answer for feedback...");
      await interview.sendAudio(blob);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [interview.sendAudio, recorder.isRecording, recorder.stop]);

  const handleNextQuestion = useCallback(() => {
    if (recorder.isRecording || isSubmitting || isInterviewerSpeaking) return;
    setProcessingSeconds(null);
    setStatus("Moving to the next question...");
    setFollowUpRound(null);
    setLatestFollowUpReport(null);
    setSpokenText("");
    interview.sendControl("next");
  }, [interview, isInterviewerSpeaking, isSubmitting, recorder.isRecording]);

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
    if (recorder.isRecording || isSubmitting || isInterviewerSpeaking || processingSeconds !== null) return;
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
    <>
    <div className="h-screen bg-gray-950 text-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm font-medium text-gray-200">Voice Learning AI — {topic}</span>
        </div>
        <div className="flex items-center gap-4">
          {currentQ && (
            <span className="text-sm text-gray-400 border-r border-gray-800 pr-4">
              Question {currentQ.index + 1} / {currentQ.total}
            </span>
          )}
          <span className="text-sm font-mono text-gray-300 tracking-wider">
            {formatTime(elapsedSeconds)}
          </span>
          <button
            onClick={() => setShowEndModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm transition-colors"
          >
            <PhoneOff size={14} /> End
          </button>
        </div>
      </div>

      {/* Main split — video panels */}
      <div className="flex flex-1 gap-0 overflow-hidden">
        {/* Left — AI Interviewer */}
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-900 relative border-r border-gray-800">
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-4xl mb-4 shadow-2xl">
            🤖
          </div>
          <p className="text-gray-400 text-sm mb-3">AI Interviewer</p>
          <Waveform active={isInterviewerSpeaking} volume={0.6} color="#60a5fa" />
          <div className="absolute top-6 left-6 flex items-center gap-2">
            {followUpMode && (
              <span className="rounded-full bg-emerald-900/70 px-3 py-1 text-xs font-semibold text-emerald-300">
                Follow-up mode
              </span>
            )}
            {followUpRound !== null && followUpRound > 0 && (
              <span className="rounded-full bg-blue-900/70 px-3 py-1 text-xs font-semibold text-blue-300">
                Round {followUpRound}
              </span>
            )}
          </div>
          {currentQ && (
            <div className="absolute bottom-6 left-6 right-6 bg-gray-800/80 backdrop-blur rounded-xl p-4 text-sm text-gray-200 leading-relaxed">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Current question</p>
              <p>{currentQ.text}</p>
              <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                currentQ.difficulty === "Hard" ? "bg-red-900 text-red-300" :
                currentQ.difficulty === "Medium" ? "bg-yellow-900 text-yellow-300" :
                "bg-green-900 text-green-300"
              }`}>{currentQ.difficulty}</span>
            </div>
          )}
          {spokenText && (
            <div className="absolute top-28 left-6 right-6 bg-gray-950/75 border border-blue-900/60 rounded-xl p-4 text-sm text-blue-100 leading-relaxed shadow-xl">
              <p className="text-xs uppercase tracking-wider text-blue-400 mb-2">What the interviewer is saying</p>
              <p>{spokenText}</p>
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
      {latestFollowUpReport && (
        <div className="absolute left-4 top-16 w-80 bg-gray-900/95 backdrop-blur border border-emerald-800 rounded-2xl p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Follow-up report</span>
            <span className="text-lg font-bold text-emerald-300">
              {latestFollowUpReport.understanding_score.toFixed(0)}
              <span className="text-xs text-gray-500">/100</span>
            </span>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">{latestFollowUpReport.overall_assessment}</p>
        </div>
      )}

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
            disabled={recorder.isRecording || isSubmitting || isInterviewerSpeaking || processingSeconds !== null}
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

          {followUpMode && lastScore && (
            <button
              onClick={handleNextQuestion}
              disabled={recorder.isRecording || isSubmitting || isInterviewerSpeaking}
              className="flex items-center gap-2 px-4 py-3 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-medium"
              title={isInterviewerSpeaking ? "Wait for the interviewer feedback to finish first" : "Move to the next question"}
            >
              Next question
            </button>
          )}
        </div>

        <div className="text-xs text-gray-500 flex items-center gap-1">
          <Volume2 size={14} /> {followUpMode ? "Interviewer + follow-up coach" : "Local AI"}
        </div>
      </div>
    </div>

    {/* End session confirmation modal */}
    {showEndModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4 flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">End session?</h2>
            <button
              onClick={() => setShowEndModal(false)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <p className="text-sm text-gray-400 leading-relaxed">
            Your progress has been saved. What would you like to do?
          </p>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            {/* View Report — primary action */}
            <button
              onClick={() => {
                interview.sendControl("end");
                onEnd();
              }}
              className="flex items-center justify-center gap-2.5 w-full px-5 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold text-white transition-colors shadow-lg"
            >
              <FileText size={16} />
              View Report
            </button>

            {/* End Call — destructive action */}
            <button
              onClick={() => {
                interview.sendControl("end");
                interview.disconnect();
                window.location.href = "/dashboard";
              }}
              className="flex items-center justify-center gap-2.5 w-full px-5 py-3 bg-gray-800 hover:bg-red-900/60 border border-gray-700 hover:border-red-700 rounded-xl text-sm font-semibold text-gray-300 hover:text-red-300 transition-colors"
            >
              <PhoneOff size={16} />
              End Call
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
