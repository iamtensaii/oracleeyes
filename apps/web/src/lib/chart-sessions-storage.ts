/**
 * Persist saved chart snapshots (OHLCV + meta) for dashboard list.
 */
import type { CsvDatasetMeta } from "@/lib/parse-csv";
import type { OhlcBar } from "@/types/market";

const SESSIONS_KEY = "oracleeyes.chartSessions.v1";
const ACTIVE_KEY = "oracleeyes.chartSession.activeId";

export type StoredChartSession = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  bars: OhlcBar[];
  meta: CsvDatasetMeta | null;
};

const MAX_SESSIONS = 24;

export function loadSessions(): StoredChartSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is StoredChartSession =>
        x &&
        typeof x === "object" &&
        typeof (x as StoredChartSession).id === "string" &&
        Array.isArray((x as StoredChartSession).bars),
    );
  } catch {
    return [];
  }
}

export function persistSessions(sessions: StoredChartSession[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
  } catch {
    /* quota / private mode */
  }
}

export function loadLastActiveId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function persistLastActiveId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* ignore */
  }
}

export function defaultSessionName(meta: CsvDatasetMeta | null, barCount: number): string {
  const sym = meta?.symbol;
  const tf = meta?.timeframe;
  const base =
    sym && tf ? `${sym} ${tf}` : meta?.sourceFilename?.replace(/\.[^.]+$/i, "") || "Chart";
  return `${base} · ${barCount} bars`;
}
