/**
 * Group saved chart sessions by symbol for multi-timeframe switching.
 */
import type { StoredChartSession } from "@/lib/chart-sessions-storage";

const TF_ORDER = [
  "M1",
  "M2",
  "M3",
  "M4",
  "M5",
  "M6",
  "M10",
  "M12",
  "M15",
  "M20",
  "M30",
  "H1",
  "H2",
  "H3",
  "H4",
  "H6",
  "H8",
  "H12",
  "D1",
  "W1",
  "MN1",
  "1D",
  "1W",
  "1M",
];

export function normalizeSymbolKey(symbol: string | null | undefined): string | null {
  const s = (symbol ?? "").trim().toUpperCase();
  return s.length > 0 ? s : null;
}

/** Sort key for MT5-style timeframe strings (M1 … MN1). */
export function timeframeRank(tf: string | null | undefined): number {
  if (!tf) return 999;
  const u = tf.trim().toUpperCase().replace(/\s+/g, "");
  const i = TF_ORDER.indexOf(u);
  if (i >= 0) return i;
  return 500 + (u.charCodeAt(0) ?? 0);
}

export function sessionsForSymbol(
  sessions: StoredChartSession[],
  symbolKey: string | null,
): StoredChartSession[] {
  if (!symbolKey) return [];
  return sessions
    .filter((s) => normalizeSymbolKey(s.meta?.symbol) === symbolKey)
    .sort((a, b) => timeframeRank(a.meta?.timeframe) - timeframeRank(b.meta?.timeframe));
}

export function displayTimeframeLabel(s: StoredChartSession): string {
  const tf = s.meta?.timeframe?.trim();
  if (tf) return tf;
  const name = s.name;
  const m = name.match(/\b(M\d+|H\d+|D1|W1|MN1|\d+\s*[mMhHdDwW]+)\b/);
  return m ? m[1]! : s.name.slice(0, 12) + (s.name.length > 12 ? "…" : "");
}
