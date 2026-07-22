# Voice Learning AI — Local-First Voice Interview Platform

Voice Learning AI is a local-first, voice-driven technical interview simulator built for Apple Silicon Macs. It combines a Next.js frontend, a FastAPI backend, SQLite persistence, and realtime voice flows for mock interviews, guided practice, and question generation.

The default setup is still local-first:
- LLM via Ollama running on your machine
- STT via faster-whisper or Moonshine
- TTS via Kokoro, Piper, or macOS voices
- Data stored locally in SQLite

The codebase now also includes optional cloud and exploratory integrations such as DeepSeek, Gemini, Groq STT, Deepgram STT/TTS, and Cartesia TTS. Those are additive, not foundational: this is still a local-first application, with local models and local storage as the primary path.

> **Fun Fact:** The name **Shiri** is a playful nod to Apple's Siri, which is fitting for a voice-driven application. Additionally, Shiri is another name for the Hindu goddess Tripurasundari.

---

## What It Does

- **Runs realtime interview sessions** with spoken prompts, recorded answers, transcription, scoring, and spoken feedback
- **Scores answers on a 100-point rubric** covering technical correctness, depth, communication, and problem solving
- **Tracks progress locally** in SQLite with session history, topic mastery, and post-session analysis
- **Supports guided practice mode** with hints, concept breakdowns, approach coaching, sample answers, deep dives, quizzes, and answer analysis
- **Generates questions from resumes, documents, and topic prompts** using the configured LLM
- **Manages question banks** from built-in seed data, CSV uploads, CRUD editing, random boards, and fixed daily practice sets
- **Lets you switch providers** for LLM, STT, and TTS without changing the core app flow

---

## Demo UI

```
┌─────────────────────────────────────────────────────────────┐
│  Voice Learning AI  [● Recording]                    [End Session]    │
├──────────────────────────┬──────────────────────────────────┤
│                          │  Session: System Design Round    │
│   🤖 AI Interviewer      │  Question 2/5  ●●○○○             │
│                          │                                  │
│   [animated waveform]    │  ─────────────────────────────   │
│                          │  Interviewer:                    │
│   "Explain how you       │  "Good start. Now tell me how    │
│    would design a        │   you'd handle 10M concurrent    │
│    URL shortener..."     │   users at peak load..."         │
│                          │  ─────────────────────────────   │
│   ──────────────────     │  You: [waveform while speaking]  │
│   🎤 You (speaking)      │                                  │
│   [live waveform]        │  Score so far: ████░░  72/100   │
│                          │                                  │
└──────────────────────────┴──────────────────────────────────┘
```

---

## Architecture

```
Browser (Next.js)
    │
    │  HTTP + WebSocket
    ▼
FastAPI Backend
    ├── Interview router      ──── realtime interview loop
    ├── Questions router      ──── bank CRUD, upload, practice sets
    ├── Resume router         ──── document parsing + question generation
    ├── Practice router       ──── hints, quizzes, deep dives, tutor chat
    ├── Progress router       ──── history, mastery, stats, DB browser
    ├── STT engines           ──── faster-whisper, Moonshine, Groq, Deepgram
    ├── LLM providers         ──── Ollama, DeepSeek, Gemini
    ├── TTS engines           ──── Kokoro, Apple, Piper, Cartesia, Deepgram
    └── SQLite                ──── sessions, questions, scores, resumes
```

Local execution is the primary path. Cloud integrations are optional and exist to expand experimentation, provider comparisons, and fallback options, not to redefine the app as cloud-first.

## Comprehensive Feature Matrix & Implementation Details

To help AI assistants and contributors understand the codebase, here is the exhaustive list of features built into this project and how they are implemented:

