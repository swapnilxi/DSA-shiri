"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Database, RefreshCw, ChevronUp, ChevronDown,
  Download, Trash2, Plus, Edit2, X, Save, Check, Upload, FileText, CheckCircle2,
} from "lucide-react";
import { api } from "@/lib/api";

type Row = Record<string, unknown>;

interface TableData {
  table: string;
  columns: string[];
  rows: Row[];
  count: number;
}

interface QuestionForm {
  topic: string;
  question: string;
  difficulty: string;
  company: string;
  category: string;
  expected_keywords: string;
}

const EMPTY_FORM: QuestionForm = {
  topic: "", question: "", difficulty: "Medium",
  company: "", category: "", expected_keywords: "",
};

const TABLES = [
  { name: "sessions",      label: "Sessions",      desc: "Every interview session" },
  { name: "questions",     label: "Questions",     desc: "Loaded question bank" },
  { name: "responses",     label: "Responses",     desc: "Your spoken answers (transcribed)" },
  { name: "scores",        label: "Scores",        desc: "Per-answer rubric scores" },
  { name: "topic_mastery", label: "Topic Mastery", desc: "Rolling averages per topic" },
];

const SCORE_COLS = new Set([
  "total", "technical_correctness", "depth_completeness",
  "communication_clarity", "problem_solving", "avg_score",
]);

function defaultColumnWidth(column: string) {
  if (column === "id") return 70;
  if (column === "question") return 520;
  if (["transcript", "llm_feedback", "expected_keywords"].includes(column)) return 360;
  if (column.endsWith("_at")) return 180;
  return 160;
}

