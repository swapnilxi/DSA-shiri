"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, FileText, Upload, Sparkles,
  CheckCircle, AlertCircle, ChevronDown,
  Save, Trash2, BookOpen, X, Plus, Download,
  Calendar, List, Pencil, Check,
} from "lucide-react";
import { api, GeneratedQuestion, ResumeEntry } from "@/lib/api";

type ActiveTab = "library" | "topics" | "daily";
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

const DAILY_CATS = [
  { id: "dsa",                   label: "DSA" },
  { id: "system_design",         label: "System Design" },
  { id: "python",                label: "Python" },
  { id: "computer_vision",       label: "Computer Vision" },
  { id: "real_life_scenario",    label: "Real-Life Scenario-Based Technical Question" },
  { id: "large_scale_system",    label: "Large Scale System Design" },
  { id: "leadership_behavioral", label: "General Leadership / Behavioral Question" },
];

type DailyCatState = Record<string, { enabled: boolean; count: number }>;

const DEFAULT_DAILY_CATS: DailyCatState = Object.fromEntries(
  DAILY_CATS.map((c) => [c.id, { enabled: false, count: c.id === "computer_vision" ? 5 : 1 }])
);

const TAB_FILE_NOTE: Record<ActiveTab, string> = {
  library: "selected for generation",
  topics:  "will be combined with your topics",
  daily:   "will be used as context",
};

