"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle, AlertCircle, ArrowLeft, Eye, EyeOff, Key, Trash2, Cpu, Volume2 } from "lucide-react";
import { api } from "@/lib/api";

interface HealthData {
  ollama_model: string;
  available_models: string[];
  ollama_available: boolean;
  deepseek_configured: boolean;
  tts_engine: "kokoro" | "apple";
}

export default function SettingsPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [health, setHealth] = useState<HealthData | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [topics, setTopics] = useState<{ topic: string; count: number }[]>([]);
  const [ollamaModel, setOllamaModel] = useState("");
  const [ollamaStatus, setOllamaStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [ollamaSaving, setOllamaSaving] = useState(false);
  const [ttsEngine, setTtsEngine] = useState<"kokoro" | "apple">("kokoro");
  const [ttsStatus, setTtsStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [ttsSaving, setTtsSaving] = useState(false);

  // DeepSeek key state
  const [dsKey, setDsKey] = useState("");
  const [dsKeyVisible, setDsKeyVisible] = useState(false);
  const [dsStatus, setDsStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [dsSaving, setDsSaving] = useState(false);

  useEffect(() => {
    api.health().then((data) => {
      setHealth(data);
      setOllamaModel(data.ollama_model);
      setTtsEngine(data.tts_engine);
    }).catch(() => {});
    api.listTopics().then(setTopics).catch(() => {});
  }, []);

  async function handleSaveOllamaModel() {
    if (!ollamaModel) return;
    setOllamaSaving(true);
    setOllamaStatus(null);
    try {
      const result = await api.saveOllamaModel(ollamaModel);
      localStorage.setItem("selectedModel", result.model);
      setHealth((current) => current ? { ...current, ollama_model: result.model } : current);
      setOllamaStatus({ ok: true, msg: `Default Ollama model set to ${result.model}.` });
    } catch (err: unknown) {
      setOllamaStatus({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setOllamaSaving(false);
    }
  }

  async function handleSaveTtsEngine() {
    setTtsSaving(true);
    setTtsStatus(null);
    try {
      const result = await api.saveTtsEngine(ttsEngine);
      setHealth((current) => current ? { ...current, tts_engine: result.engine } : current);
      setTtsStatus({
        ok: true,
        msg: result.engine === "apple"
          ? "Apple TTS selected. It starts quickly and uses the built-in macOS voice."
          : "Kokoro selected. It provides the more natural AI voice.",
      });
    } catch (err: unknown) {
      setTtsStatus({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setTtsSaving(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.uploadQuestions(file);
      setUploadStatus({ ok: true, msg: `Uploaded "${res.filename}" — ${res.inserted} questions added` });
      setTopics(await api.listTopics());
    } catch (err: unknown) {
      setUploadStatus({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveKey() {
    if (!dsKey.trim()) return;
    setDsSaving(true);
    setDsStatus(null);
    try {
      await api.saveDeepSeekKey(dsKey.trim());
      setDsStatus({ ok: true, msg: "API key saved — DeepSeek models are now available." });
      setHealth((h) => h ? { ...h, deepseek_configured: true } : h);
      setDsKey("");
    } catch (err: unknown) {
      setDsStatus({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setDsSaving(false);
    }
  }

  async function handleRemoveKey() {
    setDsSaving(true);
    setDsStatus(null);
    try {
      await api.removeDeepSeekKey();
      setDsStatus({ ok: true, msg: "API key removed." });
      setHealth((h) => h ? { ...h, deepseek_configured: false } : h);
    } catch (err: unknown) {
      setDsStatus({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setDsSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6">
          <ArrowLeft size={16} /> Dashboard
        </button>

        <h1 className="text-xl font-bold mb-6">Settings</h1>

        {/* System status */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">System Status</h2>
          {health ? (
            <div className="space-y-2 text-sm">
              <Row label="Ollama" value={health.ollama_available ? "✅ Connected" : "❌ Not running"} />
              <Row label="Default model" value={health.ollama_model} />
              <Row label="Ollama models" value={health.available_models.join(", ") || "none"} />
              <Row label="DeepSeek" value={health.deepseek_configured ? "✅ API key configured" : "⚪ Not configured"} />
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Checking backend...</p>
          )}
        </div>

        {/* Ollama model */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-1 flex items-center gap-2">
            <Cpu size={15} /> Ollama Model
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Choose the local model used by default for interview questions and assessment.
          </p>

          {health?.available_models.length ? (
            <div className="flex gap-2">
              <select
                value={ollamaModel}
                onChange={(event) => setOllamaModel(event.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm"
              >
                {health.available_models.map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
              <button
                onClick={handleSaveOllamaModel}
                disabled={ollamaSaving || !ollamaModel || ollamaModel === health.ollama_model}
                className="px-5 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 rounded-xl text-sm font-medium"
              >
                {ollamaSaving ? "Saving..." : "Use model"}
              </button>
            </div>
          ) : (
            <p className="text-sm text-yellow-400">
              No local Ollama models found. Install one with <code className="bg-gray-800 px-1 rounded">ollama pull model-name</code>.
            </p>
          )}

          {ollamaStatus && (
            <div className={`flex items-start gap-2 mt-3 p-3 rounded-xl text-sm ${
              ollamaStatus.ok ? "bg-green-900/40 text-green-300" : "bg-red-900/40 text-red-300"
            }`}>
              {ollamaStatus.ok ? <CheckCircle size={15} className="mt-0.5 shrink-0" /> : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
              {ollamaStatus.msg}
            </div>
          )}
        </div>

        {/* TTS engine */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-1 flex items-center gap-2">
            <Volume2 size={15} /> Interviewer Voice
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Apple TTS starts faster. Kokoro is usually more natural but has a model warm-up cost.
          </p>

          <div className="flex gap-2">
            <select
              value={ttsEngine}
              onChange={(event) => setTtsEngine(event.target.value as "kokoro" | "apple")}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm"
            >
              <option value="apple">Apple TTS — fastest startup</option>
              <option value="kokoro">Kokoro-82M — natural voice</option>
            </select>
            <button
              onClick={handleSaveTtsEngine}
              disabled={ttsSaving || ttsEngine === health?.tts_engine}
              className="px-5 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 rounded-xl text-sm font-medium"
            >
              {ttsSaving ? "Saving..." : "Use voice"}
            </button>
          </div>

          {ttsStatus && (
            <div className={`flex items-start gap-2 mt-3 p-3 rounded-xl text-sm ${
              ttsStatus.ok ? "bg-green-900/40 text-green-300" : "bg-red-900/40 text-red-300"
            }`}>
              {ttsStatus.ok ? <CheckCircle size={15} className="mt-0.5 shrink-0" /> : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
              {ttsStatus.msg}
            </div>
          )}
        </div>

        {/* DeepSeek API key */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-1 flex items-center gap-2">
            <Key size={15} /> DeepSeek API Key
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Required to use <span className="text-gray-300">deepseek-chat</span> (V3) or <span className="text-gray-300">deepseek-reasoner</span> (R1).
            Get your key at <span className="text-blue-400">platform.deepseek.com</span>.
            The key is stored in <code className="bg-gray-800 px-1 rounded">backend/.env</code> on your machine only.
          </p>

          {health?.deepseek_configured ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-400 font-mono">
                sk-••••••••••••••••••••••••
              </div>
              <button
                onClick={handleRemoveKey}
                disabled={dsSaving}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-red-900/50 hover:bg-red-900 border border-red-800 rounded-xl text-red-300 text-sm disabled:opacity-50"
              >
                <Trash2 size={14} /> Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={dsKeyVisible ? "text" : "password"}
                  value={dsKey}
                  onChange={(e) => setDsKey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveKey()}
                  placeholder="sk-..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 pr-10 text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-blue-600"
                />
                <button
                  onClick={() => setDsKeyVisible((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {dsKeyVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <button
                onClick={handleSaveKey}
                disabled={dsSaving || !dsKey.trim()}
                className="px-5 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 rounded-xl text-sm font-medium"
              >
                {dsSaving ? "Saving..." : "Save"}
              </button>
            </div>
          )}

          {dsStatus && (
            <div className={`flex items-start gap-2 mt-3 p-3 rounded-xl text-sm ${
              dsStatus.ok ? "bg-green-900/40 text-green-300" : "bg-red-900/40 text-red-300"
            }`}>
              {dsStatus.ok ? <CheckCircle size={15} className="mt-0.5 shrink-0" /> : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
              {dsStatus.msg}
            </div>
          )}
        </div>

        {/* Upload question bank */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-2">Upload Question Bank</h2>
          <p className="text-xs text-gray-500 mb-4">
            CSV must have: <code className="bg-gray-800 px-1 rounded">topic</code>, <code className="bg-gray-800 px-1 rounded">question</code>.
            Optional: <code className="bg-gray-800 px-1 rounded">difficulty</code>, <code className="bg-gray-800 px-1 rounded">company</code>, <code className="bg-gray-800 px-1 rounded">category</code>, <code className="bg-gray-800 px-1 rounded">expected_keywords</code>
          </p>

          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 rounded-xl text-sm font-medium"
          >
            <Upload size={16} />
            {uploading ? "Uploading..." : "Choose CSV file"}
          </button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleUpload} />

          {uploadStatus && (
            <div className={`flex items-start gap-2 mt-4 p-3 rounded-xl text-sm ${
              uploadStatus.ok ? "bg-green-900/40 text-green-300" : "bg-red-900/40 text-red-300"
            }`}>
              {uploadStatus.ok ? <CheckCircle size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
              {uploadStatus.msg}
            </div>
          )}
        </div>

        {/* Loaded topics */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Loaded Topics ({topics.length})</h2>
          <div className="grid grid-cols-2 gap-2">
            {topics.map((t) => (
              <div key={t.topic} className="flex justify-between bg-gray-800 rounded-lg px-3 py-2 text-sm">
                <span className="text-gray-200 truncate">{t.topic}</span>
                <span className="text-gray-500 ml-2 shrink-0">{t.count}q</span>
              </div>
            ))}
            {topics.length === 0 && <p className="text-gray-500 text-sm col-span-2">No questions loaded yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-200 font-mono text-xs">{value}</span>
    </div>
  );
}