### 🎙️ Core Interview Engine
- **Real-time WebSocket sessions** with AI interviewer (Backend `interview.py`)
- **Voice recording** via browser microphone using `MediaRecorder` API
- **Speech-to-Text transcription** (Whisper, Moonshine, Groq, Deepgram via `services/stt.py`)
- **Text-to-Speech spoken feedback** (Kokoro, macOS, Piper, Cartesia, Deepgram via `services/tts.py`)
- **100-point rubric scoring** (Technical 40, Depth 25, Clarity 20, Process 15 via `services/assessor.py`)
- **Real-time score overlay** with per-dimension progress bars (`ScoreOverlay.tsx`)
- **Live audio waveform visualisation** for both interviewer and candidate (`Waveform.tsx`)
- **Follow-up mode** for deeper probing, hints, explanations on the same question
- **Follow-up report** with understanding score, strengths, and gaps
- **End session confirmation** modal with "View Report" and "End Call" options
- **Graceful WebSocket disconnect handling** via backend try-except blocks
- **Session Timer:** Real-time elapsed interview session timer in `mm:ss` format (`InterviewRoom.tsx`)

### 📊 Dashboard & Analytics
- **Stats overview** (sessions, answers, avg score, topics)
- **Topic mastery radar chart** using Recharts (`TopicRadar.tsx`)
- **Recent sessions list** with score colour coding
- **Quick session start** with topic, company, model, follow-up mode pickers
- **Question bank board** (randomized, filterable by category)
- **Daily Practice Set generation** with CSV/PDF export
- **Category filter pills** (DSA, System Design, CV, Real-Life, Large Scale, Leadership)
- **Tabbed Layout:** Division of dashboard statistics ("Overview") and the interactive question bank ("Practice Board")

### 📝 Session Reports
- **Per-question score breakdown** with 4-dimension bar charts
- **LLM feedback** per answer
- **Post-session AI analysis** (strengths, weak areas, learning plan, readiness badge)
- **"Analyse More" deep dive** (what you got right, gaps, misconceptions, mini lesson, next steps, stronger answer outline)
- **Session deletion** with confirmation

### 📚 Practice Mode
- **Question browser** with search, difficulty pills, category/topic dropdowns
- **Infinite scroll** using `IntersectionObserver`
- **Per-question practice page** with 7 AI-generated study sections:
  - Hints, Key Concepts, Approach Guide, Sample Answer, Follow-up Questions, Dive Deeper, Quick Quiz (MCQs)
- **AI Chat assistant** per question (with quick prompt buttons)
- **Voice follow-up practice** (record answer → AI evaluates → multi-round)

### 🤖 Question Generation
- **Generate from uploaded resume/document** (PDF, DOCX, TXT via `routers/resume.py`)
- **Resume library** (upload, select, delete)
- **Generate from free-text topics** or combined resume + topic
- **Daily practice set generator** with per-category count controls
- **Preview generated questions** before saving to bank

### 🗄️ Database Management (`voicelearning.db`)
- **Full database browser** inside the app (`database/page.tsx`)
- **Sortable columns** with resizable widths
- **Batch delete** selected rows
- **CRUD modal** for questions (add/edit single question)
- **CSV bulk upload** and export per table

### ⚙️ Settings & Configuration
- **Global Navigation Bar** for moving between modules seamlessly (`NavBar.tsx`)
- **LLM model picker** (Ollama local, DeepSeek API, Gemini API)
- **STT/TTS engine switcher** and configuration
- **API key management** for all cloud providers (add/remove/toggle visibility)
- **CSV upload** for question bank seeding
- **Breadcrumbs navigation** for trace tracking in sub-modules (`Breadcrumbs.tsx`)

### 🏗️ Infrastructure & Architecture
- **FastAPI backend** with modular routers (interview, questions, progress, resume, practice)
- **SQLite persistence** (sessions, questions, responses, scores, topic_mastery)
- **Next.js 15 frontend** with App Router
- **Launch scripts** (`start.sh`) to run FE + BE in one terminal

---

## Requirements

| Component | Requirement |
|-----------|-------------|
| macOS     | Ventura 13+ (Apple Silicon M-series) |
| RAM       | 16 GB minimum (24 GB recommended for 14B models) |
| Storage   | ~15 GB (models + deps) |
| Python    | 3.11 or 3.12 |
| Node.js   | 18+ |
| Homebrew  | Latest |

---

## Step-by-Step Setup

### Step 1 — Install system dependencies

Open **Terminal** and run these one at a time:

