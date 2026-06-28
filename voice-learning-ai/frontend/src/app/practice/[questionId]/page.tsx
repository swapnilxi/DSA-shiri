"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Question } from "@/lib/api";

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
  Easy: "text-green-400 bg-green-900/30 border-green-800",
  Medium: "text-yellow-400 bg-yellow-900/30 border-yellow-800",
  Hard: "text-red-400 bg-red-900/30 border-red-800",
};

const SECTIONS: { key: SectionKey; icon: string; label: string; desc: string }[] = [
  { key: "hints", icon: "💡", label: "Hints", desc: "Progressive hints from subtle to explicit" },
  { key: "concepts", icon: "🧩", label: "Key Concepts", desc: "Core knowledge areas to brush up on" },
  { key: "approach", icon: "🗺️", label: "Approach Guide", desc: "Step-by-step thinking process" },
  { key: "sample_answer", icon: "⭐", label: "Sample Answer", desc: "Model answer with key takeaways" },
  { key: "followups", icon: "🔗", label: "Follow-up Questions", desc: "What an interviewer might ask next" },
  { key: "deep_dive", icon: "🔭", label: "Dive Deeper", desc: "Real-world scenarios, core concepts, mental models" },
  { key: "quiz", icon: "🎯", label: "Quick Quiz", desc: "Test your understanding with 4 MCQ questions" },
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
      if (m[1]) parts.push(<code key={m.index} className="px-1 py-0.5 bg-gray-700 rounded text-emerald-300 text-xs font-mono">{m[1]}</code>);
      if (m[2]) parts.push(<strong key={m.index} className="text-white font-semibold">{m[2]}</strong>);
      last = m.index + m[0].length;
    }
    if (last < line.length) parts.push(line.slice(last));
    const isBullet = line.trimStart().startsWith("- ") || line.trimStart().startsWith("• ");
    if (isBullet) {
      return <li key={i} className="ml-4 list-disc text-gray-300 text-sm leading-relaxed">{parts.map((p, j) => typeof p === "string" ? p.replace(/^[-•]\s*/, "") : p)}</li>;
    }
    return <p key={i} className={`text-gray-300 text-sm leading-relaxed ${line === "" ? "h-2" : ""}`}>{parts}</p>;
  });
}

// ── Section content renderers ──────────────────────────────────────────────

function HintsContent({ content }: { content: unknown }) {
  const hints = content as string[];
  const [revealed, setRevealed] = useState(0);
  return (
    <div className="space-y-3">
      {hints.slice(0, revealed).map((h, i) => (
        <div key={i} className="flex gap-3 p-3 bg-yellow-900/20 border border-yellow-800/40 rounded-lg">
          <span className="text-yellow-400 font-bold text-sm shrink-0">#{i + 1}</span>
          <p className="text-gray-200 text-sm leading-relaxed">{h}</p>
        </div>
      ))}
      {revealed < hints.length && (
        <button
          onClick={() => setRevealed(r => r + 1)}
          className="w-full py-2 border border-dashed border-yellow-800 rounded-lg text-yellow-400 text-sm hover:bg-yellow-900/20 transition-colors"
        >
          {revealed === 0 ? "Reveal First Hint" : `Reveal Hint ${revealed + 1} of ${hints.length}`}
        </button>
      )}
      {revealed === hints.length && (
        <p className="text-center text-xs text-gray-600 py-1">All hints revealed</p>
      )}
    </div>
  );
}

