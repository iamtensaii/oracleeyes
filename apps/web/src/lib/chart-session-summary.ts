/**
 * Human-readable timeframe + date coverage for saved chart sessions.
 */
import type { StoredChartSession } from "@/lib/chart-sessions-storage";
import type { CsvDatasetMeta } from "@/lib/parse-csv";
import type { OhlcBar } from "@/types/market";
import { displayTimeframeLabel, normalizeSymbolKey, timeframeRank } from "@/lib/symbol-timeframe-group";

export type SymbolSessionGroup = {
  symbolKey: string;
  sessions: StoredChartSession[];
};

/**
 * Full date range of bar timestamps (UTC-based calendar dates in local display).
 */
export function formatBarDateRange(bars: OhlcBar[]): string | null {
  if (bars.length < 1) return null;
  const first = bars[0]!.time;
  const last = bars[bars.length - 1]!.time;
  const opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };
  const a = new Date(first * 1000).toLocaleDateString(undefined, opts);
  const b = new Date(last * 1000).toLocaleDateString(undefined, opts);
  return `${a} – ${b}`;
}

/**
 * Compact range for small UI (e.g. pill second line).
 */
export function formatBarDateRangeShort(bars: OhlcBar[]): string | null {
  if (bars.length < 1) return null;
  const f = new Date(bars[0]!.time * 1000);
  const l = new Date(bars[bars.length - 1]!.time * 1000);
  const sameYear = f.getFullYear() === l.getFullYear();
  const startOpts: Intl.DateTimeFormatOptions = sameYear
    ? { month: "short", day: "numeric" }
    : { month: "short", day: "numeric", year: "2-digit" };
  const endOpts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "2-digit" };
  return `${f.toLocaleDateString(undefined, startOpts)} – ${l.toLocaleDateString(undefined, endOpts)}`;
}

export function sessionCoverageSummary(s: StoredChartSession): string {
  const tf = displayTimeframeLabel(s);
  const range = formatBarDateRange(s.bars);
  if (range) return `${tf} · ${range}`;
  return tf;
}

export function sessionTabTooltip(s: StoredChartSession): string {
  const range = formatBarDateRange(s.bars);
  const tf = displayTimeframeLabel(s);
  const parts = [
    `${tf}, ${s.bars.length.toLocaleString()} bars`,
    range ?? "No date range",
    s.meta?.sourceFilename,
  ].filter(Boolean);
  return `${s.name} — ${parts.join(" · ")}`;
}

/**
 * Group saved sessions by normalized symbol for inventory lists.
 */
/**
 * Factual context for the agent system prompt: what is on the chart right now.
 */
/** One-line summary for Smart numbers / UI (not the full agent brief). */
export function shortDatasetBlurb(bars: OhlcBar[], meta: CsvDatasetMeta | null): string | null {
  if (bars.length === 0) return null;
  const range = formatBarDateRange(bars);
  const sym = meta?.symbol?.trim();
  const tf = meta?.timeframe?.trim();
  const label = [sym, tf].filter(Boolean).join(" · ");
  const head = label || "Loaded series";
  return range
    ? `${head} · ${bars.length.toLocaleString()} bars · ${range}`
    : `${head} · ${bars.length.toLocaleString()} bars`;
}

export function buildLoadedDatasetContext(bars: OhlcBar[], meta: CsvDatasetMeta | null): string {
  if (bars.length === 0) {
    return "No OHLCV series is loaded on the chart. ML tools cannot run until the user loads a CSV or opens a saved tab.";
  }
  const range = formatBarDateRange(bars);
  const sym = meta?.symbol?.trim();
  const tf = meta?.timeframe?.trim();
  const file = meta?.sourceFilename;
  const head = [
    `${bars.length.toLocaleString()} OHLCV bars on the chart`,
    sym ? `symbol ${sym}` : null,
    tf ? `timeframe ${tf}` : null,
    range ? `bar timestamps from ${range}` : null,
    `last close ${bars[bars.length - 1]!.close}`,
    file ? `source ${file}` : null,
  ]
    .filter(Boolean)
    .join("; ");
  return `${head}. Train, predict, and backtest tools always consume this loaded series only (not other saved tabs until the user switches). Longer clean histories and stable bar cadence generally improve fit; treat each timeframe upload as its own experiment.`;
}

export function groupSessionsBySymbol(sessions: StoredChartSession[]): SymbolSessionGroup[] {
  const map = new Map<string, StoredChartSession[]>();
  for (const s of sessions) {
    const key = normalizeSymbolKey(s.meta?.symbol) ?? "—";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => timeframeRank(a.meta?.timeframe) - timeframeRank(b.meta?.timeframe));
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => {
      if (a === "—") return 1;
      if (b === "—") return -1;
      return a.localeCompare(b);
    })
    .map(([symbolKey, sess]) => ({ symbolKey, sessions: sess }));
}
