"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart2, BookOpen, Mic, Upload, Zap, ChevronDown, Database, Sparkles } from "lucide-react";
import { api, Stats, TopicMastery, Session } from "@/lib/api";
import { TopicRadar } from "@/components/dashboard/TopicRadar";

interface ModelGroups {
  ollama: string[];
  deepseek: string[];
  deepseek_configured: boolean;
  default: string;
}

const DEEPSEEK_LABELS: Record<string, string> = {
  "deepseek-chat": "DeepSeek V3 (Chat)",
  "deepseek-reasoner": "DeepSeek R1 (Reasoner)",
};

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
        // Restore last used model from localStorage, fallback to server default
        const saved = localStorage.getItem("selectedModel");
        setSelectedModel(saved && [...mg.ollama, ...mg.deepseek].includes(saved) ? saved : mg.default);
      })
      .catch(() => {});
  }, []);

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
  const deepSeekNotConfigured = isDeepSeek && modelGroups && !modelGroups.deepseek_configured;

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
                {isDeepSeek && (
                  <span className="ml-2 px-1.5 py-0.5 bg-blue-900 text-blue-300 rounded text-xs">API</span>
                )}
                {!isDeepSeek && (
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
              {!isDeepSeek && selectedModel && (
                <p className="text-xs text-green-400 mt-1.5">
                  Installed locally • This model will run the interview
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
                disabled={starting || !!deepSeekNotConfigured}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <button onClick={() => router.push("/settings")}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                <Upload size={12} /> Upload CSV
              </button>
            </div>
            <div className="space-y-2">
              {sessions.slice(0, 6).map((s) => (
                <div key={s.id}
                  onClick={() => router.push(`/dashboard/session/${s.id}`)}
                  className="flex items-center justify-between py-2.5 px-3 bg-gray-800 hover:bg-gray-750 rounded-xl cursor-pointer">
                  <div>
                    <p className="text-sm text-gray-200">{s.title}</p>
                    <p className="text-xs text-gray-500">{new Date(s.started_at).toLocaleDateString()}</p>
                  </div>
                  {s.total_score != null && (
                    <span className={`text-sm font-bold ${
                      s.total_score >= 80 ? "text-green-400" : s.total_score >= 60 ? "text-yellow-400" : "text-red-400"
                    }`}>{s.total_score.toFixed(0)}</span>
                  )}
                </div>
              ))}
              {sessions.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">No sessions yet — start your first interview!</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
