"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Search, Trash2, Eye, BrainCircuit, ChevronDown, ChevronRight,
  BookOpen, Mic, BarChart2, Target, Sparkles, RefreshCw, X, ExternalLink,
  CheckCircle2, AlertTriangle, XCircle, Calendar,
} from "lucide-react";
import { api, Session, SessionResponse, SessionAnalysis } from "@/lib/api";

function scoreColor(s?: number | null) {
  if (s == null) return "text-text-muted";
  if (s >= 80) return "text-status-ok";
  if (s >= 60) return "text-status-warn";
  return "text-status-error";
}
function scoreBg(s?: number | null) {
  if (s == null) return "border-border-default bg-surface-2/60";
  if (s >= 80) return "border-status-ok/30 bg-status-ok/10";
  if (s >= 60) return "border-status-warn/30 bg-status-warn/10";
  return "border-status-error/30 bg-status-error/10";
}
const STATUS_CHIP: Record<string, string> = {
  completed: "bg-status-ok/10 text-status-ok border-status-ok/30",
  active:    "bg-accent/40  text-accent  border-accent/25",
  abandoned: "bg-surface-2     text-text-muted  border-border-default",
};

function ReadinessBadge({ value }: { value: SessionAnalysis["readiness"] }) {
  const cfg = {
    Strong:      { cls: "bg-status-ok/10 text-status-ok border-status-ok/35",   icon: <CheckCircle2 size={12} /> },
    "Needs Work":{ cls: "bg-status-warn/10 text-status-warn border-status-warn/35", icon: <AlertTriangle size={12} /> },
    "Not Ready": { cls: "bg-status-error/12 text-status-error border-status-error/35",         icon: <XCircle size={12} /> },
  }[value];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.cls}`}>
      {cfg.icon} {value}
    </span>
  );
}

interface CardState {
  expanded: boolean;
  detailLoading: boolean;
  responses: SessionResponse[];
  analysisState: "idle" | "loading" | "done" | "error";
  analysis: SessionAnalysis | null;
  analysisError: string;
}

export default function SessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [cards, setCards] = useState<Record<number, CardState>>({});
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const analysisModelRef = useRef<string>("");

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try { setSessions(await api.getSessions()); }
    catch { /* silently fail */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  function getCard(id: number): CardState {
    return cards[id] ?? {
      expanded: false, detailLoading: false, responses: [],
      analysisState: "idle", analysis: null, analysisError: "",
    };
  }
  function patchCard(id: number, patch: Partial<CardState>) {
    setCards(prev => ({ ...prev, [id]: { ...getCard(id), ...patch } }));
  }

  async function toggleExpand(id: number) {
    const card = getCard(id);
    if (card.expanded) { patchCard(id, { expanded: false }); return; }
    patchCard(id, { expanded: true });
    if (card.responses.length === 0) {
      patchCard(id, { detailLoading: true });
      try {
        const detail = await api.getSessionDetail(id);
        patchCard(id, { responses: detail.responses, detailLoading: false });
      } catch {
        patchCard(id, { detailLoading: false });
      }
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this session? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await api.deleteSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
    } finally { setDeletingId(null); }
  }

  const filtered = sessions.filter(s => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return s.title.toLowerCase().includes(q) || s.topic.toLowerCase().includes(q);
  });

  async function handleDeleteAll() {
    if (!confirm(`Delete all ${filtered.length} session${filtered.length > 1 ? "s" : ""}? This cannot be undone.`)) return;
    setDeletingAll(true);
    try {
      await api.deleteAllSessions(filtered.map(s => s.id));
      setSessions(prev => prev.filter(s => !filtered.find(f => f.id === s.id)));
    } finally { setDeletingAll(false); }
  }

  async function handleAnalyze(id: number) {
    const card = getCard(id);
    if (card.analysisState === "loading") return;
    patchCard(id, { analysisState: "loading", analysisError: "", expanded: true });
    if (card.responses.length === 0) {
      try {
        const detail = await api.getSessionDetail(id);
        patchCard(id, { responses: detail.responses });
      } catch { /* ignore */ }
    }
    try {
      const result = await api.analyzeSession(id, analysisModelRef.current || undefined);
      patchCard(id, { analysisState: "done", analysis: result });
    } catch (err) {
      patchCard(id, {
        analysisState: "error",
        analysisError: err instanceof Error ? err.message : "Analysis failed.",
      });
    }
  }

  return (
    <div className="min-h-screen bg-surface-0 text-white">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-surface-0/95 backdrop-blur border-b border-border-subtle/60">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="flex-1">
            <h1 className="text-lg font-bold leading-tight">All Sessions</h1>
            <p className="text-xs text-text-muted mt-0.5">
              {sessions.length} total{filtered.length !== sessions.length ? `, ${filtered.length} shown` : ""}
            </p>
          </div>
          {filtered.length > 0 && (
            <button
              onClick={handleDeleteAll}
              disabled={deletingAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-status-error/10 border border-status-error/25 text-status-error hover:bg-status-error/12 text-xs transition-colors disabled:opacity-50"
            >
              {deletingAll ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
              Delete {filtered.length > 1 ? `all ${filtered.length}` : "session"}
            </button>
          )}
        </div>
        <div className="max-w-5xl mx-auto px-6 pb-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search sessions by title or topic…"
              className="w-full pl-9 pr-9 py-2 bg-surface-1 border border-border-default rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/35 transition-colors"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        {loading && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-surface-1 border border-border-subtle animate-pulse" />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Mic size={40} className="text-text-muted mb-4" />
            <p className="text-text-secondary font-medium">
              {query ? "No sessions match your search." : "No sessions yet."}
            </p>
            {!query && (
              <button
                onClick={() => router.push("/dashboard")}
                className="mt-4 px-4 py-2 rounded-xl bg-accent hover:bg-accent-bright text-sm font-medium transition-colors"
              >
                Start your first interview
              </button>
            )}
          </div>
        )}

        {!loading && filtered.map(s => {
          const card = getCard(s.id);
          return (
            <div key={s.id} className={`rounded-2xl border transition-all ${scoreBg(s.total_score)} overflow-hidden`}>

              {/* Card header */}
              <div 
                className="p-4 flex items-center gap-3 cursor-pointer hover:bg-surface-1/40 transition-colors"
                onClick={() => toggleExpand(s.id)}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-surface-1/70 border ${scoreBg(s.total_score)}`}>
                  <span className={`text-base font-bold ${scoreColor(s.total_score)}`}>
                    {s.total_score != null ? s.total_score.toFixed(0) : "—"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary truncate">{s.title}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="flex items-center gap-1 text-xs text-text-muted">
                      <Calendar size={11} /> {new Date(s.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    {s.topic && s.topic !== "random" && (
                      <span className="text-xs text-accent bg-accent/30 border border-accent/25 rounded px-1.5 py-0.5 truncate max-w-[140px]">{s.topic}</span>
                    )}
                    <span className={`text-xs border rounded px-1.5 py-0.5 capitalize ${STATUS_CHIP[s.status] ?? STATUS_CHIP.abandoned}`}>{s.status}</span>
                    {s.follow_up_mode && (
                      <span className="text-xs text-status-ok bg-status-ok/10 border border-status-ok/30 rounded px-1.5 py-0.5">Follow-up</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/session/${s.id}`); }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-accent/50 border border-border-default hover:border-accent/35 text-xs text-text-secondary hover:text-accent transition-all"
                    title="View detailed feedback"
                  >
                    <Eye size={12} /> Feedback
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAnalyze(s.id); }}
                    disabled={card.analysisState === "loading"}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gold/10 hover:bg-gold/10 border border-gold/20 hover:border-accent/45 text-xs text-gold transition-all disabled:opacity-50"
                    title="Generate AI evaluation"
                  >
                    {card.analysisState === "loading" ? <RefreshCw size={12} className="animate-spin" /> : <BrainCircuit size={12} />}
                    {card.analysisState === "loading" ? "Analyzing…" : "Analyze"}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                    disabled={deletingId === s.id}
                    className="p-1.5 rounded-lg bg-surface-2 hover:bg-status-error/12 border border-border-default hover:border-status-error/30 text-text-muted hover:text-status-error transition-all"
                    title="Delete session"
                  >
                    {deletingId === s.id ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleExpand(s.id); }}
                    className="p-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border-default text-text-muted hover:text-text-primary transition-all"
                    title={card.expanded ? "Collapse" : "Show questions"}
                  >
                    {card.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                </div>
              </div>

              {/* Inline analysis */}
              {(card.analysisState === "done" || card.analysisState === "error") && (
                <div className="border-t border-border-subtle/60 bg-surface-0/40 px-4 py-3">
                  {card.analysisState === "error" && (
                    <p className="text-xs text-status-error">{card.analysisError}</p>
                  )}
                  {card.analysisState === "done" && card.analysis && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1.5 text-xs text-gold font-semibold">
                          <Sparkles size={12} /> AI Evaluation
                        </span>
                        <ReadinessBadge value={card.analysis.readiness} />
                      </div>
                      <p className="text-xs text-text-primary leading-relaxed">{card.analysis.summary}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {card.analysis.strengths.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-status-ok mb-1.5 flex items-center gap-1"><CheckCircle2 size={11} /> Strengths</p>
                            <ul className="space-y-1">
                              {card.analysis.strengths.slice(0, 3).map((str, i) => (
                                <li key={i} className="text-xs text-text-secondary flex items-start gap-1.5"><span className="text-status-ok mt-0.5 shrink-0">•</span>{str}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {card.analysis.weak_areas.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-status-error mb-1.5 flex items-center gap-1"><Target size={11} /> Weak Areas</p>
                            <ul className="space-y-1">
                              {card.analysis.weak_areas.slice(0, 3).map((w, i) => (
                                <li key={i} className="text-xs text-text-secondary flex items-start gap-1.5"><span className="text-status-error mt-0.5 shrink-0">•</span>{w.topic} — {w.reason}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      {card.analysis.learning_plan.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-accent mb-1.5 flex items-center gap-1"><BarChart2 size={11} /> Learning Plan</p>
                          <div className="flex flex-wrap gap-2">
                            {card.analysis.learning_plan.slice(0, 4).map((lp, i) => (
                              <span key={i} className="text-xs bg-accent/30 border border-accent/25 text-accent rounded-lg px-2 py-1">{lp.priority}. {lp.action}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => router.push(`/dashboard/session/${s.id}`)}
                        className="text-xs text-accent hover:text-accent flex items-center gap-1 transition-colors"
                      >
                        Full detailed feedback <ExternalLink size={11} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Expanded questions */}
              {card.expanded && (
                <div className="border-t border-border-subtle/60 bg-surface-0/60 px-4 py-3">
                  {card.detailLoading && (
                    <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-10 rounded-xl bg-surface-2 animate-pulse" />)}</div>
                  )}
                  {!card.detailLoading && card.responses.length === 0 && (
                    <p className="text-xs text-text-muted py-3 text-center">No responses recorded for this session.</p>
                  )}
                  {!card.detailLoading && card.responses.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-text-muted mb-2 flex items-center gap-1.5">
                        <BookOpen size={11} /> Questions answered — click to practice
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {card.responses.map((resp, i) => {
                          const diffCls =
                            resp.difficulty === "Hard"   ? "bg-status-error/12 text-status-error border-status-error/30" :
                            resp.difficulty === "Medium" ? "bg-status-warn/10 text-status-warn border-status-warn/30" :
                                                          "bg-status-ok/10 text-status-ok border-status-ok/30";
                          return (
                            <button
                              key={resp.id}
                              onClick={() => window.open(`/practice/${resp.question_id}`, "_blank")}
                              className="text-left group flex items-start gap-2.5 p-2.5 rounded-xl bg-surface-2/60 border border-border-default/60 hover:border-accent/35 hover:bg-accent/10 transition-all"
                            >
                              <span className="text-xs text-text-muted font-mono shrink-0 mt-0.5 w-4">{i + 1}.</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                  <span className={`text-[10px] font-medium border rounded px-1 py-0.5 ${diffCls}`}>{resp.difficulty}</span>
                                  <span className="text-[10px] text-accent bg-accent/30 border border-accent/25 rounded px-1 py-0.5 truncate max-w-[120px]">{resp.topic}</span>
                                  <span className={`text-[10px] font-bold ml-auto ${scoreColor(resp.total)}`}>{resp.total}/100</span>
                                </div>
                                <p className="text-xs text-text-primary line-clamp-2 leading-snug">{resp.question}</p>
                                <p className="text-[10px] text-text-muted group-hover:text-accent mt-1 transition-colors flex items-center gap-1">
                                  <ExternalLink size={9} /> Open in practice mode
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
