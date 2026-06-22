"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, FileText, List, Upload, Sparkles,
  CheckCircle, AlertCircle, ChevronDown,
  Save, Trash2, BookOpen, X, Plus, Download,
} from "lucide-react";
import { api, GeneratedQuestion, ResumeEntry } from "@/lib/api";

type Mode = "library" | "topics";
type Difficulty = "Mixed" | "Easy" | "Medium" | "Hard";

interface ModelGroups {
  ollama: string[];
  deepseek: string[];
  deepseek_configured: boolean;
  default: string;
}

const DIFF_COLORS: Record<string, string> = {
  Easy: "bg-green-900/50 text-green-300 border-green-800",
  Medium: "bg-yellow-900/50 text-yellow-300 border-yellow-800",
  Hard: "bg-red-900/50 text-red-300 border-red-800",
};

export default function GeneratePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const addFileRef = useRef<HTMLInputElement>(null);

  // ── library state ───────────────────────────────────────────────────────────
  const [library, setLibrary] = useState<ResumeEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [addingFile, setAddingFile] = useState(false);

  // ── input mode ──────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>("library");
  const [file, setFile] = useState<File | null>(null);
  const [topics, setTopics] = useState("");

  // ── generation controls ──────────────────────────────────────────────────────
  const [numQuestions, setNumQuestions] = useState(10);
  const [difficulty, setDifficulty] = useState<Difficulty>("Mixed");
  const [model, setModel] = useState("");
  const [modelGroups, setModelGroups] = useState<ModelGroups | null>(null);

  // ── results ──────────────────────────────────────────────────────────────────
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ questions: GeneratedQuestion[]; source: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<{ inserted: number; skipped: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getModels().then((mg) => {
      setModelGroups(mg);
      const saved = localStorage.getItem("selectedModel");
      const all = [...mg.ollama, ...mg.deepseek];
      setModel(saved && all.includes(saved) ? saved : mg.default);
    }).catch(() => {});
    loadLibrary();
  }, []);

  function loadLibrary() {
    api.getResumeLibrary().then(setLibrary).catch(() => {});
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await api.deleteResume(id);
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      setLibrary((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  }

  async function handleAddFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = "";
    setAddingFile(true);
    setError("");
    try {
      const entry = await api.uploadToLibrary(f);
      loadLibrary();
      // Auto-select the newly added file
      setSelectedIds((prev) => new Set([...prev, entry.id]));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAddingFile(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
    setSaveStatus(null);
    setError("");
  }

  async function handleGenerate() {
    setError("");
    setResult(null);
    setSaveStatus(null);
    setGenerating(true);
    try {
      if (mode === "library") {
        if (selectedIds.size === 0) {
          setError("Select at least one file from the library.");
          return;
        }
        const res = await api.generateFromIds({
          resume_ids: [...selectedIds],
          num_questions: numQuestions,
          difficulty,
          model,
        });
        setResult({ questions: res.questions, source: res.source });
      } else {
        if (!topics.trim()) {
          setError("Please enter at least one topic.");
          return;
        }
        if (selectedIds.size > 0) {
          const res = await api.generateFromIds({
            resume_ids: [...selectedIds],
            num_questions: numQuestions,
            difficulty,
            model,
            topics,
          });
          setResult({ questions: res.questions, source: res.source });
        } else {
          const fd = new FormData();
          fd.append("topics", topics);
          fd.append("num_questions", String(numQuestions));
          fd.append("difficulty", difficulty);
          fd.append("model", model);
          const res = await api.generateQuestions(fd);
          setResult({ questions: res.questions, source: res.source });
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  function handleRemoveQuestion(index: number) {
    setResult((prev) => {
      if (!prev) return prev;
      const updated = prev.questions.filter((_, i) => i !== index);
      return { ...prev, questions: updated };
    });
    setSaveStatus(null);
  }

  function handleExportCSV() {
    if (!result) return;
    const escape = (v: string) =>
      v.includes(",") || v.includes('"') || v.includes("\n")
        ? `"${v.replace(/"/g, '""')}"` : v;
    const headers = "topic,question,difficulty,category,expected_keywords";
    const lines = result.questions.map((q) =>
      [q.topic, q.question, q.difficulty, q.category || "", q.expected_keywords || ""]
        .map(escape).join(",")
    );
    const csv = [headers, ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "generated_questions.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    setSaveStatus(null);
    setError("");
    try {
      const res = await api.saveQuestions(result.questions, result.source);
      setSaveStatus(res);
      if (res.skipped > 0) {
        console.warn(`[duplicates] ${res.skipped} question(s) already exist in DB and were skipped.`);
      }
      loadLibrary();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const canGenerate =
    mode === "library" ? selectedIds.size > 0 : !!topics.trim();

  const alreadySaved = saveStatus !== null;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push("/dashboard")}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm">
            <ArrowLeft size={15} /> Dashboard
          </button>
        </div>

        <div className="mb-6">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Sparkles size={20} className="text-blue-400" />
            Generate Interview Questions
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Select files from your library or enter topics — review questions, then save to your bank.
          </p>
        </div>

        {/* ── Library (resumes + files) ─────────────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <BookOpen size={14} className="text-blue-400" />
              Library — Resumes &amp; Files
              {library.length > 0 && (
                <span className="px-1.5 py-0.5 bg-gray-800 rounded text-xs text-gray-400">
                  {library.length}
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <button onClick={() => setSelectedIds(new Set())}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300">
                  <X size={11} /> Clear
                </button>
              )}
              {/* Add file to library */}
              <button
                onClick={() => addFileRef.current?.click()}
                disabled={addingFile}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 border border-gray-700 rounded-lg text-xs text-gray-300"
              >
                {addingFile ? (
                  <span className="animate-pulse">Adding…</span>
                ) : (
                  <><Plus size={12} /> Add file</>
                )}
              </button>
              <input ref={addFileRef} type="file" accept=".pdf,.docx,.doc,.txt,.md"
                className="hidden" onChange={handleAddFile} />
            </div>
          </div>

          {library.length === 0 ? (
            <div
              onClick={() => addFileRef.current?.click()}
              className="border-2 border-dashed border-gray-700 hover:border-blue-600 rounded-xl p-6 flex flex-col items-center gap-2 text-gray-500 hover:text-gray-300 cursor-pointer transition-colors"
            >
              <Upload size={22} />
              <span className="text-sm">Click to add your first resume or file</span>
              <span className="text-xs text-gray-600">PDF, DOCX, TXT supported</span>
            </div>
          ) : (
            <>
              <div className="space-y-2 mb-3">
                {library.map((r) => {
                  const selected = selectedIds.has(r.id);
                  return (
                    <div
                      key={r.id}
                      onClick={() => { toggleSelect(r.id); if (mode !== "topics") setMode("library"); }}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer border transition-colors ${
                        selected
                          ? "bg-blue-900/30 border-blue-700"
                          : "bg-gray-800 border-gray-700 hover:border-gray-600"
                      }`}
                    >
                      {/* Checkbox */}
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        selected ? "bg-blue-600 border-blue-500" : "border-gray-600"
                      }`}>
                        {selected && (
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                            <path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200 truncate">{r.filename}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-500">
                            {new Date(r.uploaded_at).toLocaleDateString()}
                          </span>
                          {r.questions_generated > 0 && (
                            <span className="text-xs text-blue-400">
                              {r.questions_generated}q generated
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
                        disabled={deletingId === r.id}
                        className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/20 disabled:opacity-40 shrink-0 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Inline add-file row */}
              <button
                onClick={() => addFileRef.current?.click()}
                disabled={addingFile}
                className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-gray-700 hover:border-blue-600 hover:text-blue-400 rounded-xl text-sm text-gray-500 disabled:opacity-40 transition-colors"
              >
                <Plus size={14} />
                {addingFile ? "Adding file…" : "Add another file"}
              </button>
            </>
          )}

          {selectedIds.size > 0 && (
            <p className="text-xs text-blue-400 mt-3">
              {selectedIds.size} file{selectedIds.size !== 1 ? "s" : ""} selected
            </p>
          )}
        </div>

        {/* ── Mode toggle ────────────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode("library")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
              mode === "library"
                ? "bg-blue-700 border-blue-600 text-white"
                : "bg-gray-900 border-gray-700 text-gray-400 hover:text-white"
            }`}
          >
            <BookOpen size={15} />
            From Library
            {selectedIds.size > 0 && (
              <span className="px-1.5 py-0.5 bg-blue-500 rounded-full text-xs font-bold">
                {selectedIds.size}
              </span>
            )}
          </button>
          <button
            onClick={() => setMode("topics")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
              mode === "topics"
                ? "bg-blue-700 border-blue-600 text-white"
                : "bg-gray-900 border-gray-700 text-gray-400 hover:text-white"
            }`}
          >
            <List size={15} /> Enter Topics
          </button>
        </div>

        {/* ── Input area ─────────────────────────────────────────────────────── */}
        {mode === "library" ? (
          selectedIds.size === 0 ? (
            <div className="bg-gray-900 border border-dashed border-gray-700 rounded-2xl p-5 mb-4 text-center text-gray-500 text-sm">
              Select one or more files from the library above, then generate.
            </div>
          ) : (
            <div className="bg-blue-950/30 border border-blue-900/50 rounded-2xl p-4 mb-4">
              <p className="text-xs text-blue-400 font-medium mb-2">Generating from:</p>
              <ul className="space-y-1">
                {library.filter((r) => selectedIds.has(r.id)).map((r) => (
                  <li key={r.id} className="text-sm text-gray-300 flex items-center gap-2">
                    <FileText size={12} className="text-blue-400 shrink-0" />
                    {r.filename}
                  </li>
                ))}
              </ul>
            </div>
          )
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
            <label className="text-xs text-gray-400 mb-2 block">
              Topics, skills, or any context (one per line or comma-separated)
            </label>
            <textarea
              value={topics}
              onChange={(e) => { setTopics(e.target.value); setResult(null); setSaveStatus(null); setError(""); }}
              placeholder={`e.g.\nSystem Design — distributed systems, caching\nAlgorithms — dynamic programming, graphs\nBehavioral — leadership, conflict resolution`}
              rows={6}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm placeholder-gray-600 focus:outline-none focus:border-blue-600 resize-none"
            />
            {selectedIds.size > 0 && (
              <p className="mt-2 text-xs text-blue-400 flex items-center gap-1.5">
                <FileText size={11} />
                Will also use {selectedIds.size} selected file{selectedIds.size !== 1 ? "s" : ""} from library above
              </p>
            )}
          </div>
        )}

        {/* ── Controls ───────────────────────────────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-36">
              <label className="text-xs text-gray-400 mb-1.5 block">Questions to generate</label>
              <input type="number" min={1} max={30} value={numQuestions}
                onChange={(e) => setNumQuestions(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-600" />
            </div>
            <div className="flex-1 min-w-36">
              <label className="text-xs text-gray-400 mb-1.5 block">Difficulty</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm">
                <option value="Mixed">Mixed</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
            <div className="flex-1 min-w-48">
              <label className="text-xs text-gray-400 mb-1.5 block">AI Model</label>
              <div className="relative">
                <select value={model}
                  onChange={(e) => { setModel(e.target.value); localStorage.setItem("selectedModel", e.target.value); }}
                  className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 pr-8 text-sm">
                  {modelGroups?.ollama.length ? (
                    <optgroup label="Ollama — local">
                      {modelGroups.ollama.map((m) => <option key={m} value={m}>{m}</option>)}
                    </optgroup>
                  ) : (
                    <option value="" disabled>No local models</option>
                  )}
                  <optgroup label="DeepSeek — API">
                    {(modelGroups?.deepseek ?? ["deepseek-chat", "deepseek-reasoner"]).map((m) => (
                      <option key={m} value={m}>{m}{!modelGroups?.deepseek_configured ? " ⚠ key needed" : ""}</option>
                    ))}
                  </optgroup>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Primary action button — always visible, label changes after first gen ── */}
        <button
          onClick={handleGenerate}
          disabled={generating || !canGenerate}
          className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-medium text-sm mb-4 transition-colors"
        >
          <Sparkles size={16} />
          {generating
            ? "Generating questions…"
            : result
              ? "Generate New Set"
              : mode === "library"
                ? `Generate from ${selectedIds.size} file${selectedIds.size !== 1 ? "s" : ""}`
                : "Generate Questions"}
        </button>

        {/* ── Error ──────────────────────────────────────────────────────────── */}
        {error && (
          <div className="flex items-start gap-2 p-4 bg-red-900/30 border border-red-800 rounded-xl text-sm text-red-300 mb-4">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* ── Results ────────────────────────────────────────────────────────── */}
        {result && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                <CheckCircle size={15} className="text-green-400" />
                {result.questions.length} questions · {result.source}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300"
                >
                  <Download size={13} /> Export CSV
                </button>
                {alreadySaved ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-900/40 border border-green-800 rounded-lg text-sm text-green-300">
                    <CheckCircle size={13} />
                    Saved ({saveStatus!.inserted} new{saveStatus!.skipped > 0 ? `, ${saveStatus!.skipped} dupes` : ""})
                  </div>
                ) : (
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 rounded-lg text-sm text-white border border-blue-600">
                    <Save size={13} />
                    {saving ? "Saving…" : "Save to DB"}
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {result.questions.map((q, i) => (
                <div key={i} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 mb-2 flex-wrap flex-1">
                      <span className="text-xs font-medium text-blue-300 bg-blue-900/40 border border-blue-800 rounded px-2 py-0.5">
                        {q.topic}
                      </span>
                      <span className={`text-xs font-medium border rounded px-2 py-0.5 ${DIFF_COLORS[q.difficulty]}`}>
                        {q.difficulty}
                      </span>
                      {q.category && <span className="text-xs text-gray-500">{q.category}</span>}
                    </div>
                    <button
                      onClick={() => handleRemoveQuestion(i)}
                      className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/20 shrink-0 transition-colors"
                      title="Remove question"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <p className="text-sm text-gray-200 leading-relaxed">{q.question}</p>
                  {q.expected_keywords && (
                    <p className="text-xs text-gray-500 mt-2">Keywords: {q.expected_keywords}</p>
                  )}
                </div>
              ))}
            </div>

            {result.questions.length > 4 && (
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleExportCSV}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-sm text-gray-300"
                >
                  <Download size={14} /> Export CSV
                </button>
                {!alreadySaved && (
                  <button onClick={handleSave} disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 rounded-xl text-sm font-medium border border-blue-600">
                    <Save size={14} />
                    {saving ? "Saving…" : `Save all ${result.questions.length} to DB`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