function ConceptsContent({ content }: { content: unknown }) {
  const concepts = content as string[];
  return (
    <div className="flex flex-wrap gap-2">
      {concepts.map((c, i) => (
        <span key={i} className="px-3 py-1.5 bg-blue-900/30 border border-blue-800/50 text-blue-300 rounded-full text-xs font-medium">
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
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Steps</p>
        <ol className="space-y-2">
          {data.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 w-5 h-5 rounded-full bg-blue-900/50 border border-blue-700 text-blue-300 text-xs flex items-center justify-center font-bold">{i + 1}</span>
              <p className="text-gray-200 text-sm leading-relaxed">{s}</p>
            </li>
          ))}
        </ol>
      </div>
      {data.tips?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Interviewer Tips</p>
          <ul className="space-y-1">
            {data.tips.map((t, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-300">
                <span className="text-emerald-400 shrink-0">→</span>
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
        <div className="p-3 bg-emerald-900/20 border border-emerald-800/40 rounded-lg">
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Key Takeaways</p>
          <ul className="space-y-1">
            {data.key_points.map((kp, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-300">
                <span className="text-emerald-400 shrink-0">✓</span>
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
        <div key={i} className="flex gap-3 p-3 bg-purple-900/20 border border-purple-800/40 rounded-lg">
          <span className="text-purple-400 shrink-0 text-sm font-bold">{i + 1}.</span>
          <p className="text-gray-200 text-sm leading-relaxed">{q}</p>
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
    if (answers[i] === undefined) return i === cursor ? "bg-blue-400 scale-125" : "bg-gray-600";
    return answers[i] === allQuestions[i].correct_index ? "bg-green-500" : "bg-red-500";
  }

  return (
    <div className="space-y-4">

      {/* ── Navigation bar ── */}
      <div className="flex items-center justify-between gap-3">
        {/* Left arrow */}
        <button
          onClick={() => setCursor(c => c - 1)}
          disabled={cursor === 0}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
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
          <span className="text-xs text-gray-600">
            Q{cursor + 1} / {total}
            {total > 4 && <span className="ml-1.5 text-gray-700">· Round {Math.floor(cursor / 4) + 1}</span>}
          </span>
        </div>

        {/* Right arrow */}
        <button
          onClick={() => setCursor(c => c + 1)}
          disabled={cursor === total - 1 || !submitted}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          title={!submitted ? "Answer this question to continue" : ""}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>

      {/* ── Question card ── */}
      <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 space-y-3">
        <p className="text-sm font-medium text-gray-200 leading-relaxed">
          {q.question}
        </p>

        <div className="space-y-2">
          {q.options.map((opt, oi) => {
            let cls = "w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ";
            if (!submitted) {
              cls += "border-gray-600 text-gray-300 hover:border-blue-600 hover:bg-blue-900/20 hover:text-blue-200";
            } else if (oi === q.correct_index) {
              cls += "border-green-600 bg-green-900/30 text-green-200 font-medium";
            } else if (oi === selected) {
              cls += "border-red-600 bg-red-900/30 text-red-300";
            } else {
              cls += "border-gray-700 text-gray-500";
            }
            return (
              <button key={oi}
                onClick={() => !submitted && setAnswers(a => ({ ...a, [cursor]: oi }))}
                disabled={submitted}
                className={cls}
              >
                <span className="font-mono text-xs mr-2 opacity-50">{String.fromCharCode(65 + oi)}.</span>
                {opt}
                {submitted && oi === q.correct_index && <span className="ml-2 text-green-400">✓</span>}
                {submitted && oi === selected && oi !== q.correct_index && <span className="ml-2 text-red-400">✗</span>}
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {submitted && (
          <div className={`flex gap-2 px-3 py-2.5 rounded-lg text-xs ${
            isCorrect ? "bg-green-900/20 border border-green-800/40 text-green-300"
                      : "bg-orange-900/20 border border-orange-800/40 text-orange-300"
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
            batchCorrect === batchSize   ? "bg-green-900/30 border-green-700 text-green-300"
            : batchCorrect >= batchSize / 2 ? "bg-yellow-900/30 border-yellow-700 text-yellow-300"
            : "bg-red-900/30 border-red-700 text-red-300"
          }`}>
            <span className="text-sm font-semibold">
              Round {Math.floor(batchEnd / 4) + 1} complete
            </span>
            <span className="text-base font-bold">{batchCorrect} / {batchSize}</span>
          </div>

          {/* Generate more */}
          {moreError && <p className="text-xs text-red-400">{moreError}</p>}
          <button
            onClick={generateMore}
            disabled={loadingMore}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-blue-800 hover:border-blue-600 rounded-xl text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors"
          >
            {loadingMore
              ? <><span className="w-3.5 h-3.5 border border-blue-400 border-t-transparent rounded-full animate-spin" />Generating…</>
              : <>Generate 4 more <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg></>
            }
          </button>
        </div>
      )}

      {/* hint if unanswered and trying to go right */}
      {submitted === false && cursor < total - 1 && (
        <p className="text-xs text-gray-700 text-center">Answer to unlock the next question →</p>
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
      <div className="p-4 bg-gradient-to-r from-blue-950/50 to-indigo-950/50 border border-blue-800/50 rounded-xl">
        <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">TL;DR</p>
        <p className="text-sm text-blue-100 leading-relaxed">{d.tldr}</p>
      </div>

      {/* Real-world scenarios */}
      {d.real_world_scenarios?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">🌍 Real-World Scenarios</p>
          <div className="space-y-2">
            {d.real_world_scenarios.map((s, i) => (
              <div key={i} className="border border-gray-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenScenario(openScenario === i ? null : i)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800/60 transition-colors text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-orange-900/50 border border-orange-700 text-orange-300 text-xs flex items-center justify-center font-bold">{i + 1}</span>
                    <span className="text-sm font-medium text-gray-200 truncate">{s.title}</span>
                  </div>
                  <span className="text-gray-600 shrink-0 ml-2">{openScenario === i ? "▲" : "▼"}</span>
                </button>
                {openScenario === i && (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-800">
                    <p className="text-xs text-gray-400 leading-relaxed pt-3">{s.context}</p>
                    <div className="bg-green-950/25 border border-green-800/40 rounded-lg px-3 py-2.5">
                      <p className="text-xs font-semibold text-green-400 mb-1">How this concept applies</p>
                      <p className="text-xs text-green-200 leading-relaxed">{s.how_it_applies}</p>
                    </div>
                    <div className="bg-red-950/20 border border-red-800/30 rounded-lg px-3 py-2.5">
                      <p className="text-xs font-semibold text-red-400 mb-1">What breaks without it</p>
                      <p className="text-xs text-red-200 leading-relaxed">{s.what_breaks_without_it}</p>
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
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">🧠 Core Concepts In Depth</p>
          <div className="space-y-2">
            {d.core_concepts.map((c, i) => (
              <div key={i} className="border border-gray-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenConcept(openConcept === i ? null : i)}
                  className="w-full flex items-start justify-between px-4 py-3 hover:bg-gray-800/60 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-200">{c.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{c.one_liner}</p>
                  </div>
                  <span className="text-gray-600 shrink-0 ml-3 mt-0.5">{openConcept === i ? "▲" : "▼"}</span>
                </button>
                {openConcept === i && (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-800">
                    <p className="text-sm text-gray-300 leading-relaxed pt-3">{c.deep_explanation}</p>
                    <div className="flex gap-2 bg-amber-950/25 border border-amber-800/40 rounded-lg px-3 py-2.5">
                      <span className="shrink-0 text-amber-400">💡</span>
                      <div>
                        <p className="text-xs font-semibold text-amber-400 mb-0.5">Analogy</p>
                        <p className="text-xs text-amber-200 leading-relaxed">{c.analogy}</p>
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
        <div className="flex gap-3 bg-purple-950/25 border border-purple-800/40 rounded-xl px-4 py-3.5">
          <span className="text-purple-400 text-lg shrink-0">🗺️</span>
          <div>
            <p className="text-xs font-semibold text-purple-400 mb-1.5">Mental Model</p>
            <p className="text-sm text-purple-100 leading-relaxed">{d.mental_model}</p>
          </div>
        </div>
      )}

      {/* How experts think about it */}
      {d.how_experts_think_about_it && (
        <div className="flex gap-3 bg-emerald-950/25 border border-emerald-800/40 rounded-xl px-4 py-3.5">
          <span className="text-emerald-400 text-lg shrink-0">👷</span>
          <div>
            <p className="text-xs font-semibold text-emerald-400 mb-1.5">How Experts Think About It</p>
            <p className="text-sm text-emerald-100 leading-relaxed">{d.how_experts_think_about_it}</p>
          </div>
        </div>
      )}

      {/* Common misconceptions */}
      {d.common_misconceptions?.length > 0 && (
        <div className="bg-red-950/20 border border-red-800/30 rounded-xl px-4 py-3.5">
          <p className="text-xs font-semibold text-red-400 mb-2">⚠️ Common Misconceptions</p>
          <ul className="space-y-1.5">
            {d.common_misconceptions.map((m, i) => (
              <li key={i} className="flex gap-2 text-xs text-red-200 leading-relaxed">
                <span className="text-red-600 shrink-0 mt-0.5">✗</span>{m}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Rabbit holes */}
      {d.rabbit_holes?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">🐇 Rabbit Holes Worth Exploring</p>
          <div className="flex flex-wrap gap-2">
            {d.rabbit_holes.map((r, i) => (
              <span key={i} className="px-3 py-1.5 bg-gray-800 border border-gray-700 hover:border-blue-700 text-gray-300 rounded-full text-xs font-medium transition-colors cursor-default">
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
  const chatEndRef = useRef<HTMLDivElement>(null);

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

  // ── Loading / Error states ─────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{loadError}</p>
          <button onClick={() => router.back()} className="text-blue-400 text-sm hover:underline">← Go back</button>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 text-sm">Loading question…</p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => window.close()}
              className="shrink-0 text-gray-500 hover:text-gray-300 transition-colors text-sm flex items-center gap-1"
            >
              ✕
            </button>
            <div className="h-4 w-px bg-gray-800 shrink-0" />
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span className="text-xs font-medium px-1.5 py-0.5 bg-blue-900/40 border border-blue-800/60 text-blue-300 rounded">
                {question.topic}
              </span>
              {question.category && (
                <span className="text-xs font-medium px-1.5 py-0.5 bg-purple-900/30 border border-purple-800 text-purple-300 rounded">
                  {question.category}
                </span>
              )}
              <span className={`text-xs font-medium px-1.5 py-0.5 border rounded ${DIFF_COLORS[question.difficulty]}`}>
                {question.difficulty}
              </span>
              {question.company && (
                <span className="text-xs text-gray-500">@ {question.company}</span>
              )}
            </div>
          </div>

          {/* Model selector */}
          {modelGroups && (
            <select
              value={model}
              onChange={e => { setModel(e.target.value); localStorage.setItem("selectedModel", e.target.value); }}
              className="shrink-0 bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-600"
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
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden max-w-7xl mx-auto w-full">
        {/* ── Left panel ─────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto px-4 py-6 space-y-4 min-w-0">

          {/* Question card */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Question</span>
              <span className="text-xs text-gray-700">#{question.id}</span>
            </div>
            <p className="text-gray-100 text-base leading-relaxed">{question.question}</p>
          </div>

          {/* AI Sections */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider px-1">AI Study Tools</p>

            {SECTIONS.map(({ key, icon, label, desc }) => {
              const s = sections[key];
              return (
                <div key={key} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                  {/* Section header */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-base">{icon}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-200">{label}</p>
                        <p className="text-xs text-gray-600">{desc}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleSection(key)}
                      disabled={s.loading}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                        ${s.generated
                          ? "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600"
                          : "bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {s.loading ? (
                        <>
                          <span className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
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
                    <div className="border-t border-gray-800 px-4 py-4">
                      {s.error ? (
                        <div className="flex items-center gap-2">
                          <p className="text-red-400 text-sm flex-1">{s.error}</p>
                          <button
                            onClick={() => {
                              setSections(prev => ({ ...prev, [key]: { ...prev[key], generated: false } }));
                              toggleSection(key);
                            }}
                            className="text-xs text-blue-400 hover:underline shrink-0"
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

          {/* Notes */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">📝 My Notes</p>
              <span className="text-xs text-gray-700">auto-saved</span>
            </div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Jot down your thoughts, approach, or things to remember…"
              rows={5}
              className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-blue-600 transition-colors"
            />
          </div>

        </main>

        {/* ── Right sidebar: AI Chat ─────────────────────────────────── */}
        <aside className="w-80 shrink-0 border-l border-gray-800 flex flex-col bg-gray-900/50">
          <div className="p-4 border-b border-gray-800">
            <p className="text-sm font-semibold text-gray-200">🤖 AI Study Assistant</p>
            <p className="text-xs text-gray-600 mt-0.5">Ask anything about this question</p>
          </div>

          {/* Quick prompts */}
          {chatHistory.length === 0 && (
            <div className="p-3 border-b border-gray-800 space-y-1.5">
              <p className="text-xs text-gray-600 uppercase tracking-wider font-semibold px-1">Quick prompts</p>
              {QUICK_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => sendChat(prompt)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-600 text-xs text-gray-400 hover:text-gray-300 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {chatHistory.length === 0 && (
              <div className="text-center py-8 text-gray-700">
                <p className="text-2xl mb-2">💬</p>
                <p className="text-xs">Start a conversation or use a quick prompt above</p>
              </div>
            )}
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[90%] rounded-2xl px-3 py-2.5 text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-tr-sm"
                    : "bg-gray-800 border border-gray-700 text-gray-200 rounded-tl-sm"
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
                <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-tl-sm px-3 py-2.5">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-800">
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
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-blue-600 transition-colors"
              />
              <button
                onClick={() => sendChat(chatInput)}
                disabled={!chatInput.trim() || chatLoading}
                className="shrink-0 self-end w-8 h-8 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-colors"
              >
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            {chatHistory.length > 0 && (
              <button
                onClick={() => setChatHistory([])}
                className="mt-1.5 text-xs text-gray-700 hover:text-gray-500 transition-colors"
              >
                Clear chat
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
