"use client";

import { useEffect, useState, useRef, useCallback, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { BrainCircuit, Lightbulb, Link2, Map, Mic, Puzzle, Search, SendHorizontal, Sparkles, Square, Star, Target, MessageSquare, Telescope, Zap } from "lucide-react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { Waveform } from "@/components/interview/Waveform";
import { api } from "@/lib/api";
import type { FollowupReport, FollowupTurn, Question } from "@/lib/api";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { NovaBadge } from "@/components/ui/NovaBadge";

// ── Types ──────────────────────────────────────────────────────────────────

type SectionKey = "hints" | "concepts" | "approach" | "sample_answer" | "followups" | "quiz" | "deep_dive";

interface SectionState {
  open: boolean;
  generated: boolean;
  loading: boolean;
  content: unknown;
  error: string | null;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

const DIFF_COLORS: Record<string, string> = {
  Easy: "text-status-ok bg-status-ok/10 border-status-ok/30",
  Medium: "text-status-warn bg-status-warn/10 border-status-warn/30",
  Hard: "text-status-error bg-status-error/12 border-status-error/30",
};

const SECTIONS: { key: SectionKey; icon: ReactNode; label: string; desc: string }[] = [
  { key: "hints", icon: <Lightbulb size={16} />, label: "Hints", desc: "Progressive hints from subtle to explicit" },
  { key: "concepts", icon: <Puzzle size={16} />, label: "Key Concepts", desc: "Core knowledge areas to brush up on" },
  { key: "approach", icon: <Map size={16} />, label: "Approach Guide", desc: "Step-by-step thinking process" },
  { key: "sample_answer", icon: <Star size={16} />, label: "Sample Answer", desc: "Model answer with key takeaways" },
  { key: "followups", icon: <Link2 size={16} />, label: "Follow-up Questions", desc: "What an interviewer might ask next" },
  { key: "deep_dive", icon: <Telescope size={16} />, label: "Dive Deeper", desc: "Real-world scenarios, core concepts, mental models" },
  { key: "quiz", icon: <Target size={16} />, label: "Quick Quiz", desc: "Test your understanding with 4 MCQ questions" },
];

const QUICK_PROMPTS = [
  "Give me a hint without spoiling the answer",
  "What data structures should I consider?",
  "Explain the time complexity tradeoffs",
  "What edge cases should I watch for?",
  "How would I approach this in an interview?",
];

// ── Markdown-lite renderer (bold, code, bullets) ───────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  return text.split("\n").map((line, i) => {
    const parts: React.ReactNode[] = [];
    const regex = /`([^`]+)`|\*\*([^*]+)\*\*/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(line)) !== null) {
      if (m.index > last) parts.push(line.slice(last, m.index));
      if (m[1]) parts.push(<code key={m.index} className="px-1 py-0.5 bg-surface-3 rounded text-status-ok text-xs font-mono">{m[1]}</code>);
      if (m[2]) parts.push(<strong key={m.index} className="text-white font-semibold">{m[2]}</strong>);
      last = m.index + m[0].length;
    }
    if (last < line.length) parts.push(line.slice(last));
    const isBullet = line.trimStart().startsWith("- ") || line.trimStart().startsWith("• ");
    if (isBullet) {
      return <li key={i} className="ml-4 list-disc text-text-primary text-sm leading-relaxed">{parts.map((p, j) => typeof p === "string" ? p.replace(/^[-•]\s*/, "") : p)}</li>;
    }
    return <p key={i} className={`text-text-primary text-sm leading-relaxed ${line === "" ? "h-2" : ""}`}>{parts}</p>;
  });
}

// ── Section content renderers ──────────────────────────────────────────────

function HintsContent({ content }: { content: unknown }) {
  const hints = content as string[];
  const [revealed, setRevealed] = useState(0);
  return (
    <div className="space-y-3">
      {hints.slice(0, revealed).map((h, i) => (
        <div key={i} className="flex gap-3 p-3 bg-status-warn/10 border border-status-warn/30 rounded-lg">
          <span className="text-status-warn font-bold text-sm shrink-0">#{i + 1}</span>
          <p className="text-text-primary text-sm leading-relaxed">{h}</p>
        </div>
      ))}
      {revealed < hints.length && (
        <button
          onClick={() => setRevealed(r => r + 1)}
          className="w-full py-2 border border-dashed border-status-warn/30 rounded-lg text-status-warn text-sm hover:bg-status-warn/10 transition-colors"
        >
          {revealed === 0 ? "Reveal First Hint" : `Reveal Hint ${revealed + 1} of ${hints.length}`}
        </button>
      )}
      {revealed === hints.length && (
        <p className="text-center text-xs text-text-muted py-1">All hints revealed</p>
      )}
    </div>
  );
}

function ConceptsContent({ content }: { content: unknown }) {
  const concepts = content as string[];
  return (
    <div className="flex flex-wrap gap-2">
      {concepts.map((c, i) => (
        <span key={i} className="px-3 py-1.5 bg-accent/30 border border-accent/25 text-accent rounded-full text-xs font-medium">
          {c}
        </span>
      ))}
    </div>
  );
}

function ApproachContent({ content }: { content: unknown }) {
  const data = content as { steps: string[]; tips: string[] };
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Steps</p>
        <ol className="space-y-2">
          {data.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 w-5 h-5 rounded-full bg-accent/50 border border-accent/35 text-accent text-xs flex items-center justify-center font-bold">{i + 1}</span>
              <p className="text-text-primary text-sm leading-relaxed">{s}</p>
            </li>
          ))}
        </ol>
      </div>
      {data.tips?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Interviewer Tips</p>
          <ul className="space-y-1">
            {data.tips.map((t, i) => (
              <li key={i} className="flex gap-2 text-sm text-text-primary">
                <span className="text-status-ok shrink-0">→</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SampleAnswerContent({ content }: { content: unknown }) {
  const data = content as { answer: string; key_points: string[] };
  return (
    <div className="space-y-4">
      <div className="prose-sm">
        <div className="space-y-1">{renderMarkdown(data.answer)}</div>
      </div>
      {data.key_points?.length > 0 && (
        <div className="p-3 bg-status-ok/10 border border-status-ok/30 rounded-lg">
          <p className="text-xs font-semibold text-status-ok uppercase tracking-wider mb-2">Key Takeaways</p>
          <ul className="space-y-1">
            {data.key_points.map((kp, i) => (
              <li key={i} className="flex gap-2 text-sm text-text-primary">
                <span className="text-status-ok shrink-0">✓</span>
                {kp}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FollowupsContent({ content }: { content: unknown }) {
  const questions = content as string[];
  return (
    <div className="space-y-2">
      {questions.map((q, i) => (
        <div key={i} className="flex gap-3 p-3 bg-gold/10 border border-gold/20 rounded-lg">
          <span className="text-gold shrink-0 text-sm font-bold">{i + 1}.</span>
          <p className="text-text-primary text-sm leading-relaxed">{q}</p>
        </div>
      ))}
    </div>
  );
}

interface QuizQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

function QuizContent({ initialQuestions, questionId, model }: {
  initialQuestions: QuizQuestion[];
  questionId: number;
  model: string;
}) {
  const [allQuestions, setAllQuestions] = useState<QuizQuestion[]>(initialQuestions);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [cursor, setCursor] = useState(0);           // which question is shown
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  const total = allQuestions.length;
  const q = allQuestions[cursor];
  const selected = answers[cursor];
  const submitted = selected !== undefined;
  const isCorrect = submitted && selected === q.correct_index;

  // Current batch boundaries (batches of 4)
  const batchStart = Math.floor(cursor / 4) * 4;
  const batchEnd   = Math.min(batchStart + 4, total) - 1;
  const batchSize  = batchEnd - batchStart + 1;
  const batchAnswered = Array.from({ length: batchSize }, (_, i) => answers[batchStart + i]).filter(v => v !== undefined).length;
  const batchCorrect  = Array.from({ length: batchSize }, (_, i) => i).filter(i => answers[batchStart + i] === allQuestions[batchStart + i]?.correct_index).length;
  const batchComplete = batchAnswered === batchSize;
  const isLastBatch   = batchEnd === total - 1;

  async function generateMore() {
    setLoadingMore(true);
    setMoreError(null);
    try {
      const res = await api.generatePracticeContent(questionId, "quiz", model || undefined);
      const newQs = res.content as QuizQuestion[];
      setAllQuestions(prev => [...prev, ...newQs]);
      setCursor(total);   // jump to first new question
    } catch (e: unknown) {
      setMoreError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoadingMore(false);
    }
  }

  // Dot color per question index
  function dotColor(i: number) {
    if (answers[i] === undefined) return i === cursor ? "bg-accent scale-125" : "bg-surface-3";
    return answers[i] === allQuestions[i].correct_index ? "bg-status-ok" : "bg-status-error";
  }

  return (
    <div className="space-y-4">

      {/* ── Navigation bar ── */}
      <div className="flex items-center justify-between gap-3">
        {/* Left arrow */}
        <button
          onClick={() => setCursor(c => c - 1)}
          disabled={cursor === 0}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
        </button>

        {/* Dots + counter */}
        <div className="flex-1 flex flex-col items-center gap-2">
          <div className="flex items-center gap-1.5">
            {allQuestions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCursor(i)}
                className={`rounded-full transition-all duration-200 ${dotColor(i)} ${i === cursor ? "w-4 h-2.5" : "w-2 h-2"}`}
              />
            ))}
          </div>
          <span className="text-xs text-text-muted">
            Q{cursor + 1} / {total}
            {total > 4 && <span className="ml-1.5 text-text-muted">· Round {Math.floor(cursor / 4) + 1}</span>}
          </span>
        </div>

        {/* Right arrow */}
        <button
          onClick={() => setCursor(c => c + 1)}
          disabled={cursor === total - 1 || !submitted}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          title={!submitted ? "Answer this question to continue" : ""}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>

      {/* ── Question card ── */}
      <div className="bg-surface-2/60 border border-border-default rounded-xl p-4 space-y-3">
        <p className="text-sm font-medium text-text-primary leading-relaxed">
          {q.question}
        </p>

        <div className="space-y-2">
          {q.options.map((opt, oi) => {
            let cls = "w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ";
            if (!submitted) {
              cls += "border-border-strong text-text-primary hover:border-accent/40 hover:bg-accent/20 hover:text-accent-bright";
            } else if (oi === q.correct_index) {
              cls += "border-status-ok/40 bg-status-ok/10 text-status-ok font-medium";
            } else if (oi === selected) {
              cls += "border-status-error/45 bg-status-error/12 text-status-error";
            } else {
              cls += "border-border-default text-text-muted";
            }
            return (
              <button key={oi}
                onClick={() => !submitted && setAnswers(a => ({ ...a, [cursor]: oi }))}
                disabled={submitted}
                className={cls}
              >
                <span className="font-mono text-xs mr-2 opacity-50">{String.fromCharCode(65 + oi)}.</span>
                {opt}
                {submitted && oi === q.correct_index && <span className="ml-2 text-status-ok">✓</span>}
                {submitted && oi === selected && oi !== q.correct_index && <span className="ml-2 text-status-error">✗</span>}
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {submitted && (
          <div className={`flex gap-2 px-3 py-2.5 rounded-lg text-xs ${
            isCorrect ? "bg-status-ok/10 border border-status-ok/30 text-status-ok"
                      : "bg-gold/10 border border-gold/25 text-gold"
          }`}>
            <span className="shrink-0">{isCorrect ? "✓" : "💡"}</span>
            <span className="leading-relaxed">{q.explanation}</span>
          </div>
        )}
      </div>

      {/* ── Batch complete summary + Generate more ── */}
      {batchComplete && isLastBatch && (
        <div className="space-y-3">
          {/* Score banner */}
          <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${
            batchCorrect === batchSize   ? "bg-status-ok/10 border-status-ok/35 text-status-ok"
            : batchCorrect >= batchSize / 2 ? "bg-status-warn/10 border-status-warn/35 text-status-warn"
            : "bg-status-error/12 border-status-error/35 text-status-error"
          }`}>
            <span className="text-sm font-semibold">
              Round {Math.floor(batchEnd / 4) + 1} complete
            </span>
            <span className="text-base font-bold">{batchCorrect} / {batchSize}</span>
          </div>

          {/* Generate more */}
          {moreError && <p className="text-xs text-status-error">{moreError}</p>}
          <button
            onClick={generateMore}
            disabled={loadingMore}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-accent/25 hover:border-accent/40 rounded-xl text-sm text-accent hover:text-accent disabled:opacity-50 transition-colors"
          >
            {loadingMore
              ? <><span className="w-3.5 h-3.5 border border-accent/50 border-t-transparent rounded-full animate-spin" />Generating…</>
              : <>Generate 4 more <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg></>
            }
          </button>
        </div>
      )}

      {/* hint if unanswered and trying to go right */}
      {submitted === false && cursor < total - 1 && (
        <p className="text-xs text-text-muted text-center">Answer to unlock the next question →</p>
      )}
    </div>
  );
}