```bash
# 1a. Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# After install, follow the "Next steps" it prints to add brew to your PATH.
# Verify:
brew --version
```

```bash
# 1b. Install Python 3.11
brew install python@3.11

# Verify (must be 3.11.x):
python3.11 --version
```

```bash
# 1c. Install Node.js 18+
brew install node

# Verify:
node --version    # should be v18.x or higher
npm --version
```

```bash
# 1d. Install PortAudio (required by sounddevice for microphone access)
brew install portaudio
```

---

### Step 2 — Install Ollama and pull a model

```bash
# 2a. Install Ollama
brew install ollama
```

```bash
# 2b. Start the Ollama background service (keep this terminal open, or use a new tab)
ollama serve
```

> You should see `Listening on 127.0.0.1:11434`. Leave this running.

Open a **new terminal tab** for the rest of setup.

```bash
# 2c. Pull the recommended model (4.7 GB, fast on M4)
ollama pull llama3.1:8b

# Optional — better for system design and deep tech (8.1 GB):
ollama pull qwen2.5:14b

# Optional — strong reasoning (4.7 GB):
ollama pull deepseek-r1:8b
```

```bash
# 2d. Verify it works
ollama run llama3.1:8b "Say hello in one sentence"
# You should get a reply. Press Ctrl+D to exit.
```

---

### Step 3 — Set up the Python backend

```bash
# 3a. Navigate to the backend folder
cd /path/to/voice-learning-ai/backend
# Example: cd ~/Documents/Coding/voice-learning-ai/backend
```

```bash
# 3b. Create and activate a virtual environment using Python 3.11
python3.11 -m venv .venv
source .venv/bin/activate

# Your prompt should now show (.venv)
# Verify you're using the right Python:
python --version    # should say 3.11.x
```

```bash
# 3c. Upgrade pip first (avoids some install issues)
pip install --upgrade pip
```

```bash
# 3d. Install all dependencies
# Note: first run may download local model assets such as Whisper / Kokoro.
pip install -r requirements.txt
```

> **If you see errors about PortAudio:** make sure Step 1d completed successfully (`brew install portaudio`), then re-run pip install.
>
> **If sounddevice fails to build:** try `pip install sounddevice --global-option=build_ext --global-option="-I/opt/homebrew/include" --global-option="-L/opt/homebrew/lib"` then re-run `pip install -r requirements.txt`.

```bash
# 3e. (Optional but recommended) Enable Apple Neural Engine for faster Whisper on M4
pip install faster-whisper[ane]
# This adds CoreML support — cuts transcription time roughly in half.
```

```bash
# 3f. Seed the database with sample questions
python ../data/seed.py
# Expected output:
#   Done. inserted=18  company-updated=0  skipped=0
#   Database: /path/to/voice-learning-ai/data/voicelearning.db
```

---

### Step 4 — Set up the frontend

```bash
# 4a. Navigate to the frontend folder
cd ../frontend
# Or from project root: cd /path/to/voice-learning-ai/frontend
```

```bash
# 4b. Copy the environment file
cp .env.example .env.local
# No edits needed — defaults point to localhost:8000
```

```bash
# 4c. Install dependencies
npm install
# Takes ~1 minute. Ignore peer-dependency warnings.
```

---

### Step 5 — Grant microphone permission

macOS blocks microphone access until explicitly allowed.

1. Open **System Settings → Privacy & Security → Microphone**
2. Make sure your browser (Chrome or Safari) is toggled **ON**
3. If you use the Terminal to run the app, allow **Terminal** access too

---

### Step 6 — Run the app

You need **two terminals** if using the launch script, or **three terminals** if running manually (Ollama from Step 2, plus backend/frontend terminals):

**Terminal 1 — Ollama** (already running from Step 2b):
```
ollama serve      ← keep this running
```

#### Option A: Run Frontend & Backend Together (Recommended)

In **Terminal 2**, run the launch script from the repository root:
```bash
./start.sh
```
This starts both the backend (FastAPI) and frontend (Next.js) dev servers simultaneously. Press `Ctrl+C` once to shut down both.

