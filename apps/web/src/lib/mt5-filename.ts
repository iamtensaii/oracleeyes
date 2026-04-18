/**
 * MetaTrader 5 export filenames: typically `<SYMBOL><TIMEFRAME>.csv`
 * Examples: XAUUSDH1.csv, EURUSDM15.csv, GBPUSDH4.csv
 */

/** Longer / alias suffixes first (e.g. MONTHLY1 before MONTHLY so suffix matches whole token). */
const TIMEFRAMES_DESC = [
  "MONTHLY1",
  "WEEKLY1",
  "DAILY1",
  "MONTHLY",
  "WEEKLY",
  "DAILY",
  "MN1",
  "D1",
  "W1",
  "M30",
  "M20",
  "M15",
  "M12",
  "M10",
  "M6",
  "M5",
  "M4",
  "M3",
  "M2",
  "M1",
  "H12",
  "H8",
  "H6",
  "H4",
  "H3",
  "H2",
  "H1",
] as const;

/** Normalize MT5 export spellings to compact codes used in the UI. */
const TIMEFRAME_CANONICAL: Record<string, string> = {
  DAILY: "D1",
  DAILY1: "D1",
  WEEKLY: "W1",
  WEEKLY1: "W1",
  MONTHLY: "MN1",
  MONTHLY1: "MN1",
};

export type Mt5FilenameMeta = {
  symbol: string;
  timeframe: string;
};

/**
 * Parse SYMBOL + timeframe from MT5-style basename (no extension).
 */
export function inferFromMt5Filename(filename: string): Mt5FilenameMeta | null {
  const base = filename
    .replace(/^.*[/\\]/, "")
    .replace(/\.[^.]+$/i, "")
    .replace(/\s+\(\d+\)\s*$/i, "")
    .toUpperCase();
  if (base.length < 3) return null;
  for (const tf of TIMEFRAMES_DESC) {
    if (base.endsWith(tf)) {
      const symbol = base.slice(0, -tf.length);
      if (symbol.length < 2) return null;
      return { symbol, timeframe: TIMEFRAME_CANONICAL[tf] ?? tf };
    }
  }
  return null;
}
