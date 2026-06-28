"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, MessageSquare, Mic, Trophy,
  Sparkles, ChevronDown, ChevronRight,
  BookOpen, Target, TrendingUp, AlertTriangle,
  CheckCircle2, XCircle, Lightbulb, BarChart2,
  ExternalLink, BrainCircuit, Trash2,
} from "lucide-react";
import { api, FollowupReport, Session, SessionResponse, SessionAnalysis } from "@/lib/api";

interface AnalyseMoreResult {
  what_you_got_right: string;
  key_gaps: string[];
  misconceptions: string[];
  mini_lesson: string;
  next_steps: string[];
  stronger_answer_outline: string;
}

interface AnalyseMoreState {
  loading: boolean;
  open: boolean;
  result: AnalyseMoreResult | null;
  error: string | null;
}

function renderMiniLesson(text: string) {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("## ")) return <h3 key={i} className="text-sm font-semibold text-indigo-300 mt-3 mb-1">{line.slice(3)}</h3>;
    if (line.startsWith("# "))  return <h2 key={i} className="text-sm font-bold text-indigo-200 mt-3 mb-1">{line.slice(2)}</h2>;
    if (line.startsWith("```")) return <div key={i} className="font-mono text-xs text-emerald-300" />;
    const parts: React.ReactNode[] = [];
    const rx = /`([^`]+)`|\*\*([^*]+)\*\*/g;
    let last = 0; let m: RegExpExecArray | null;
    while ((m = rx.exec(line)) !== null) {
      if (m.index > last) parts.push(line.slice(last, m.index));
      if (m[1]) parts.push(<code key={m.index} className="px-1 py-0.5 bg-gray-700 rounded text-emerald-300 text-xs font-mono">{m[1]}</code>);
      if (m[2]) parts.push(<strong key={m.index} className="text-white">{m[2]}</strong>);
      last = m.index + m[0].length;
    }
    if (last < line.length) parts.push(line.slice(last));
    const isBullet = /^\s*[-•*]/.test(line);
    if (isBullet) return <li key={i} className="ml-4 list-disc text-gray-300 text-xs leading-relaxed">{parts.map(p => typeof p === "string" ? p.replace(/^\s*[-•*]\s*/, "") : p)}</li>;
    return <p key={i} className={`text-gray-300 text-xs leading-relaxed ${line === "" ? "h-2" : ""}`}>{parts}</p>;
  });
}

const DIMENSIONS: { key: keyof SessionResponse; label: string; color: string; max: number }[] = [
  { key: "technical_correctness", label: "Technical",  color: "bg-blue-500",   max: 40 },
  { key: "depth_completeness",    label: "Depth",      color: "bg-purple-500", max: 25 },
  { key: "communication_clarity", label: "Clarity",    color: "bg-green-500",  max: 20 },
  { key: "problem_solving",       label: "Process",    color: "bg-orange-500", max: 15 },
];

function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-12 text-right">{value}/{max}</span>
    </div>
  );
}

function scoreColor(total: number) {
  if (total >= 80) return "text-green-400";
  if (total >= 60) return "text-yellow-400";
  return "text-red-400";
}

function difficultyBadge(d: string) {
  if (d === "Hard")   return "bg-red-900 text-red-300";
  if (d === "Medium") return "bg-yellow-900 text-yellow-300";
  return "bg-green-900 text-green-300";
}

function ReadinessBadge({ value }: { value: SessionAnalysis["readiness"] }) {
  const cfg = {
    "Strong":      { cls: "bg-green-900/50 text-green-300 border-green-700",  icon: <CheckCircle2 size={14} /> },
    "Needs Work":  { cls: "bg-yellow-900/50 text-yellow-300 border-yellow-700", icon: <AlertTriangle size={14} /> },
    "Not Ready":   { cls: "bg-red-900/50 text-red-300 border-red-700",        icon: <XCircle size={14} /> },
  }[value];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${cfg.cls}`}>
      {cfg.icon} {value}
    </span>
  );
}