interface DeepDiveData {
  tldr: string;
  real_world_scenarios: { title: string; context: string; how_it_applies: string; what_breaks_without_it: string }[];
  core_concepts: { name: string; one_liner: string; deep_explanation: string; analogy: string }[];
  mental_model: string;
  common_misconceptions: string[];
  how_experts_think_about_it: string;
  rabbit_holes: string[];
}

function DeepDiveContent({ content }: { content: unknown }) {
  const d = content as DeepDiveData;
  const [openConcept, setOpenConcept] = useState<number | null>(null);
  const [openScenario, setOpenScenario] = useState<number | null>(null);

  return (
    <div className="space-y-5">

      {/* TL;DR */}
      <div className="p-4 bg-gradient-to-r from-accent/20 to-accent/30 border border-accent/25 rounded-xl">
        <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-2">TL;DR</p>
        <p className="text-sm text-accent-bright leading-relaxed">{d.tldr}</p>
      </div>

      {/* Real-world scenarios */}
      {d.real_world_scenarios?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 px-1">🌍 Real-World Scenarios</p>
          <div className="space-y-2">
            {d.real_world_scenarios.map((s, i) => (
              <div key={i} className="border border-border-default rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenScenario(openScenario === i ? null : i)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-2/60 transition-colors text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-gold/10 border border-gold/35 text-gold text-xs flex items-center justify-center font-bold">{i + 1}</span>
                    <span className="text-sm font-medium text-text-primary truncate">{s.title}</span>
                  </div>
                  <span className="text-text-muted shrink-0 ml-2">{openScenario === i ? "▲" : "▼"}</span>
                </button>
                {openScenario === i && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border-subtle">
                    <p className="text-xs text-text-secondary leading-relaxed pt-3">{s.context}</p>
                    <div className="bg-status-ok/10 border border-status-ok/30 rounded-lg px-3 py-2.5">
                      <p className="text-xs font-semibold text-status-ok mb-1">How this concept applies</p>
                      <p className="text-xs text-status-ok leading-relaxed">{s.how_it_applies}</p>
                    </div>
                    <div className="bg-status-error/10 border border-status-error/30 rounded-lg px-3 py-2.5">
                      <p className="text-xs font-semibold text-status-error mb-1">What breaks without it</p>
                      <p className="text-xs text-status-error leading-relaxed">{s.what_breaks_without_it}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Core concepts */}
      {d.core_concepts?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 px-1">Core Concepts In Depth</p>
          <div className="space-y-2">
            {d.core_concepts.map((c, i) => (
              <div key={i} className="border border-border-default rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenConcept(openConcept === i ? null : i)}
                  className="w-full flex items-start justify-between px-4 py-3 hover:bg-surface-2/60 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary">{c.name}</p>
                    <p className="text-xs text-text-muted mt-0.5 truncate">{c.one_liner}</p>
                  </div>
                  <span className="text-text-muted shrink-0 ml-3 mt-0.5">{openConcept === i ? "▲" : "▼"}</span>
                </button>
                {openConcept === i && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border-subtle">
                    <p className="text-sm text-text-primary leading-relaxed pt-3">{c.deep_explanation}</p>
                    <div className="flex gap-2 bg-gold/10 border border-gold/25 rounded-lg px-3 py-2.5">
                      <Lightbulb size={13} className="shrink-0 text-gold" />
                      <div>
                        <p className="text-xs font-semibold text-gold mb-0.5">Analogy</p>
                        <p className="text-xs text-text-secondary leading-relaxed">{c.analogy}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mental model */}
      {d.mental_model && (
        <div className="flex gap-3 bg-gold/10 border border-gold/20 rounded-xl px-4 py-3.5">
          <Map size={17} className="text-gold shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-gold mb-1.5">Mental Model</p>
            <p className="text-sm text-gold leading-relaxed">{d.mental_model}</p>
          </div>
        </div>
      )}

      {/* How experts think about it */}
      {d.how_experts_think_about_it && (
        <div className="flex gap-3 bg-status-ok/10 border border-status-ok/30 rounded-xl px-4 py-3.5">
          <span className="text-status-ok text-lg shrink-0">👷</span>
          <div>
            <p className="text-xs font-semibold text-status-ok mb-1.5">How Experts Think About It</p>
            <p className="text-sm text-status-ok leading-relaxed">{d.how_experts_think_about_it}</p>
          </div>
        </div>
      )}

      {/* Common misconceptions */}
      {d.common_misconceptions?.length > 0 && (
        <div className="bg-status-error/10 border border-status-error/30 rounded-xl px-4 py-3.5">
          <p className="text-xs font-semibold text-status-error mb-2">⚠️ Common Misconceptions</p>
          <ul className="space-y-1.5">
            {d.common_misconceptions.map((m, i) => (
              <li key={i} className="flex gap-2 text-xs text-status-error leading-relaxed">
                <span className="text-status-error shrink-0 mt-0.5">✗</span>{m}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Rabbit holes */}
      {d.rabbit_holes?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 px-1">🐇 Rabbit Holes Worth Exploring</p>
          <div className="flex flex-wrap gap-2">
            {d.rabbit_holes.map((r, i) => (
              <span key={i} className="px-3 py-1.5 bg-surface-2 border border-border-default hover:border-accent/35 text-text-primary rounded-full text-xs font-medium transition-colors cursor-default">
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

function SectionContent({ sectionKey, content, questionId, model }: {
  sectionKey: SectionKey;
  content: unknown;
  questionId: number;
  model: string;
}) {
  if (sectionKey === "hints") return <HintsContent content={content} />;
  if (sectionKey === "concepts") return <ConceptsContent content={content} />;
  if (sectionKey === "approach") return <ApproachContent content={content} />;
  if (sectionKey === "sample_answer") return <SampleAnswerContent content={content} />;
  if (sectionKey === "followups") return <FollowupsContent content={content} />;
  if (sectionKey === "deep_dive") return <DeepDiveContent content={content} />;
  if (sectionKey === "quiz") return <QuizContent initialQuestions={content as QuizQuestion[]} questionId={questionId} model={model} />;
  return null;
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function PracticePage() {
  const { questionId } = useParams<{ questionId: string }>();
  const router = useRouter();
  const recorder = useAudioRecorder();

  const [question, setQuestion] = useState<Question | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [model, setModel] = useState<string>("");
  const [modelGroups, setModelGroups] = useState<{
    ollama: string[];
    deepseek: string[];
    deepseek_configured: boolean;
    gemini: string[];
    gemini_configured: boolean;
    default: string;
  } | null>(null);

  const [sections, setSections] = useState<Record<SectionKey, SectionState>>(() =>
    Object.fromEntries(
      SECTIONS.map(s => [s.key, { open: false, generated: false, loading: false, content: null, error: null }])
    ) as Record<SectionKey, SectionState>
  );

  const [notes, setNotes] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [quickPromptsOpen, setQuickPromptsOpen] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [followupActive, setFollowupActive] = useState(false);
  const [followupTurns, setFollowupTurns] = useState<FollowupTurn[]>([]);
  const [followupMessages, setFollowupMessages] = useState<ChatMsg[]>([]);
  const [followupInput, setFollowupInput] = useState("");
  const [followupLoading, setFollowupLoading] = useState(false);
  const [followupStatus, setFollowupStatus] = useState("Click \"Generate\" to receive the first question and begin the deep-dive.");
  const [followupReport, setFollowupReport] = useState<FollowupReport | null>(null);
  const followupEndRef = useRef<HTMLDivElement>(null);
  const [followupPanelOpen, setFollowupPanelOpen] = useState(false);

  // ── Code editor & submission ───────────────────────────────────────────────
  const [code, setCode] = useState("");
  const [codeSubmitting, setCodeSubmitting] = useState(false);
  const [codeResult, setCodeResult] = useState<import("@/lib/api").CodeSubmissionResponse | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [pastSubmissions, setPastSubmissions] = useState<import("@/lib/api").DsaSubmissionRecord[]>([]);
  const [xpToast, setXpToast] = useState<{ xp: number; level: number } | null>(null);
  const [codeEditorOpen, setCodeEditorOpen] = useState(true);

  // Play base64-encoded WAV audio (TTS response)
  const playFollowupAudio = useCallback((audio_b64: string | null) => {
    if (!audio_b64) return;
    try {
      const bytes = Uint8Array.from(atob(audio_b64), c => c.charCodeAt(0));
      const ctx = new AudioContext();
      ctx.decodeAudioData(bytes.buffer, (buffer) => {
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(ctx.destination);
        src.start(0);
      });
    } catch {
      // silently ignore TTS playback errors
    }
  }, []);

  // Practice drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterTopic, setFilterTopic] = useState<string>("");
  const [drawerVisible, setDrawerVisible] = useState(15);
  const drawerSentinelRef = useRef<HTMLDivElement>(null);

  // Load question + models on mount
  useEffect(() => {
    const id = parseInt(questionId, 10);
    if (isNaN(id)) { setLoadError("Invalid question ID"); return; }

    api.getPracticeQuestion(id).then(setQuestion).catch(e => setLoadError(e.message));
    api.getModels().then(data => {
      setModelGroups(data);
      const saved = typeof window !== "undefined" ? localStorage.getItem("selectedModel") : null;
      setModel(saved || data.default);
    }).catch(() => {});
    // Load past submissions for spaced repetition display
    api.getQuestionSubmissions(id).then(setPastSubmissions).catch(() => {});
  }, [questionId]);

  // Restore notes from localStorage
  useEffect(() => {
    if (!questionId) return;
    const saved = localStorage.getItem(`practice_notes_${questionId}`);
    if (saved) setNotes(saved);
  }, [questionId]);

  // Persist notes
  useEffect(() => {
    if (!questionId) return;
    localStorage.setItem(`practice_notes_${questionId}`, notes);
  }, [notes, questionId]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  useEffect(() => {
    followupEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [followupMessages, followupReport]);

  // Load questions when drawer opens for the first time
  useEffect(() => {
    if (!drawerOpen || allQuestions.length > 0) return;
    setDrawerLoading(true);
    api.listQuestions({ limit: 200 }).then(qs => {
      setAllQuestions(qs);
    }).catch(() => {}).finally(() => setDrawerLoading(false));
  }, [drawerOpen, allQuestions.length]);

  // Reset drawer visible count when filters change
  useEffect(() => { setDrawerVisible(15); }, [searchQuery, filterDifficulty, filterCategory, filterTopic]);

  const drawerCategories = Array.from(new Set(allQuestions.map(q => q.category).filter(Boolean))) as string[];
  const drawerTopics = Array.from(new Set(allQuestions.map(q => q.topic).filter(Boolean))) as string[];

  const filteredQuestions = allQuestions.filter(q => {
    if (filterDifficulty && q.difficulty !== filterDifficulty) return false;
    if (filterCategory && q.category !== filterCategory) return false;
    if (filterTopic && q.topic !== filterTopic) return false;
    if (searchQuery) {
      const lc = searchQuery.toLowerCase();
      return q.question.toLowerCase().includes(lc) || q.topic.toLowerCase().includes(lc) || (q.category ?? "").toLowerCase().includes(lc);
    }
    return true;
  });

  const drawerVisibleQuestions = filteredQuestions.slice(0, drawerVisible);
  const drawerHasMore = drawerVisible < filteredQuestions.length;

  // Drawer infinite scroll
  useEffect(() => {
    if (!drawerSentinelRef.current || !drawerHasMore) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) setDrawerVisible(c => c + 15); },
      { threshold: 0.1 }
    );
    observer.observe(drawerSentinelRef.current);
    return () => observer.disconnect();
  }, [drawerHasMore, drawerVisible]);

  const toggleSection = useCallback(async (key: SectionKey) => {
    const s = sections[key];
    if (!s.generated && !s.open) {
      // First open → generate
      setSections(prev => ({ ...prev, [key]: { ...prev[key], open: true, loading: true, error: null } }));
      try {
        const res = await api.generatePracticeContent(parseInt(questionId, 10), key, model || undefined);
        setSections(prev => ({ ...prev, [key]: { ...prev[key], loading: false, generated: true, content: res.content } }));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Generation failed";
        setSections(prev => ({ ...prev, [key]: { ...prev[key], loading: false, error: msg } }));
      }
    } else {
      setSections(prev => ({ ...prev, [key]: { ...prev[key], open: !prev[key].open } }));
    }
  }, [sections, questionId, model]);

  const submitCode = useCallback(async () => {
    const trimmed = code.trim();
    if (!trimmed || codeSubmitting) return;
    setCodeSubmitting(true);
    setCodeError(null);
    setCodeResult(null);
    try {
      const result = await api.submitPythonCode(parseInt(questionId, 10), trimmed, {
        hints_used: sections.hints?.generated ? 1 : 0,
        model: model || undefined,
      });
      setCodeResult(result);
      setPastSubmissions(prev => [{
        id: result.submission_id,
        question_id: parseInt(questionId, 10),
        code: trimmed,
        language: "python",
        status: result.evaluation.status,
        efficiency_score: result.evaluation.efficiency_score,
        correctness_score: result.evaluation.correctness_score,
        xp_earned: result.xp_earned,
        feedback: result.evaluation.feedback,
        time_complexity: result.evaluation.time_complexity,
        space_complexity: result.evaluation.space_complexity,
        strengths: result.evaluation.strengths,
        edge_cases: result.evaluation.edge_cases,
        optimizations: result.evaluation.optimizations,
        submitted_at: new Date().toISOString(),
        next_review_at: undefined,
      }, ...prev]);
      setXpToast({ xp: result.xp_earned, level: result.level });
      setTimeout(() => setXpToast(null), 4000);
    } catch (e: unknown) {
      setCodeError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setCodeSubmitting(false);
    }
  }, [code, codeSubmitting, model, questionId, sections]);

  const sendChat = useCallback(async (text: string) => {
    const msg = text.trim();
    if (!msg || chatLoading) return;
    setChatInput("");
    const newHistory: ChatMsg[] = [...chatHistory, { role: "user", content: msg }];
    setChatHistory(newHistory);
    setChatLoading(true);
    try {
      const res = await api.practiceChat(
        parseInt(questionId, 10),
        msg,
        newHistory.map(m => ({ role: m.role, content: m.content })),
        model || undefined,
      );
      setChatHistory(prev => [...prev, { role: "assistant", content: res.reply }]);
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : "Chat failed";
      setChatHistory(prev => [...prev, { role: "assistant", content: `⚠️ ${errMsg}` }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatHistory, chatLoading, questionId, model]);

  const startFollowupMode = useCallback(async () => {
    setFollowupLoading(true);
    setFollowupStatus("Generating the first deeper follow-up question...");
    try {
      const res = await api.practiceFollowup(parseInt(questionId, 10), {
        history: [],
        model: model || undefined,
      });
      setFollowupActive(true);
      setFollowupTurns(res.turns);
      setFollowupMessages([{ role: "assistant", content: res.assistant_text }]);
      setFollowupReport(null);
      setFollowupInput("");
      setFollowupStatus("Answer with text or use the mic. I will keep pushing deeper.");
      playFollowupAudio(res.audio_b64);
    } catch (error: unknown) {
      setFollowupStatus(error instanceof Error ? error.message : "Could not start follow-up mode.");
    } finally {
      setFollowupLoading(false);
    }
  }, [model, playFollowupAudio, questionId]);

  const submitFollowup = useCallback(async (opts: { text?: string; audio?: Blob }) => {
    const text = opts.text?.trim() ?? "";
    if (!opts.audio && !text) return;
    setFollowupLoading(true);
    setFollowupStatus(opts.audio ? "Transcribing and reviewing your answer..." : "Reviewing your answer...");
    try {
      const res = await api.practiceFollowup(parseInt(questionId, 10), {
        history: followupTurns,
        model: model || undefined,
        answerText: text || undefined,
        audio: opts.audio,
      });
      setFollowupActive(true);
      setFollowupTurns(res.turns);
      setFollowupMessages((prev) => [
        ...prev,
        { role: "user", content: res.transcript },
        { role: "assistant", content: res.assistant_text },
      ]);
      setFollowupInput("");
      setFollowupReport(res.report);
      setFollowupStatus(
        res.complete
          ? `Follow-up mode complete. Final depth score: ${res.understanding_score.toFixed(0)}/100.`
          : `Depth score so far: ${res.understanding_score.toFixed(0)}/100. Keep going.`,
      );
      playFollowupAudio(res.audio_b64);
    } catch (error: unknown) {
      setFollowupStatus(error instanceof Error ? error.message : "Follow-up mode failed.");
    } finally {
      setFollowupLoading(false);
    }
  }, [followupTurns, model, playFollowupAudio, questionId]);

  const toggleFollowupMic = useCallback(async () => {
    if (followupLoading) return;
    if (!followupActive) {
      await startFollowupMode();
    }
    if (recorder.isRecording) {
      const blob = await recorder.stop();
      await submitFollowup({ audio: blob });
      return;
    }
    await recorder.start();
    setFollowupStatus("Recording… click the mic again to stop and submit.");
  }, [followupActive, followupLoading, recorder, startFollowupMode, submitFollowup]);

  // ── Loading / Error states ─────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <div className="text-center">
          <p className="text-status-error mb-4">{loadError}</p>
          <button onClick={() => router.back()} className="text-accent text-sm hover:underline">← Go back</button>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-accent/40 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-text-muted text-sm">Loading question…</p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="h-screen bg-surface-0 text-text-primary flex flex-col overflow-hidden">

      {/* ── XP Toast ─────────────────────────────────────── */}
      {xpToast && (
        <div className="fixed top-6 right-6 z-[100] animate-bounce">
          <div className="bg-gradient-to-br from-accent to-accent-bright border border-accent/50 rounded-2xl px-5 py-3.5 shadow-2xl shadow-indigo-900/50 flex items-center gap-3">
            <span className="text-2xl">✨</span>
            <div>
              <p className="text-white font-extrabold text-sm">+{xpToast.xp} XP earned!</p>
              <p className="text-accent-bright text-xs">Level {xpToast.level} · Keep it up!</p>
            </div>
          </div>
        </div>
      )}
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Practice", href: "/practice" },
          { label: `Question #${questionId}` },
        ]}
      />

      {/* ── Practice Drawer ──────────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Panel */}
          <div className="relative z-10 w-[420px] max-w-[95vw] h-full bg-surface-1 border-r border-border-subtle flex flex-col shadow-2xl">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle shrink-0">
              <div>
                <p className="text-sm font-semibold text-text-primary">Practice Questions</p>
                <p className="text-xs text-text-muted mt-0.5">{filteredQuestions.length} of {allQuestions.length} questions</p>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search + filters */}
            <div className="px-3 py-3 border-b border-border-subtle space-y-2.5 shrink-0">
              {/* Search */}
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search questions…"
                  className="w-full pl-8 pr-3 py-1.5 bg-surface-2 border border-border-default rounded-lg text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                )}
              </div>

              {/* Filters row */}
              <div className="flex flex-wrap items-center gap-1.5">
                {["Easy", "Medium", "Hard"].map(d => (
                  <button
                    key={d}
                    onClick={() => setFilterDifficulty(filterDifficulty === d ? "" : d)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      filterDifficulty === d
                        ? d === "Easy"   ? "bg-status-ok/10 border-status-ok/40 text-status-ok"
                        : d === "Medium" ? "bg-status-warn/10 border-status-warn/40 text-status-warn"
                        :                  "bg-status-error/12 border-status-error/45 text-status-error"
                        : "bg-surface-2 border-border-default text-text-muted hover:border-border-strong hover:text-text-secondary"
                    }`}
                  >
                    {d}
                  </button>
                ))}

                {drawerCategories.length > 0 && (
                  <div className="relative">
                    <select
                      value={filterCategory}
                      onChange={e => setFilterCategory(e.target.value)}
                      className={`appearance-none pl-2.5 pr-6 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer focus:outline-none ${
                        filterCategory ? "bg-gold/10 border-accent/40 text-gold" : "bg-surface-2 border-border-default text-text-muted"
                      }`}
                    >
                      <option value="">Category</option>
                      {drawerCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <svg className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-text-muted" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                )}

                {drawerTopics.length > 0 && (
                  <div className="relative">
                    <select
                      value={filterTopic}
                      onChange={e => setFilterTopic(e.target.value)}
                      className={`appearance-none pl-2.5 pr-6 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer focus:outline-none ${
                        filterTopic ? "bg-accent/50 border-accent/40 text-accent" : "bg-surface-2 border-border-default text-text-muted"
                      }`}
                    >
                      <option value="">Topic</option>
                      {drawerTopics.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <svg className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-text-muted" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                )}

                {(filterDifficulty || filterCategory || filterTopic || searchQuery) && (
                  <button
                    onClick={() => { setFilterDifficulty(""); setFilterCategory(""); setFilterTopic(""); setSearchQuery(""); }}
                    className="px-2.5 py-1 rounded-full text-xs border border-border-default text-text-muted hover:text-text-secondary hover:border-border-strong transition-colors"
                  >
                    ✕ Clear
                  </button>
                )}
              </div>
            </div>

            {/* Question list */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
              {drawerLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-6 h-6 border-2 border-accent/40 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredQuestions.length === 0 ? (
                <div className="text-center py-12 text-text-muted">
                  <p className="text-2xl mb-2">🔍</p>
                  <p className="text-sm">No questions match your filters</p>
                </div>
              ) : (
                <>
                  {drawerVisibleQuestions.map(q => (
                    <button
                      key={q.id}
                      onClick={() => { router.push(`/practice/${q.id}`); setDrawerOpen(false); }}
                      className={`w-full text-left p-3 rounded-xl border transition-all group ${
                        q.id === parseInt(questionId, 10)
                          ? "bg-accent/30 border-accent/35"
                          : "bg-surface-2/40 border-border-default/60 hover:bg-surface-2 hover:border-border-strong"
                      }`}
                    >
                      <p className="text-xs text-text-primary leading-relaxed line-clamp-2 group-hover:text-white transition-colors">
                        {q.question}
                      </p>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-surface-3/60 text-text-secondary">{q.topic}</span>
                        {q.category && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gold/10 border border-gold/20 text-gold">{q.category}</span>
                        )}
                        <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${
                          q.difficulty === "Easy"   ? "bg-status-ok/10 border-status-ok/30 text-status-ok"
                          : q.difficulty === "Medium" ? "bg-status-warn/10 border-status-warn/30 text-status-warn"
                          : "bg-status-error/12 border-status-error/30 text-status-error"
                        }`}>
                          {q.difficulty}
                        </span>
                        {q.id === parseInt(questionId, 10) && (
                          <span className="ml-auto text-xs text-accent font-medium">Current</span>
                        )}
                      </div>
                    </button>
                  ))}
                  {drawerHasMore && (
                    <div ref={drawerSentinelRef} className="flex items-center justify-center py-3 gap-2 text-text-muted text-xs">
                      <div className="w-3.5 h-3.5 border border-border-default border-t-text-muted rounded-full animate-spin" />
                      Loading more…
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="shrink-0 z-20 bg-surface-0/85 backdrop-blur-md border-b border-border-subtle px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-wrap">
            <button
              onClick={() => setDrawerOpen(true)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border-default bg-surface-1/80 hover:bg-surface-2 hover:border-border-strong text-xs font-semibold text-text-primary transition-all shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span>Problem Drawer</span>
            </button>
            <div className="h-4 w-px bg-surface-2 shrink-0 hidden sm:block" />
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span className="text-xs font-semibold px-2.5 py-0.5 bg-accent/60 border border-accent/25 text-accent rounded-lg">
                {question.topic}
              </span>
              {question.category && (
                <span className="text-xs font-semibold px-2.5 py-0.5 bg-gold/10 border border-gold/20 text-gold rounded-lg">
                  {question.category}
                </span>
              )}
              <span className={`text-xs font-semibold px-2.5 py-0.5 border rounded-lg ${DIFF_COLORS[question.difficulty]}`}>
                {question.difficulty}
              </span>
              {question.company && (
                <span className="text-xs text-text-secondary font-medium">@ {question.company}</span>
              )}
              <NovaBadge contextName="Coach" tip="Nova provides progressive hints, complexity breakdowns, and multi-turn voice follow-up testing." />
            </div>
          </div>

          {/* Model selector */}
          {modelGroups && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-text-secondary font-medium hidden sm:inline">Tutor Model:</span>
              <select
                value={model}
                onChange={e => { setModel(e.target.value); localStorage.setItem("selectedModel", e.target.value); }}
                className="bg-surface-1 border border-border-default/80 text-text-primary text-xs font-medium rounded-xl px-3 py-1.5 focus:outline-none focus:border-accent/50 cursor-pointer shadow-sm"
              >
                {modelGroups.ollama.length > 0 && (
                  <optgroup label="Ollama (local)">
                    {modelGroups.ollama.map(m => <option key={m} value={m}>{m}</option>)}
                  </optgroup>
                )}
                {modelGroups.deepseek_configured && (
                  <optgroup label="DeepSeek">
                    {modelGroups.deepseek.map(m => <option key={m} value={m}>{m}</option>)}
                  </optgroup>
                )}
                {modelGroups.gemini_configured && (
                  <optgroup label="Gemini">
                    {modelGroups.gemini.map(m => <option key={m} value={m}>{m}</option>)}
                  </optgroup>
                )}
              </select>
            </div>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden max-w-7xl mx-auto w-full">
        {/* ── Left panel ─────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto px-4 py-6 space-y-4 min-w-0">

          {/* Question card */}
          <div className="bg-surface-1/80 border border-border-subtle rounded-3xl p-6 shadow-xl shadow-black/20">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-accent uppercase tracking-wider">Problem Statement</span>
                <span className="text-xs text-text-muted font-mono">#{question.id}</span>
              </div>
              <span className="text-xs text-text-secondary">FAANG Technical Bar</span>
            </div>
            <p className="text-text-primary text-base sm:text-lg font-medium leading-relaxed">{question.question}</p>
          </div>

          {/* AI Sections */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider px-1">AI Study Tools</p>

            {SECTIONS.map(({ key, icon, label, desc }) => {
              const s = sections[key];
              return (
                <div key={key} className="bg-surface-1 border border-border-subtle rounded-2xl overflow-hidden">
                  {/* Section header */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-base">{icon}</span>
                      <div>
                        <p className="text-sm font-medium text-text-primary">{label}</p>
                        <p className="text-xs text-text-muted">{desc}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleSection(key)}
                      disabled={s.loading}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                        ${s.generated
                          ? "bg-surface-2 border-border-default text-text-primary hover:border-border-strong"
                          : "bg-accent/40 border-accent/35 text-accent hover:bg-accent/60"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {s.loading ? (
                        <>
                          <span className="w-3 h-3 border border-accent/50 border-t-transparent rounded-full animate-spin" />
                          Generating…
                        </>
                      ) : s.generated ? (
                        s.open ? "▲ Collapse" : "▼ Expand"
                      ) : (
                        <>✦ Generate</>
                      )}
                    </button>
                  </div>

                  {/* Section content */}
                  {s.open && (
                    <div className="border-t border-border-subtle px-4 py-4">
                      {s.error ? (
                        <div className="flex items-center gap-2">
                          <p className="text-status-error text-sm flex-1">{s.error}</p>
                          <button
                            onClick={() => {
                              setSections(prev => ({ ...prev, [key]: { ...prev[key], generated: false } }));
                              toggleSection(key);
                            }}
                            className="text-xs text-accent hover:underline shrink-0"
                          >
                            Retry
                          </button>
                        </div>
                      ) : s.content !== null ? (
                        <SectionContent sectionKey={key} content={s.content} questionId={parseInt(questionId, 10)} model={model} />
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="bg-surface-1 border border-border-subtle rounded-2xl overflow-hidden">
            {/* ── Collapsible header ── */}
            <button
              onClick={() => setFollowupPanelOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-surface-2/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-status-ok" />
                <p className="text-sm font-semibold text-text-primary">Follow-up Mode</p>
                {followupActive && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-status-ok/10 border border-status-ok/35 text-status-ok">
                    Active · {followupMessages.filter(m => m.role === "user").length} answer{followupMessages.filter(m => m.role === "user").length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <svg
                className={`w-4 h-4 text-text-muted transition-transform duration-200 ${followupPanelOpen ? "rotate-180" : ""}`}
                fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {followupPanelOpen && (
              <div className="border-t border-border-subtle p-4 space-y-4">
                <p className="text-xs text-text-muted leading-relaxed">
                  Stay on this exact question. Click <strong className="text-text-secondary">Generate</strong> to receive the first interview question, then keep answering to go deeper — up to 30 rounds.
                </p>

                <div className="flex items-center justify-between gap-3">
                  <div className="rounded-xl border border-border-subtle bg-surface-0/60 px-3 py-2.5 text-xs text-text-secondary flex items-center gap-3 flex-1 min-h-[40px]">
                    <span>{followupStatus}</span>
                    {recorder.isRecording && (
                      <div className="shrink-0 bg-surface-1/80 px-2 py-0.5 rounded-lg border border-border-subtle h-7 flex items-center overflow-hidden">
                        <Waveform active={true} volume={recorder.volume} color="#34d399" />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={startFollowupMode}
                    disabled={followupLoading}
                    className="shrink-0 rounded-xl border border-status-ok/35 bg-status-ok/10 px-3 py-2 text-xs font-semibold text-status-ok hover:bg-status-ok/10 disabled:opacity-50 transition-colors"
                  >
                    {followupLoading && !followupActive ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 border border-status-ok/50 border-t-transparent rounded-full animate-spin" />
                        Generating…
                      </span>
                    ) : followupActive ? "Restart" : "Generate"}
                  </button>
                </div>

                <div className="max-h-96 overflow-y-auto space-y-3 rounded-2xl border border-border-subtle bg-surface-0/40 p-3">
                  {!followupActive && (
                    <div className="py-8 text-center text-text-muted">
                      <BrainCircuit className="mx-auto mb-3 h-6 w-6 text-text-muted" />
                      <p className="text-xs">Click <strong className="text-text-muted">Generate</strong> to receive your first interview question.</p>
                    </div>
                  )}
                  {followupMessages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[92%] rounded-2xl px-3 py-2.5 text-xs leading-relaxed ${
                        msg.role === "user"
                          ? "bg-status-ok text-white rounded-tr-sm"
                          : "bg-surface-2 border border-border-default text-text-primary rounded-tl-sm"
                      }`}>
                        {msg.role === "assistant"
                          ? <div className="space-y-3">
                              {msg.content.split("\n\n").map((para, pi) => (
                                <div key={pi} className={`space-y-1 ${para.startsWith("Follow-up question:") ? "pt-1 border-t border-border-strong" : ""}`}>
                                  {renderMarkdown(para)}
                                </div>
                              ))}
                            </div>
                          : msg.content}
                      </div>
                    </div>
                  ))}
                  {followupLoading && (
                    <div className="flex justify-start">
                      <div className="bg-surface-2 border border-border-default rounded-2xl rounded-tl-sm px-3 py-2.5">
                        <span className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-surface-3 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 bg-surface-3 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 bg-surface-3 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </span>
                      </div>
                    </div>
                  )}
                  {followupReport && (
                    <div className="rounded-2xl border border-status-ok/30 bg-status-ok/10 p-4">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-status-ok">Final depth report</p>
                        <span className="text-sm font-bold text-status-ok">
                          {followupReport.understanding_score.toFixed(0)}
                          <span className="text-xs text-text-muted">/100</span>
                        </span>
                      </div>
                      <p className="text-sm text-status-ok leading-relaxed mb-3">{followupReport.overall_assessment}</p>
                      {followupReport.strengths.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-status-ok mb-1">Strengths</p>
                          <ul className="space-y-1">
                            {followupReport.strengths.map((item, index) => (
                              <li key={index} className="flex gap-2 text-xs text-status-ok">
                                <span className="text-status-ok shrink-0">•</span>{item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {followupReport.remaining_gaps.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-status-warn mb-1">Remaining gaps</p>
                          <ul className="space-y-1">
                            {followupReport.remaining_gaps.map((item, index) => (
                              <li key={index} className="flex gap-2 text-xs text-text-primary">
                                <span className="text-status-warn shrink-0">•</span>{item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {followupReport.recommended_drills.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-accent mb-1">Recommended drills</p>
                          <ul className="space-y-1">
                            {followupReport.recommended_drills.map((item, index) => (
                              <li key={index} className="flex gap-2 text-xs text-accent-bright">
                                <span className="text-accent shrink-0">•</span>{item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  <div ref={followupEndRef} />
                </div>

                <div className="flex gap-2">
                  <textarea
                    value={followupInput}
                    onChange={e => setFollowupInput(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (!followupActive) {
                          await startFollowupMode();
                        } else {
                          await submitFollowup({ text: followupInput });
                        }
                      }
                    }}
                    placeholder={followupActive ? "Answer the follow-up question…" : "Click Generate to start…"}
                    rows={3}
                    className="flex-1 rounded-xl border border-border-default bg-surface-2/50 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-status-ok/40"
                  />
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={toggleFollowupMic}
                      disabled={followupLoading}
                      className={`flex h-11 w-11 items-center justify-center rounded-xl text-white transition-all disabled:opacity-50 ${
                        recorder.isRecording
                          ? "bg-status-error hover:bg-status-error animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.6)]"
                          : "bg-surface-2 hover:bg-surface-3"
                      }`}
                      title={recorder.isRecording ? "Stop recording and submit" : "Record answer"}
                    >
                      {recorder.isRecording ? <Square size={16} /> : <Mic size={16} />}
                    </button>
                    <button
                      onClick={async () => {
                        if (!followupActive) {
                          await startFollowupMode();
                        } else {
                          await submitFollowup({ text: followupInput });
                        }
                      }}
                      disabled={followupLoading || (!followupInput.trim() && !followupActive)}
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-status-ok text-white hover:bg-status-ok disabled:opacity-50"
                      title="Send follow-up answer"
                    >
                      <SendHorizontal size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Python Code Editor ──────────────────────────────── */}
          <div className="bg-surface-1 border border-border-subtle rounded-2xl overflow-hidden">
            <button
              onClick={() => setCodeEditorOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-surface-2/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">🐍</span>
                <p className="text-sm font-semibold text-text-primary">Python Code Editor</p>
                {pastSubmissions.length > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full border ${
                    pastSubmissions[0].status === "accepted"
                      ? "bg-status-ok/10 border-status-ok/35 text-status-ok"
                      : "bg-status-warn/10 border-status-warn/35 text-status-warn"
                  }`}>
                    {pastSubmissions[0].status === "accepted" ? "✓ Accepted" : "Needs revision"}
                  </span>
                )}
              </div>
              <svg
                className={`w-4 h-4 text-text-muted transition-transform duration-200 ${codeEditorOpen ? "rotate-180" : ""}`}
                fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {codeEditorOpen && (
              <div className="border-t border-border-subtle p-4 space-y-4">
                <p className="text-xs text-text-muted leading-relaxed">
                  Write your Python solution. Submit to get AI code review, complexity analysis, and XP.
                </p>

                {/* Editor */}
                <div className="relative">
                  <textarea
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    placeholder={`# Write your Python solution here\ndef solution(...):\n    pass`}
                    rows={12}
                    spellCheck={false}
                    className="w-full font-mono text-xs bg-surface-0 border border-border-default rounded-xl px-4 py-3 text-status-ok placeholder-gray-700 resize-y focus:outline-none focus:border-accent/40 transition-colors leading-relaxed"
                  />
                </div>

                {/* Submit */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={submitCode}
                    disabled={!code.trim() || codeSubmitting}
                    className="flex items-center gap-2 px-5 py-2.5 bg-status-ok hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-colors shadow-lg shadow-emerald-900/30"
                  >
                    {codeSubmitting ? (
                      <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Evaluating…</>
                    ) : (
                      <>▶ Submit Solution</>
                    )}
                  </button>
                  {code.trim() && (
                    <button
                      onClick={() => setCode("")}
                      className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {codeError && (
                  <div className="px-4 py-3 bg-status-error/10 border border-status-error/30 rounded-xl text-sm text-status-error">
                    {codeError}
                  </div>
                )}

                {/* Latest submission result */}
                {codeResult && (
                  <div className={`rounded-2xl border p-4 space-y-3 ${
                    codeResult.evaluation.status === "accepted"
                      ? "bg-status-ok/10 border-status-ok/30"
                      : "bg-status-warn/10 border-status-warn/30"
                  }`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-lg ${
                          codeResult.evaluation.status === "accepted" ? "✅" : "⚠️"
                        }`}>
                          {codeResult.evaluation.status === "accepted" ? "✅" : "⚠️"}
                        </span>
                        <p className={`text-sm font-bold ${
                          codeResult.evaluation.status === "accepted" ? "text-status-ok" : "text-status-warn"
                        }`}>
                          {codeResult.evaluation.status === "accepted" ? "Accepted" : "Needs Revision"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-text-secondary">
                        <span>Correctness: <strong className="text-white">{codeResult.evaluation.correctness_score}</strong>/100</span>
                        <span>Efficiency: <strong className="text-white">{codeResult.evaluation.efficiency_score}</strong>/100</span>
                      </div>
                    </div>

                    <p className="text-sm text-text-primary leading-relaxed">{codeResult.evaluation.feedback}</p>

                    <div className="flex flex-wrap gap-3 text-xs">
                      <div className="bg-surface-1/60 border border-border-default rounded-lg px-3 py-1.5">
                        <span className="text-text-secondary">Time: </span>
                        <span className="text-accent font-mono font-semibold">{codeResult.evaluation.time_complexity}</span>
                      </div>
                      <div className="bg-surface-1/60 border border-border-default rounded-lg px-3 py-1.5">
                        <span className="text-text-secondary">Space: </span>
                        <span className="text-gold font-mono font-semibold">{codeResult.evaluation.space_complexity}</span>
                      </div>
                      <div className="bg-accent/50 border border-accent/25 rounded-lg px-3 py-1.5">
                        <span className="text-accent font-semibold">+{codeResult.xp_earned} XP</span>
                        <span className="text-text-muted ml-1">Review in {codeResult.next_review_days}d</span>
                      </div>
                    </div>

                    {codeResult.evaluation.strengths.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-status-ok mb-1">✔ Strengths</p>
                        <ul className="space-y-0.5">
                          {codeResult.evaluation.strengths.map((s, i) => (
                            <li key={i} className="text-xs text-status-ok flex gap-1.5"><span className="text-status-ok">•</span>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {codeResult.evaluation.optimizations.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gold mb-1">⚡ Optimizations</p>
                        <ul className="space-y-0.5">
                          {codeResult.evaluation.optimizations.map((o, i) => (
                            <li key={i} className="text-xs text-text-secondary flex gap-1.5"><span className="text-gold">•</span>{o}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Submission history */}
                {pastSubmissions.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Past Attempts ({pastSubmissions.length})</p>
                    <div className="space-y-1.5">
                      {pastSubmissions.slice(0, 3).map((sub, i) => (
                        <div key={sub.id} className="flex items-center gap-3 px-3 py-2 bg-surface-2/40 border border-border-default/50 rounded-xl text-xs">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${
                            sub.status === "accepted" ? "bg-status-ok" : "bg-status-warn"
                          }`} />
                          <span className="text-text-secondary">{i === 0 ? "Latest" : new Date(sub.submitted_at).toLocaleDateString()}</span>
                          <span className={`font-medium ${
                            sub.status === "accepted" ? "text-status-ok" : "text-status-warn"
                          }`}>{sub.correctness_score}/100</span>
                          {sub.next_review_at && (
                            <span className="ml-auto text-text-muted">
                              Review: {new Date(sub.next_review_at).toLocaleDateString()}
                            </span>
                          )}
                          <span className="text-accent font-semibold">+{sub.xp_earned} XP</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-surface-1 border border-border-subtle rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">📝 My Notes</p>
              <span className="text-xs text-text-muted">auto-saved</span>
            </div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Jot down your thoughts, approach, or things to remember…"
              rows={5}
              className="w-full bg-surface-2/50 border border-border-default rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>

        </main>

        {/* ── Right sidebar: AI Chat ─────────────────────────────────── */}
        <aside className="hidden lg:flex w-84 shrink-0 border-l border-border-subtle flex-col bg-surface-0/70 backdrop-blur-md">
          <div className="p-4 border-b border-border-subtle bg-surface-1/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <p className="text-sm font-bold text-text-primary">Nova DSA Tutor</p>
              </div>
              <span className="text-[10px] font-mono text-accent bg-accent/60 px-2 py-0.5 rounded-full border border-accent/25">
                Interactive
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-1">Inquire about optimal data structures, edge cases, and proofs</p>
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {chatHistory.length === 0 && (
              <div className="text-center py-8 text-text-muted">
                <p className="text-2xl mb-2">💬</p>
                <p className="text-xs">Start a conversation or use a quick prompt below</p>
              </div>
            )}
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[90%] rounded-2xl px-3 py-2.5 text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-accent text-white rounded-tr-sm"
                    : "bg-surface-2 border border-border-default text-text-primary rounded-tl-sm"
                }`}>
                  {msg.role === "assistant"
                    ? <div className="space-y-1">{renderMarkdown(msg.content)}</div>
                    : msg.content
                  }
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-surface-2 border border-border-default rounded-2xl rounded-tl-sm px-3 py-2.5">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-surface-3 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-surface-3 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-surface-3 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border-subtle">
            {/* Quick prompts — collapsible */}
            <div className="border-b border-border-subtle">
              <button
                onClick={() => setQuickPromptsOpen(o => !o)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                <span className="uppercase tracking-wider font-semibold">Quick prompts</span>
                <svg
                  className={`w-3 h-3 transition-transform duration-200 ${quickPromptsOpen ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {quickPromptsOpen && (
                <div className="px-3 pb-2 space-y-1">
                  {QUICK_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => { sendChat(prompt); setQuickPromptsOpen(false); }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg bg-surface-2 border border-border-default hover:border-border-strong text-xs text-text-secondary hover:text-text-primary transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3">
              <div className="flex gap-2">
                <textarea
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendChat(chatInput);
                    }
                  }}
                  placeholder="Ask a question… (Enter to send)"
                  rows={2}
                  className="flex-1 bg-surface-2 border border-border-default rounded-xl px-3 py-2 text-xs text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent/40 transition-colors"
                />
                <button
                  onClick={() => sendChat(chatInput)}
                  disabled={!chatInput.trim() || chatLoading}
                  className="shrink-0 self-end w-8 h-8 bg-accent hover:bg-accent-bright disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-colors"
                >
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              {chatHistory.length > 0 && (
                <button
                  onClick={() => setChatHistory([])}
                  className="mt-1.5 text-xs text-text-muted hover:text-text-muted transition-colors"
                >
                  Clear chat
                </button>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
