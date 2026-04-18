/**
 * Agent session memory — Postgres when DATABASE_URL is set, else in-process Map.
 * RuVector/Cypher can replace this storage later; same API surface.
 * Server-only: import only from Route Handlers / Server Actions.
 */
import "server-only";

import { randomUUID } from "crypto";

type Row = { id: string; session_id: string; content: string; role: string | null; created_at: string };

const memoryFallback = new Map<string, Row[]>();

export async function saveMemory(
  sessionId: string,
  content: string,
  role?: string,
): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url });
    await pool.query(
      `INSERT INTO agent_memory (session_id, content, role) VALUES ($1, $2, $3)`,
      [sessionId, content, role ?? null],
    );
    await pool.end();
    return;
  }
  const row: Row = {
    id: randomUUID(),
    session_id: sessionId,
    content,
    role: role ?? null,
    created_at: new Date().toISOString(),
  };
  const list = memoryFallback.get(sessionId) ?? [];
  list.push(row);
  memoryFallback.set(sessionId, list);
}

export async function listMemory(sessionId: string, limit = 50): Promise<Row[]> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url });
    const r = await pool.query<Row>(
      `SELECT id::text, session_id, content, role, created_at::text
       FROM agent_memory WHERE session_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [sessionId, limit],
    );
    await pool.end();
    return r.rows;
  }
  return (memoryFallback.get(sessionId) ?? []).slice(-limit).reverse();
}