export default function GeneratePage() {
  const router = useRouter();
  const addFileRef = useRef<HTMLInputElement>(null);

  // ── shared ───────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<ActiveTab>("daily");
  const [library, setLibrary] = useState<ResumeEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [addingFile, setAddingFile] = useState(false);
  const [model, setModel] = useState("");
  const [modelGroups, setModelGroups] = useState<ModelGroups | null>(null);

  // ── library + topics generate state ─────────────────────────────────────────
  const [topics, setTopics] = useState("");
  const [numQuestions, setNumQuestions] = useState(10);
  const [difficulty, setDifficulty] = useState<Difficulty>("Mixed");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ questions: GeneratedQuestion[]; source: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<{ inserted: number; skipped: number } | null>(null);
  const [error, setError] = useState("");

  // ── daily practice state ─────────────────────────────────────────────────────
  const [dailyCats, setDailyCats] = useState<DailyCatState>(DEFAULT_DAILY_CATS);
  const [companies, setCompanies] = useState<{ company: string; count: number }[]>([]);
  const [dailyCompany, setDailyCompany] = useState("all");
  const [dailyContext, setDailyContext] = useState("");
  const [dailyDifficulty, setDailyDifficulty] = useState<Difficulty>("Mixed");
  const [dailyGenerating, setDailyGenerating] = useState(false);
  const [dailySaving, setDailySaving] = useState(false);
  const [dailyResult, setDailyResult] = useState<{ questions: GeneratedQuestion[]; source: string } | null>(null);
  const [dailySaveStatus, setDailySaveStatus] = useState<{ inserted: number; skipped: number } | null>(null);
  const [dailyError, setDailyError] = useState("");

  // ── custom categories (persisted) ────────────────────────────────────────────
  const [customCats, setCustomCats] = useState<{ id: string; label: string }[]>([]);
  const [customCatsLoaded, setCustomCatsLoaded] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");

  useEffect(() => {
    api.getModels().then((mg) => {
      setModelGroups(mg);
      const saved = localStorage.getItem("selectedModel");
      const all = [...mg.ollama, ...mg.deepseek];
      setModel(saved && all.includes(saved) ? saved : mg.default);
    }).catch(() => {});
    api.listCompanies().then(setCompanies).catch(() => {});
    loadLibrary();

    // Load persisted custom categories
    try {
      const raw = localStorage.getItem("dailyCustomCats");
      if (raw) {
        const cats = JSON.parse(raw) as { id: string; label: string }[];
        setCustomCats(cats);
        setDailyCats((prev) => {
          const next = { ...prev };
          cats.forEach((c) => { if (!next[c.id]) next[c.id] = { enabled: false, count: 1 }; });
          return next;
        });
      }
    } catch { /* ignore */ }
    finally { setCustomCatsLoaded(true); }
  }, []);

  useEffect(() => {
    if (!customCatsLoaded) return;
    localStorage.setItem("dailyCustomCats", JSON.stringify(customCats));
  }, [customCats, customCatsLoaded]);

  function loadLibrary() {
    api.getResumeLibrary().then(setLibrary).catch(() => {});
  }

  function addCustomCat() {
    const label = newCatLabel.trim();
    if (!label) return;
    const id = `custom_${Date.now()}`;
    setCustomCats((prev) => [...prev, { id, label }]);
    setDailyCats((prev) => ({ ...prev, [id]: { enabled: false, count: 1 } }));
    setNewCatLabel("");
  }

  function deleteCustomCat(id: string) {
    setCustomCats((prev) => prev.filter((c) => c.id !== id));
    setDailyCats((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }

  function commitEdit() {
    const label = editingLabel.trim();
    if (!editingId || !label) { setEditingId(null); return; }
    setCustomCats((prev) => prev.map((c) => c.id === editingId ? { ...c, label } : c));
    setEditingId(null);
    setEditingLabel("");
  }

  function toggleSelect(id: number) {
    setSelectedIds((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await api.deleteResume(id);
      setSelectedIds((p) => { const n = new Set(p); n.delete(id); return n; });
      setLibrary((p) => p.filter((r) => r.id !== id));
    } catch { /* ignore */ }
    finally { setDeletingId(null); }
  }

  async function handleAddFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    e.target.value = "";
    setAddingFile(true); setError("");
    try {
      const entry = await api.uploadToLibrary(f);
      loadLibrary();
      setSelectedIds((p) => new Set([...p, entry.id]));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setAddingFile(false); }
  }

  // ── generate (library / topics tabs) ────────────────────────────────────────
  async function handleGenerate() {
    setError(""); setResult(null); setSaveStatus(null); setGenerating(true);
    try {
      if (tab === "library") {
        if (selectedIds.size === 0) { setError("Select at least one file from the library above."); return; }
        const res = await api.generateFromIds({ resume_ids: [...selectedIds], num_questions: numQuestions, difficulty, model });
        setResult({ questions: res.questions, source: res.source });
      } else {
        if (!topics.trim()) { setError("Enter at least one topic."); return; }
        if (selectedIds.size > 0) {
          const res = await api.generateFromIds({ resume_ids: [...selectedIds], num_questions: numQuestions, difficulty, model, topics });
          setResult({ questions: res.questions, source: res.source });
        } else {
          const fd = new FormData();
          fd.append("topics", topics); fd.append("num_questions", String(numQuestions));
          fd.append("difficulty", difficulty); fd.append("model", model);
          setResult({ questions: (await api.generateQuestions(fd)).questions, source: "topics" });
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setGenerating(false); }
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true); setSaveStatus(null); setError("");
    try { setSaveStatus(await api.saveQuestions(result.questions, result.source)); loadLibrary(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setSaving(false); }
  }

  function buildCSV(qs: GeneratedQuestion[]) {
    const esc = (v: string) => (v.includes(",") || v.includes('"') || v.includes("\n")) ? `"${v.replace(/"/g, '""')}"` : v;
    return ["topic,question,difficulty,company,category,expected_keywords",
      ...qs.map((q) => [
        q.topic,
        q.question,
        q.difficulty,
        q.company || "General",
        q.category || "",
        q.expected_keywords || "",
      ].map(esc).join(","))
    ].join("\n");
  }

  function exportCSV(qs: GeneratedQuestion[], name: string) {
    const url = URL.createObjectURL(new Blob([buildCSV(qs)], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
  }

  function getDailyCSVName() {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yy = String(now.getFullYear()).slice(-2);
    const key = `dailySetNo_${mm}_${yy}`;
    const n = (parseInt(localStorage.getItem(key) ?? "0", 10)) + 1;
    localStorage.setItem(key, String(n));
    return `daily_practice_${mm}_${yy}_${n}.csv`;
  }

  // ── daily practice ────────────────────────────────────────────────────────────
  const allDailyCats = [...DAILY_CATS, ...customCats];
  const enabledCats = allDailyCats.filter((c) => dailyCats[c.id]?.enabled);
  const dailyTotal = enabledCats.reduce((s, c) => s + (dailyCats[c.id]?.count ?? 1), 0);

  async function handleDailyGenerate() {
    if (enabledCats.length === 0) { setDailyError("Select at least one category."); return; }
    setDailyError(""); setDailyResult(null); setDailySaveStatus(null); setDailyGenerating(true);
    try {
      const res = await api.generateDailyPractice({
        categories: enabledCats.map((c) => ({ name: c.label, count: dailyCats[c.id].count })),
        company: dailyCompany,
        context: dailyContext || undefined,
        resume_ids: selectedIds.size > 0 ? [...selectedIds] : undefined,
        difficulty: dailyDifficulty, model,
      });
      setDailyResult({ questions: res.questions, source: res.source });
    } catch (err: unknown) {
      setDailyError(err instanceof Error ? err.message : String(err));
    } finally { setDailyGenerating(false); }
  }

  async function handleDailySave() {
    if (!dailyResult) return;
    setDailySaving(true); setDailySaveStatus(null); setDailyError("");
    try { setDailySaveStatus(await api.saveQuestions(dailyResult.questions, dailyResult.source)); loadLibrary(); }
    catch (err: unknown) { setDailyError(err instanceof Error ? err.message : String(err)); }
    finally { setDailySaving(false); }
  }

  // ── shared sub-components ────────────────────────────────────────────────────
  function CatRow({ cat, state, fixed }: {
    cat: { id: string; label: string };
    state: { enabled: boolean; count: number };
    fixed: boolean;
  }) {
    const isEditing = editingId === cat.id;
    return (
      <div
        onClick={() => {
          if (isEditing) return;
          setDailyCats((p) => ({ ...p, [cat.id]: { ...(p[cat.id] ?? { enabled: false, count: 1 }), enabled: !(p[cat.id]?.enabled ?? false) } }));
        }}
        className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${isEditing ? "bg-gray-800 border-gray-600 cursor-default" : `cursor-pointer ${state.enabled ? "bg-purple-900/20 border-purple-800" : "bg-gray-800 border-gray-700 hover:border-gray-600"}`}`}
      >
        {/* Checkbox */}
        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${state.enabled ? "bg-purple-600 border-purple-500" : "border-gray-600"}`}>
          {state.enabled && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>

        {/* Label / edit input */}
        {isEditing ? (
          <input
            autoFocus
            value={editingLabel}
            onChange={(e) => setEditingLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingId(null); }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-2 py-0.5 text-sm text-white focus:outline-none focus:border-purple-500"
          />
        ) : (
          <span className={`flex-1 leading-tight ${cat.label.length > 22 ? "text-xs" : "text-sm"} ${state.enabled ? "text-gray-200" : "text-gray-400"}`}>{cat.label}</span>
        )}

        {/* Count stepper (only when enabled) */}
        {state.enabled && !isEditing && (
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setDailyCats((p) => ({ ...p, [cat.id]: { ...p[cat.id], count: Math.max(1, p[cat.id].count - 1) } }))}
              className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm leading-none">−</button>
            <span className="w-7 text-center text-sm font-semibold text-white">{state.count}</span>
            <button onClick={() => setDailyCats((p) => ({ ...p, [cat.id]: { ...p[cat.id], count: Math.min(20, p[cat.id].count + 1) } }))}
              className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm leading-none">+</button>
            <span className="text-xs text-gray-500 ml-1">q</span>
          </div>
        )}

        {/* Actions for custom categories */}
        {!fixed && (
          <div className="flex items-center gap-1 shrink-0 ml-1" onClick={(e) => e.stopPropagation()}>
            {isEditing ? (
              <button onClick={commitEdit}
                className="w-6 h-6 flex items-center justify-center rounded-lg bg-purple-700 hover:bg-purple-600 text-white transition-colors">
                <Check size={12} />
              </button>
            ) : (
              <button onClick={() => { setEditingId(cat.id); setEditingLabel(cat.label); }}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-600 hover:text-gray-300 hover:bg-gray-700 transition-colors">
                <Pencil size={11} />
              </button>
            )}
            <button onClick={() => deleteCustomCat(cat.id)}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/20 transition-colors">
              <X size={12} />
            </button>
          </div>
        )}
      </div>
    );
  }

  function ModelSelect() {
    return (
      <div className="relative">
        <select value={model}
          onChange={(e) => { setModel(e.target.value); localStorage.setItem("selectedModel", e.target.value); }}
          className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 pr-8 text-sm">
          {modelGroups?.ollama.length
            ? <optgroup label="Ollama — local">{modelGroups.ollama.map((m) => <option key={m} value={m}>{m}</option>)}</optgroup>
            : <option value="" disabled>No local models</option>}
          <optgroup label="DeepSeek — API">
            {(modelGroups?.deepseek ?? ["deepseek-chat", "deepseek-reasoner"]).map((m) => (
              <option key={m} value={m}>{m}{!modelGroups?.deepseek_configured ? " ⚠ key needed" : ""}</option>
            ))}
          </optgroup>
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>
    );
  }

  function Controls({ diff, setDiff, nq, setNq, showCount = true }: {
    diff: Difficulty; setDiff: (d: Difficulty) => void;
    nq?: number; setNq?: (n: number) => void; showCount?: boolean;
  }) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
        <div className="flex flex-wrap gap-4">
          {showCount && nq !== undefined && setNq && (
            <div className="flex-1 min-w-32">
              <label className="text-xs text-gray-400 mb-1.5 block">Questions</label>
              <input type="number" min={1} max={30} value={nq} onChange={(e) => setNq(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-600" />
            </div>
          )}
          <div className="flex-1 min-w-32">
            <label className="text-xs text-gray-400 mb-1.5 block">Difficulty</label>
            <select value={diff} onChange={(e) => setDiff(e.target.value as Difficulty)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm">
              {["Mixed","Easy","Medium","Hard"].map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-44">
            <label className="text-xs text-gray-400 mb-1.5 block">AI Model</label>
            <ModelSelect />
          </div>
        </div>
      </div>
    );
  }

  function Results({
    questions, source, accent, onRemove, onExport, onSave, saved, isSaving, ss,
  }: {
    questions: GeneratedQuestion[]; source: string; accent: string;
    onRemove: (i: number) => void; onExport: () => void;
    onSave: () => void; saved: boolean; isSaving: boolean;
    ss: { inserted: number; skipped: number } | null;
  }) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <span className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <CheckCircle size={15} className="text-green-400" />
            {questions.length} questions · {source}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onExport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300">
              <Download size={13} /> Export CSV
            </button>
            {saved ? (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-900/40 border border-green-800 rounded-lg text-sm text-green-300">
                <CheckCircle size={13} />
                Saved ({ss!.inserted} new{ss!.skipped > 0 ? `, ${ss!.skipped} dupes` : ""})
              </span>
            ) : (
              <button onClick={onSave} disabled={isSaving}
                className={`flex items-center gap-1.5 px-3 py-1.5 ${accent} disabled:opacity-40 rounded-lg text-sm text-white`}>
                <Save size={13} />{isSaving ? "Saving…" : "Save to DB"}
              </button>
            )}
          </div>
        </div>
        <div className="space-y-3">
          {questions.map((q, i) => (
            <div key={i} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 mb-2 flex-wrap flex-1">
                  <span className="text-xs font-medium text-blue-300 bg-blue-900/40 border border-blue-800 rounded px-2 py-0.5">{q.topic}</span>
                  <span className={`text-xs font-medium border rounded px-2 py-0.5 ${DIFF_COLORS[q.difficulty]}`}>{q.difficulty}</span>
                  {q.company && (
                    <span className="text-xs text-purple-300 bg-purple-900/30 border border-purple-800 rounded px-2 py-0.5">
                      {q.company}
                    </span>
                  )}
                  {q.category && <span className="text-xs text-gray-500">{q.category}</span>}
                </div>
                <button onClick={() => onRemove(i)} className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/20 shrink-0 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="text-sm text-gray-200 leading-relaxed">{q.question}</p>
              {q.expected_keywords && <p className="text-xs text-gray-500 mt-2">Keywords: {q.expected_keywords}</p>}
            </div>
          ))}
        </div>
        {questions.length > 4 && (
          <div className="flex gap-2 mt-4">
            <button onClick={onExport}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-sm text-gray-300">
              <Download size={14} /> Export CSV
            </button>
            {!saved && (
              <button onClick={onSave} disabled={isSaving}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 ${accent} disabled:opacity-40 rounded-xl text-sm font-medium`}>
                <Save size={14} />{isSaving ? "Saving…" : `Save all ${questions.length} to DB`}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}

        <div className="mb-5">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Sparkles size={20} className="text-blue-400" />
            Generate Interview Questions
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Generate from files, enter topics, or build a structured daily practice set.
          </p>
        </div>

        {/* ── Library — shared across all tabs ──────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <BookOpen size={14} className="text-blue-400" />
              Library
              {library.length > 0 && (
                <span className="px-1.5 py-0.5 bg-gray-800 rounded text-xs text-gray-400">{library.length} files</span>
              )}
            </h2>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <button onClick={() => setSelectedIds(new Set())}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors">
                  <X size={11} /> Clear selection
                </button>
              )}
              <button onClick={() => addFileRef.current?.click()} disabled={addingFile}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 border border-gray-700 rounded-lg text-xs text-gray-300 transition-colors">
                {addingFile ? <span className="animate-pulse">Adding…</span> : <><Plus size={12} /> Add file</>}
              </button>
              <input ref={addFileRef} type="file" accept=".pdf,.docx,.doc,.txt,.md" className="hidden" onChange={handleAddFile} />
            </div>
          </div>

          {library.length === 0 ? (
            <div onClick={() => addFileRef.current?.click()}
              className="border-2 border-dashed border-gray-700 hover:border-blue-600 rounded-xl p-6 flex flex-col items-center gap-2 text-gray-500 hover:text-gray-300 cursor-pointer transition-colors">
              <Upload size={20} />
              <span className="text-sm">Click to add your first resume or file</span>
              <span className="text-xs text-gray-600">PDF, DOCX, TXT, MD supported</span>
            </div>
          ) : (
            <>
              <div className="space-y-1.5 mb-2">
                {library.map((r) => {
                  const sel = selectedIds.has(r.id);
                  return (
                    <div key={r.id} onClick={() => toggleSelect(r.id)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer border transition-colors ${sel ? "bg-blue-900/30 border-blue-700" : "bg-gray-800 border-gray-700 hover:border-gray-600"}`}>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${sel ? "bg-blue-600 border-blue-500" : "border-gray-600"}`}>
                        {sel && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <FileText size={13} className={`shrink-0 ${sel ? "text-blue-400" : "text-gray-500"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200 truncate">{r.filename}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(r.uploaded_at).toLocaleDateString()}
                          {r.questions_generated > 0 && <span className="text-blue-400 ml-2">{r.questions_generated}q generated</span>}
                        </p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }} disabled={deletingId === r.id}
                        className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/20 disabled:opacity-40 shrink-0 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <button onClick={() => addFileRef.current?.click()} disabled={addingFile}
                className="w-full flex items-center justify-center gap-2 py-1.5 border border-dashed border-gray-700 hover:border-blue-600 hover:text-blue-400 rounded-xl text-xs text-gray-500 disabled:opacity-40 transition-colors">
                <Plus size={12} />{addingFile ? "Adding file…" : "Add another file"}
              </button>
            </>
          )}

          {selectedIds.size > 0 && (
            <p className="text-xs text-blue-400 mt-2.5">
              {selectedIds.size} file{selectedIds.size !== 1 ? "s" : ""} selected — {TAB_FILE_NOTE[tab]}
            </p>
          )}
        </div>

        {/* ── Tab navigation ─────────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-5">
          {([
            { id: "daily",   label: "Daily Practice", icon: <Calendar size={14} />,  color: "purple" },
            { id: "library", label: "From Library",   icon: <BookOpen size={14} />,  color: "blue"   },
            { id: "topics",  label: "Enter Topics",   icon: <List size={14} />,      color: "blue"   },
          ] as const).map(({ id, label, icon, color }) => {
            const active = tab === id;
            const on  = color === "purple" ? "bg-purple-700 border-purple-600 text-white" : "bg-blue-700 border-blue-600 text-white";
            const off = "bg-gray-900 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600";
            return (
              <button key={id} onClick={() => setTab(id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${active ? on : off}`}>
                {icon} {label}
              </button>
            );
          })}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            FROM LIBRARY TAB
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === "library" && (
          <>
            {selectedIds.size === 0 ? (
              <div className="bg-gray-900 border border-dashed border-gray-700 rounded-2xl p-5 mb-4 text-center text-gray-500 text-sm">
                Select one or more files from the library above, then generate.
              </div>
            ) : (
              <div className="bg-blue-950/30 border border-blue-900/50 rounded-2xl px-4 py-3 mb-4 flex items-center gap-2 flex-wrap">
                <FileText size={13} className="text-blue-400 shrink-0" />
                <span className="text-xs text-blue-300 font-medium">Generating from:</span>
                {library.filter((r) => selectedIds.has(r.id)).map((r) => (
                  <span key={r.id} className="text-xs text-gray-300 bg-gray-800 border border-gray-700 rounded px-2 py-0.5">{r.filename}</span>
                ))}
              </div>
            )}

            <Controls diff={difficulty} setDiff={setDifficulty} nq={numQuestions} setNq={setNumQuestions} />

            <button onClick={handleGenerate} disabled={generating || selectedIds.size === 0}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-medium text-sm mb-4 transition-colors">
              <Sparkles size={16} />
              {generating ? "Generating…" : result ? "Generate New Set" : selectedIds.size === 0 ? "Select files above" : `Generate from ${selectedIds.size} file${selectedIds.size !== 1 ? "s" : ""}`}
            </button>

            {error && (
              <div className="flex items-start gap-2 p-4 bg-red-900/30 border border-red-800 rounded-xl text-sm text-red-300 mb-4">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />{error}
              </div>
            )}

            {result && (
              <Results
                questions={result.questions} source={result.source} accent="bg-blue-700 hover:bg-blue-600 border border-blue-600"
                onRemove={(i) => { setResult((p) => p ? { ...p, questions: p.questions.filter((_, j) => j !== i) } : p); setSaveStatus(null); }}
                onExport={() => exportCSV(result.questions, "generated_questions.csv")}
                onSave={handleSave} saved={saveStatus !== null} isSaving={saving} ss={saveStatus}
              />
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            ENTER TOPICS TAB
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === "topics" && (
          <>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
              <label className="text-xs text-gray-400 mb-2 block">Topics, skills, or any context (one per line or comma-separated)</label>
              <textarea value={topics}
                onChange={(e) => { setTopics(e.target.value); setResult(null); setSaveStatus(null); setError(""); }}
                placeholder={`e.g.\nSystem Design — distributed systems, caching\nAlgorithms — dynamic programming, graphs\nBehavioral — leadership, conflict resolution`}
                rows={6}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm placeholder-gray-600 focus:outline-none focus:border-blue-600 resize-none" />
              {selectedIds.size > 0 && (
                <p className="mt-2 text-xs text-blue-400 flex items-center gap-1.5">
                  <FileText size={11} />
                  {selectedIds.size} library file{selectedIds.size !== 1 ? "s" : ""} will be combined with these topics
                </p>
              )}
            </div>

            <Controls diff={difficulty} setDiff={setDifficulty} nq={numQuestions} setNq={setNumQuestions} />

            <button onClick={handleGenerate} disabled={generating || !topics.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-medium text-sm mb-4 transition-colors">
              <Sparkles size={16} />
              {generating ? "Generating…" : result ? "Generate New Set" : "Generate Questions"}
            </button>

            {error && (
              <div className="flex items-start gap-2 p-4 bg-red-900/30 border border-red-800 rounded-xl text-sm text-red-300 mb-4">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />{error}
              </div>
            )}

            {result && (
              <Results
                questions={result.questions} source={result.source} accent="bg-blue-700 hover:bg-blue-600 border border-blue-600"
                onRemove={(i) => { setResult((p) => p ? { ...p, questions: p.questions.filter((_, j) => j !== i) } : p); setSaveStatus(null); }}
                onExport={() => exportCSV(result.questions, "generated_questions.csv")}
                onSave={handleSave} saved={saveStatus !== null} isSaving={saving} ss={saveStatus}
              />
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            DAILY PRACTICE TAB
        ══════════════════════════════════════════════════════════════════════ */}
        {tab === "daily" && (
          <>
            {/* Category selector */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
              <h2 className="text-sm font-semibold text-gray-300 mb-1">Select categories</h2>
              <p className="text-xs text-gray-500 mb-4">Pick topics to practice and set the question count per category.</p>

              <div className="grid grid-cols-2 gap-2">
                {/* Fixed categories */}
                {DAILY_CATS.map((cat) => {
                  const state = dailyCats[cat.id];
                  return (
                    <CatRow key={cat.id} cat={cat} state={state} fixed />
                  );
                })}

                {/* Custom categories */}
                {customCats.map((cat) => {
                  const state = dailyCats[cat.id] ?? { enabled: false, count: 1 };
                  return (
                    <CatRow key={cat.id} cat={cat} state={state} fixed={false} />
                  );
                })}
              </div>

              {/* Add new category */}
              <div className="mt-3 pt-3 border-t border-gray-800">
                <div className="flex gap-2">
                  <input
                    value={newCatLabel}
                    onChange={(e) => setNewCatLabel(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomCat(); } }}
                    placeholder="Add a custom category…"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm placeholder-gray-600 focus:outline-none focus:border-purple-600"
                  />
                  <button
                    onClick={addCustomCat}
                    disabled={!newCatLabel.trim()}
                    className="flex items-center gap-1.5 px-3 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm text-white transition-colors"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
              </div>

              {enabledCats.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between">
                  <span className="text-xs text-gray-500">{enabledCats.length} categor{enabledCats.length !== 1 ? "ies" : "y"}</span>
                  <span className="text-sm font-semibold text-purple-300">{dailyTotal} total questions</span>
                </div>
              )}
            </div>

            {/* Company target */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
              <label className="text-xs text-gray-400 mb-2 block font-medium">
                Target company
              </label>
              <select
                value={dailyCompany}
                onChange={(e) => {
                  setDailyCompany(e.target.value);
                  setDailyResult(null);
                  setDailySaveStatus(null);
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-600"
              >
                <option value="all">Auto / mixed companies</option>
                {companies.map((company) => (
                  <option key={company.company} value={company.company}>
                    {company.company} ({company.count})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-2">
                A selected company is applied to every generated question.
              </p>
            </div>

            {/* Context */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
              <label className="text-xs text-gray-400 mb-2 block font-medium">
                Additional context <span className="text-gray-600 font-normal">(optional)</span>
              </label>
              <textarea value={dailyContext}
                onChange={(e) => { setDailyContext(e.target.value); setDailyResult(null); setDailySaveStatus(null); }}
                placeholder="e.g., focus on autonomous vehicles, fintech regulations, or my upcoming Google interview…"
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm placeholder-gray-600 focus:outline-none focus:border-purple-600 resize-none" />
              {selectedIds.size > 0 && (
                <p className="mt-2 text-xs text-purple-400 flex items-center gap-1.5">
                  <FileText size={11} />
                  {selectedIds.size} library file{selectedIds.size !== 1 ? "s" : ""} will be used as context
                </p>
              )}
            </div>

            <Controls diff={dailyDifficulty} setDiff={setDailyDifficulty} showCount={false} />

            <button onClick={handleDailyGenerate} disabled={dailyGenerating || enabledCats.length === 0}
              className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-medium text-sm mb-4 transition-colors">
              <Sparkles size={16} />
              {dailyGenerating ? "Generating daily set…"
                : dailyResult ? `Generate New Set (${dailyTotal} questions)`
                : enabledCats.length === 0 ? "Select categories above"
                : `Generate ${dailyTotal} Daily Practice Questions`}
            </button>

            {dailyError && (
              <div className="flex items-start gap-2 p-4 bg-red-900/30 border border-red-800 rounded-xl text-sm text-red-300 mb-4">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />{dailyError}
              </div>
            )}

            {dailyResult && (
              <Results
                questions={dailyResult.questions} source={dailyResult.source} accent="bg-purple-700 hover:bg-purple-600 border border-purple-600"
                onRemove={(i) => { setDailyResult((p) => p ? { ...p, questions: p.questions.filter((_, j) => j !== i) } : p); setDailySaveStatus(null); }}
                onExport={() => exportCSV(dailyResult.questions, getDailyCSVName())}
                onSave={handleDailySave} saved={dailySaveStatus !== null} isSaving={dailySaving} ss={dailySaveStatus}
              />
            )}
          </>
        )}

      </div>
    </div>
  );
}
