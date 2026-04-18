-- Agent session memory (Postgres fallback until RuVector graph layer is enabled)
CREATE TABLE IF NOT EXISTS agent_memory (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  content TEXT NOT NULL,
  role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_memory_session ON agent_memory (session_id, created_at DESC);