export default function DatabasePage() {
  const router = useRouter();
  const [activeTable, setActiveTable] = useState("sessions");
  const [data, setData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(false);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(false);
  const [columnWidths, setColumnWidths] = useState<Record<string, Record<string, number>>>({});

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // CRUD modal (questions only)
  const [modal, setModal] = useState<{ mode: "add" | "edit"; row?: Row } | null>(null);
  const [modalTab, setModalTab] = useState<"single" | "csv">("single");
  const [form, setForm] = useState<QuestionForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // CSV bulk upload state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResult, setCsvResult] = useState<{ inserted: number; filename: string } | null>(null);
  const [csvDragOver, setCsvDragOver] = useState(false);

  // Action state
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState("");

  const load = useCallback(async (table: string) => {
    setLoading(true);
    setData(null);
    setSortCol(null);
    setSelectedIds(new Set());
    setActionError("");
    try {
      const d = await api.getDbTable(table);
      setData(d);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(activeTable); }, [activeTable, load]);

  function toggleSort(col: string) {
    if (sortCol === col) setSortAsc((a) => !a);
    else { setSortCol(col); setSortAsc(false); }
  }

  function getColumnWidth(col: string) {
    return columnWidths[activeTable]?.[col] ?? defaultColumnWidth(col);
  }

  function startColumnResize(event: React.MouseEvent, col: string) {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = getColumnWidth(col);

    const onMove = (moveEvent: MouseEvent) => {
      const width = Math.max(80, Math.min(900, startWidth + moveEvent.clientX - startX));
      setColumnWidths((current) => ({
        ...current,
        [activeTable]: {
          ...current[activeTable],
          [col]: width,
        },
      }));
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function resetColumnWidth(event: React.MouseEvent, col: string) {
    event.preventDefault();
    event.stopPropagation();
    setColumnWidths((current) => {
      const tableWidths = { ...current[activeTable] };
      delete tableWidths[col];
      return { ...current, [activeTable]: tableWidths };
    });
  }

  const rows = data
    ? [...data.rows].sort((a, b) => {
        if (!sortCol) return 0;
        const av = a[sortCol] ?? "";
        const bv = b[sortCol] ?? "";
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortAsc ? cmp : -cmp;
      })
    : [];

  // ── Selection ────────────────────────────────────────────────────────────────
  const allSelected = rows.length > 0 && selectedIds.size === rows.length;
  const someSelected = selectedIds.size > 0;

  function toggleAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(rows.map((r) => r.id as number)));
  }

  function toggleRow(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── CSV Export ───────────────────────────────────────────────────────────────
  function exportCSV(exportRows: Row[]) {
    if (!data || exportRows.length === 0) return;
    const escape = (v: unknown) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = data.columns.join(",");
    const body = exportRows.map((row) => data.columns.map((c) => escape(row[c])).join(","));
    const csv = [header, ...body].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeTable}${someSelected ? "_selected" : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  async function deleteRows(ids: number[]) {
    if (ids.length === 0) return;
    setDeleting(true);
    setActionError("");
    try {
      await api.batchDeleteRows(activeTable, ids);
      setSelectedIds((prev) => { const n = new Set(prev); ids.forEach((id) => n.delete(id)); return n; });
      await load(activeTable);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  }

  // ── Modal ────────────────────────────────────────────────────────────────────
  function openAdd() {
    setForm(EMPTY_FORM);
    setModal({ mode: "add" });
    setModalTab("single");
    setCsvFile(null);
    setCsvResult(null);
    setActionError("");
  }

  async function handleCsvUpload() {
    if (!csvFile) return;
    setCsvUploading(true);
    setActionError("");
    try {
      const result = await api.uploadQuestions(csvFile);
      setCsvResult(result);
      await load(activeTable);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setCsvUploading(false);
    }
  }

  function openEdit(row: Row) {
    setForm({
      topic: String(row.topic ?? ""),
      question: String(row.question ?? ""),
      difficulty: String(row.difficulty ?? "Medium"),
      company: String(row.company ?? ""),
      category: String(row.category ?? ""),
      expected_keywords: String(row.expected_keywords ?? ""),
    });
    setModal({ mode: "edit", row });
    setActionError("");
  }

  async function handleSave() {
    if (!modal) return;
    setSaving(true);
    setActionError("");
    try {
      const payload = {
        topic: form.topic.trim(),
        question: form.question.trim(),
        difficulty: form.difficulty,
        company: form.company.trim() || undefined,
        category: form.category.trim() || undefined,
        expected_keywords: form.expected_keywords.trim() || undefined,
      };
      if (modal.mode === "add") {
        await api.createQuestion(payload);
      } else if (modal.row) {
        await api.updateQuestion(modal.row.id as number, payload);
      }
      setModal(null);
      await load(activeTable);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  // ── Cell formatting ──────────────────────────────────────────────────────────
  function formatCell(col: string, val: unknown): { text: string; cls: string } {
    if (val === null || val === undefined) return { text: "—", cls: "text-gray-600" };
    if (typeof val === "string" && val.length > 120)
      return { text: val.slice(0, 120) + "…", cls: "text-gray-300" };
    if (SCORE_COLS.has(col) && typeof val === "number") {
      const cls = val >= 80 ? "text-green-400 font-semibold" : val >= 60 ? "text-yellow-400 font-semibold" : "text-red-400 font-semibold";
      return { text: val.toFixed(1), cls };
    }
    if (col === "status") {
      const cls = val === "completed" ? "text-green-400" : val === "active" ? "text-blue-400" : "text-gray-500";
      return { text: String(val), cls };
    }
    if (col === "difficulty") {
      const cls = val === "Hard" ? "text-red-400" : val === "Medium" ? "text-yellow-400" : "text-green-400";
      return { text: String(val), cls };
    }
    return { text: String(val), cls: "text-gray-200" };
  }

  const active = TABLES.find((t) => t.name === activeTable)!;
  const isQuestions = activeTable === "questions";

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* ── Header ── */}
      <div className="flex items-center gap-4 px-6 py-4 bg-gray-900 border-b border-gray-800 flex-wrap">
        <Database size={18} className="text-blue-400" />
        <h1 className="text-base font-semibold">Database</h1>
        <span className="text-xs text-gray-500 font-mono">voicelearning.db</span>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {data && <span className="text-xs text-gray-500">{data.count} rows</span>}

          {/* Add Question (questions table only) */}
          {isQuestions && (
            <button onClick={openAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-xs font-medium transition-colors">
              <Plus size={13} /> Add Question
            </button>
          )}

          {/* Export CSV */}
          <button
            onClick={() => exportCSV(someSelected ? rows.filter((r) => selectedIds.has(r.id as number)) : rows)}
            disabled={!data || rows.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 border border-gray-700 rounded-lg text-xs text-gray-300 transition-colors"
          >
            <Download size={13} />
            {someSelected ? `Export ${selectedIds.size} rows` : "Export CSV"}
          </button>

          {/* Delete selected */}
          {someSelected && (
            <button
              onClick={() => deleteRows([...selectedIds])}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/50 hover:bg-red-800/60 disabled:opacity-40 border border-red-800 rounded-lg text-xs text-red-300 transition-colors"
            >
              <Trash2 size={13} />
              {deleting ? "Deleting…" : `Delete ${selectedIds.size}`}
            </button>
          )}

          <button onClick={() => load(activeTable)}
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {actionError && (
        <div className="mx-4 mt-2 p-3 bg-red-900/30 border border-red-800 rounded-lg text-xs text-red-300 flex items-center justify-between">
          {actionError}
          <button onClick={() => setActionError("")}><X size={13} /></button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <div className="w-52 shrink-0 bg-gray-900 border-r border-gray-800 p-3 space-y-1">
          {TABLES.map((t) => (
            <button
              key={t.name}
              onClick={() => setActiveTable(t.name)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                activeTable === t.name
                  ? "bg-blue-700/30 border border-blue-700/50 text-blue-300"
                  : "hover:bg-gray-800 text-gray-400 hover:text-gray-200"
              }`}
            >
              <p className="text-sm font-medium">{t.label}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-tight">{t.desc}</p>
            </button>
          ))}
        </div>

        {/* ── Main ── */}
        <div className="flex-1 overflow-auto p-0">
          {loading && (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
              Loading {active.label}…
            </div>
          )}

          {!loading && data && data.rows.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <Database size={32} className="text-gray-700" />
              <p className="text-gray-500 text-sm">
                No rows in <span className="text-gray-400 font-mono">{activeTable}</span> yet
              </p>
              <p className="text-xs text-gray-600">Start a session to populate this table</p>
              {isQuestions && (
                <button onClick={openAdd}
                  className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 rounded-lg text-xs text-white">
                  <Plus size={12} /> Add first question
                </button>
              )}
            </div>
          )}

          {!loading && data && data.rows.length > 0 && (
            <table
              className="min-w-full table-fixed text-xs border-collapse"
              style={{
                width: data.columns.reduce((total, col) => total + getColumnWidth(col), 112),
              }}
            >
              <colgroup>
                <col style={{ width: 32 }} />
                {data.columns.map((col) => (
                  <col key={col} style={{ width: getColumnWidth(col) }} />
                ))}
                <col style={{ width: 80 }} />
              </colgroup>
              <thead className="sticky top-0 bg-gray-900 z-10">
                <tr>
                  {/* Select-all checkbox */}
                  <th className="px-3 py-3 border-b border-gray-800 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="rounded border-gray-600 accent-blue-500 cursor-pointer"
                    />
                  </th>
                  {data.columns.map((col) => (
                    <th
                      key={col}
                      onClick={() => toggleSort(col)}
                      className="relative text-left px-4 py-3 text-gray-400 text-xs font-semibold uppercase tracking-wider border-b border-gray-800 cursor-pointer hover:text-gray-200 whitespace-nowrap select-none"
                    >
                      <span className="flex items-center gap-1">
                        {col.replace(/_/g, " ")}
                        {sortCol === col
                          ? sortAsc
                            ? <ChevronUp size={11} className="text-blue-400" />
                            : <ChevronDown size={11} className="text-blue-400" />
                          : <ChevronDown size={11} className="opacity-0" />
                        }
                      </span>
                      <span
                        onMouseDown={(event) => startColumnResize(event, col)}
                        onDoubleClick={(event) => resetColumnWidth(event, col)}
                        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-500/70"
                        title="Drag to resize; double-click to reset"
                      />
                    </th>
                  ))}
                  <th className="px-3 py-3 border-b border-gray-800 text-gray-600 text-xs font-semibold uppercase tracking-wider w-20 text-left">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const rowId = row.id as number;
                  const selected = selectedIds.has(rowId);
                  return (
                    <tr
                      key={i}
                      className={`border-b border-gray-800/50 hover:bg-gray-900/60 ${
                        selected ? "bg-blue-950/30" : i % 2 === 0 ? "" : "bg-gray-900/20"
                      }`}
                    >
                      {/* Row checkbox */}
                      <td className="px-3 py-2.5 w-8">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleRow(rowId)}
                          className="rounded border-gray-600 accent-blue-500 cursor-pointer"
                        />
                      </td>
                      {data.columns.map((col) => {
                        const { text, cls } = formatCell(col, row[col]);
                        const wrapQuestion = isQuestions && col === "question";
                        const isMono = col === "id" || col.endsWith("_id");
                        return (
                          <td
                            key={col}
                            className={`px-4 py-2.5 ${isMono ? "font-mono text-[11px]" : "text-[13px]"} ${cls} ${
                              wrapQuestion
                                ? "whitespace-normal break-words leading-relaxed"
                                : "overflow-hidden text-ellipsis whitespace-nowrap"
                            }`}
                            title={String(row[col] ?? "")}
                          >
                            {wrapQuestion ? String(row[col] ?? "—") : text}
                          </td>
                        );
                      })}
                      {/* Actions */}
                      <td className="px-3 py-2.5 w-20">
                        <div className="flex items-center gap-0.5">
                          {isQuestions && (
                            <button
                              onClick={() => openEdit(row)}
                              className="p-1.5 rounded-lg text-gray-600 hover:text-blue-400 hover:bg-blue-900/20 transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={13} />
                            </button>
                          )}
                          <button
                            onClick={() => deleteRows([rowId])}
                            disabled={deleting}
                            className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/20 disabled:opacity-40 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Add / Edit Modal (questions only) ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4">
              <h2 className="text-base font-semibold">
                {modal.mode === "edit" ? "Edit Question" : "Add Question"}
              </h2>
              <button onClick={() => setModal(null)} className="text-gray-500 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {/* Tabs — only in add mode */}
            {modal.mode === "add" && (
              <div className="flex gap-1 px-6 pb-4">
                <button
                  onClick={() => { setModalTab("single"); setActionError(""); setCsvResult(null); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    modalTab === "single"
                      ? "bg-blue-700/30 border border-blue-700/60 text-blue-300"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  <Plus size={13} /> Single
                </button>
                <button
                  onClick={() => { setModalTab("csv"); setActionError(""); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    modalTab === "csv"
                      ? "bg-blue-700/30 border border-blue-700/60 text-blue-300"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  <Upload size={13} /> Bulk CSV
                </button>
              </div>
            )}

            <div className="px-6 pb-6">

              {/* ── Single question form ── */}
              {(modal.mode === "edit" || modalTab === "single") && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block">Topic *</label>
                    <input
                      value={form.topic}
                      onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                      placeholder="e.g. System Design"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block">Question *</label>
                    <textarea
                      value={form.question}
                      onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                      placeholder="Enter the interview question…"
                      rows={3}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-600 resize-none"
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-gray-400 mb-1.5 block">Difficulty</label>
                      <select
                        value={form.difficulty}
                        onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm"
                      >
                        <option>Easy</option>
                        <option>Medium</option>
                        <option>Hard</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-400 mb-1.5 block">Company</label>
                      <input
                        value={form.company}
                        onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                        placeholder="e.g. Google"
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block">Category</label>
                    <input
                      value={form.category}
                      onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      placeholder="e.g. Algorithms"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block">Expected Keywords</label>
                    <input
                      value={form.expected_keywords}
                      onChange={(e) => setForm((f) => ({ ...f, expected_keywords: e.target.value }))}
                      placeholder="e.g. consistency, CAP theorem, replication"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  {actionError && <p className="text-xs text-red-400">{actionError}</p>}

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={() => setModal(null)}
                      className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm text-gray-300 border border-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || !form.topic.trim() || !form.question.trim()}
                      className="flex-1 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 rounded-xl text-sm text-white font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      {saving
                        ? <><Save size={14} className="animate-pulse" /> Saving…</>
                        : <><Check size={14} /> {modal.mode === "add" ? "Add Question" : "Save Changes"}</>
                      }
                    </button>
                  </div>
                </div>
              )}

              {/* ── Bulk CSV upload ── */}
              {modal.mode === "add" && modalTab === "csv" && (
                <div className="space-y-4">

                  {csvResult ? (
                    /* Success state */
                    <div className="flex flex-col items-center gap-3 py-6 text-center">
                      <CheckCircle2 size={36} className="text-green-400" />
                      <p className="text-base font-semibold text-green-300">
                        {csvResult.inserted} question{csvResult.inserted !== 1 ? "s" : ""} imported
                      </p>
                      <p className="text-xs text-gray-500">{csvResult.filename}</p>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => { setCsvFile(null); setCsvResult(null); setActionError(""); }}
                          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-sm text-gray-300"
                        >
                          Upload another
                        </button>
                        <button
                          onClick={() => setModal(null)}
                          className="px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded-xl text-sm text-white font-medium"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Drop zone */}
                      <div
                        onDragOver={(e) => { e.preventDefault(); setCsvDragOver(true); }}
                        onDragLeave={() => setCsvDragOver(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setCsvDragOver(false);
                          const f = e.dataTransfer.files[0];
                          if (f) { setCsvFile(f); setCsvResult(null); setActionError(""); }
                        }}
                        onClick={() => document.getElementById("csv-file-input")?.click()}
                        className={`relative flex flex-col items-center gap-2 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                          csvDragOver
                            ? "border-blue-500 bg-blue-900/20"
                            : csvFile
                            ? "border-green-700 bg-green-900/10"
                            : "border-gray-700 hover:border-blue-600 hover:bg-blue-900/10"
                        }`}
                      >
                        <input
                          id="csv-file-input"
                          type="file"
                          accept=".csv"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) { setCsvFile(f); setCsvResult(null); setActionError(""); }
                            e.target.value = "";
                          }}
                        />
                        {csvFile ? (
                          <>
                            <FileText size={28} className="text-green-400" />
                            <p className="text-sm font-medium text-green-300">{csvFile.name}</p>
                            <p className="text-xs text-gray-500">{(csvFile.size / 1024).toFixed(1)} KB · click to change</p>
                          </>
                        ) : (
                          <>
                            <Upload size={28} className="text-gray-600" />
                            <p className="text-sm text-gray-400">Drop a CSV file here, or click to browse</p>
                            <p className="text-xs text-gray-600">Only .csv files are supported</p>
                          </>
                        )}
                      </div>

                      {/* Column reference */}
                      <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/50">
                        <p className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">
                          Expected CSV columns
                        </p>
                        <div className="space-y-2">
                          {[
                            { name: "topic",             required: true,  note: "The subject area, e.g. System Design" },
                            { name: "question",          required: true,  note: "The full interview question text" },
                            { name: "difficulty",        required: false, note: "Easy / Medium / Hard — defaults to Medium" },
                            { name: "company",           required: false, note: "e.g. Google, Meta" },
                            { name: "category",          required: false, note: "e.g. Algorithms, Behavioral" },
                            { name: "expected_keywords", required: false, note: "Comma-separated hint keywords" },
                          ].map((col) => (
                            <div key={col.name} className="flex items-start gap-2.5">
                              <code className={`shrink-0 text-xs px-2 py-0.5 rounded font-mono ${
                                col.required
                                  ? "bg-blue-900/50 text-blue-300 border border-blue-800/60"
                                  : "bg-gray-700/60 text-gray-400 border border-gray-600/40"
                              }`}>
                                {col.name}
                              </code>
                              <span className="text-xs text-gray-500 leading-tight mt-0.5">
                                {col.required && <span className="text-blue-400 font-medium mr-1">required ·</span>}
                                {col.note}
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-gray-600 mt-3 border-t border-gray-700 pt-3">
                          Column names are case-insensitive. Extra columns are ignored. Rows missing topic or question are skipped automatically.
                        </p>
                      </div>

                      {actionError && <p className="text-xs text-red-400">{actionError}</p>}

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setModal(null)}
                          className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm text-gray-300 border border-gray-700"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleCsvUpload}
                          disabled={!csvFile || csvUploading}
                          className="flex-1 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm text-white font-medium flex items-center justify-center gap-2 transition-colors"
                        >
                          {csvUploading
                            ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading…</>
                            : <><Upload size={14} /> Import CSV</>
                          }
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
