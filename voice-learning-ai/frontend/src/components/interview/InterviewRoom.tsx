"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, PhoneOff, Send, Volume2, FileText, Loader2, RefreshCw, X } from "lucide-react";
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
  const everConnectedRef = useRef(false);

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

  // Reflect the socket state in the status line so the room never looks stuck
  // on "Connecting..." while the backend prepares the opening (LLM + voice).
  useEffect(() => {
    if (interview.connected) {
      everConnectedRef.current = true;
      setStatus("Connected — Nova is preparing your first question...");
    } else if (everConnectedRef.current && !isComplete) {
      setStatus("Connection lost — click Reconnect to continue.");
    }
  }, [interview.connected, isComplete]);

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
      if (event.type === "error") setStatus(event.message);
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
      <div className="flex flex-col items-center justify-center h-screen bg-surface-0 text-white gap-6">
        <div className="text-5xl font-bold text-status-ok">{finalScore.toFixed(0)}<span className="text-2xl text-text-secondary">/100</span></div>
        <p className="text-xl text-text-primary">Session complete</p>
        <button onClick={onEnd} className="px-6 py-3 bg-accent hover:bg-accent-bright rounded-xl text-white font-medium">
          View Full Report
        </button>
      </div>
    );
  }

  return (
    <>
    <div className="h-screen bg-surface-0 text-text-primary flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-surface-1/90 backdrop-blur-md border-b border-border-subtle z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-status-ok animate-pulse" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white tracking-tight">Interview Arena</span>
            <span className="text-xs text-accent font-medium hidden sm:inline">• {topic}</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/70 border border-accent/25 text-accent">
            Nova Voice Examiner
          </span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          {currentQ && (
            <span className="text-xs font-semibold text-text-primary bg-surface-2 px-2.5 py-1 rounded-lg border border-border-default">
              Q{currentQ.index + 1} of {currentQ.total}
            </span>
          )}
          <span className="text-xs sm:text-sm font-mono text-text-primary bg-surface-0 px-2.5 py-1 rounded-lg border border-border-subtle">
            {formatTime(elapsedSeconds)}
          </span>
          <button
            onClick={() => setShowEndModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-status-error/90 hover:bg-status-error rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-md shadow-red-950/40"
          >
            <PhoneOff size={14} /> <span>End</span>
          </button>
        </div>
      </div>

      {/* Main split — video panels */}
      <div className="flex flex-col md:flex-row flex-1 gap-0 overflow-hidden relative">
        {/* Left — AI Interviewer */}
        <div className="flex-1 flex flex-col items-center justify-center bg-surface-1/90 relative border-b md:border-b-0 md:border-r border-border-subtle p-6">
          <div className="w-24 sm:w-28 h-24 sm:h-28 rounded-3xl bg-gradient-to-tr from-accent via-accent to-accent-bright flex items-center justify-center text-4xl mb-3 shadow-2xl shadow-indigo-600/30">
            🤖
          </div>
          <p className="text-text-primary text-sm font-semibold mb-2">Nova AI Examiner</p>
          <Waveform active={isInterviewerSpeaking} volume={0.6} color="#818cf8" />

          {!currentQ && (
            <p className="mt-4 flex items-center gap-2 text-xs text-text-secondary">
              <Loader2 size={14} className="animate-spin text-accent" />
              {interview.connected ? "Preparing your first question..." : "Connecting to the interviewer..."}
            </p>
          )}
          
          <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex items-center gap-2">
            {followUpMode && (
              <span className="rounded-full bg-status-ok/10 border border-status-ok/30 px-3 py-1 text-xs font-semibold text-status-ok shadow-sm">
                Follow-up mode
              </span>
            )}
            {followUpRound !== null && followUpRound > 0 && (
              <span className="rounded-full bg-accent/80 border border-accent/25 px-3 py-1 text-xs font-semibold text-accent shadow-sm">
                Probe Round {followUpRound}
              </span>
            )}
          </div>

          {currentQ && (
            <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 bg-surface-0/85 backdrop-blur-md border border-border-subtle rounded-2xl p-4 text-sm text-text-primary leading-relaxed shadow-xl">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-accent">Current Question</p>
                <span className={`px-2 py-0.2 rounded-md text-[11px] font-semibold ${
                  currentQ.difficulty === "Hard" ? "bg-status-error/10 border border-status-error/30 text-status-error" :
                  currentQ.difficulty === "Medium" ? "bg-status-warn/10 border border-status-warn/30 text-status-warn" :
                  "bg-status-ok/10 border border-status-ok/30 text-status-ok"
                }`}>{currentQ.difficulty}</span>
              </div>
              <p className="font-medium text-text-primary">{currentQ.text}</p>
            </div>
          )}

          {spokenText && (
            <div className="absolute top-20 left-4 right-4 sm:left-6 sm:right-6 bg-surface-0/90 border border-accent/25 rounded-2xl p-4 text-xs sm:text-sm text-text-secondary leading-relaxed shadow-2xl backdrop-blur-md">
              <p className="text-[10px] uppercase font-bold tracking-wider text-accent mb-1">Interviewer Speaking</p>
              <p>{spokenText}</p>
            </div>
          )}
        </div>

        {/* Right — You */}
        <div className="flex-1 flex flex-col items-center justify-center bg-surface-0 relative p-6">
          <div className="w-24 sm:w-28 h-24 sm:h-28 rounded-3xl bg-gradient-to-tr from-status-ok via-accent to-accent flex items-center justify-center text-4xl mb-3 shadow-2xl shadow-status-ok/25">
            👤
          </div>
          <p className="text-text-primary text-sm font-semibold mb-2">Candidate (You)</p>
          <Waveform active={recorder.isRecording} volume={recorder.volume} color="#34d399" />
          
          {transcript && (
            <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 bg-surface-1/90 backdrop-blur-md border border-border-subtle rounded-2xl p-4 text-xs sm:text-sm text-text-primary leading-relaxed italic shadow-xl">
              <p className="text-[10px] uppercase font-bold not-italic tracking-wider text-status-ok mb-1">Live Transcript</p>
              "{transcript}"
            </div>
          )}
        </div>
      </div>

      {/* Score overlay */}
      {lastScore && <ScoreOverlay score={lastScore} />}
      {latestFollowUpReport && (
        <div className="absolute left-4 top-16 w-80 bg-surface-1/95 backdrop-blur border border-status-ok/30 rounded-2xl p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-status-ok">Follow-up report</span>
            <span className="text-lg font-bold text-status-ok">
              {latestFollowUpReport.understanding_score.toFixed(0)}
              <span className="text-xs text-text-muted">/100</span>
            </span>
          </div>
          <p className="text-xs text-text-primary leading-relaxed">{latestFollowUpReport.overall_assessment}</p>
        </div>
      )}

      {/* Bottom control bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 bg-surface-1/90 backdrop-blur-md border-t border-border-subtle z-10 shrink-0">
        <div className="text-xs text-text-secondary font-medium">
          {recorder.isRecording
            ? "🎙️ Recording in progress — speak your analytical thought process"
            : processingSeconds !== null
              ? processingSeconds > 0
                ? `⚡ Nova evaluating response: ${processingSeconds}s`
                : "⚡ Finalizing rubric breakdown..."
              : status}
        </div>

        <div className="flex items-center gap-3">
          {!interview.connected && (
            <button
              onClick={() => interview.connect()}
              className="flex items-center gap-2 px-4 py-3 bg-gold hover:bg-gold rounded-xl text-sm font-bold text-white shadow-lg shadow-amber-600/20 transition-all"
            >
              <RefreshCw size={16} />
              Reconnect
            </button>
          )}
          <button
            onClick={handleRecord}
            disabled={recorder.isRecording || isSubmitting || isInterviewerSpeaking || processingSeconds !== null}
            className={`w-13 h-13 rounded-2xl flex items-center justify-center text-white shadow-xl transition-all disabled:cursor-not-allowed ${
              recorder.isRecording
                ? "bg-status-error scale-105 animate-pulse shadow-red-600/40"
                : "bg-accent hover:bg-accent-bright shadow-indigo-600/30 disabled:opacity-40"
            }`}
            aria-label="Start recording"
          >
            <Mic size={22} />
          </button>

          <button
            onClick={submitRecording}
            disabled={!recorder.isRecording || isSubmitting}
            className="flex items-center gap-2 px-5 py-3 bg-status-ok hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-all"
          >
            <Send size={16} />
            {isSubmitting ? "Scoring..." : "Submit Answer"}
          </button>

          {followUpMode && lastScore && (
            <button
              onClick={handleNextQuestion}
              disabled={recorder.isRecording || isSubmitting || isInterviewerSpeaking}
              className="flex items-center gap-2 px-4 py-3 bg-accent hover:bg-accent-bright disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-semibold text-white shadow-lg shadow-indigo-700/20 transition-all"
              title={isInterviewerSpeaking ? "Wait for the interviewer feedback to finish first" : "Move to the next question"}
            >
              Next Question
            </button>
          )}
        </div>

        <div className="text-xs text-text-secondary flex items-center gap-1.5 font-medium">
          <Volume2 size={14} className="text-accent" /> {followUpMode ? "Nova Examiner + Follow-up Coach" : "Nova Realtime Core"}
        </div>
      </div>
    </div>

    {/* End session confirmation modal */}
    {showEndModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-surface-1 border border-border-default rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4 flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">End session?</h2>
            <button
              onClick={() => setShowEndModal(false)}
              className="p-1.5 rounded-lg text-text-secondary hover:text-white hover:bg-surface-2 transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <p className="text-sm text-text-secondary leading-relaxed">
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
              className="flex items-center justify-center gap-2.5 w-full px-5 py-3 bg-accent hover:bg-accent-bright rounded-xl text-sm font-semibold text-white transition-colors shadow-lg"
            >
              <FileText size={16} />
              View Report
            </button>

            {/* End Call — destructive action */}
            <button
              onClick={() => {
                // Fire-and-forget: send "end", drop the socket without waiting
                // for a close handshake, then client-side navigate. A full
                // window.location reload recompiles the app in dev and feels
                // several seconds slower than the View Report button.
                interview.sendControl("end");
                interview.disconnect();
                onEnd();
              }}
              className="flex items-center justify-center gap-2.5 w-full px-5 py-3 bg-surface-2 hover:bg-status-error/12 border border-border-default hover:border-status-error/35 rounded-xl text-sm font-semibold text-text-primary hover:text-status-error transition-colors"
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
