-- VoiceIQ database schema

CREATE TABLE IF NOT EXISTS questions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    topic       TEXT NOT NULL,
    question    TEXT NOT NULL,
    difficulty  TEXT CHECK(difficulty IN ('Easy','Medium','Hard')) DEFAULT 'Medium',
    company     TEXT,
    category    TEXT,
    expected_keywords TEXT,   -- comma-separated hints for the LLM scorer
    source_file TEXT,         -- which CSV this came from
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT,
    topic       TEXT,
    model_used  TEXT,
    follow_up_mode INTEGER DEFAULT 0,
    status      TEXT CHECK(status IN ('active','completed','abandoned')) DEFAULT 'active',
    total_score REAL,
    started_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at    DATETIME
);

CREATE TABLE IF NOT EXISTS session_questions (
    session_id      INTEGER NOT NULL REFERENCES sessions(id),
    question_id     INTEGER NOT NULL REFERENCES questions(id),
    question_order  INTEGER NOT NULL,
    PRIMARY KEY (session_id, question_order)
);

CREATE TABLE IF NOT EXISTS responses (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      INTEGER NOT NULL REFERENCES sessions(id),
    question_id     INTEGER NOT NULL REFERENCES questions(id),
    question_order  INTEGER,
    transcript      TEXT,           -- your spoken answer, transcribed
    audio_duration  REAL,           -- seconds
    responded_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scores (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    response_id             INTEGER NOT NULL REFERENCES responses(id),
    technical_correctness   REAL,   -- 0-40
    depth_completeness      REAL,   -- 0-25
    communication_clarity   REAL,   -- 0-20
    problem_solving         REAL,   -- 0-15
    total                   REAL,   -- 0-100
    llm_feedback            TEXT,   -- paragraph of feedback
    follow_up_asked         TEXT,   -- what the interviewer asked next
    scored_at               DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Rolling topic mastery — updated after every session
CREATE TABLE IF NOT EXISTS topic_mastery (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    topic           TEXT UNIQUE NOT NULL,
    avg_score       REAL DEFAULT 0,
    attempts        INTEGER DEFAULT 0,
    last_practiced  DATETIME
);

CREATE TABLE IF NOT EXISTS resumes (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    filename            TEXT NOT NULL,
    parsed_text         TEXT,
    questions_generated INTEGER DEFAULT 0,
    uploaded_at         DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS response_followups (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    response_id         INTEGER NOT NULL UNIQUE REFERENCES responses(id),
    turns_json          TEXT NOT NULL,
    report_json         TEXT NOT NULL,
    understanding_score REAL,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_responses_session ON responses(session_id);
CREATE INDEX IF NOT EXISTS idx_scores_response ON scores(response_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic);
CREATE INDEX IF NOT EXISTS idx_session_questions_session ON session_questions(session_id);
CREATE INDEX IF NOT EXISTS idx_response_followups_response ON response_followups(response_id);
