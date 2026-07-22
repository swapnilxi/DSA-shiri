"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle, AlertCircle, ArrowLeft, Eye, EyeOff, Key, Trash2, Cpu, Volume2, Mic, ChevronDown, Brain } from "lucide-react";
import { api } from "@/lib/api";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";


const DEEPSEEK_LABELS: Record<string, string> = {
  "deepseek-chat": "DeepSeek V3 (Chat)",
  "deepseek-reasoner": "DeepSeek R1 (Reasoner)",
};
const GEMINI_LABELS: Record<string, string> = {
  "gemini-2.0-flash": "Gemini 2.0 Flash ⚡ (free tier)",
  "gemini-1.5-flash": "Gemini 1.5 Flash (free tier)",
};

function InfoTip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center ml-1.5 align-middle">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="w-4 h-4 rounded-full bg-gray-700 text-gray-400 text-[10px] font-bold leading-none flex items-center justify-center hover:bg-gray-600 hover:text-white"
        aria-label="More info"
      >i</button>
      {show && (
        <span className="absolute left-5 top-0 z-50 w-64 bg-gray-800 border border-gray-600 rounded-xl p-3 text-xs text-gray-300 leading-relaxed shadow-xl">
          {text}
        </span>
      )}
    </span>
  );
}

const CARTESIA_VOICES = [
  { id: "47c38ca4-5f35-497b-b1a3-415245fb35e1", name: "Daniel (English, male)" },
  { id: "a0e99841-438c-4a64-b679-ae501e7d6091", name: "Barbra (English, female)" },
  { id: "custom", name: "Custom voice ID…" },
];

interface ModelGroups {
  ollama: string[];
  deepseek: string[];
  deepseek_configured: boolean;
  gemini: string[];
  gemini_configured: boolean;
  default: string;
}

interface HealthData {
  ollama_model: string;
  available_models: string[];
  ollama_available: boolean;
  deepseek_configured: boolean;
  gemini_configured: boolean;
  cartesia_configured: boolean;
  cartesia_model: string;
  cartesia_voice_id: string;
  deepgram_configured: boolean;
  deepgram_model: string;
  stt_engine: "whisper" | "moonshine" | "groq" | "deepgram";
  whisper_model: string;
  moonshine_model: string;
  groq_configured: boolean;
  groq_stt_model: string;
  deepgram_stt_model: string;
  tts_engine: "kokoro" | "apple" | "cartesia" | "piper" | "deepgram";
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

  // Default AI model (full grouped picker)
  const [modelGroups, setModelGroups] = useState<ModelGroups | null>(null);
  const [defaultModel, setDefaultModel] = useState<string>("");
  const [defaultModelSaved, setDefaultModelSaved] = useState(false);