#### Option B: Run Frontend & Backend Manually

**Terminal 2 — Backend:**
```bash
cd /path/to/voice-learning-ai/backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

Expected output:
```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Terminal 3 — Frontend:**
```bash
cd /path/to/voice-learning-ai/frontend
npm run dev
```

Expected output:
```
▲ Next.js 15.1.0
- Local:        http://localhost:3000
- Ready in 2.1s
```

---

### Step 7 — Verify everything is working

Open your browser and go to:

```
http://localhost:8000/health
```

You should see JSON like:
```json
{
  "status": "ok",
  "ollama_available": true,
  "available_models": ["llama3.1:8b"],
  "deepseek_configured": false
}
```

If `ollama_available` is `false`, make sure `ollama serve` is still running in Terminal 1.

Then open the app:
```
http://localhost:3000
```

---

### Step 8 — Your first session

1. On the **Dashboard**, select a **Topic** (e.g. "System Design") from the first dropdown
2. Choose a **Model** from the second dropdown — start with `llama3.1:8b` (Local)
3. Click **Start**
4. The AI interviewer will speak to you — make sure your speaker/headphones are on
5. Press the **microphone button** at the bottom to start recording your answer
6. Speak your answer clearly, then press the **mic button again** to submit
7. Wait 3–5 seconds — the app transcribes your speech, scores it, and the interviewer speaks feedback
8. Your score breakdown appears on the right panel

---

### Step 9 — Optional provider configuration

You can stop after Step 8 if you want a local-only setup. The app works that way by default.

Optional integrations currently exposed by the codebase:
- `DeepSeek` for cloud LLM inference
- `Gemini` for cloud LLM inference
- `Groq` for cloud speech-to-text
- `Deepgram` for cloud speech-to-text and text-to-speech
- `Cartesia` for cloud text-to-speech
- `Moonshine` as a lightweight local STT alternative
- `Piper` and `Apple` as local TTS alternatives

### Example: add a DeepSeek API key

To use DeepSeek V3 (`deepseek-chat`) or R1 (`deepseek-reasoner`):

1. Get an API key from **platform.deepseek.com** → API Keys
2. In the app, go to **Settings** (top-right button on Dashboard)
3. Find the **DeepSeek API Key** section, paste your key, click **Save**
4. The key is saved to `backend/.env` on your machine — never leaves your computer
5. Go back to Dashboard — DeepSeek models now appear in the Model dropdown without the ⚠ warning

---

### Step 10 — Upload your own question bank

1. Go to **Settings** → **Upload Question Bank**
2. Choose a `.csv` file (e.g. `microsoft.csv`)
3. Required columns: `topic`, `question`
4. Optional: `difficulty`, `company`, `category`, `expected_keywords`
5. After upload, the new topics appear in the Dashboard topic dropdown immediately

Sample files are already in `data/question_banks/` — you can open them to see the exact format.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `brew: command not found` | Add Homebrew to PATH: `export PATH="/opt/homebrew/bin:$PATH"` in `~/.zshrc`, then `source ~/.zshrc` |
| `python3.11: command not found` | Run `brew install python@3.11`, then use `/opt/homebrew/bin/python3.11` |
| `pip install` fails on `sounddevice` | `brew install portaudio` first |
| `ollama_available: false` in `/health` | Run `ollama serve` in a separate terminal |
| No audio from interviewer | Check System Settings → Sound → Output volume. Also try Chrome over Safari. |
| Mic button does nothing | Allow microphone in System Settings → Privacy & Security → Microphone |
| `faster-whisper` model download stuck | Delete `~/.cache/huggingface/hub/` and retry |
| Kokoro TTS import error | `pip install kokoro==0.9.4 soundfile sounddevice` — Kokoro requires `espeak-ng`: `brew install espeak` |
| `uvicorn: command not found` | Make sure venv is active: `source backend/.venv/bin/activate` |
| `npm run dev` fails | Run `node --version` — must be 18+. Upgrade: `brew upgrade node` |
| Port 8000 already in use | `lsof -ti:8000 \| xargs kill` then restart uvicorn |
| DeepSeek returns 401 | API key is wrong or expired — remove and re-add in Settings |
| Gemini / Groq / Deepgram / Cartesia features do not work | Confirm the matching API key is saved in Settings and that the selected provider supports the capability you picked |
| Score always 0 | The LLM returned malformed JSON. Try a larger model (`qwen2.5:14b`) or check backend logs |

