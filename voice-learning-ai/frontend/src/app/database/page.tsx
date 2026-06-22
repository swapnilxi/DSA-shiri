"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Database, RefreshCw, ChevronUp, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";

type Row = Record<string, unknown>;

interface TableData {
  table: string;
  columns: string[];
  rows: Row[];
  count: number;
}

const TABLES = [
  { name: "sessions",      label: "Sessions",      desc: "Every interview session" },
  { name: "responses",     label: "Responses",     desc: "Your spoken answers (transcribed)" },
  { name: "scores",        label: "Scores",        desc: "Per-answer rubric scores" },
  { name: "topic_mastery", label: "Topic Mastery", desc: "Rolling averages per topic" },
  { name: "questions",     label: "Questions",     desc: "Loaded question bank" },
];

const SCORE_COLS = new Set(["total", "technical_correctness", "depth_completeness", "communication_clarity", "problem_solving", "avg_score"]);

export default function DatabasePage() {
  const router = useRouter();
  const [activeTable, setActiveTable] = useState("sessions");
  const [data, setData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(false);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(false);

  const load = useCallback(async (table: string) => {
    setLoading(true);
    setData(null);
    setSortCol(null);
    try {
      const d = await api.getDbTable(table);
      setData(d);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(activeTable);
  }, [activeTable, load]);

  function toggleSort(col: string) {
    if (sortCol === col) {
      setSortAsc((a) => !a);
    } else {
      setSortCol(col);
      setSortAsc(false);
    }
  }

  const rows = data ? [...data.rows].sort((a, b) => {
    if (!sortCol) return 0;
    const av = a[sortCol] ?? "";
    const bv = b[sortCol] ?? "";
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortAsc ? cmp : -cmp;
  }) : [];

  function formatCell(col: string, val: unknown): { text: string; cls: string } {
    if (val === null || val === undefined) return { text: "—", cls: "text-gray-600" };
    if (typeof val === "string" && val.length > 120) {
      return { text: val.slice(0, 120) + "…", cls: "text-gray-300" };
    }
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

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 bg-gray-900 border-b border-gray-800">
        <button onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm">
          <ArrowLeft size={16} />
        </button>
        <Database size={18} className="text-blue-400" />
        <h1 className="text-base font-semibold">Database Viewer</h1>
        <span className="text-xs text-gray-500 font-mono">voicelearning.db</span>
        <div className="ml-auto flex items-center gap-2">
          {data && (
            <span className="text-xs text-gray-500">{data.count} rows</span>
          )}
          <button onClick={() => load(activeTable)}
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — table list */}
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

        {/* Main — table content */}
        <div className="flex-1 overflow-auto p-0">
          {loading && (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
              Loading {active.label}…
            </div>
          )}

          {!loading && data && data.rows.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <Database size={32} className="text-gray-700" />
              <p className="text-gray-500 text-sm">No rows in <span className="text-gray-400 font-mono">{activeTable}</span> yet</p>
              <p className="text-xs text-gray-600">Start a session to populate this table</p>
            </div>
          )}

          {!loading && data && data.rows.length > 0 && (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-gray-900 z-10">
                <tr>
                  {data.columns.map((col) => (
                    <th
                      key={col}
                      onClick={() => toggleSort(col)}
                      className="text-left px-4 py-3 text-gray-400 font-medium border-b border-gray-800 cursor-pointer hover:text-gray-200 whitespace-nowrap select-none"
                    >
                      <span className="flex items-center gap-1">
                        {col}
                        {sortCol === col ? (
                          sortAsc ? <ChevronUp size={11} className="text-blue-400" /> : <ChevronDown size={11} className="text-blue-400" />
                        ) : (
                          <ChevronDown size={11} className="opacity-0 group-hover:opacity-30" />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={`border-b border-gray-800/50 hover:bg-gray-900/60 ${i % 2 === 0 ? "" : "bg-gray-900/20"}`}>
                    {data.columns.map((col) => {
                      const { text, cls } = formatCell(col, row[col]);
                      return (
                        <td key={col} className={`px-4 py-2.5 font-mono max-w-xs truncate ${cls}`} title={String(row[col] ?? "")}>
                          {text}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
