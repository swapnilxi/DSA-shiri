"use client";
import { ScoreBreakdown } from "@/hooks/useInterview";

interface Props {
  score: ScoreBreakdown;
}

const DIMENSIONS = [
  { key: "technical_correctness" as const, label: "Technical", max: 40, color: "bg-accent" },
  { key: "depth_completeness" as const, label: "Depth", max: 25, color: "bg-gold" },
  { key: "communication_clarity" as const, label: "Clarity", max: 20, color: "bg-accent" },
  { key: "problem_solving" as const, label: "Process", max: 15, color: "bg-gold" },
];

export function ScoreOverlay({ score }: Props) {
  const pct = score.total;
  const color = pct >= 80 ? "text-status-ok" : pct >= 60 ? "text-status-warn" : "text-status-error";

  return (
    <div className="absolute right-4 top-16 w-72 bg-surface-1/95 backdrop-blur border border-border-default rounded-2xl p-4 shadow-2xl">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Score</span>
        <span className={`text-2xl font-bold ${color}`}>{pct.toFixed(0)}<span className="text-sm text-text-muted">/100</span></span>
      </div>

      <div className="space-y-2 mb-3">
        {DIMENSIONS.map((d) => (
          <div key={d.key} className="flex items-center gap-2">
            <span className="text-xs text-text-secondary w-16 shrink-0">{d.label}</span>
            <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
              <div
                className={`h-full ${d.color} rounded-full transition-all duration-700`}
                style={{ width: `${(score[d.key] / d.max) * 100}%` }}
              />
            </div>
            <span className="text-xs text-text-secondary w-8 text-right">{score[d.key].toFixed(0)}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-text-primary leading-relaxed border-t border-border-default pt-3">
        {score.llm_feedback}
      </p>

      {score.follow_up_asked && (
        <p className="text-xs text-accent mt-2 italic">"{score.follow_up_asked}"</p>
      )}
    </div>
  );
}
