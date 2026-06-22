"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MessageSquare, Mic, Trophy } from "lucide-react";
import { api, Session, SessionResponse } from "@/lib/api";

const DIMENSIONS: { key: keyof SessionResponse; label: string; color: string; max: number }[] = [
  { key: "technical_correctness", label: "Technical", color: "bg-blue-500", max: 40 },
  { key: "depth_completeness", label: "Depth", color: "bg-purple-500", max: 25 },
  { key: "communication_clarity", label: "Clarity", color: "bg-green-500", max: 20 },
  { key: "problem_solving", label: "Process", color: "bg-orange-500", max: 15 },
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
  if (d === "Hard") return "bg-red-900 text-red-300";
  if (d === "Medium") return "bg-yellow-900 text-yellow-300";
  return "bg-green-900 text-green-300";
}

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = Number(params.sessionId);

  const [session, setSession] = useState<Session | null>(null);
  const [responses, setResponses] = useState<SessionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getSessionDetail(sessionId)
      .then(({ session, responses }) => {
        setSession(session);
        setResponses(responses);
      })
      .catch(() => setError("Could not load session. Make sure the backend is running."))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
        Loading feedback...
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 text-gray-400">
        <p className="text-red-400">{error || "Session not found."}</p>
        <button onClick={() => router.push("/dashboard")} className="text-sm text-blue-400 hover:underline">
          ← Back to Dashboard
        </button>
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
          <button
            onClick={() => router.push("/dashboard")}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{session.title}</h1>
            <p className="text-xs text-gray-500">
              {new Date(session.started_at).toLocaleString()} ·{" "}
              <span
                className={`font-medium ${
                  session.status === "completed" ? "text-green-400" : "text-yellow-400"
                }`}
              >
                {session.status}
              </span>
            </p>
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
        </div>

        {/* Summary bar */}
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

        {/* Per-question feedback */}
        {responses.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center text-gray-500">
            No responses recorded for this session.
          </div>
        ) : (
          <div className="space-y-4">
            {responses.map((r, i) => (
              <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                {/* Question header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-200 leading-snug">{r.question}</p>
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

                {/* LLM feedback */}
                {r.llm_feedback && (
                  <div className="flex gap-2 bg-blue-950/40 border border-blue-900/50 rounded-xl px-4 py-3">
                    <MessageSquare size={14} className="shrink-0 mt-0.5 text-blue-400" />
                    <p className="text-sm text-blue-200 leading-relaxed">{r.llm_feedback}</p>
                  </div>
                )}

                {/* No score yet */}
                {r.total == null && (
                  <p className="text-xs text-gray-600 italic">This question was not scored.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
