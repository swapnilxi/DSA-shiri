# Voice Learning AI — Implementation Tracker & TODOs

This tracker details the features implemented so far across the project phases and outlines the remaining/missing features according to the roadmap and active design files.

---

## 🚀 What is Done (Implemented)

### 🎙️ Core Interview Engine
- [x] **Real-time WebSocket Loop:** Multi-turn mock interviews using FastAPI WebSockets (`backend/routers/interview.py`).
- [x] **Voice Input & STT Integration:** Browser microphone recording (`MediaRecorder` API) transcribed using local STT (Whisper, Moonshine) or cloud providers (Groq, Deepgram).
- [x] **TTS Voice Playback:** Playback of interviewer prompts via Kokoro, macOS local, Piper, Cartesia, or Deepgram.
- [x] **FAANG-Standard Assessor:** 100-point rubric assessment of transcripts scoring technical correctness (40%), depth (25%), clarity (20%), and problem-solving (15%).
- [x] **Visual Waveforms:** Live SVG canvas audio visualization for interviewer and candidate speech.
- [x] **Performance/Session Timer:** Real-time interview clock displaying elapsed session time (`mm:ss`) in the interview room header.
- [x] **Follow-Up Mode:** Ability to drill down on the same question, receive hints, clarify concepts, and get a follow-up assessment report.

### 📊 Dashboard & Navigation
- [x] **Tabbed Interface:** Refactored dashboard splitting statistics/history ("Overview") from the question bank search ("Practice Board").
- [x] **Topic Mastery Radar:** Visual Recharts-based radar chart showing average scores across categories.
- [x] **Global Navigation Bar:** Centrally-managed header navbar (`NavBar.tsx`) embedded in the root layout to seamlessly switch between modules.
- [x] **Breadcrumbs Navigation:** Contextual breadcrumbs (`Breadcrumbs.tsx`) on session reports and practice detail pages.
- [x] **Session Empty State:** Clean, user-friendly card layout shown when no sessions have been recorded yet.

### 📚 Guided Practice Mode
- [x] **Interactive Study Sections:** 7 AI-generated helper sections for each question: Hints, Key Concepts, Approach Guide, Sample Answer, Follow-up Questions, Dive Deeper, and Quick MCQ Quizzes.
- [x] **AI Practice Chat Tutor:** Spoken or text-based practice chat assistant per question with quick action prompts.
- [x] **Infinite Scroll:** IntersectionObserver-based question browser.

### ⚙️ Settings & Database Admin
- [x] **Provider Switches:** Easy toggle between Ollama (local), DeepSeek (cloud), Gemini (cloud) for LLM, and various local/cloud STT and TTS engines.
- [x] **Local DB Browser:** Table browser inside the app supporting column sorting, cell sizing, search, and batch deleting.
- [x] **CSV Upload & Export:** Support for bulk uploading questions from CSV templates.
- [x] **Config API Endpoints:** Dedicated `/settings` and `/health` APIs returning status configurations and API key verification.

---

## 🎯 What is Missing (Roadmap / Next Steps)

### 💡 High Priority
- [x] **Frontend integration of `/settings` API:** Settings page now fetches initial engine/model configuration directly via `/settings` endpoint.
- [x] **Breadcrumbs Expansion:** Added contextual `<Breadcrumbs />` to Database, Settings, and Generate routes for complete layout consistency across all subpages.
- [x] **Export Session as PDF:** Export PDF button added to session details report header allowing one-click download/print of session feedback and rubric scores.


### 🛠️ Advanced Simulation Features
- [ ] **Code Execution Sandbox:** Run candidates' algorithm answers live in an execution sandbox.
- [ ] **Whiteboard Mode:** Add a collaborative drawing board to illustrate data structures or architecture flows while speaking.
- [ ] **Multi-Round Mock Interview Sequences:** Support structured sequential interview loops (e.g., HR round → System Design round → Coding round) with an aggregated readiness profile.
- [x] **FAANG Pass-Rate Comparison:** Each session report now shows a FAANG Readiness panel — tier badge (Strong Hire / Hire / Borderline / Not Ready), score gauge with tier markers at 60/75/90, per-dimension bars vs FAANG minimums, and targeted upgrade tips for every dimension below the FAANG bar.