---

## Model and Engine Notes (M4 24GB)

| Model | Size | Use Case | Quality |
|-------|------|----------|---------|
| `llama3.1:8b` | 4.7GB | General interviews, fast | ★★★★☆ |
| `qwen2.5:14b` | 8.1GB | Deep technical + coding | ★★★★★ |
| `deepseek-r1:8b` | 4.7GB | Reasoning / system design | ★★★★☆ |
| `codellama:13b` | 7.4GB | Coding rounds | ★★★★☆ |

STT (speech-to-text):
- `whisper large-v3-turbo` — default, best speed/accuracy on M4 (uses CoreML)
- `moonshine/tiny` or `moonshine/base` — lightweight local alternatives
- `groq whisper-large-v3-turbo` and `deepgram nova-3` — optional cloud STT paths

TTS (interviewer voice):
- `kokoro-82M` — default, ~50ms latency, very natural
- `apple` — built-in macOS voice fallback
- `piper` — lightweight local TTS option
- `cartesia` and `deepgram` — optional cloud TTS paths

---

## Question Bank Format

Upload a `.csv` file from the Settings page. Required columns:

```csv
topic,question,difficulty,company,category,expected_keywords
"System Design","Design a rate limiter","Hard","Google","System Design","token bucket,sliding window,distributed"
"Algorithms","Find k-th largest element in an array","Medium","Amazon","Arrays","quickselect,heap,sorting"
"Behavioral","Tell me about a time you handled a conflict","Medium","Microsoft","Behavioral","STAR,communication,resolution"
```

Sample question banks are in [data/question_banks/](data/question_banks/).

| File | Description |
|------|-------------|
| `sample_faang.csv` | 200 questions from FAANG interview reports |
| `sample_microsoft.csv` | 150 Microsoft-style questions |
| `sample_system_design.csv` | 50 system design questions |

---

## Assessment Rubric

After each answer, the LLM scores you on a **100-point FAANG rubric**:

| Dimension | Weight | What it measures |
|-----------|--------|-----------------|
| Technical Correctness | 40% | Is the core answer right? |
| Depth & Completeness | 25% | Edge cases, trade-offs, alternatives |
| Communication Clarity | 20% | Structure, examples, conciseness |
| Problem Solving Process | 15% | How you approached the problem |

Scores are stored in SQLite and visualized on the dashboard.

---

## SQLite Database

The app stores its working data in a single SQLite file at `data/voicelearning.db`.

### Tables

| Table | What it stores |
|-------|---------------|
| `sessions` | Every interview session (topic, model used, final score, timestamps) |
| `questions` | All loaded questions (from seed + CSV uploads) |
| `responses` | Your spoken answers, transcribed |
| `scores` | Per-answer rubric breakdown (technical, depth, clarity, process) |
| `topic_mastery` | Rolling average score per topic across all sessions |
| `resumes` | Uploaded documents and parsed text used for question generation |
| `session_questions` | The exact question order selected for each interview session |
| `response_followups` | Saved follow-up reports and transcript turns for follow-up mode drills |

### In-app Database Viewer

Click the **DB** button on the Dashboard to open the built-in database viewer.

```
┌─────────────────────────────────────────────────────┐
│  Database Viewer          voicelearning.db  [↻]     │
├──────────────┬──────────────────────────────────────┤
│  Sessions    │  id  title           topic  score    │
│  Responses   │  ─────────────────────────────────   │
│  Scores      │  12  System Design…  SD     84.0     │
│  Topic       │  11  Algorithms…     Algo   71.5     │
│  Mastery     │  10  Behavioral…     Beh    90.0     │
│  Questions   │                                      │
└──────────────┴──────────────────────────────────────┘
```

