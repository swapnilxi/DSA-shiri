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
      tts_engine: "kokoro" | "apple" | "cartesia" | "piper" | "deepgram";
      tts_voice: string;
      deepseek_configured: boolean;
      gemini_configured: boolean;
      cartesia_configured: boolean;
      cartesia_model: string;
      cartesia_voice_id: string;
      deepgram_configured: boolean;
      deepgram_model: string;
      stt_engine: "whisper" | "moonshine" | "groq" | "deepgram";
      moonshine_model: string;
      groq_configured: boolean;
      groq_stt_model: string;
      deepgram_stt_model: string;
    }>("/health"),

  getModels: () =>
    request<{ ollama: string[]; deepseek: string[]; deepseek_configured: boolean; gemini: string[]; gemini_configured: boolean; default: string }>("/models"),

  saveOllamaModel: (model: string) =>
    request<{ ok: boolean; model: string }>("/config/ollama-model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    }),

  saveTtsEngine: (engine: "kokoro" | "apple" | "cartesia" | "piper" | "deepgram") =>
    request<{ ok: boolean; engine: "kokoro" | "apple" | "cartesia" | "piper" | "deepgram" }>("/config/tts-engine", {
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

  saveGeminiKey: (api_key: string) =>
    request<{ ok: boolean; configured: boolean }>("/config/gemini-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key }),
    }),

  removeGeminiKey: () =>
    request<{ ok: boolean; configured: boolean }>("/config/gemini-key", { method: "DELETE" }),

  saveCartesiaKey: (api_key: string) =>
    request<{ ok: boolean; configured: boolean }>("/config/cartesia-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key }),
    }),

  removeCartesiaKey: () =>
    request<{ ok: boolean; configured: boolean }>("/config/cartesia-key", { method: "DELETE" }),

  saveDeepgramKey: (api_key: string) =>
    request<{ ok: boolean; configured: boolean }>("/config/deepgram-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key }),
    }),

  removeDeepgramKey: () =>
    request<{ ok: boolean; configured: boolean }>("/config/deepgram-key", { method: "DELETE" }),

  saveWhisperModel: (model: string) =>
    request<{ ok: boolean; model: string }>("/config/whisper-model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    }),

  saveMoonshineModel: (model: "moonshine/tiny" | "moonshine/base") =>
    request<{ ok: boolean; model: string }>("/config/moonshine-model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    }),

  saveGroqKey: (api_key: string) =>
    request<{ ok: boolean; configured: boolean }>("/config/groq-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key }),
    }),

  removeGroqKey: () =>
    request<{ ok: boolean; configured: boolean }>("/config/groq-key", { method: "DELETE" }),

  saveGroqSttModel: (model: string) =>
    request<{ ok: boolean; model: string }>("/config/groq-stt-model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    }),

  saveSttEngine: (engine: "whisper" | "moonshine" | "groq" | "deepgram") =>
    request<{ ok: boolean; engine: string }>("/config/stt-engine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ engine }),
    }),

  saveDeepgramSttModel: (model: string) =>
    request<{ ok: boolean; model: string }>("/config/deepgram-stt-model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    }),

  saveDeepgramModel: (model: string) =>
    request<{ ok: boolean; model: string }>("/config/deepgram-model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    }),

  saveCartesiaVoice: (voice_id: string) =>
    request<{ ok: boolean; voice_id: string }>("/config/cartesia-voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voice_id }),
    }),

  saveCartesiaModel: (model: "sonic-2" | "sonic-english") =>
    request<{ ok: boolean; model: string }>("/config/cartesia-model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    }),

  startSession: (topic: string, model?: string, company?: string, title?: string, followUpMode = false) =>
    request<{ session_id: number; questions: Question[]; total: number; follow_up_mode: boolean }>("/interview/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, company, model_used: model, title, follow_up_mode: followUpMode }),
    }),

  listTopics: () => request<{ topic: string; count: number }[]>("/questions/topics"),
  listCompanies: () => request<{ company: string; count: number }[]>("/questions/companies"),

  listQuestions: (params?: { topic?: string; difficulty?: string; category?: string; limit?: number }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<Question[]>(`/questions${qs ? `?${qs}` : ""}`);
  },

  getRandomQuestions: (categories?: string[], limit = 10) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (categories && categories.length > 0) params.set("categories", categories.join(","));
    return request<Question[]>(`/questions/random?${params}`);
  },

  getPracticeSet: () => request<Question[]>("/questions/practice-set"),

  generateDailyPractice: (opts: {
    categories: { name: string; count: number }[];
    company?: string;
    context?: string;
    resume_ids?: number[];
    difficulty: string;
    model: string;
  }) =>
    request<{
      questions: GeneratedQuestion[];
      inserted: number;
      skipped: number;
      source: string;
      model_used: string;
    }>("/resume/daily-practice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    }),

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

  uploadToLibrary: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<{ id: number; filename: string }>("/resume/upload", { method: "POST", body: fd });
  },

  generateFromIds: (opts: {
    resume_ids: number[];
    num_questions: number;
    difficulty: string;
    model: string;
    topics?: string;
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

  createQuestion: (q: { topic: string; question: string; difficulty?: string; company?: string; category?: string; expected_keywords?: string }) =>
    request<Record<string, unknown>>("/questions/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(q),
    }),

  updateQuestion: (id: number, q: { topic: string; question: string; difficulty?: string; company?: string; category?: string; expected_keywords?: string }) =>
    request<Record<string, unknown>>(`/questions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(q),
    }),

  deleteSession: (id: number) =>
    request<{ deleted: number }>(`/progress/db/sessions/rows`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([id]),
    }),

  deleteAllSessions: (ids: number[]) =>
    request<{ deleted: number }>(`/progress/db/sessions/rows`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids),
    }),

  batchDeleteRows: (table: string, ids: number[]) =>
    request<{ deleted: number }>(`/progress/db/${table}/rows`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids),
    }),

  getDbTable: (table: string, limit = 200) =>
    request<{ table: string; columns: string[]; rows: Record<string, unknown>[]; count: number }>(
      `/progress/db/${table}?limit=${limit}`
    ),

  getSessions: () => request<Session[]>("/progress/sessions"),
  getSessionDetail: (id: number) => request<{ session: Session; responses: SessionResponse[] }>(`/progress/sessions/${id}`),
  analyzeSession: (id: number, model?: string) => {
    const qs = model ? `?model=${encodeURIComponent(model)}` : "";
    return request<SessionAnalysis>(`/progress/sessions/${id}/analyze${qs}`, { method: "POST" });
  },
  getMastery: () => request<TopicMastery[]>("/progress/mastery"),
  getStats: () => request<Stats>("/progress/stats"),

  // ── Practice ──────────────────────────────────────────────────────────────

  getPracticeQuestion: (id: number) =>
    request<Question>(`/practice/${id}`),

  generatePracticeContent: (
    questionId: number,
    type: "hints" | "concepts" | "approach" | "sample_answer" | "followups" | "quiz" | "deep_dive",
    model?: string,
  ) =>
    request<{ type: string; content: unknown }>(`/practice/${questionId}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, model }),
    }),

  practiceChat: (
    questionId: number,
    message: string,
    history: { role: string; content: string }[],
    model?: string,
  ) =>
    request<{ reply: string }>(`/practice/${questionId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history, model }),
    }),

  practiceFollowup: (
    questionId: number,
    opts: {
      history: FollowupTurn[];
      model?: string;
      answerText?: string;
      audio?: Blob;
    },
  ) => {
    const fd = new FormData();
    fd.append("history", JSON.stringify(opts.history ?? []));
    if (opts.model) fd.append("model", opts.model);
    if (opts.answerText) fd.append("answer_text", opts.answerText);
    if (opts.audio) fd.append("audio", opts.audio, "followup.webm");
    return request<PracticeFollowupResponse>(`/practice/${questionId}/followup`, {
      method: "POST",
      body: fd,
    });
  },

  analyseAnswer: (
    questionId: number,
    transcript: string,
    scores: Record<string, number>,
    model?: string,
  ) =>
    request<{
      what_you_got_right: string;
      key_gaps: string[];
      misconceptions: string[];
      mini_lesson: string;
      next_steps: string[];
      stronger_answer_outline: string;
    }>(`/practice/${questionId}/analyse-answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, scores, model }),
    }),
};

