"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart2,
  BookOpen,
  Mic,
  Zap,
  ChevronRight,
  Database,
  RefreshCw,
  Download,
  FileText,
} from "lucide-react";
import { api, Stats, TopicMastery, Session, Question, LearningProfileState } from "@/lib/api";
import { TopicRadar } from "@/components/dashboard/TopicRadar";
import {
  PageHeader,
  PageShell,
  Card,
  Badge,
  ScorePill,
  EmptyState,
  Section,
} from "@/components/ui/Shell";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ModelGroups {
  ollama: string[];
  deepseek: string[];
  deepseek_configured: boolean;
  gemini: string[];
  gemini_configured: boolean;
  default: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DEEPSEEK_LABELS: Record<string, string> = {
  "deepseek-chat": "DeepSeek V3 (Chat)",
  "deepseek-reasoner": "DeepSeek R1 (Reasoner)",
};

const GEMINI_LABELS: Record<string, string> = {
  "gemini-2.5-flash": "Gemini 2.5 Flash (free tier)",
  "gemini-flash-lite-latest": "Gemini 2.5 Flash-Lite (free tier, fastest)",
};

const BOARD_CATS = [
  { id: "dsa",                  label: "DSA" },
  { id: "system_design",        label: "System Design" },
  { id: "computer_vision",      label: "Computer Vision" },
  { id: "real_life_scenario",   label: "Real-Life Scenario" },
  { id: "large_scale_system",   label: "Large Scale System" },
  { id: "leadership_behavioral", label: "Leadership / Behavioral" },
];

const STATS_LAYOUT = [
  {
    label: "Missions Completed",
    value: (s: Stats) => s.sessions_completed,
    icon: <BarChart2 size={15} className="text-accent shrink-0" />,
  },
  {
    label: "Spoken Responses",
    value: (s: Stats) => s.total_answers,
    icon: <Mic size={15} className="text-status-ok shrink-0" />,
  },
  {
    label: "FAANG Avg Score",
    value: (s: Stats) => `${s.avg_score.toFixed(0)}/100`,
    icon: <Zap size={15} className="text-gold shrink-0" />,
  },
  {
    label: "Mastered Topics",
    value: (_: Stats, mastery: TopicMastery[]) => mastery.length,
    icon: <BookOpen size={15} className="text-text-muted shrink-0" />,
  },
];

const BOARD_FILTER_PANEL_ID = "board-filter-panel";

// ── Helpers ────────────────────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildSimplePdf(inputLines: string[]) {
  const sanitise = (text: string) =>
    text.normalize("NFKD").replace(/[^\x20-\x7E]/g, "?");
  const escapePdf = (text: string) =>
    sanitise(text).replace(/\\/g, "\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const wrap = (text: string, max = 88) => {
    if (!text) return [""];
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      if (!line) line = word;
      else if (`${line} ${word}`.length <= max) line += ` ${word}`;
      else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  const wrapped = inputLines.flatMap((line) => wrap(line));
  const pages: string[][] = [];
  for (let index = 0; index < wrapped.length; index += 48) {
    pages.push(wrapped.slice(index, index + 48));
  }

  const objects: string[] = ["", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  const pageObjectIds: number[] = [];

  for (const pageLines of pages) {
    const content = [
      "BT",
      "/F1 10 Tf",
      "50 790 Td",
      "14 TL",
      ...pageLines.flatMap((line, index) => [
        `(${escapePdf(line)}) Tj`,
        ...(index < pageLines.length - 1 ? ["T*"] : []),
      ]),
      "ET",
    ].join("\n");
    const pageId = objects.length + 1;
    const contentId = pageId + 1;
    pageObjectIds.push(pageId);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`,
      `<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}\nendstream`,
    );
  }

  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index++) {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

function xpProgress(totalXp: number) {
  const remainder = totalXp % 250;
  const pct = (remainder / 250) * 100;
  const remaining = 250 - remainder;
  return { pct, remaining, level: Math.floor(totalXp / 250) + 1 };
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [learningState, setLearningState] = useState<LearningProfileState | null>(null);
  const [mastery, setMastery] = useState<TopicMastery[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [topics, setTopics] = useState<{ topic: string; count: number }[]>([]);
  const [companies, setCompanies] = useState<{ company: string; count: number }[]>([]);
  const [modelGroups, setModelGroups] = useState<ModelGroups | null>(null);

  const [selectedTopic, setSelectedTopic] = useState("random");
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [followUpMode, setFollowUpMode] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");

  const [boardCats, setBoardCats] = useState<Set<string>>(new Set());
  const [boardQuestions, setBoardQuestions] = useState<Question[]>([]);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardError, setBoardError] = useState("");
  const [practiceMode, setPracticeMode] = useState(false);
  const [practiceSetNumber, setPracticeSetNumber] = useState<number | null>(null);
  const [cachedPracticeQuestions, setCachedPracticeQuestions] = useState<Question[]>([]);
  const [cachedPracticeSetNumber, setCachedPracticeSetNumber] = useState<number | null>(null);

  const fetchBoard = useCallback(async (cats: Set<string>) => {
    setPracticeMode(false);
    setPracticeSetNumber(null);
    setBoardError("");
    setBoardLoading(true);
    try {
      const labels = BOARD_CATS.filter((c) => cats.has(c.id)).map((c) => c.label);
      setBoardQuestions(
        await api.getRandomQuestions(labels.length > 0 ? labels : undefined),
      );
    } catch (error: unknown) {
      setBoardError(
        error instanceof Error ? error.message : "Could not load questions.",
      );
    } finally {
      setBoardLoading(false);
    }
  }, []);

  function nextPracticeSetNumber() {
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    const storageKey = "dailyPracticeSetCounter";
    let counter = { date: dateKey, count: 0 };
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { date?: string; count?: number };
        if (parsed.date === dateKey)
          counter = { date: dateKey, count: parsed.count ?? 0 };
      }
    } catch {
      /* start from zero */
    }
    counter.count += 1;
    localStorage.setItem(storageKey, JSON.stringify(counter));
    return counter.count;
  }

  async function fetchPracticeSet() {
    setBoardLoading(true);
    setBoardError("");
    try {
      const questions = await api.getPracticeSet();
      const setNum = nextPracticeSetNumber();
      setBoardQuestions(questions);
      setCachedPracticeQuestions(questions);
      setCachedPracticeSetNumber(setNum);
      setBoardCats(new Set());
      setPracticeMode(true);
      setPracticeSetNumber(setNum);
    } catch (error: unknown) {
      setPracticeMode(false);
      setPracticeSetNumber(null);
      setBoardError(
        error instanceof Error
          ? error.message
          : "Could not build the Practice Set.",
      );
    } finally {
      setBoardLoading(false);
    }
  }

  function practiceFilename(extension: "csv" | "pdf") {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = String(now.getFullYear()).slice(-2);
    return `Daily_practice_set_${day}_${month}_${year}_set_${
      practiceSetNumber ?? 1
    }.${extension}`;
  }

  function exportPracticeCSV() {
    const escape = (value: unknown) => {
      const text = String(value ?? "");
      return /[",\n]/.test(text)
        ? `"${text.replace(/"/g, '""')}"`
        : text;
    };
    const rows = boardQuestions.map((question, index) => [
      index + 1,
      question.practice_category ?? "",
      question.topic,
      question.question,
      question.difficulty,
      question.company ?? "General",
      question.category ?? "",
    ]);
    const csv = [
      [
        "number",
        "practice_category",
        "topic",
        "question",
        "difficulty",
        "company",
        "category",
      ],
      ...rows,
    ]
      .map((row) => row.map(escape).join(","))
      .join("\n");
    downloadBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      practiceFilename("csv"),
    );
  }

  function exportPracticePDF() {
    const lines = [
      `Daily Practice Set ${practiceSetNumber ?? 1}`,
      "",
      ...boardQuestions.flatMap((question, index) => [
        `${index + 1}. [${question.practice_category ?? "Random"}] ${question.question}`,
        `   Topic: ${question.topic} | Difficulty: ${question.difficulty} | Company: ${question.company ?? "General"}`,
        "",
      ]),
    ];
    downloadBlob(buildSimplePdf(lines), practiceFilename("pdf"));
  }

  useEffect(() => {
    Promise.all([
      api.getStats(),
      api.getMastery(),
      api.getSessions(),
      api.listTopics(),
      api.listCompanies(),
      api.getModels(),
      api.getLearningState(),
    ])
      .then(([s, m, sess, t, c, mg, ls]) => {
        setStats(s);
        setMastery(m);
        setSessions(sess);
        setTopics(t);
        setCompanies(c);
        setModelGroups(mg);
        setLearningState(ls as LearningProfileState);
        const saved = localStorage.getItem("selectedModel");
        setSelectedModel(
          saved && [...mg.ollama, ...mg.deepseek].includes(saved)
            ? saved
            : mg.default,
        );
      })
      .catch(() => {});
    fetchBoard(new Set());
  }, [fetchBoard]);

  useEffect(() => {
    if (practiceMode) return;
    fetchBoard(boardCats);
  }, [boardCats, fetchBoard, practiceMode]);

  function handleModelChange(model: string) {
    setSelectedModel(model);
    localStorage.setItem("selectedModel", model);
  }

  async function handleStart() {
    setStarting(true);
    setStartError("");
    try {
      const res = await api.startSession(
        selectedTopic,
        selectedModel,
        selectedCompany,
        undefined,
        followUpMode,
      );
      const label =
        selectedCompany === "all"
          ? selectedTopic
          : `${selectedCompany} · ${selectedTopic}`;
      router.push(
        `/interview/${res.session_id}?topic=${encodeURIComponent(label)}`,
      );
    } catch (error: unknown) {
      setStartError(
        error instanceof Error
          ? error.message
          : "Could not start the interview. Check that the backend and Ollama are running.",
      );
    } finally {
      setStarting(false);
    }
  }

  const isDeepSeek = selectedModel.startsWith("deepseek-");
  const isGemini = selectedModel.startsWith("gemini-");
  const isApiModel = isDeepSeek || isGemini;
  const deepSeekNotConfigured =
    isDeepSeek && modelGroups?.deepseek_configured === false;
  const geminiNotConfigured =
    isGemini && modelGroups?.gemini_configured === false;

  return (
    <div className="min-h-screen bg-surface-0">
      <PageShell>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <PageHeader
          title="Home"
          description="Your command center for algorithmic mastery, interview readiness, and daily practice."
        >
          <div className="flex items-center gap-3">
            <Badge variant="ok" dot>
              Daily goal: 1 mock
            </Badge>
          </div>
        </PageHeader>

        {/* ── Daily Mission Card ─────────────────────────────────────────── */}
        <Card className="overflow-hidden">
          <div className="relative">
            {/* Subtle accent stripe */}
            <div className="absolute right-0 top-0 bottom-0 w-1/3 max-w-[180px] bg-gradient-to-l from-accent/5 to-transparent pointer-events-none" />

            <div className="relative z-10 p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="accent">Recommended daily mission</Badge>
                    <span className="text-xs text-text-muted">
                      · 15 min · FAANG bar standard
                    </span>
                  </div>

                  <h2 className="text-lg font-semibold text-text-primary leading-snug tracking-tight">
                    Simulated Technical Screening: Distributed Systems &amp; Algorithms
                  </h2>
                  <p className="mt-1.5 text-sm text-text-secondary leading-relaxed">
                    A real-time voice interview with live AI evaluation across four
                    dimensions: technical correctness, architectural depth,
                    communication clarity, and problem-solving process.
                  </p>

                  {/* Mission parameters */}
                  <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    {/* Company */}
                    <label className="block">
                      <span className="text-[11px] text-text-muted font-medium">
                        Target company
                      </span>
                      <div className="mt-1">
                        <select
                          value={selectedCompany}
                          onChange={(e) => setSelectedCompany(e.target.value)}
                          className="w-full rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-text-primary ring-1 ring-transparent focus:border-accent/50 focus:ring-accent/25 focus:outline-none"
                        >
                          <option value="all">All companies</option>
                          {companies.map((company) => (
                            <option key={company.company} value={company.company}>
                              {company.company} ({company.count})
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>

                    {/* Topic */}
                    <label className="block">
                      <span className="text-[11px] text-text-muted font-medium">
                        Focus domain
                      </span>
                      <div className="mt-1">
                        <select
                          value={selectedTopic}
                          onChange={(e) => setSelectedTopic(e.target.value)}
                          className="w-full rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-text-primary ring-1 ring-transparent focus:border-accent/50 focus:ring-accent/25 focus:outline-none"
                        >
                          <option value="random">Random high-yield</option>
                          {topics.map((t) => (
                            <option key={t.topic} value={t.topic}>
                              {t.topic} ({t.count})
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>

                    {/* Model */}
                    <label className="block">
                      <span className="text-[11px] text-text-muted font-medium">
                        Interviewer core
                      </span>
                      <div className="mt-1">
                        <select
                          value={selectedModel}
                          onChange={(e) => handleModelChange(e.target.value)}
                          className="w-full rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-text-primary ring-1 ring-transparent focus:border-accent/50 focus:ring-accent/25 focus:outline-none"
                        >
                          {modelGroups?.ollama.length ? (
                            <optgroup label="Local (Ollama)">
                              {modelGroups.ollama.map((m) => (
                                <option key={m} value={m}>
                                  {m === "qwen2.5:latest"
                                    ? "Qwen 2.5 (Local)"
                                    : m}
                                </option>
                              ))}
                            </optgroup>
                          ) : null}
                          <optgroup label="Cloud API">
                            {(modelGroups?.gemini ?? [
                              "gemini-2.5-flash",
                              "gemini-flash-lite-latest",
                            ]).map((m) => (
                              <option key={m} value={m}>
                                {GEMINI_LABELS[m] ?? m}
                              </option>
                            ))}
                            {(modelGroups?.deepseek ?? ["deepseek-chat"]).map((m) => (
                              <option key={m} value={m}>
                                {DEEPSEEK_LABELS[m] ?? m}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Launch */}
                <div className="flex flex-col items-start gap-3 lg:items-end lg:flex-row lg:items-center lg:gap-3">
                  <button
                    type="button"
                    onClick={handleStart}
                    disabled={starting || deepSeekNotConfigured || geminiNotConfigured}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-surface-0 shadow-sm shadow-accent/25 transition-all disabled:cursor-not-allowed disabled:opacity-50 hover:bg-accent-bright hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Zap
                      size={16}
                      className={`shrink-0 ${starting ? "animate-spin text-text-secondary" : "text-gold"}`}
                    />
                    {starting ? "Preparing..." : "Start mission"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setFollowUpMode((v) => !v)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      followUpMode
                        ? "border-status-ok/40 bg-status-ok/8 text-status-ok"
                        : "border-border-subtle bg-surface-2 text-text-secondary hover:bg-surface-3"
                    }`}
                  >
                    <span
                      className={`size-2 rounded-full ${followUpMode ? "bg-status-ok" : "bg-text-muted"}`}
                    />
                    Follow-up coach
                    <Badge
                      variant={followUpMode ? "ok" : "muted"}
                      size="sm"
                      className="-ml-0.5"
                    >
                      {followUpMode ? "on" : "off"}
                    </Badge>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {startError && (
            <div className="mx-5 mb-4 rounded-xl border border-status-error/30 bg-status-error/5 px-4 py-2.5">
              <p className="text-xs text-status-error">{startError}</p>
            </div>
          )}
        </Card>

        {/* ── Progress overview ──────────────────────────────────────────── */}
        {learningState && (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* XP & Level — spans 2 cols on large */}
            <Card className="col-span-1 sm:col-span-2 lg:col-span-2" hover>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:items-start">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 ring-1 ring-accent/20">
                    <span className="text-xl font-bold text-accent">
                      L{learningState.level}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary">
                        Level {learningState.level}
                      </span>
                      <Badge variant="gold" size="sm">
                        {learningState.total_xp} XP
                      </Badge>
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">
                      {learningState.solved_count} problems solved
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 sm:justify-end">
                  <div className="w-32">
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="text-text-muted">Progress to next level</span>
                      <span className="text-text-muted font-medium">
                        {xpProgress(learningState.total_xp).remaining} XP remaining
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent to-gold"
                        style={{ width: `${xpProgress(learningState.total_xp).pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Streak */}
            <Card hover>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 ring-1 ring-gold/25">
                  <span className="text-lg">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                      className="text-gold"
                    >
                      <path
                        d="M12 2c0 4-4 6-4 10a4 4 0 0 0 8 0c0-4-4-6-4-10z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M12 6v4M12 14v2"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </div>
                <div>
                  <div className="text-xl font-bold text-gold tracking-tight">
                    {learningState.streak_days}
                  </div>
                  <div className="text-xs text-text-muted">day streak</div>
                </div>
              </div>
            </Card>

            {/* Nova message */}
            <Card hover={false} className="border-accent/15 bg-accent/[0.02]">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                    className="text-accent"
                  >
                    <path
                      d="M12 4l4 8h8v2h-8l4 8-4 8H8l-4-8h-8V12h8L12 4z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {learningState.nova_message}
                </p>
              </div>
            </Card>
          </div>
        )}

        {/* ── Daily quest + due revisions ────────────────────────────────── */}
        {learningState &&
          (learningState.daily_quest || learningState.due_revisions.length > 0) && (
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Daily quest */}
              {learningState.daily_quest && (
                <Section title="Daily quest">
                  <Card hover={true} className="cursor-pointer" onClick={() => router.push(`/practice/${learningState.daily_quest!.id}`)}>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="accent">Today&apos;s quest</Badge>
                        <Badge variant="neutral">
                          {learningState.daily_quest.topic}
                        </Badge>
                        <Badge
                          variant={
                            learningState.daily_quest.difficulty === "Easy"
                              ? "ok"
                              : learningState.daily_quest.difficulty === "Medium"
                                ? "gold"
                                : "error"
                          }
                        >
                          {learningState.daily_quest.difficulty}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium text-text-primary leading-relaxed line-clamp-2">
                        {learningState.daily_quest.question}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <span className="text-accent">→</span>
                        Open in practice mode
                      </div>
                    </div>
                  </Card>
                </Section>
              )}

              {/* Due revisions */}
              {learningState.due_revisions.length > 0 && (
                <Section
                  title={`Due for revision (${learningState.due_revisions.length})`}
                  description="Questions you practiced earlier and are due to revisit."
                >
                  <div className="flex flex-col gap-2">
                    {learningState.due_revisions.slice(0, 3).map((rev) => (
                      <Card
                        key={rev.id}
                        hover={true}
                        className="cursor-pointer"
                        onClick={() => router.push(`/practice/${rev.question_id}`)}
                      >
                        <div className="flex flex-col gap-1.5">
                          <p className="text-sm text-text-primary leading-snug line-clamp-1">
                            {rev.question}
                          </p>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-text-muted">{rev.topic}</span>
                            <Badge variant="gold" size="sm">
                              Review now
                            </Badge>
                          </div>
                        </div>
                      </Card>
                    ))}
                    {learningState.due_revisions.length > 3 && (
                      <p className="text-center text-xs text-text-muted pt-1">
                        +{learningState.due_revisions.length - 3} more due
                      </p>
                    )}
                  </div>
                </Section>
              )}
            </div>
          )}

        {/* ── Stats row ──────────────────────────────────────────────────── */}
        {stats && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STATS_LAYOUT.map((stat) => (
              <Card key={stat.label} hover={false} className="py-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-text-muted text-xs font-medium">
                    {stat.icon}
                    {stat.label}
                  </div>
                  <div className="text-xl font-bold text-text-primary tracking-tight">
                    {typeof stat.value === "function"
                      ? stat.value(stats, mastery)
                      : stat.value}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* ── Topic mastery + recent sessions ────────────────────────────── */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Topic mastery radar */}
          {mastery.length > 0 && (
            <Section title="Topic mastery" description="Your rolling average score per topic.">
              <Card hover={false} className="p-0 overflow-hidden">
                <div className="p-5">
                  <TopicRadar data={mastery} />
                </div>
              </Card>
            </Section>
          )}

          {/* Recent sessions */}
          <Section
            title="Recent sessions"
            description={`${sessions.length} total session${sessions.length !== 1 ? "s" : ""}`}
            action={
              sessions.length > 0 ? (
                <button
                  type="button"
                  onClick={() => router.push("/sessions")}
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent-bright"
                >
                  View all
                  <ChevronRight size={12} />
                </button>
              ) : null
            }
          >
            {sessions.length === 0 ? (
              <EmptyState
                icon="mic"
                title="No sessions yet"
                description="Your completed interviews will appear here."
                action={
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard")}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-surface-0 shadow-sm shadow-accent/20 transition-all hover:bg-accent-bright"
                  >
                    Start your first interview
                    <Zap size={12} className="text-gold" />
                  </button>
                }
              />
            ) : (
              <div className="flex flex-col gap-2">
                {sessions.slice(0, 5).map((s) => (
                  <Card
                    key={s.id}
                    hover
                    className="cursor-pointer"
                    onClick={() => router.push(`/dashboard/session/${s.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <ScorePill score={s.total_score} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {s.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-text-muted">
                            {formatDate(s.started_at)}
                          </span>
                          {s.topic && s.topic !== "random" && (
                            <Badge variant="accent" size="sm">
                              {s.topic}
                            </Badge>
                          )}                    <Badge
                      variant={s.status === "completed"
                        ? "ok"
                        : s.status === "active"
                          ? "accent"
                          : "muted"
                      }
                      size="sm"
                    >
                            {s.status}
                          </Badge>
                          {s.follow_up_mode && (
                            <Badge variant="ok" dot size="sm">
                              follow-up
                            </Badge>
                          )}
                        </div>
                      </div>
                      <ChevronRight
                        size={13}
                        className="shrink-0 text-text-muted group-hover:text-accent transition-colors"
                      />
                    </div>
                  </Card>
                ))}

                {sessions.length > 5 && (
                  <button
                    type="button"
                    onClick={() => router.push("/sessions")}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-subtle px-3 py-2 text-xs text-text-muted transition-colors hover:border-accent/40 hover:text-accent w-full"
                  >
                    +{sessions.length - 5} more sessions
                    <ChevronRight size={11} />
                  </button>
                )}
              </div>
            )}
          </Section>
        </div>

        {/* ── Question bank board ────────────────────────────────────────── */}
        <section className="mt-8">
          <div className="flex flex-col gap-1 mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-text-primary">
                Question bank
              </h2>
              <span className="text-xs text-text-muted">
                Browse, filter, and practice any saved question
              </span>
            </div>
          </div>

          <Card hover={false} className="!bg-surface-1/60">
            <div className="flex flex-col gap-4 p-5">
              {/* Header row */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Database
                    size={14}
                    className="text-accent shrink-0"
                  />
                  <span className="text-sm font-semibold text-text-primary">
                    Question bank
                  </span>
                  {boardQuestions.length > 0 && (
                    <Badge variant="muted" size="sm">
                      {practiceMode
                        ? `Practice set ${practiceSetNumber}`
                        : "10 random"}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {practiceMode && boardQuestions.length === 10 && (
                    <>
                      <button
                        type="button"
                        onClick={exportPracticeCSV}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary"
                      >
                        <Download size={11} />
                        CSV
                      </button>
                      <button
                        type="button"
                        onClick={exportPracticePDF}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary"
                      >
                        <FileText size={11} />
                        PDF
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      practiceMode ? fetchPracticeSet() : fetchBoard(boardCats)
                    }
                    disabled={boardLoading}
                    className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-3 hover:text-accent disabled:opacity-40"
                    title="Refresh"
                  >
                    <RefreshCw
                      size={14}
                      className={boardLoading ? "animate-spin" : ""}
                    />
                  </button>
                </div>
              </div>

              {/* Category filter pills */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (practiceMode) {
                      setPracticeMode(false);
                      setPracticeSetNumber(null);
                      fetchBoard(new Set());
                    } else if (cachedPracticeQuestions.length > 0) {
                      setBoardQuestions(cachedPracticeQuestions);
                      setPracticeSetNumber(cachedPracticeSetNumber);
                      setBoardCats(new Set());
                      setPracticeMode(true);
                    } else {
                      fetchPracticeSet();
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    practiceMode
                      ? "border-accent/40 bg-accent/10 text-accent"
                      : "border-border-subtle bg-surface-2 text-text-secondary hover:border-accent/30 hover:text-accent"
                  }`}
                >
                  Practice set
                </button>
                {BOARD_CATS.map((cat) => {
                  const active = boardCats.has(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setPracticeMode(false);
                        setPracticeSetNumber(null);
                        setBoardCats((p) => {
                          const n = new Set(p);
                          n.has(cat.id) ? n.delete(cat.id) : n.add(cat.id);
                          return n;
                        });
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? "border-accent/40 bg-accent/10 text-accent"
                          : "border-border-subtle bg-surface-2 text-text-secondary hover:border-border-default hover:text-text-primary"
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
                {(boardCats.size > 0 || practiceMode) && (
                  <button
                    type="button"
                    onClick={() => {
                      setPracticeMode(false);
                      setPracticeSetNumber(null);
                      setBoardCats(new Set());
                      fetchBoard(new Set());
                    }}
                    className="rounded-lg p-1 text-text-muted hover:text-text-secondary"
                    title="Clear filters"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      aria-hidden="true"
                      className="rounded-full border border-current"
                    >
                      <path
                        d="M3 3l6 6M9 3L3 9"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                )}
              </div>

              {boardError && (
                <div className="rounded-xl border border-status-error/30 bg-status-error/5 px-3 py-2">
                  <p className="text-xs text-status-error">{boardError}</p>
                </div>
              )}

              {boardLoading ? (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-14 rounded-xl border border-border-subtle bg-surface-2 animate-pulse"
                    />
                  ))}
                </div>
              ) : boardQuestions.length === 0 ? (
                <EmptyState
                  icon="database"
                  title="No questions in the bank yet"
                  description={
                    boardCats.size > 0
                      ? "Try clearing the category filter."
                      : "Generate and save some questions first."
                  }
                />
              ) : (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {boardQuestions.map((q, i) => (
                    <div
                      key={q.id}
                      onClick={() => window.open(`/practice/${q.id}`, "_blank")}
                      className="group flex items-start gap-3 rounded-xl border border-border-subtle bg-surface-2/80 p-4 transition-colors hover:border-accent/30 hover:bg-surface-2 cursor-pointer"
                    >
                      <span className="shrink-0 mt-0.5 text-xs font-mono text-text-muted">
                        {i + 1}.
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          {q.category && (
                            <Badge variant="gold" size="sm">
                              {q.category}
                            </Badge>
                          )}
                          {practiceMode && q.practice_category && (
                            <Badge variant="warn" size="sm">
                              {q.practice_category}
                            </Badge>
                          )}
                          <Badge variant="accent" size="sm" className="truncate max-w-[140px]">
                            {q.topic}
                          </Badge>
                          <Badge
                            variant={
                              q.difficulty === "Easy"
                                ? "ok"
                                : q.difficulty === "Medium"
                                  ? "gold"
                                  : "error"
                            }
                            size="sm"
                          >
                            {q.difficulty}
                          </Badge>
                        </div>
                        <p className="text-sm text-text-primary leading-snug line-clamp-2">
                          {q.question}
                        </p>
                        <div className="mt-2 flex items-center gap-1 text-xs text-text-muted group-hover:text-accent transition-colors">
                          Open in practice
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path
                              d="M5 12h14M13 5l7 7-7 7"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {boardQuestions.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    practiceMode ? fetchPracticeSet() : fetchBoard(boardCats)
                  }
                  disabled={boardLoading}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-subtle px-3 py-2 text-sm text-text-muted transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-40"
                >
                  <RefreshCw
                    size={12}
                    className={boardLoading ? "animate-spin" : ""}
                  />
                  {boardLoading
                    ? "Loading…"
                    : practiceMode
                      ? "Generate next practice set"
                      : "Load another 10 random"}
                </button>
              )}
            </div>
          </Card>
        </section>
      </PageShell>
    </div>
  );
}