- Click any **column header** to sort
- Scores are color-coded: green ≥80, yellow ≥60, red <60
- Shows up to 200 rows per table (newest first)

### Direct DB access (optional)

To inspect or query the database directly:

```bash
# Option 1 — command line
sqlite3 data/voicelearning.db

# Useful queries:
sqlite3 data/voicelearning.db "SELECT topic, AVG(total) as avg, COUNT(*) as n FROM scores s JOIN responses r ON r.id=s.response_id JOIN questions q ON q.id=r.question_id GROUP BY topic ORDER BY avg DESC;"

# Option 2 — GUI (recommended)
brew install --cask db-browser-for-sqlite
# Then open data/voicelearning.db in the app
```

See [backend/db/schema.sql](backend/db/schema.sql) for the full schema with column definitions.

---

## Project Structure

```
voice-learning-ai/
├── README.md
├── backend/
│   ├── main.py                 # FastAPI app + WebSocket
│   ├── requirements.txt
│   ├── config.py               # model paths, Ollama URL, settings
│   ├── db/
│   │   ├── database.py         # SQLite connection + schema init
│   │   └── schema.sql
│   ├── models/
│   │   ├── session.py
│   │   ├── question.py
│   │   └── score.py
│   ├── routers/
│   │   ├── interview.py        # WebSocket interview loop
│   │   ├── questions.py        # CRUD + CSV upload
│   │   ├── progress.py         # stats, history, DB browser
│   │   ├── resume.py           # resume/doc-based generation
│   │   └── practice.py         # guided study endpoints
│   └── services/
│       ├── stt.py              # local + cloud STT routing
│       ├── tts.py              # local + cloud TTS routing
│       ├── llm.py              # Ollama + cloud LLM routing
│       └── assessor.py         # scoring engine
├── frontend/
│   ├── package.json
│   └── src/
│       ├── app/
│       │   ├── page.tsx              # redirect to dashboard
│       │   ├── dashboard/page.tsx    # progress & history
│       │   ├── generate/page.tsx     # resume/topic-based generation
│       │   ├── interview/
│       │   │   └── [sessionId]/page.tsx  # interview room
│       │   ├── practice/[questionId]/page.tsx  # guided practice
│       │   ├── database/page.tsx     # in-app DB browser
│       │   └── settings/page.tsx     # provider config, uploads
│       ├── components/
│       │   ├── interview/
│       │   │   ├── InterviewRoom.tsx  # main interview layout
│       │   │   ├── Waveform.tsx
│       │   │   ├── TranscriptPanel.tsx
│       │   │   └── ScoreOverlay.tsx
│       │   ├── dashboard/
│       │   │   └── TopicRadar.tsx     # mastery visualization
│       ├── hooks/
│       │   ├── useAudioRecorder.ts
│       │   └── useInterview.ts
│       └── lib/
│           └── api.ts
├── data/
│   ├── seed.py                 # DB init + sample question loader
│   └── question_banks/
│       ├── sample_faang.csv
│       ├── sample_microsoft.csv
│       └── sample_system_design.csv
└── scripts/
    ├── setup.sh                # one-shot setup script
    └── check_models.sh         # verify Ollama models are available
```

---

## Configuration

Runtime defaults live in [backend/config.py](backend/config.py) and can also be changed from the app's Settings page, which persists updates into `backend/.env`.

```python
ollama_model = "llama3.1:8b"
stt_engine = "whisper"
whisper_model = "large-v3-turbo"
tts_engine = "kokoro"
tts_voice = "af_heart"
database_path = "../data/voicelearning.db"
```

## Local-First Positioning

- The main path is still local: Ollama for LLMs, local STT/TTS options, and SQLite for storage.
- Optional cloud and exploratory integrations do not change the core design goal; they extend the app for experimentation and provider flexibility.
- If you enable DeepSeek, Gemini, Groq, Deepgram, or Cartesia, that specific capability becomes cloud-backed, but the application architecture and stored data remain local-first.

---

## Roadmap & Implementation Tracker

To track feature completion status, in-progress tasks, and missing features, please refer to the detailed [TODO.md](TODO.md) file.

---



## License

MIT