export interface Question {
  id: number;
  topic: string;
  question: string;
  difficulty: "Easy" | "Medium" | "Hard";
  company?: string;
  category?: string;
  practice_category?: string;
}

export interface Session {
  id: number;
  title: string;
  topic: string;
  follow_up_mode?: boolean;
  status: "active" | "completed" | "abandoned";
  total_score?: number;
  started_at: string;
  ended_at?: string;
}

export interface FollowupTurn {
  round: number;
  interviewer_prompt: string;
  candidate_answer: string;
  understanding_score: number;
  coach_feedback: string;
  deeper_explanation: string;
  hint: string;
  next_question: string;
  what_they_now_understand: string[];
  remaining_gaps: string[];
}

export interface FollowupReport {
  understanding_score: number;
  overall_assessment: string;
  strengths: string[];
  remaining_gaps: string[];
  concepts_mastered: string[];
  concepts_to_review: string[];
  recommended_drills: string[];
  ideal_answer_extension: string;
  rounds_completed?: number;
  turns?: FollowupTurn[];
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
  company: string;
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
  followup_report?: FollowupReport | null;
}

export interface PracticeFollowupResponse {
  round: number;
  complete: boolean;
  transcript: string;
  assistant_text: string;
  understanding_score: number;
  report: FollowupReport | null;
  turns: FollowupTurn[];
}

export interface ResumeEntry {
  id: number;
  filename: string;
  questions_generated: number;
  uploaded_at: string;
  preview?: string;
}

export interface SessionAnalysis {
  summary: string;
  strengths: string[];
  weak_areas: {
    topic: string;
    reason: string;
    study_topics: string[];
    how_to_improve: string;
  }[];
  per_question: {
    index: number;
    score: number;
    what_was_good: string;
    what_was_missing: string;
    ideal_outline: string;
  }[];
  learning_plan: { priority: number; action: string }[];
  readiness: "Strong" | "Needs Work" | "Not Ready";
}

export interface Stats {
  sessions_completed: number;
  total_answers: number;
  avg_score: number;
  top_topics: { topic: string; avg_score: number }[];
  weak_topics: { topic: string; avg_score: number }[];
}
