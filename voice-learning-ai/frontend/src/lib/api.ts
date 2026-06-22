const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, init);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  health: () =>
    request<{
      status: string;
      ollama_model: string;
      ollama_available: boolean;
      available_models: string[];
      whisper_model: string;
      tts_engine: "kokoro" | "apple";
      tts_voice: string;
      deepseek_configured: boolean;
    }>("/health"),

  getModels: () =>
    request<{ ollama: string[]; deepseek: string[]; deepseek_configured: boolean; default: string }>("/models"),

  saveOllamaModel: (model: string) =>
    request<{ ok: boolean; model: string }>("/config/ollama-model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    }),

  saveTtsEngine: (engine: "kokoro" | "apple") =>
    request<{ ok: boolean; engine: "kokoro" | "apple" }>("/config/tts-engine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ engine }),
    }),

  saveDeepSeekKey: (api_key: string) =>
    request<{ ok: boolean; configured: boolean }>("/config/deepseek-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key }),
    }),

  removeDeepSeekKey: () =>
    request<{ ok: boolean; configured: boolean }>("/config/deepseek-key", { method: "DELETE" }),

  startSession: (topic: string, model?: string, company?: string, title?: string) =>
    request<{ session_id: number; questions: Question[]; total: number }>("/interview/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, company, model_used: model, title }),
    }),

  listTopics: () => request<{ topic: string; count: number }[]>("/questions/topics"),
  listCompanies: () => request<{ company: string; count: number }[]>("/questions/companies"),

  listQuestions: (params?: { topic?: string; difficulty?: string; limit?: number }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<Question[]>(`/questions${qs ? `?${qs}` : ""}`);
  },

  uploadQuestions: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<{ inserted: number; filename: string }>("/questions/upload", {
      method: "POST",
      body: fd,
    });
  },

  generateQuestions: (formData: FormData) =>
    request<{
      questions: GeneratedQuestion[];
      inserted: number;
      skipped: number;
      source: string;
      model_used: string;
    }>("/resume/generate", { method: "POST", body: formData }),

  saveQuestions: (questions: GeneratedQuestion[], source?: string) =>
    request<{ inserted: number; skipped: number }>("/resume/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(questions.map((q) => ({ ...q, source }))),
    }),

  getResumeLibrary: () =>
    request<ResumeEntry[]>("/resume/history"),

  deleteResume: (id: number) =>
    request<{ deleted: number }>(`/resume/history/${id}`, { method: "DELETE" }),

  generateFromIds: (opts: {
    resume_ids: number[];
    num_questions: number;
    difficulty: string;
    model: string;
  }) =>
    request<{
      questions: GeneratedQuestion[];
      inserted: number;
      skipped: number;
      source: string;
      model_used: string;
    }>("/resume/generate-from-ids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    }),

  /** @deprecated use getResumeLibrary */
  getGenerateHistory: () =>
    request<ResumeEntry[]>("/resume/history"),

  getDbTable: (table: string, limit = 200) =>
    request<{ table: string; columns: string[]; rows: Record<string, unknown>[]; count: number }>(
      `/progress/db/${table}?limit=${limit}`
    ),

  getSessions: () => request<Session[]>("/progress/sessions"),
  getSessionDetail: (id: number) => request<{ session: Session; responses: SessionResponse[] }>(`/progress/sessions/${id}`),
  getMastery: () => request<TopicMastery[]>("/progress/mastery"),
  getStats: () => request<Stats>("/progress/stats"),
};

export interface Question {
  id: number;
  topic: string;
  question: string;
  difficulty: "Easy" | "Medium" | "Hard";
  company?: string;
  category?: string;
}

export interface Session {
  id: number;
  title: string;
  topic: string;
  status: "active" | "completed" | "abandoned";
  total_score?: number;
  started_at: string;
  ended_at?: string;
}

export interface TopicMastery {
  topic: string;
  avg_score: number;
  attempts: number;
  last_practiced?: string;
}

export interface GeneratedQuestion {
  topic: string;
  question: string;
  difficulty: "Easy" | "Medium" | "Hard";
  category: string;
  expected_keywords: string;
}

export interface SessionResponse {
  id: number;
  question_id: number;
  topic: string;
  question: string;
  difficulty: "Easy" | "Medium" | "Hard";
  transcript: string;
  audio_duration: number;
  total: number;
  technical_correctness: number;
  depth_completeness: number;
  communication_clarity: number;
  problem_solving: number;
  llm_feedback: string;
}

export interface ResumeEntry {
  id: number;
  filename: string;
  questions_generated: number;
  uploaded_at: string;
  preview?: string;
}

export interface Stats {
  sessions_completed: number;
  total_answers: number;
  avg_score: number;
  top_topics: { topic: string; avg_score: number }[];
  weak_topics: { topic: string; avg_score: number }[];
}