function Collapsible({ title, icon, children, defaultOpen = false }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800/50 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-200">{icon}{title}</span>
        {open ? <ChevronDown size={15} className="text-gray-500" /> : <ChevronRight size={15} className="text-gray-500" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

export default function SessionDetailPage() {
  const params  = useParams();
  const router  = useRouter();
  const sessionId = Number(params.sessionId);

  const [session,   setSession]   = useState<Session | null>(null);
  const [responses, setResponses] = useState<SessionResponse[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");

  const [analyseMore, setAnalyseMore] = useState<Record<number, AnalyseMoreState>>({});
  const [analysis,         setAnalysis]         = useState<SessionAnalysis | null>(null);
  const [analysisLoading,  setAnalysisLoading]  = useState(false);
  const [analysisError,    setAnalysisError]    = useState("");
  const [expandedQs,       setExpandedQs]       = useState<Set<number>>(new Set());

  // Persist analysis in localStorage so it survives refresh
  const storageKey = `session_analysis_${sessionId}`;

  useEffect(() => {
    api.getSessionDetail(sessionId)
      .then(({ session, responses }) => {
        setSession(session);
        setResponses(responses);
        const cached = localStorage.getItem(storageKey);
        if (cached) {
          try { setAnalysis(JSON.parse(cached)); } catch { /* ignore */ }
        }
      })
      .catch(() => setError("Could not load session. Make sure the backend is running."))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function handleAnalyze() {
    setAnalysisLoading(true);
    setAnalysisError("");
    try {
      const model = localStorage.getItem("selectedModel") || undefined;
      const result = await api.analyzeSession(sessionId, model);
      setAnalysis(result);
      localStorage.setItem(storageKey, JSON.stringify(result));
    } catch (err: unknown) {
      setAnalysisError(err instanceof Error ? err.message : "Analysis failed. Is the backend running?");
    } finally {
      setAnalysisLoading(false);
    }
  }

  function toggleQ(i: number) {
    setExpandedQs((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  }

  async function handleAnalyseMore(r: SessionResponse) {
    const key = r.id;
    setAnalyseMore(prev => ({
      ...prev,
      [key]: { loading: false, open: true, result: prev[key]?.result ?? null, error: null },
    }));
    if (analyseMore[key]?.result) return; // already fetched
    setAnalyseMore(prev => ({ ...prev, [key]: { ...prev[key], loading: true } }));
    try {
      const model = localStorage.getItem("selectedModel") || undefined;
      const result = await api.analyseAnswer(
        r.question_id,
        r.transcript || "",
        { technical_correctness: r.technical_correctness, depth_completeness: r.depth_completeness, communication_clarity: r.communication_clarity, problem_solving: r.problem_solving, total: r.total },
        model,
      );
      setAnalyseMore(prev => ({ ...prev, [key]: { loading: false, open: true, result, error: null } }));
    } catch (e: unknown) {
      setAnalyseMore(prev => ({ ...prev, [key]: { loading: false, open: true, result: null, error: e instanceof Error ? e.message : "Failed" } }));
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Loading feedback…</div>;
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 text-gray-400">
        <p className="text-red-400">{error || "Session not found."}</p>
        <button onClick={() => router.back()} className="text-sm text-blue-400 hover:underline">← Back</button>
      </div>
    );
  }

  const answered = responses.filter((r) => r.total != null);
  const avgScore = answered.length
    ? Math.round(answered.reduce((s, r) => s + r.total, 0) / answered.length)
    : null;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{session.title}</h1>
            <p className="text-xs text-gray-500">
              {new Date(session.started_at).toLocaleString()} ·{" "}
              <span className={`font-medium ${session.status === "completed" ? "text-green-400" : "text-yellow-400"}`}>
                {session.status}
              </span>
            </p>
            {session.follow_up_mode && (
              <span className="inline-flex mt-2 rounded-full bg-emerald-900/40 px-2.5 py-1 text-xs font-semibold text-emerald-300 border border-emerald-800">
                Follow-up mode session
              </span>
            )}
          </div>
          {session.total_score != null && (
            <div className="flex items-center gap-1.5">
              <Trophy size={18} className={scoreColor(session.total_score)} />
              <span className={`text-2xl font-bold ${scoreColor(session.total_score)}`}>
                {session.total_score.toFixed(0)}
              </span>
              <span className="text-gray-500 text-sm">/100</span>
            </div>
          )}
          <button
            onClick={async () => {
              if (!confirm("Delete this session and all its responses? This cannot be undone.")) return;
              await api.deleteSession(sessionId);
              localStorage.removeItem(`session_analysis_${sessionId}`);
              router.push("/dashboard");
            }}
            className="p-2 rounded-lg bg-gray-800 hover:bg-red-900/40 text-gray-500 hover:text-red-400 border border-transparent hover:border-red-800 transition-colors"
            title="Delete session"
          >
            <Trash2 size={15} />
          </button>
        </div>

        {/* Summary stats */}
        {answered.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold">{responses.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">Questions</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold">{answered.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">Answered</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <div className={`text-2xl font-bold ${avgScore != null ? scoreColor(avgScore) : "text-gray-400"}`}>
                {avgScore ?? "—"}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">Avg Score</div>
            </div>
          </div>
        )}

        {/* ── Deep Analysis Panel ──────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 border border-indigo-800/50 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-indigo-200 flex items-center gap-2">
                <Sparkles size={15} className="text-indigo-400" /> AI Deep Analysis
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {analysis ? "Full learning report generated" : "Get a detailed breakdown of what to study and improve"}
              </p>
            </div>
            <button
              onClick={handleAnalyze}
              disabled={analysisLoading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors"
            >
              <Sparkles size={14} />
              {analysisLoading ? "Analysing…" : analysis ? "Regenerate" : "Generate Report"}
            </button>
          </div>

          {analysisLoading && (
            <div className="flex items-center gap-3 py-4 text-indigo-300 text-sm">
              <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
              Reading all your answers and building a personalised learning plan…
            </div>
          )}

          {analysisError && (
            <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2 mt-2">
              {analysisError}
            </p>
          )}

          {analysis && !analysisLoading && (
            <div className="space-y-4 mt-4">

              {/* Readiness + Summary */}
              <div className="bg-gray-900/70 rounded-xl p-4 border border-gray-700/50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Overall Verdict</span>
                  <ReadinessBadge value={analysis.readiness} />
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">{analysis.summary}</p>
              </div>

              {/* Strengths */}
              {analysis.strengths.length > 0 && (
                <div className="bg-green-950/30 border border-green-800/40 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-green-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <CheckCircle2 size={13} /> Strengths
                  </h3>
                  <ul className="space-y-1.5">
                    {analysis.strengths.map((s, i) => (
                      <li key={i} className="flex gap-2 text-sm text-green-200">
                        <span className="text-green-600 shrink-0">•</span>{s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Weak Areas */}
              {analysis.weak_areas.length > 0 && (
                <div className="bg-red-950/20 border border-red-800/40 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <AlertTriangle size={13} /> Areas to Improve
                  </h3>
                  <div className="space-y-4">
                    {analysis.weak_areas.map((w, i) => (
                      <div key={i}>
                        <p className="text-sm font-semibold text-red-300 mb-0.5">{w.topic}</p>
                        <p className="text-xs text-gray-400 mb-2">{w.reason}</p>
                        {w.study_topics.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {w.study_topics.map((t, j) => (
                              <span key={j} className="px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-indigo-300 bg-indigo-950/40 border border-indigo-900/40 rounded-lg px-3 py-2 flex gap-1.5">
                          <Lightbulb size={12} className="shrink-0 mt-0.5" /> {w.how_to_improve}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Learning Plan */}
              {analysis.learning_plan.length > 0 && (
                <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <TrendingUp size={13} /> Learning Plan
                  </h3>
                  <ol className="space-y-2">
                    {analysis.learning_plan.map((p) => (
                      <li key={p.priority} className="flex gap-3 text-sm text-gray-300">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-800 text-indigo-200 text-xs flex items-center justify-center font-bold">
                          {p.priority}
                        </span>
                        {p.action}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Per-question deep dives */}
              {analysis.per_question.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <BarChart2 size={13} /> Per-Question Breakdown
                  </h3>
                  <div className="space-y-2">
                    {analysis.per_question.map((pq) => {
                      const resp = responses[pq.index];
                      const open = expandedQs.has(pq.index);
                      return (
                        <div key={pq.index} className="bg-gray-900/70 border border-gray-700/50 rounded-xl overflow-hidden">
                          <button
                            onClick={() => toggleQ(pq.index)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors text-left"
                          >
                            <span className="shrink-0 w-5 h-5 rounded-full bg-gray-700 text-xs flex items-center justify-center text-gray-400 font-bold">
                              {pq.index + 1}
                            </span>
                            <span className="flex-1 text-xs text-gray-300 truncate">
                              {resp?.question ?? `Question ${pq.index + 1}`}
                            </span>
                            <span className={`shrink-0 text-xs font-bold ${scoreColor(pq.score)}`}>{pq.score}/100</span>
                            {open
                              ? <ChevronDown size={13} className="shrink-0 text-gray-500" />
                              : <ChevronRight size={13} className="shrink-0 text-gray-500" />}
                          </button>
                          {open && (
                            <div className="px-4 pb-4 space-y-3 border-t border-gray-800">
                              {pq.what_was_good && (
                                <div className="pt-3">
                                  <p className="text-xs font-semibold text-green-400 mb-1">What you got right</p>
                                  <p className="text-sm text-gray-300">{pq.what_was_good}</p>
                                </div>
                              )}
                              {pq.what_was_missing && (
                                <div>
                                  <p className="text-xs font-semibold text-red-400 mb-1">What was missing</p>
                                  <p className="text-sm text-gray-300">{pq.what_was_missing}</p>
                                </div>
                              )}
                              {pq.ideal_outline && (
                                <div className="bg-blue-950/30 border border-blue-800/40 rounded-lg px-3 py-2.5">
                                  <p className="text-xs font-semibold text-blue-400 mb-1.5 flex items-center gap-1">
                                    <BookOpen size={11} /> Ideal answer outline
                                  </p>
                                  <p className="text-xs text-blue-200 leading-relaxed">{pq.ideal_outline}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* ── Per-question session responses ───────────────────────────────── */}
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Target size={13} /> Session Responses
        </h2>

        {responses.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center text-gray-500">
            No responses recorded for this session.
          </div>
        ) : (
          <div className="space-y-4">
            {responses.map((r, i) => {
              const am = analyseMore[r.id];
              const followupReport = r.followup_report as FollowupReport | null | undefined;
              return (
              <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                {/* Question header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <button
                        onClick={() => window.open(`/practice/${r.question_id}`, "_blank")}
                        className="text-sm font-medium text-gray-200 leading-snug hover:text-blue-300 transition-colors text-left group"
                      >
                        {r.question}
                        <ExternalLink size={10} className="inline ml-1 opacity-0 group-hover:opacity-60 transition-opacity" />
                      </button>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">{r.topic}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${difficultyBadge(r.difficulty)}`}>
                          {r.difficulty}
                        </span>
                      </div>
                    </div>
                  </div>
                  {r.total != null && (
                    <span className={`shrink-0 text-xl font-bold ${scoreColor(r.total)}`}>
                      {r.total}<span className="text-sm text-gray-500">/100</span>
                    </span>
                  )}
                </div>

                {/* Transcript */}
                {r.transcript ? (
                  <div className="flex gap-2 bg-gray-800/60 rounded-xl px-4 py-3 mb-3">
                    <Mic size={14} className="shrink-0 mt-0.5 text-green-400" />
                    <p className="text-sm text-gray-300 italic leading-relaxed">"{r.transcript}"</p>
                  </div>
                ) : (
                  <div className="flex gap-2 bg-gray-800/40 rounded-xl px-4 py-3 mb-3">
                    <Mic size={14} className="shrink-0 mt-0.5 text-gray-600" />
                    <p className="text-sm text-gray-600 italic">No transcript recorded</p>
                  </div>
                )}

                {/* Score breakdown */}
                {r.total != null && (
                  <div className="space-y-2 mb-3">
                    {DIMENSIONS.map((d) => (
                      <div key={d.key} className="grid grid-cols-[80px_1fr] items-center gap-2">
                        <span className="text-xs text-gray-500">{d.label}</span>
                        <ScoreBar value={r[d.key] as number} max={d.max} color={d.color} />
                      </div>
                    ))}
                  </div>
                )}

                {/* LLM in-session feedback (concise) */}
                {r.llm_feedback && (
                  <div className="flex gap-2 bg-blue-950/40 border border-blue-900/50 rounded-xl px-4 py-3 mb-3">
                    <MessageSquare size={14} className="shrink-0 mt-0.5 text-blue-400" />
                    <p className="text-sm text-blue-200 leading-relaxed">{r.llm_feedback}</p>
                  </div>
                )}

                {followupReport && (
                  <div className="mb-3 rounded-2xl border border-emerald-800/40 bg-emerald-950/20 p-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
                        Follow-up mode report
                      </p>
                      <span className="text-sm font-bold text-emerald-300">
                        {followupReport.understanding_score.toFixed(0)}
                        <span className="text-xs text-gray-500">/100 depth</span>
                      </span>
                    </div>
                    <p className="text-sm text-emerald-100 leading-relaxed mb-3">
                      {followupReport.overall_assessment}
                    </p>

                    {followupReport.strengths?.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-emerald-400 mb-1.5">Strengths after follow-up</p>
                        <ul className="space-y-1">
                          {followupReport.strengths.map((item, index) => (
                            <li key={index} className="flex gap-2 text-xs text-emerald-100">
                              <span className="text-emerald-500 shrink-0">•</span>{item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {followupReport.remaining_gaps?.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-yellow-300 mb-1.5">Remaining gaps</p>
                        <ul className="space-y-1">
                          {followupReport.remaining_gaps.map((item, index) => (
                            <li key={index} className="flex gap-2 text-xs text-yellow-100">
                              <span className="text-yellow-500 shrink-0">•</span>{item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {followupReport.turns && followupReport.turns.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-400">Follow-up turns</p>
                        {followupReport.turns.map((turn) => (
                          <div key={turn.round} className="rounded-xl border border-gray-800 bg-gray-950/50 p-3">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-xs font-semibold text-blue-300">Round {turn.round}</span>
                              <span className="text-xs text-gray-500">{turn.understanding_score.toFixed(0)}/100</span>
                            </div>
                            <p className="text-xs text-blue-100 leading-relaxed mb-2">{turn.interviewer_prompt}</p>
                            <p className="text-xs text-gray-300 italic leading-relaxed mb-2">"{turn.candidate_answer}"</p>
                            <p className="text-xs text-emerald-100 leading-relaxed">{turn.coach_feedback}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Analyse More button */}
                {r.transcript && r.total != null && (
                  <div>
                    <button
                      onClick={() => am?.open
                        ? setAnalyseMore(prev => ({ ...prev, [r.id]: { ...prev[r.id], open: false } }))
                        : handleAnalyseMore(r)
                      }
                      disabled={am?.loading}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                        ${am?.result
                          ? "bg-indigo-900/30 border-indigo-700 text-indigo-300 hover:bg-indigo-900/50"
                          : "bg-gray-800 border-gray-700 text-gray-400 hover:border-indigo-700 hover:text-indigo-300"
                        } disabled:opacity-50`}
                    >
                      {am?.loading ? (
                        <><span className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" />Analysing…</>
                      ) : (
                        <><BrainCircuit size={12} />Analyse More{am?.open ? " ▲" : " ▼"}</>
                      )}
                    </button>

                    {/* Analyse More result panel */}
                    {am?.open && (
                      <div className="mt-3 space-y-3">
                        {am.error && (
                          <p className="text-xs text-red-400 bg-red-950/30 border border-red-900 rounded-lg px-3 py-2">{am.error}</p>
                        )}
                        {am.loading && (
                          <div className="flex items-center gap-2 text-indigo-300 text-xs py-2">
                            <div className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" />
                            Analysing your answer in depth…
                          </div>
                        )}
                        {am.result && (
                          <>
                            {/* What you got right */}
                            <div className="bg-green-950/25 border border-green-800/40 rounded-xl px-4 py-3">
                              <p className="text-xs font-semibold text-green-400 mb-1.5 flex items-center gap-1"><CheckCircle2 size={11} /> What you got right</p>
                              <p className="text-xs text-green-200 leading-relaxed">{am.result.what_you_got_right}</p>
                            </div>

                            {/* Key gaps */}
                            {am.result.key_gaps.length > 0 && (
                              <div className="bg-red-950/20 border border-red-800/40 rounded-xl px-4 py-3">
                                <p className="text-xs font-semibold text-red-400 mb-1.5 flex items-center gap-1"><AlertTriangle size={11} /> Key gaps</p>
                                <ul className="space-y-1">
                                  {am.result.key_gaps.map((g, j) => (
                                    <li key={j} className="flex gap-2 text-xs text-red-200"><span className="text-red-600 shrink-0">•</span>{g}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Misconceptions */}
                            {am.result.misconceptions.length > 0 && (
                              <div className="bg-orange-950/20 border border-orange-800/40 rounded-xl px-4 py-3">
                                <p className="text-xs font-semibold text-orange-400 mb-1.5 flex items-center gap-1"><XCircle size={11} /> Misconceptions to correct</p>
                                <ul className="space-y-1">
                                  {am.result.misconceptions.map((m, j) => (
                                    <li key={j} className="flex gap-2 text-xs text-orange-200"><span className="text-orange-600 shrink-0">•</span>{m}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Mini lesson */}
                            <div className="bg-indigo-950/25 border border-indigo-800/40 rounded-xl px-4 py-3">
                              <p className="text-xs font-semibold text-indigo-400 mb-2 flex items-center gap-1"><BookOpen size={11} /> Mini Lesson</p>
                              <div className="space-y-1">{renderMiniLesson(am.result.mini_lesson)}</div>
                            </div>

                            {/* Stronger answer outline */}
                            <div className="bg-blue-950/20 border border-blue-800/40 rounded-xl px-4 py-3">
                              <p className="text-xs font-semibold text-blue-400 mb-1.5 flex items-center gap-1"><Lightbulb size={11} /> Stronger answer outline</p>
                              <p className="text-xs text-blue-200 leading-relaxed">{am.result.stronger_answer_outline}</p>
                            </div>

                            {/* Next steps */}
                            {am.result.next_steps.length > 0 && (
                              <div className="bg-purple-950/20 border border-purple-800/40 rounded-xl px-4 py-3">
                                <p className="text-xs font-semibold text-purple-400 mb-1.5 flex items-center gap-1"><TrendingUp size={11} /> Next steps</p>
                                <ol className="space-y-1">
                                  {am.result.next_steps.map((s, j) => (
                                    <li key={j} className="flex gap-2 text-xs text-purple-200">
                                      <span className="shrink-0 w-4 h-4 rounded-full bg-purple-800 text-purple-200 text-xs flex items-center justify-center font-bold">{j+1}</span>
                                      {s}
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {r.total == null && (
                  <p className="text-xs text-gray-600 italic">This question was not scored.</p>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
