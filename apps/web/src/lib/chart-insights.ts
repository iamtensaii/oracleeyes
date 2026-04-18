/**
 * Infer bar spacing and approximate calendar returns from OHLCV (research / UI only).
 */
import type { OhlcBar } from "@/types/market";

export type PerfWindowId = "1d" | "1w" | "1m" | "3m" | "6m" | "ytd" | "1y";

export const PERF_WINDOWS: { id: PerfWindowId; label: string }[] = [
  { id: "1d", label: "1D" },
  { id: "1w", label: "1W" },
  { id: "1m", label: "1M" },
  { id: "3m", label: "3M" },
  { id: "6m", label: "6M" },
  { id: "ytd", label: "YTD" },
  { id: "1y", label: "1Y" },
];

/** Median positive delta between consecutive bars (seconds). */
export function inferMedianBarPeriodSeconds(bars: OhlcBar[]): number | null {
  if (bars.length < 3) return null;
  const deltas: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const d = bars[i].time - bars[i - 1].time;
    if (d > 0 && d < 86400 * 400) deltas.push(d);
  }
  if (deltas.length === 0) return null;
  deltas.sort((a, b) => a - b);
  return deltas[Math.floor(deltas.length / 2)]!;
}

function windowStartUnix(lastTimeSec: number, window: PerfWindowId): number {
  switch (window) {
    case "1d":
      return lastTimeSec - 86400;
    case "1w":
      return lastTimeSec - 7 * 86400;
    case "1m":
      return lastTimeSec - 30 * 86400;
    case "3m":
      return lastTimeSec - 90 * 86400;
    case "6m":
      return lastTimeSec - 180 * 86400;
    case "1y":
      return lastTimeSec - 365 * 86400;
    case "ytd": {
      const d = new Date(lastTimeSec * 1000);
      return Math.floor(Date.UTC(d.getUTCFullYear(), 0, 1) / 1000);
    }
    default:
      return lastTimeSec;
  }
}

/**
 * % return from open of first bar at/after window start to last close.
 * Null if not enough history or invalid prices.
 */
export function returnOverWindow(bars: OhlcBar[], window: PerfWindowId): number | null {
  if (bars.length < 2) return null;
  const last = bars[bars.length - 1]!;
  const lastTime = last.time;
  const startSec = windowStartUnix(lastTime, window);
  const idx = bars.findIndex((b) => b.time >= startSec);
  if (idx < 0) return null;
  if (idx >= bars.length - 1) return null;
  const startPrice = bars[idx]!.open;
  const endPrice = last.close;
  if (!Number.isFinite(startPrice) || !Number.isFinite(endPrice) || startPrice === 0) return null;
  return ((endPrice - startPrice) / startPrice) * 100;
}

/** Bars of history needed for rough quality of each window (by bar period). */
export function minBarsHintForWindow(window: PerfWindowId, periodSec: number | null): number {
  const p = periodSec && periodSec > 0 ? periodSec : 3600;
  const needSec =
    window === "1d"
      ? 86400
      : window === "1w"
        ? 7 * 86400
        : window === "1m"
          ? 30 * 86400
          : window === "3m"
            ? 90 * 86400
            : window === "6m"
              ? 180 * 86400
              : window === "1y"
                ? 365 * 86400
                : 30 * 86400;
  return Math.ceil(needSec / p) + 2;
}
