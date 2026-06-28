"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart2, BookOpen, Mic, Upload, Zap, ChevronDown, Database,
  Sparkles, RefreshCw, X, Download, FileText, Trash2,
} from "lucide-react";
import { api, Stats, TopicMastery, Session, Question } from "@/lib/api";
import { TopicRadar } from "@/components/dashboard/TopicRadar";

interface ModelGroups {
  ollama: string[];
  deepseek: string[];
  deepseek_configured: boolean;
  gemini: string[];
  gemini_configured: boolean;
  default: string;
}

const DEEPSEEK_LABELS: Record<string, string> = {
  "deepseek-chat": "DeepSeek V3 (Chat)",
  "deepseek-reasoner": "DeepSeek R1 (Reasoner)",
};

const GEMINI_LABELS: Record<string, string> = {
  "gemini-2.0-flash": "Gemini 2.0 Flash ⚡ (free tier)",
  "gemini-1.5-flash": "Gemini 1.5 Flash (free tier)",
};

const DIFF_COLORS: Record<string, string> = {
  Easy: "bg-green-900/50 text-green-300 border-green-800",
  Medium: "bg-yellow-900/50 text-yellow-300 border-yellow-800",
  Hard: "bg-red-900/50 text-red-300 border-red-800",
};

const BOARD_CATS = [
  { id: "dsa",                 label: "DSA" },
  { id: "system_design",       label: "System Design" },
  { id: "computer_vision",     label: "Computer Vision" },
  { id: "real_life_scenario",  label: "Real-Life Scenario-Based" },
  { id: "large_scale_system",  label: "Large Scale System" },
  { id: "leadership_behavioral", label: "Leadership / Behavioral" },
];

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
    sanitise(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
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

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [mastery, setMastery] = useState<TopicMastery[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [topics, setTopics] = useState<{ topic: string; count: number }[]>([]);
  const [companies, setCompanies] = useState<{ company: string; count: number }[]>([]);
  const [modelGroups, setModelGroups] = useState<ModelGroups | null>(null);

  const [selectedTopic, setSelectedTopic] = useState("random");
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");

  // ── question bank board ───────────────────────────────────────────────────────
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
      setBoardQuestions(await api.getRandomQuestions(labels.length > 0 ? labels : undefined));
    } catch (error: unknown) {
      setBoardError(error instanceof Error ? error.message : "Could not load questions.");
    }
    finally { setBoardLoading(false); }
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
        if (parsed.date === dateKey) counter = { date: dateKey, count: parsed.count ?? 0 };
      }
    } catch { /* start from zero */ }
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
      setBoardError(error instanceof Error ? error.message : "Could not build the Practice Set.");
    } finally {
      setBoardLoading(false);
    }
  }

  function practiceFilename(extension: "csv" | "pdf") {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = String(now.getFullYear()).slice(-2);
    return `Daily_practice_set_${day}_${month}_${year}_set_${practiceSetNumber ?? 1}.${extension}`;
  }

  function exportPracticeCSV() {
    const escape = (value: unknown) => {
      const text = String(value ?? "");
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
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
      ["number", "practice_category", "topic", "question", "difficulty", "company", "category"],
      ...rows,
    ].map((row) => row.map(escape).join(",")).join("\n");
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), practiceFilename("csv"));
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
    ])
      .then(([s, m, sess, t, c, mg]) => {
        setStats(s);
        setMastery(m);
        setSessions(sess);
        setTopics(t);
        setCompanies(c);
        setModelGroups(mg);
        const saved = localStorage.getItem("selectedModel");
        setSelectedModel(saved && [...mg.ollama, ...mg.deepseek].includes(saved) ? saved : mg.default);
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
      const res = await api.startSession(selectedTopic, selectedModel, selectedCompany);
      const label = selectedCompany === "all"
        ? selectedTopic
        : `${selectedCompany} · ${selectedTopic}`;
      router.push(`/interview/${res.session_id}?topic=${encodeURIComponent(label)}`);
    } catch (error: unknown) {
      setStartError(
        error instanceof Error
          ? error.message
          : "Could not start the interview. Check that the backend and Ollama are running."
      );
    } finally {
      setStarting(false);
    }
  }

  const isDeepSeek = selectedModel.startsWith("deepseek-");
  const isGemini = selectedModel.startsWith("gemini-");
  const isApiModel = isDeepSeek || isGemini;
  const deepSeekNotConfigured = isDeepSeek && modelGroups && !modelGroups.deepseek_configured;
  const geminiNotConfigured = isGemini && modelGroups && !modelGroups.gemini_configured;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Voice Learning AI</h1>
            <p className="text-gray-400 text-sm mt-0.5">Local voice assessment • FAANG level</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push("/database")}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300">
              <Database size={14} /> DB
            </button>
            <button onClick={() => router.push("/generate")}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-900/60 hover:bg-blue-900 border border-blue-800 rounded-lg text-sm text-blue-300">
              <Sparkles size={14} /> Generate
            </button>
            <button onClick={() => router.push("/settings")}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm">
              Settings
            </button>
          </div>
        </div>

        {/* Start session card */}
        <div className="bg-gradient-to-br from-blue-900/40 to-purple-900/40 border border-blue-800/50 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Mic size={18} /> Start Session</h2>

          <div className="flex gap-3 flex-wrap items-start">
            {/* Company picker */}
            <div className="flex-1 min-w-40">
              <label className="text-xs text-gray-400 mb-1.5 block">Company</label>
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm"
              >
                <option value="all">All companies</option>
                {companies.map((company) => (
                  <option key={company.company} value={company.company}>
                    {company.company} ({company.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Topic picker */}
            <div className="flex-1 min-w-40">
              <label className="text-xs text-gray-400 mb-1.5 block">Topic</label>
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm"
              >
                <option value="random">🎲 Random Mix</option>
                {topics.map((t) => (
                  <option key={t.topic} value={t.topic}>{t.topic} ({t.count})</option>
                ))}
              </select>
            </div>

            {/* Model picker — grouped by provider */}
            <div className="flex-1 min-w-52">
              <label className="text-xs text-gray-400 mb-1.5 block">
                Choose AI model
                {isApiModel ? (
                  <span className="ml-2 px-1.5 py-0.5 bg-blue-900 text-blue-300 rounded text-xs">API</span>
                ) : (
                  <span className="ml-2 px-1.5 py-0.5 bg-green-900 text-green-300 rounded text-xs">Local</span>
                )}
              </label>
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 pr-8 text-sm"
                >
                  {modelGroups?.ollama.length ? (
                    <optgroup label="Ollama — installed locally">
                      {modelGroups.ollama.map((m) => (
                        <option key={m} value={m}>
                          {m === "qwen2.5:latest" ? "Qwen 2.5 (qwen2.5:latest)" : m}
                        </option>
                      ))}
                    </optgroup>
                  ) : (
                    <option value="" disabled>No local Ollama models found</option>
                  )}
                  <optgroup label="Google Gemini — API (free tier)">
                    {(modelGroups?.gemini ?? ["gemini-2.0-flash", "gemini-1.5-flash"]).map((m) => (
                      <option key={m} value={m}>
                        {GEMINI_LABELS[m] ?? m}
                        {!modelGroups?.gemini_configured ? " ⚠ key needed" : ""}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="DeepSeek — API">
                    {(modelGroups?.deepseek ?? ["deepseek-chat", "deepseek-reasoner"]).map((m) => (
                      <option key={m} value={m}>
                        {DEEPSEEK_LABELS[m] ?? m}
                        {!modelGroups?.deepseek_configured ? " ⚠ key needed" : ""}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              {!isApiModel && selectedModel && (
                <p className="text-xs text-green-400 mt-1.5">
                  Installed locally • This model will run the interview
                </p>
              )}
              {geminiNotConfigured && (
                <p className="text-xs text-yellow-400 mt-1.5">
                  Add your Gemini API key in{" "}
                  <button onClick={() => router.push("/settings")} className="underline hover:text-yellow-300">
                    Settings
                  </button>{" "}
                  first.
                </p>
              )}
              {deepSeekNotConfigured && (
                <p className="text-xs text-yellow-400 mt-1.5">
                  Add your DeepSeek API key in{" "}
                  <button onClick={() => router.push("/settings")} className="underline hover:text-yellow-300">
                    Settings
                  </button>{" "}
                  first.
                </p>
              )}
            </div>

            {/* Start button */}
            <div className="self-end">
              <button
                onClick={handleStart}
                disabled={starting || !!deepSeekNotConfigured || !!geminiNotConfigured}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-medium text-sm"
              >
                <Zap size={16} />
                {starting ? "Starting..." : "Start"}
              </button>
            </div>
          </div>
          {startError && (
            <p className="mt-3 text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
              {startError}
            </p>
          )}
        </div>

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Sessions", value: stats.sessions_completed, icon: <BarChart2 size={18} /> },
              { label: "Answers", value: stats.total_answers, icon: <Mic size={18} /> },
              { label: "Avg Score", value: `${stats.avg_score}/100`, icon: <Zap size={18} /> },
              { label: "Topics", value: mastery.length, icon: <BookOpen size={18} /> },
            ].map((s) => (
              <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">{s.icon}{s.label}</div>
                <div className="text-2xl font-bold">{s.value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Radar */}
          {mastery.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-4">Topic Mastery</h3>
              <TopicRadar data={mastery} />
            </div>
          )}

          {/* Recent sessions */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-300">Recent Sessions</h3>
              <div className="flex items-center gap-2">
                {sessions.length > 0 && (
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete all ${sessions.length} session${sessions.length > 1 ? "s" : ""}? This cannot be undone.`)) return;
                      await api.deleteAllSessions(sessions.map(s => s.id));
                      setSessions([]);
                    }}
                    className="text-xs text-red-500 hover:text-red-400 flex items-center gap-1 transition-colors"
                  >
                    <Trash2 size={11} /> Clear all
                  </button>
                )}
                <button onClick={() => router.push("/settings")}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  <Upload size={12} /> Upload CSV
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {sessions.slice(0, 6).map((s) => (
                <div key={s.id}
                  className="flex items-center justify-between py-2.5 px-3 bg-gray-800 hover:bg-gray-750 rounded-xl group">
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => router.push(`/dashboard/session/${s.id}`)}
                  >
                    <p className="text-sm text-gray-200">{s.title}</p>
                    <p className="text-xs text-gray-500">{new Date(s.started_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.total_score != null && (
                      <span className={`text-sm font-bold ${
                        s.total_score >= 80 ? "text-green-400" : s.total_score >= 60 ? "text-yellow-400" : "text-red-400"
                      }`}>{s.total_score.toFixed(0)}</span>
                    )}
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm("Delete this session? This cannot be undone.")) return;
                        await api.deleteSession(s.id);
                        setSessions(prev => prev.filter(x => x.id !== s.id));
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-900/20 transition-all"
                      title="Delete session"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
              {sessions.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">No sessions yet — start your first interview!</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Question Bank Board ────────────────────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <Database size={14} className="text-blue-400" />
              Question Bank
              {boardQuestions.length > 0 && (
                <span className="px-1.5 py-0.5 bg-gray-800 rounded text-xs text-gray-400">
                  {practiceMode ? `Practice Set ${practiceSetNumber}` : "10 random"}
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              {practiceMode && boardQuestions.length === 10 && (
                <>
                  <button onClick={exportPracticeCSV}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs text-gray-300">
                    <Download size={12} /> CSV
                  </button>
                  <button onClick={exportPracticePDF}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs text-gray-300">
                    <FileText size={12} /> PDF
                  </button>
                </>
              )}
              <button
                onClick={() => practiceMode ? fetchPracticeSet() : fetchBoard(boardCats)}
                disabled={boardLoading}
                className="p-1.5 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-blue-900/20 disabled:opacity-40 transition-colors"
                title="Refresh"
              >
                <RefreshCw size={15} className={boardLoading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Category filter pills */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
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
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                practiceMode
                  ? "bg-purple-900/50 border-purple-700 text-purple-200"
                  : "bg-gray-800 border-gray-700 text-gray-400 hover:border-purple-700 hover:text-purple-300"
              }`}
            >
              Practice Set
            </button>
            {BOARD_CATS.map((cat) => {
              const active = boardCats.has(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setPracticeMode(false);
                    setPracticeSetNumber(null);
                    setBoardCats((p) => { const n = new Set(p); n.has(cat.id) ? n.delete(cat.id) : n.add(cat.id); return n; });
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    active
                      ? "bg-blue-900/40 border-blue-700 text-blue-300"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300"
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
            {(boardCats.size > 0 || practiceMode) && (
              <button
                onClick={() => { setPracticeMode(false); setPracticeSetNumber(null); setBoardCats(new Set()); fetchBoard(new Set()); }}
                className="px-2 py-1.5 rounded-lg text-xs text-gray-600 hover:text-gray-400 border border-transparent hover:border-gray-700 transition-colors"
              >
                <X size={11} />
              </button>
            )}
          </div>

          {boardError && (
            <div className="mb-4 px-3 py-2 bg-red-950/40 border border-red-900 rounded-lg text-sm text-red-300">
              {boardError}
            </div>
          )}

          {boardLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-14 bg-gray-800 rounded-xl animate-pulse border border-gray-700" />
              ))}
            </div>
          ) : boardQuestions.length === 0 ? (
            <div className="text-center py-8 text-gray-600 text-sm">
              <Database size={28} className="mx-auto mb-2 opacity-40" />
              No questions in the bank yet.{boardCats.size > 0 ? " Try clearing the category filter." : " Generate and save some questions first."}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {boardQuestions.map((q, i) => (
                <div
                  key={q.id}
                  onClick={() => window.open(`/practice/${q.id}`, "_blank")}
                  className="bg-gray-800 border border-gray-700 rounded-xl p-3 cursor-pointer hover:border-blue-700 hover:bg-gray-750 transition-colors group"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-gray-600 font-mono shrink-0 mt-0.5 w-5">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        {q.category && (
                          <span className="text-xs font-medium text-purple-300 bg-purple-900/30 border border-purple-800 rounded px-1.5 py-0.5 truncate max-w-[160px]">
                            {q.category}
                          </span>
                        )}
                        {practiceMode && q.practice_category && (
                          <span className="text-xs font-medium text-amber-300 bg-amber-900/30 border border-amber-800 rounded px-1.5 py-0.5">
                            {q.practice_category}
                          </span>
                        )}
                        <span className="text-xs font-medium text-blue-300 bg-blue-900/30 border border-blue-800/50 rounded px-1.5 py-0.5 truncate max-w-[120px]">
                          {q.topic}
                        </span>
                        <span className={`text-xs font-medium border rounded px-1.5 py-0.5 ${DIFF_COLORS[q.difficulty]}`}>
                          {q.difficulty}
                        </span>
                      </div>
                      <p className="text-sm text-gray-200 leading-snug line-clamp-2">{q.question}</p>
                      <p className="text-xs text-gray-600 group-hover:text-blue-500 mt-1.5 transition-colors">Practice →</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {boardQuestions.length > 0 && (
            <button
              onClick={() => practiceMode ? fetchPracticeSet() : fetchBoard(boardCats)}
              disabled={boardLoading}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2 border border-dashed border-gray-700 hover:border-blue-600 hover:text-blue-400 rounded-xl text-sm text-gray-500 disabled:opacity-40 transition-colors"
            >
              <RefreshCw size={13} />
              {boardLoading ? "Loading…" : practiceMode ? "Generate next Practice Set" : "Load another 10 random"}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
