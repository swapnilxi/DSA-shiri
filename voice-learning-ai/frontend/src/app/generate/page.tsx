"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, FileText, List, Upload, Sparkles,
  CheckCircle, AlertCircle, ChevronDown, Clock,
} from "lucide-react";
import { api, GeneratedQuestion } from "@/lib/api";

type Mode = "file" | "topics";
type Difficulty = "Mixed" | "Easy" | "Medium" | "Hard";

interface ModelGroups {
  ollama: string[];
  deepseek: string[];
  deepseek_configured: boolean;
  default: string;
}

interface HistoryEntry {
  id: number;
  filename: string;
  questions_generated: number;
  uploaded_at: string;
}

const DIFF_COLORS: Record<string, string> = {
  Easy: "bg-green-900/50 text-green-300 border-green-800",
  Medium: "bg-yellow-900/50 text-yellow-300 border-yellow-800",
  Hard: "bg-red-900/50 text-red-300 border-red-800",
};

export default function GeneratePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>("file");
  const [file, setFile] = useState<File | null>(null);
  const [topics, setTopics] = useState("");
  const [numQuestions, setNumQuestions] = useState(10);
  const [difficulty, setDifficulty] = useState<Difficulty>("Mixed");
  const [model, setModel] = useState("");
  const [modelGroups, setModelGroups] = useState<ModelGroups | null>(null);

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{
    questions: GeneratedQuestion[];
    inserted: number;
    skipped: number;
    source: string;
  } | null>(null);
  const [error, setError] = useState("");

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    api.getModels().then((mg) => {
      setModelGroups(mg);
      const saved = localStorage.getItem("selectedModel");
      const all = [...mg.ollama, ...mg.deepseek];
      setModel(saved && all.includes(saved) ? saved : mg.default);
    }).catch(() => {});
    api.getGenerateHistory().then(setHistory).catch(() => {});
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
    setError("");
  }

  async function handleGenerate() {
    setError("");
    setResult(null);

    if (mode === "file" && !file) {
      setError("Please select a file first.");
      return;
    }
    if (mode === "topics" && !topics.trim()) {
      setError("Please enter at least one topic.");
      return;
    }

    setGenerating(true);
    try {
      const fd = new FormData();
      if (mode === "file" && file) {
        fd.append("file", file);
      } else {
        fd.append("topics", topics);
      }
      fd.append("num_questions", String(numQuestions));
      fd.append("difficulty", difficulty);
      fd.append("model", model);

      const res = await api.generateQuestions(fd);
      setResult(res);
      // Refresh history
      api.getGenerateHistory().then(setHistory).catch(() => {});
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  const canGenerate = mode === "file" ? !!file : !!topics.trim();

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm"
          >
            <ArrowLeft size={15} /> Dashboard
          </button>
        </div>

        <div className="mb-6">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Sparkles size={20} className="text-blue-400" />
            Generate Interview Questions
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Upload a resume, paste topics, or drop any document — the AI will
            create tailored interview questions and save them to your question bank.
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => { setMode("file"); setResult(null); setError(""); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
              mode === "file"
                ? "bg-blue-700 border-blue-600 text-white"
                : "bg-gray-900 border-gray-700 text-gray-400 hover:text-white"
            }`}
          >
            <FileText size={15} /> Upload File
          </button>
          <button
            onClick={() => { setMode("topics"); setResult(null); setError(""); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
              mode === "topics"
                ? "bg-blue-700 border-blue-600 text-white"
                : "bg-gray-900 border-gray-700 text-gray-400 hover:text-white"
            }`}
          >
            <List size={15} /> Enter Topics
          </button>
        </div>

        {/* Input card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
          {mode === "file" ? (
            <>
              <p className="text-xs text-gray-500 mb-3">
                Supported formats: <span className="text-gray-300">PDF, DOCX, TXT</span>
              </p>
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-700 hover:border-blue-600 rounded-xl p-8 flex flex-col items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <Upload size={28} />
                <span className="text-sm font-medium">
                  {file ? file.name : "Click to choose a file"}
                </span>
                {file && (
                  <span className="text-xs text-gray-500">
                    {(file.size / 1024).toFixed(0)} KB
                  </span>
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt,.md"
                className="hidden"
                onChange={handleFileChange}
              />
            </>
          ) : (
            <>
              <label className="text-xs text-gray-400 mb-2 block">
                Topics, skills, or any context (one per line or comma-separated)
              </label>
              <textarea
                value={topics}
                onChange={(e) => { setTopics(e.target.value); setResult(null); setError(""); }}
                placeholder={`e.g.\nSystem Design — distributed systems, caching\nAlgorithms — dynamic programming, graphs\nBehavioral — leadership, conflict resolution`}
                rows={7}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm placeholder-gray-600 focus:outline-none focus:border-blue-600 resize-none"
              />
            </>
          )}
        </div>

        {/* Controls */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
          <div className="flex flex-wrap gap-4">
            {/* Number of questions */}
            <div className="flex-1 min-w-36">
              <label className="text-xs text-gray-400 mb-1.5 block">Questions to generate</label>
              <input
                type="number"
                min={1}
                max={30}
                value={numQuestions}
                onChange={(e) => setNumQuestions(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Difficulty */}
            <div className="flex-1 min-w-36">
              <label className="text-xs text-gray-400 mb-1.5 block">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm"
              >
                <option value="Mixed">Mixed</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            {/* Model */}
            <div className="flex-1 min-w-48">
              <label className="text-xs text-gray-400 mb-1.5 block">AI Model</label>
              <div className="relative">
                <select
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value);
                    localStorage.setItem("selectedModel", e.target.value);
                  }}
                  className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 pr-8 text-sm"
                >
                  {modelGroups?.ollama.length ? (
                    <optgroup label="Ollama — local">
                      {modelGroups.ollama.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </optgroup>
                  ) : (
                    <option value="" disabled>No local models</option>
                  )}
                  <optgroup label="DeepSeek — API">
                    {(modelGroups?.deepseek ?? ["deepseek-chat", "deepseek-reasoner"]).map((m) => (
                      <option key={m} value={m}>
                        {m}{!modelGroups?.deepseek_configured ? " ⚠ key needed" : ""}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={generating || !canGenerate}
          className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-medium text-sm mb-4 transition-colors"
        >
          <Sparkles size={16} />
          {generating ? "Generating questions…" : "Generate Questions"}
        </button>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-4 bg-red-900/30 border border-red-800 rounded-xl text-sm text-red-300 mb-4">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                <CheckCircle size={15} className="text-green-400" />
                Generated from &quot;{result.source}&quot;
              </h2>
              <div className="flex gap-3 text-xs text-gray-400">
                <span className="text-green-400 font-medium">+{result.inserted} new</span>
                {result.skipped > 0 && <span>{result.skipped} already existed</span>}
              </div>
            </div>

            <div className="space-y-3">
              {result.questions.map((q, i) => (
                <div
                  key={i}
                  className="bg-gray-800 rounded-xl p-4 border border-gray-700"
                >
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs font-medium text-blue-300 bg-blue-900/40 border border-blue-800 rounded px-2 py-0.5">
                      {q.topic}
                    </span>
                    <span className={`text-xs font-medium border rounded px-2 py-0.5 ${DIFF_COLORS[q.difficulty]}`}>
                      {q.difficulty}
                    </span>
                    {q.category && (
                      <span className="text-xs text-gray-500">{q.category}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-200 leading-relaxed">{q.question}</p>
                  {q.expected_keywords && (
                    <p className="text-xs text-gray-500 mt-2">
                      Keywords: {q.expected_keywords}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <Clock size={14} /> Past Generations
            </h2>
            <div className="space-y-2">
              {history.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2.5 text-sm"
                >
                  <span className="text-gray-300 truncate max-w-xs">{h.filename}</span>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className="text-blue-400 font-medium text-xs">
                      {h.questions_generated}q
                    </span>
                    <span className="text-gray-500 text-xs">
                      {new Date(h.uploaded_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