  // STT engine
  const [sttEngine, setSttEngine] = useState<"whisper" | "moonshine" | "groq" | "deepgram">("whisper");
  const [sttStatus, setSttStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [sttSaving, setSttSaving] = useState(false);
  const [deepgramSttModel, setDeepgramSttModel] = useState("nova-3");
  const [deepgramSttModelStatus, setDeepgramSttModelStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [deepgramSttModelSaving, setDeepgramSttModelSaving] = useState(false);
  const [whisperModel, setWhisperModel] = useState("large-v3-turbo");
  const [moonshineModel, setMoonshineModel] = useState<"moonshine/tiny" | "moonshine/base">("moonshine/tiny");
  const [moonshineModelStatus, setMoonshineModelStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [moonshineModelSaving, setMoonshineModelSaving] = useState(false);
  const [groqKey, setGroqKey] = useState("");
  const [groqKeyVisible, setGroqKeyVisible] = useState(false);
  const [groqStatus, setGroqStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [groqSaving, setGroqSaving] = useState(false);
  const [groqSttModel, setGroqSttModel] = useState("whisper-large-v3-turbo");
  const [groqSttModelStatus, setGroqSttModelStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [groqSttModelSaving, setGroqSttModelSaving] = useState(false);
  const [whisperModelStatus, setWhisperModelStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [whisperModelSaving, setWhisperModelSaving] = useState(false);
  const [ttsEngine, setTtsEngine] = useState<"kokoro" | "apple" | "cartesia" | "piper" | "deepgram">("kokoro");
  const [cartesiaModel, setCartesiaModel] = useState<"sonic-2" | "sonic-english">("sonic-2");
  const [cartesiaModelStatus, setCartesiaModelStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [cartesiaModelSaving, setCartesiaModelSaving] = useState(false);
  const [ttsStatus, setTtsStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [ttsSaving, setTtsSaving] = useState(false);

  // DeepSeek key state
  const [dsKey, setDsKey] = useState("");
  const [dsKeyVisible, setDsKeyVisible] = useState(false);
  const [dsStatus, setDsStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [dsSaving, setDsSaving] = useState(false);

  // Gemini key state
  const [geminiKey, setGeminiKey] = useState("");
  const [geminiKeyVisible, setGeminiKeyVisible] = useState(false);
  const [geminiStatus, setGeminiStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [geminiSaving, setGeminiSaving] = useState(false);

  // Cartesia key state
  const [deepgramKey, setDeepgramKey] = useState("");
  const [deepgramKeyVisible, setDeepgramKeyVisible] = useState(false);
  const [deepgramStatus, setDeepgramStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [deepgramSaving, setDeepgramSaving] = useState(false);
  const [deepgramModel, setDeepgramModel] = useState("aura-2-en-us");
  const [deepgramModelStatus, setDeepgramModelStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [deepgramModelSaving, setDeepgramModelSaving] = useState(false);
  const [cartesiaVoiceId, setCartesiaVoiceId] = useState("47c38ca4-5f35-497b-b1a3-415245fb35e1");
  const [cartesiaVoiceStatus, setCartesiaVoiceStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [cartesiaVoiceSaving, setCartesiaVoiceSaving] = useState(false);
  const [cartesiaKey, setCartesiaKey] = useState("");
  const [cartesiaKeyVisible, setCartesiaKeyVisible] = useState(false);
  const [cartesiaStatus, setCartesiaStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [cartesiaSaving, setCartesiaSaving] = useState(false);

  useEffect(() => {
    api.settings().then((data) => {
      setOllamaModel(data.ollama_model);
      setTtsEngine(data.tts_engine);
      if (data.cartesia_model === "sonic-english") setCartesiaModel("sonic-english");
      if (data.cartesia_voice_id) setCartesiaVoiceId(data.cartesia_voice_id);
      if (data.deepgram_model) setDeepgramModel(data.deepgram_model);
      if (data.stt_engine) setSttEngine(data.stt_engine);
      if (data.deepgram_stt_model) setDeepgramSttModel(data.deepgram_stt_model);
      if (data.whisper_model) setWhisperModel(data.whisper_model);
      if (data.moonshine_model) setMoonshineModel(data.moonshine_model as "moonshine/tiny" | "moonshine/base");
      if (data.groq_stt_model) setGroqSttModel(data.groq_stt_model);
    }).catch(() => {});
    api.health().then((h) => setHealth(h)).catch(() => {});
    api.getModels().then((mg) => {
      setModelGroups(mg);
      const saved = localStorage.getItem("selectedModel");
      const allModels = [...mg.ollama, ...mg.deepseek, ...mg.gemini];
      setDefaultModel(saved && allModels.includes(saved) ? saved : mg.default);
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
      const msgs: Record<string, string> = {
        apple: "Apple TTS selected. Built-in macOS voice, fastest startup.",
        kokoro: "Kokoro selected. Natural local AI voice (82M model, ~50ms/sentence).",
        piper: "Piper selected. Lightweight local ONNX voice (~50MB, real-time on any CPU).",
        cartesia: "Cartesia selected. Ultra-low latency cloud TTS (~80ms, free tier ~500K chars/mo).",
        deepgram: "Deepgram selected. Aura cloud TTS (~200ms, $200 one-time signup credit).",
      };
      setTtsStatus({ ok: true, msg: msgs[result.engine] ?? "Voice engine updated." });
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

  async function handleSaveGeminiKey() {
    if (!geminiKey.trim()) return;
    setGeminiSaving(true);
    setGeminiStatus(null);
    try {
      await api.saveGeminiKey(geminiKey.trim());
      setGeminiStatus({ ok: true, msg: "API key saved — Gemini Flash models are now available." });
      setHealth((h) => h ? { ...h, gemini_configured: true } : h);
      setGeminiKey("");
    } catch (err: unknown) {
      setGeminiStatus({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setGeminiSaving(false);
    }
  }

  async function handleRemoveGeminiKey() {
    setGeminiSaving(true);
    setGeminiStatus(null);
    try {
      await api.removeGeminiKey();
      setGeminiStatus({ ok: true, msg: "API key removed." });
      setHealth((h) => h ? { ...h, gemini_configured: false } : h);
    } catch (err: unknown) {
      setGeminiStatus({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setGeminiSaving(false);
    }
  }

  async function handleSaveCartesiaKey() {
    if (!cartesiaKey.trim()) return;
    setCartesiaSaving(true);
    setCartesiaStatus(null);
    try {
      await api.saveCartesiaKey(cartesiaKey.trim());
      setCartesiaStatus({ ok: true, msg: "API key saved — Cartesia Sonic-2 is now available as a voice option." });
      setHealth((h) => h ? { ...h, cartesia_configured: true } : h);
      setCartesiaKey("");
    } catch (err: unknown) {
      setCartesiaStatus({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setCartesiaSaving(false);
    }
  }

  async function handleSaveDeepgramKey() {
    if (!deepgramKey.trim()) return;
    setDeepgramSaving(true);
    setDeepgramStatus(null);
    try {
      await api.saveDeepgramKey(deepgramKey.trim());
      setDeepgramStatus({ ok: true, msg: "API key saved — Deepgram Aura is now available as a voice option." });
      setHealth((h) => h ? { ...h, deepgram_configured: true } : h);
      setDeepgramKey("");
    } catch (err: unknown) {
      setDeepgramStatus({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setDeepgramSaving(false);
    }
  }

  async function handleRemoveDeepgramKey() {
    setDeepgramSaving(true);
    setDeepgramStatus(null);
    try {
      await api.removeDeepgramKey();
      setDeepgramStatus({ ok: true, msg: "API key removed." });
      setHealth((h) => h ? { ...h, deepgram_configured: false } : h);
    } catch (err: unknown) {
      setDeepgramStatus({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setDeepgramSaving(false);
    }
  }

  async function handleSaveDeepgramModel() {
    setDeepgramModelSaving(true);
    setDeepgramModelStatus(null);
    try {
      await api.saveDeepgramModel(deepgramModel);
      setHealth((h) => h ? { ...h, deepgram_model: deepgramModel } : h);
      const labels: Record<string, string> = {
        "aura-2-en-us": "aura-2-en-us — best quality",
        "aura-asteria-en": "aura-asteria-en — fastest/cheapest",
        "aura-luna-en": "aura-luna-en — natural female",
        "aura-stella-en": "aura-stella-en — upbeat female",
      };
      setDeepgramModelStatus({ ok: true, msg: `Model set to ${labels[deepgramModel] ?? deepgramModel}.` });
    } catch (err: unknown) {
      setDeepgramModelStatus({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setDeepgramModelSaving(false);
    }
  }

  async function handleSaveCartesiaVoice() {
    if (!cartesiaVoiceId.trim()) return;
    setCartesiaVoiceSaving(true);
    setCartesiaVoiceStatus(null);
    try {
      await api.saveCartesiaVoice(cartesiaVoiceId.trim());
      const label = CARTESIA_VOICES.find((v) => v.id === cartesiaVoiceId.trim())?.name ?? "Custom voice";
      setCartesiaVoiceStatus({ ok: true, msg: `Voice set to ${label}.` });
      setHealth((h) => h ? { ...h, cartesia_voice_id: cartesiaVoiceId.trim() } : h);
    } catch (err: unknown) {
      setCartesiaVoiceStatus({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setCartesiaVoiceSaving(false);
    }
  }

  async function handleSaveCartesiaModel() {
    setCartesiaModelSaving(true);
    setCartesiaModelStatus(null);
    try {
      await api.saveCartesiaModel(cartesiaModel);
      setHealth((h) => h ? { ...h, cartesia_model: cartesiaModel } : h);
      setCartesiaModelStatus({ ok: true, msg: cartesiaModel === "sonic-english" ? "sonic-english selected — faster and cheaper." : "sonic-2 selected — best quality." });
    } catch (err: unknown) {
      setCartesiaModelStatus({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setCartesiaModelSaving(false);
    }
  }

  async function handleRemoveCartesiaKey() {
    setCartesiaSaving(true);
    setCartesiaStatus(null);
    try {
      await api.removeCartesiaKey();
      setCartesiaStatus({ ok: true, msg: "API key removed." });
      setHealth((h) => h ? { ...h, cartesia_configured: false } : h);
    } catch (err: unknown) {
      setCartesiaStatus({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setCartesiaSaving(false);
    }
  }

  async function handleSaveMoonshineModel() {
    setMoonshineModelSaving(true);
    setMoonshineModelStatus(null);
    try {
      await api.saveMoonshineModel(moonshineModel);
      setHealth((h) => h ? { ...h, moonshine_model: moonshineModel } : h);
      setMoonshineModelStatus({ ok: true, msg: `${moonshineModel === "moonshine/tiny" ? "tiny (~25 MB)" : "base (~75 MB)"} selected. Will load on next session.` });
    } catch (err: unknown) {
      setMoonshineModelStatus({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setMoonshineModelSaving(false);
    }
  }

  async function handleSaveGroqKey() {
    if (!groqKey.trim()) return;
    setGroqSaving(true);
    setGroqStatus(null);
    try {
      await api.saveGroqKey(groqKey.trim());
      setGroqStatus({ ok: true, msg: "API key saved — Groq Whisper is now available." });
      setHealth((h) => h ? { ...h, groq_configured: true } : h);
      setGroqKey("");
    } catch (err: unknown) {
      setGroqStatus({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setGroqSaving(false);
    }
  }

  async function handleRemoveGroqKey() {
    setGroqSaving(true);
    setGroqStatus(null);
    try {
      await api.removeGroqKey();
      setGroqStatus({ ok: true, msg: "API key removed." });
      setHealth((h) => h ? { ...h, groq_configured: false } : h);
    } catch (err: unknown) {
      setGroqStatus({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setGroqSaving(false);
    }
  }

  async function handleSaveGroqSttModel() {
    setGroqSttModelSaving(true);
    setGroqSttModelStatus(null);
    try {
      await api.saveGroqSttModel(groqSttModel);
      setHealth((h) => h ? { ...h, groq_stt_model: groqSttModel } : h);
      setGroqSttModelStatus({ ok: true, msg: `Groq STT model set to ${groqSttModel}.` });
    } catch (err: unknown) {
      setGroqSttModelStatus({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setGroqSttModelSaving(false);
    }
  }

  async function handleSaveWhisperModel() {
    setWhisperModelSaving(true);
    setWhisperModelStatus(null);
    try {
      await api.saveWhisperModel(whisperModel);
      setHealth((h) => h ? { ...h, whisper_model: whisperModel } : h);
      setWhisperModelStatus({ ok: true, msg: `Whisper model set to ${whisperModel}. Will load on next session.` });
    } catch (err: unknown) {
      setWhisperModelStatus({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setWhisperModelSaving(false);
    }
  }

  function handleSaveDefaultModel() {
    if (!defaultModel) return;
    localStorage.setItem("selectedModel", defaultModel);
    setDefaultModelSaved(true);
    setTimeout(() => setDefaultModelSaved(false), 2500);
    // Also persist to backend if it's an Ollama model
    if (modelGroups?.ollama.includes(defaultModel)) {
      api.saveOllamaModel(defaultModel).catch(() => {});
    }
  }

  async function handleSaveSttEngine() {
    setSttSaving(true);
    setSttStatus(null);
    try {
      await api.saveSttEngine(sttEngine);
      setHealth((h) => h ? { ...h, stt_engine: sttEngine } : h);
      const msgs: Record<string, string> = {
        whisper: "Whisper selected. Local STT — free, offline, CoreML on Apple Silicon.",
        moonshine: "Moonshine selected. Local ONNX STT — ~25 MB, fastest on M2, free, offline.",
        groq: "Groq Whisper selected. Cloud STT — free 18K sec/month, ~300× realtime.",
        deepgram: "Deepgram Nova selected. Cloud STT — ~100ms, uses your Deepgram key.",
      };
      setSttStatus({ ok: true, msg: msgs[sttEngine] ?? "STT engine updated." });
    } catch (err: unknown) {
      setSttStatus({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setSttSaving(false);
    }
  }

  async function handleSaveDeepgramSttModel() {
    setDeepgramSttModelSaving(true);
    setDeepgramSttModelStatus(null);
    try {
      await api.saveDeepgramSttModel(deepgramSttModel);
      setHealth((h) => h ? { ...h, deepgram_stt_model: deepgramSttModel } : h);
      setDeepgramSttModelStatus({ ok: true, msg: `STT model set to ${deepgramSttModel}.` });
    } catch (err: unknown) {
      setDeepgramSttModelStatus({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setDeepgramSttModelSaving(false);
    }
  }

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings" },
        ]}
      />
      <div className="min-h-screen bg-gray-950 text-white p-6">
        <div className="max-w-2xl mx-auto">
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
              <Row label="Gemini" value={health.gemini_configured ? "✅ API key configured" : "⚪ Not configured"} />
              <Row label="Cartesia TTS" value={health.cartesia_configured ? "✅ API key configured" : "⚪ Not configured"} />
              <Row label="Deepgram" value={health.deepgram_configured ? "✅ API key configured" : "⚪ Not configured"} />
              <Row label="Groq STT" value={health.groq_configured ? "✅ API key configured" : "⚪ Not configured"} />
              <Row label="STT engine" value={{ whisper: "Whisper (local)", moonshine: "Moonshine (local, M2)", groq: "Groq Whisper (cloud)", deepgram: "Deepgram Nova (cloud)" }[health.stt_engine] ?? health.stt_engine} />
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Checking backend...</p>
          )}
        </div>

        {/* Default AI Model */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-1 flex items-center gap-2">
            <Brain size={15} /> Default AI Model
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Pre-selects this model on the dashboard. You can still override it per session.
          </p>

          {modelGroups ? (
            <>
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <select
                    value={defaultModel}
                    onChange={(e) => setDefaultModel(e.target.value)}
                    className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 pr-8 text-sm"
                  >
                    {modelGroups.ollama.length ? (
                      <optgroup label="Ollama — installed locally">
                        {modelGroups.ollama.map((m) => (
                          <option key={m} value={m}>{m === "qwen2.5:latest" ? "Qwen 2.5 (qwen2.5:latest)" : m}</option>
                        ))}
                      </optgroup>
                    ) : (
                      <option value="" disabled>No local Ollama models found</option>
                    )}
                    <optgroup label="Google Gemini — API (free tier)">
                      {modelGroups.gemini.map((m) => (
                        <option key={m} value={m}>
                          {GEMINI_LABELS[m] ?? m}{!modelGroups.gemini_configured ? " ⚠ key needed" : ""}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="DeepSeek — API">
                      {modelGroups.deepseek.map((m) => (
                        <option key={m} value={m}>
                          {DEEPSEEK_LABELS[m] ?? m}{!modelGroups.deepseek_configured ? " ⚠ key needed" : ""}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
                <button
                  onClick={handleSaveDefaultModel}
                  disabled={!defaultModel}
                  className="px-5 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 rounded-xl text-sm font-medium"
                >
                  {defaultModelSaved ? "✓ Saved" : "Set default"}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Current default: <span className="text-gray-300 font-mono">{localStorage.getItem("selectedModel") ?? modelGroups.default}</span>
              </p>
            </>
          ) : (
            <p className="text-gray-500 text-sm">Loading models...</p>
          )}
        </div>

        {/* TTS engine */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-1 flex items-center gap-2">
            <Volume2 size={15} /> Interviewer Voice
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Choose your interviewer&apos;s voice.
            <InfoTip text="M2 recommendations: Piper (50MB, fastest local) or Apple TTS (zero overhead). Kokoro works but takes ~1s warmup on M2. Cloud options (Cartesia/Deepgram) need an internet connection but have no local overhead." />
          </p>

          <div className="flex gap-2">
            <select
              value={ttsEngine}
              onChange={(event) => setTtsEngine(event.target.value as "kokoro" | "apple" | "cartesia" | "piper" | "deepgram")}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm"
            >
              <option value="kokoro">Kokoro-82M — natural voice (local, ~300MB)</option>
              <option value="piper">Piper ONNX — lightweight voice (local, ~50MB) ✅ M2</option>
              <option value="cartesia">Cartesia — ~80ms, free tier (cloud) ✅ M2</option>
              <option value="deepgram">Deepgram Aura — ~200ms, $200 credit (cloud) ✅ M2</option>
              <option value="apple">Apple TTS — zero overhead (local, built-in) ✅ M2</option>
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

        {/* Speech Recognition (STT) */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-1 flex items-center gap-2">
            <Mic size={15} /> Speech Recognition
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            <span className="text-green-400 font-medium">Recommended: Whisper (local)</span> — free, offline, CoreML on Apple Silicon. Use Deepgram for cloud accuracy on noisy environments (uses your Deepgram key).
          </p>

          <div className="flex gap-2">
            <select
              value={sttEngine}
              onChange={(e) => setSttEngine(e.target.value as "whisper" | "moonshine" | "groq" | "deepgram")}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm"
            >
              <optgroup label="Local — free, offline">
                <option value="whisper">Whisper — large-v3-turbo default (M4) / small or base (M2)</option>
                <option value="moonshine">Moonshine ONNX — ~25 MB tiny, fastest local ✅ M2</option>
              </optgroup>
              <optgroup label="Cloud — needs API key">
                <option value="groq">Groq Whisper — free 18K sec/month, ~300× realtime ✅ M2</option>
                <option value="deepgram">Deepgram Nova-3 — ~100ms, $200 one-time credit ✅ M2</option>
              </optgroup>
            </select>
            <button
              onClick={handleSaveSttEngine}
              disabled={sttSaving || sttEngine === health?.stt_engine}
              className="px-5 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 rounded-xl text-sm font-medium"
            >
              {sttSaving ? "Saving..." : "Use engine"}
            </button>
          </div>

          {sttStatus && (
            <div className={`flex items-start gap-2 mt-3 p-3 rounded-xl text-sm ${
              sttStatus.ok ? "bg-green-900/40 text-green-300" : "bg-red-900/40 text-red-300"
            }`}>
              {sttStatus.ok ? <CheckCircle size={15} className="mt-0.5 shrink-0" /> : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
              {sttStatus.msg}
            </div>
          )}

          {/* Whisper model size picker */}
          {sttEngine === "whisper" && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <p className="text-xs text-gray-400 mb-2 font-medium flex items-center">
                Whisper Model Size
                <InfoTip text="Larger models are more accurate but use more RAM and take longer to load. All sizes use CoreML on Apple Silicon for fast inference." />
              </p>
              <div className="flex gap-2">
                <select
                  value={whisperModel}
                  onChange={(e) => setWhisperModel(e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm"
                >
                  <option value="tiny">tiny — ~75MB, fastest, lower accuracy</option>
                  <option value="base">base — ~150MB, good for M2 lightweight
                    <InfoTip text="✅ M2 compatible" /></option>
                  <option value="small">small — ~250MB, balanced speed/accuracy ✅ M2</option>
                  <option value="medium">medium — ~750MB, high accuracy</option>
                  <option value="large-v3">large-v3 — ~1.5GB, best accuracy</option>
                  <option value="large-v3-turbo">large-v3-turbo — ~1.5GB, best + fast ✅ M4 recommended</option>
                </select>
                <button
                  onClick={handleSaveWhisperModel}
                  disabled={whisperModelSaving || whisperModel === health?.whisper_model}
                  className="px-5 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 rounded-xl text-sm font-medium"
                >
                  {whisperModelSaving ? "Saving..." : "Use model"}
                </button>
              </div>
              {/* M2 recommendation callout */}
              <div className="mt-2 p-2.5 bg-blue-950/50 border border-blue-900/50 rounded-lg text-xs text-blue-300">
                <span className="font-medium">M2 recommendation:</span> use <code className="bg-blue-900/50 px-1 rounded">small</code> (250MB, fast + accurate) or <code className="bg-blue-900/50 px-1 rounded">base</code> (150MB, lightest). M4 can handle <code className="bg-blue-900/50 px-1 rounded">large-v3-turbo</code> comfortably.
              </div>
              {whisperModelStatus && (
                <div className={`flex items-start gap-2 mt-2 p-2 rounded-lg text-xs ${
                  whisperModelStatus.ok ? "bg-green-900/40 text-green-300" : "bg-red-900/40 text-red-300"
                }`}>
                  {whisperModelStatus.ok ? <CheckCircle size={13} className="mt-0.5 shrink-0" /> : <AlertCircle size={13} className="mt-0.5 shrink-0" />}
                  {whisperModelStatus.msg}
                </div>
              )}
            </div>
          )}

          {sttEngine === "moonshine" && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <p className="text-xs text-gray-400 mb-2 font-medium flex items-center">
                Moonshine Model
                <InfoTip text="Moonshine tiny (~25 MB) is faster than Whisper base on Apple Silicon with similar accuracy on conversational speech. Install: pip install moonshine-onnx" />
              </p>
              <div className="flex gap-2">
                <select
                  value={moonshineModel}
                  onChange={(e) => setMoonshineModel(e.target.value as "moonshine/tiny" | "moonshine/base")}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm"
                >
                  <option value="moonshine/tiny">tiny — ~25 MB, fastest ✅ M2 recommended</option>
                  <option value="moonshine/base">base — ~75 MB, more accurate</option>
                </select>
                <button
                  onClick={handleSaveMoonshineModel}
                  disabled={moonshineModelSaving || moonshineModel === health?.moonshine_model}
                  className="px-5 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 rounded-xl text-sm font-medium"
                >
                  {moonshineModelSaving ? "Saving..." : "Use model"}
                </button>
              </div>
              <div className="mt-2 p-2.5 bg-blue-950/50 border border-blue-900/50 rounded-lg text-xs text-blue-300">
                Install first: <code className="bg-blue-900/50 px-1 rounded">pip install moonshine-onnx</code>
              </div>
              {moonshineModelStatus && (
                <div className={`flex items-start gap-2 mt-2 p-2 rounded-lg text-xs ${moonshineModelStatus.ok ? "bg-green-900/40 text-green-300" : "bg-red-900/40 text-red-300"}`}>
                  {moonshineModelStatus.ok ? <CheckCircle size={13} className="mt-0.5 shrink-0" /> : <AlertCircle size={13} className="mt-0.5 shrink-0" />}
                  {moonshineModelStatus.msg}
                </div>
              )}
            </div>
          )}

          {sttEngine === "groq" && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <p className="text-xs text-gray-400 mb-2 font-medium flex items-center">
                Groq Whisper Model
                <InfoTip text="Groq runs Whisper at ~300× realtime. Free tier: ~18,000 seconds/month. Get a free key at console.groq.com" />
              </p>
              <div className="flex gap-2">
                <select
                  value={groqSttModel}
                  onChange={(e) => setGroqSttModel(e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm"
                >
                  <option value="whisper-large-v3-turbo">whisper-large-v3-turbo — best quality (recommended)</option>
                  <option value="whisper-large-v3">whisper-large-v3 — most accurate, slower</option>
                  <option value="distil-whisper-large-v3-en">distil-whisper-large-v3-en — English only, fastest</option>
                </select>
                <button
                  onClick={handleSaveGroqSttModel}
                  disabled={groqSttModelSaving || groqSttModel === health?.groq_stt_model}
                  className="px-5 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 rounded-xl text-sm font-medium"
                >
                  {groqSttModelSaving ? "Saving..." : "Use model"}
                </button>
              </div>
              {groqSttModelStatus && (
                <div className={`flex items-start gap-2 mt-2 p-2 rounded-lg text-xs ${groqSttModelStatus.ok ? "bg-green-900/40 text-green-300" : "bg-red-900/40 text-red-300"}`}>
                  {groqSttModelStatus.ok ? <CheckCircle size={13} className="mt-0.5 shrink-0" /> : <AlertCircle size={13} className="mt-0.5 shrink-0" />}
                  {groqSttModelStatus.msg}
                </div>
              )}
            </div>
          )}

          {sttEngine === "deepgram" && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <p className="text-xs text-gray-400 mb-2 font-medium">Deepgram STT Model</p>
              <div className="flex gap-2">
                <select
                  value={deepgramSttModel}
                  onChange={(e) => setDeepgramSttModel(e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm"
                >
                  <option value="nova-3">nova-3 — most accurate (recommended)</option>
                  <option value="nova-2">nova-2 — slightly faster</option>
                  <option value="base">base — cheapest</option>
                </select>
                <button
                  onClick={handleSaveDeepgramSttModel}
                  disabled={deepgramSttModelSaving || deepgramSttModel === health?.deepgram_stt_model}
                  className="px-5 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 rounded-xl text-sm font-medium"
                >
                  {deepgramSttModelSaving ? "Saving..." : "Use model"}
                </button>
              </div>
              {deepgramSttModelStatus && (
                <div className={`flex items-start gap-2 mt-2 p-2 rounded-lg text-xs ${
                  deepgramSttModelStatus.ok ? "bg-green-900/40 text-green-300" : "bg-red-900/40 text-red-300"
                }`}>
                  {deepgramSttModelStatus.ok ? <CheckCircle size={13} className="mt-0.5 shrink-0" /> : <AlertCircle size={13} className="mt-0.5 shrink-0" />}
                  {deepgramSttModelStatus.msg}
                </div>
              )}
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

        {/* Groq API key */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-1 flex items-center gap-2">
            <Key size={15} /> Groq API Key
            <span className="ml-1 px-1.5 py-0.5 bg-green-900 text-green-300 rounded text-xs">STT</span>
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Powers <span className="text-gray-300">Groq Whisper</span> STT — runs Whisper at ~300× realtime with a{" "}
            <span className="text-green-400">free tier (~18,000 sec/month)</span>.
            Get your key at <span className="text-blue-400">console.groq.com</span>.
            Stored in <code className="bg-gray-800 px-1 rounded">backend/.env</code> only.
          </p>

          {health?.groq_configured ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-400 font-mono">
                gsk_••••••••••••••••••••••••
              </div>
              <button onClick={handleRemoveGroqKey} disabled={groqSaving}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-red-900/50 hover:bg-red-900 border border-red-800 rounded-xl text-red-300 text-sm disabled:opacity-50">
                <Trash2 size={14} /> Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={groqKeyVisible ? "text" : "password"}
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveGroqKey()}
                  placeholder="gsk_..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 pr-10 text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-blue-600"
                />
                <button onClick={() => setGroqKeyVisible((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {groqKeyVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <button onClick={handleSaveGroqKey} disabled={groqSaving || !groqKey.trim()}
                className="px-5 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 rounded-xl text-sm font-medium">
                {groqSaving ? "Saving..." : "Save"}
              </button>
            </div>
          )}

          {groqStatus && (
            <div className={`flex items-start gap-2 mt-3 p-3 rounded-xl text-sm ${groqStatus.ok ? "bg-green-900/40 text-green-300" : "bg-red-900/40 text-red-300"}`}>
              {groqStatus.ok ? <CheckCircle size={15} className="mt-0.5 shrink-0" /> : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
              {groqStatus.msg}
            </div>
          )}
        </div>

        {/* Gemini API key */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-1 flex items-center gap-2">
            <Key size={15} /> Google Gemini API Key
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Required for <span className="text-gray-300">gemini-2.0-flash</span> and <span className="text-gray-300">gemini-1.5-flash</span> — both have a{" "}
            <span className="text-green-400">free tier</span> (15 req/min, 1,500 req/day).
            Get your key at <span className="text-blue-400">aistudio.google.com</span>.
            Stored in <code className="bg-gray-800 px-1 rounded">backend/.env</code> only.
          </p>

          {health?.gemini_configured ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-400 font-mono">
                AIza••••••••••••••••••••••••
              </div>
              <button
                onClick={handleRemoveGeminiKey}
                disabled={geminiSaving}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-red-900/50 hover:bg-red-900 border border-red-800 rounded-xl text-red-300 text-sm disabled:opacity-50"
              >
                <Trash2 size={14} /> Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={geminiKeyVisible ? "text" : "password"}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveGeminiKey()}
                  placeholder="AIza..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 pr-10 text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-blue-600"
                />
                <button
                  onClick={() => setGeminiKeyVisible((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {geminiKeyVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <button
                onClick={handleSaveGeminiKey}
                disabled={geminiSaving || !geminiKey.trim()}
                className="px-5 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 rounded-xl text-sm font-medium"
              >
                {geminiSaving ? "Saving..." : "Save"}
              </button>
            </div>
          )}

          {geminiStatus && (
            <div className={`flex items-start gap-2 mt-3 p-3 rounded-xl text-sm ${
              geminiStatus.ok ? "bg-green-900/40 text-green-300" : "bg-red-900/40 text-red-300"
            }`}>
              {geminiStatus.ok ? <CheckCircle size={15} className="mt-0.5 shrink-0" /> : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
              {geminiStatus.msg}
            </div>
          )}
        </div>

        {/* Cartesia API key */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-1 flex items-center gap-2">
            <Key size={15} /> Cartesia API Key
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Powers the <span className="text-gray-300">Cartesia Sonic-2</span> voice engine — ~80ms latency with a{" "}
            <span className="text-green-400">free tier</span> (~500K chars/month).
            Get your key at <span className="text-blue-400">cartesia.ai</span>.
            Stored in <code className="bg-gray-800 px-1 rounded">backend/.env</code> only.
          </p>

          {health?.cartesia_configured ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-400 font-mono">
                sk-••••••••••••••••••••••••
              </div>
              <button
                onClick={handleRemoveCartesiaKey}
                disabled={cartesiaSaving}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-red-900/50 hover:bg-red-900 border border-red-800 rounded-xl text-red-300 text-sm disabled:opacity-50"
              >
                <Trash2 size={14} /> Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={cartesiaKeyVisible ? "text" : "password"}
                  value={cartesiaKey}
                  onChange={(e) => setCartesiaKey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveCartesiaKey()}
                  placeholder="sk-..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 pr-10 text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-blue-600"
                />
                <button
                  onClick={() => setCartesiaKeyVisible((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {cartesiaKeyVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <button
                onClick={handleSaveCartesiaKey}
                disabled={cartesiaSaving || !cartesiaKey.trim()}
                className="px-5 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 rounded-xl text-sm font-medium"
              >
                {cartesiaSaving ? "Saving..." : "Save"}
              </button>
            </div>
          )}

          {cartesiaStatus && (
            <div className={`flex items-start gap-2 mt-3 p-3 rounded-xl text-sm ${
              cartesiaStatus.ok ? "bg-green-900/40 text-green-300" : "bg-red-900/40 text-red-300"
            }`}>
              {cartesiaStatus.ok ? <CheckCircle size={15} className="mt-0.5 shrink-0" /> : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
              {cartesiaStatus.msg}
            </div>
          )}

          {/* Cartesia voice selector */}
          <div className="mt-4 pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-400 mb-2 font-medium">Voice</p>
            <div className="flex flex-col gap-2">
              <select
                value={CARTESIA_VOICES.some((v) => v.id === cartesiaVoiceId) ? cartesiaVoiceId : "custom"}
                onChange={(e) => {
                  if (e.target.value !== "custom") setCartesiaVoiceId(e.target.value);
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm"
              >
                {CARTESIA_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={cartesiaVoiceId}
                  onChange={(e) => setCartesiaVoiceId(e.target.value)}
                  placeholder="Voice ID (UUID)"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-blue-600"
                />
                <button
                  onClick={handleSaveCartesiaVoice}
                  disabled={cartesiaVoiceSaving || !cartesiaVoiceId.trim() || cartesiaVoiceId.trim() === health?.cartesia_voice_id}
                  className="px-5 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 rounded-xl text-sm font-medium"
                >
                  {cartesiaVoiceSaving ? "Saving..." : "Use voice"}
                </button>
              </div>
            </div>
            {cartesiaVoiceStatus && (
              <div className={`flex items-start gap-2 mt-2 p-2 rounded-lg text-xs ${
                cartesiaVoiceStatus.ok ? "bg-green-900/40 text-green-300" : "bg-red-900/40 text-red-300"
              }`}>
                {cartesiaVoiceStatus.ok ? <CheckCircle size={13} className="mt-0.5 shrink-0" /> : <AlertCircle size={13} className="mt-0.5 shrink-0" />}
                {cartesiaVoiceStatus.msg}
              </div>
            )}
          </div>

          {/* Cartesia model sub-selector */}
          <div className="mt-4 pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-400 mb-2 font-medium">Cartesia Model</p>
            <div className="flex gap-2">
              <select
                value={cartesiaModel}
                onChange={(e) => setCartesiaModel(e.target.value as "sonic-2" | "sonic-english")}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm"
              >
                <option value="sonic-2">sonic-2 — best quality</option>
                <option value="sonic-english">sonic-english — faster &amp; cheaper</option>
              </select>
              <button
                onClick={handleSaveCartesiaModel}
                disabled={cartesiaModelSaving || cartesiaModel === health?.cartesia_model}
                className="px-5 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 rounded-xl text-sm font-medium"
              >
                {cartesiaModelSaving ? "Saving..." : "Use model"}
              </button>
            </div>
            {cartesiaModelStatus && (
              <div className={`flex items-start gap-2 mt-2 p-2 rounded-lg text-xs ${
                cartesiaModelStatus.ok ? "bg-green-900/40 text-green-300" : "bg-red-900/40 text-red-300"
              }`}>
                {cartesiaModelStatus.ok ? <CheckCircle size={13} className="mt-0.5 shrink-0" /> : <AlertCircle size={13} className="mt-0.5 shrink-0" />}
                {cartesiaModelStatus.msg}
              </div>
            )}
          </div>
        </div>

        {/* Deepgram API key */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-1 flex items-center gap-2">
            <Key size={15} /> Deepgram API Key
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Powers <span className="text-gray-300">Deepgram Aura</span> TTS — ~200ms latency with a{" "}
            <span className="text-green-400">$200 one-time signup credit</span> (not monthly).
            Get your key at <span className="text-blue-400">deepgram.com</span>.
            Stored in <code className="bg-gray-800 px-1 rounded">backend/.env</code> only.
          </p>

          {health?.deepgram_configured ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-400 font-mono">
                ••••••••••••••••••••••••••••••••••••••••
              </div>
              <button
                onClick={handleRemoveDeepgramKey}
                disabled={deepgramSaving}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-red-900/50 hover:bg-red-900 border border-red-800 rounded-xl text-red-300 text-sm disabled:opacity-50"
              >
                <Trash2 size={14} /> Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={deepgramKeyVisible ? "text" : "password"}
                  value={deepgramKey}
                  onChange={(e) => setDeepgramKey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveDeepgramKey()}
                  placeholder="Token..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 pr-10 text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-blue-600"
                />
                <button
                  onClick={() => setDeepgramKeyVisible((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {deepgramKeyVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <button
                onClick={handleSaveDeepgramKey}
                disabled={deepgramSaving || !deepgramKey.trim()}
                className="px-5 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 rounded-xl text-sm font-medium"
              >
                {deepgramSaving ? "Saving..." : "Save"}
              </button>
            </div>
          )}

          {deepgramStatus && (
            <div className={`flex items-start gap-2 mt-3 p-3 rounded-xl text-sm ${
              deepgramStatus.ok ? "bg-green-900/40 text-green-300" : "bg-red-900/40 text-red-300"
            }`}>
              {deepgramStatus.ok ? <CheckCircle size={15} className="mt-0.5 shrink-0" /> : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
              {deepgramStatus.msg}
            </div>
          )}

          {/* Deepgram model sub-selector */}
          <div className="mt-4 pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-400 mb-2 font-medium">Aura Voice Model</p>
            <div className="flex gap-2">
              <select
                value={deepgramModel}
                onChange={(e) => setDeepgramModel(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm"
              >
                <option value="aura-2-en-us">aura-2-en-us — best quality</option>
                <option value="aura-asteria-en">aura-asteria-en — fastest &amp; cheapest</option>
                <option value="aura-luna-en">aura-luna-en — natural female</option>
                <option value="aura-stella-en">aura-stella-en — upbeat female</option>
              </select>
              <button
                onClick={handleSaveDeepgramModel}
                disabled={deepgramModelSaving || deepgramModel === health?.deepgram_model}
                className="px-5 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 rounded-xl text-sm font-medium"
              >
                {deepgramModelSaving ? "Saving..." : "Use model"}
              </button>
            </div>
            {deepgramModelStatus && (
              <div className={`flex items-start gap-2 mt-2 p-2 rounded-lg text-xs ${
                deepgramModelStatus.ok ? "bg-green-900/40 text-green-300" : "bg-red-900/40 text-red-300"
              }`}>
                {deepgramModelStatus.ok ? <CheckCircle size={13} className="mt-0.5 shrink-0" /> : <AlertCircle size={13} className="mt-0.5 shrink-0" />}
                {deepgramModelStatus.msg}
              </div>
            )}
          </div>
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
    </>
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
