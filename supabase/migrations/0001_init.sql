-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ─────────────────────────────────────────────
-- 1. entities
-- ─────────────────────────────────────────────
CREATE TABLE entities (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text,
  name        text,
  kind        text,
  metadata    jsonb,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE entities ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────
-- 2. raw_captures
-- ─────────────────────────────────────────────
CREATE TABLE raw_captures (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        text,
  source         text,
  raw_text       text,
  audio_url      text,
  classification jsonb,
  llm_source     text,
  routed_to      text,
  routed_id      uuid,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE raw_captures ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────
-- 3. tasks
-- ─────────────────────────────────────────────
CREATE TABLE tasks (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           text,
  title             text        NOT NULL,
  description       text,
  urgency           text,
  key               boolean     DEFAULT false,
  priority_score    numeric     DEFAULT 0,
  time_estimate_min int,
  tags              text[],
  due_date          date,
  owner             text,
  entity_id         uuid        REFERENCES entities (id),
  completed_at      timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────
-- 4. daily_logs
-- NOTE: notes est TEXT intentionnellement — le code fait JSON.parse côté client
-- ─────────────────────────────────────────────
CREATE TABLE daily_logs (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    text,
  log_date   date        NOT NULL,
  notes      text,
  mood       text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────
-- 5. memory_chunks
-- ─────────────────────────────────────────────
CREATE TABLE memory_chunks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text,
  source_type text,
  source_id   uuid,
  text        text,
  embedding   vector(1536),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE memory_chunks ENABLE ROW LEVEL SECURITY;

CREATE INDEX memory_chunks_embedding_idx
  ON memory_chunks
  USING ivfflat (embedding vector_cosine_ops);

-- ─────────────────────────────────────────────
-- 6. audit_log
-- ─────────────────────────────────────────────
CREATE TABLE audit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       text,
  action        text,
  resource_type text,
  resource_id   uuid,
  metadata      jsonb,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
