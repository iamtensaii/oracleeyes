/**
 * Build an illustrative next-bar OHLC from RF direction + recent volatility (UI only).
 */
import { inferMedianBarPeriodSeconds } from "@/lib/chart-insights";
import type { OhlcBar } from "@/types/market";

/**
 * If timestamp falls on Saturday or Sunday (UTC), roll forward to Monday 00:00:00 UTC.
 * Matches typical Mon–Fri cash/FX-style sessions; wrong for 24/7 crypto (use skipWeekends: false).
 */
export function rollForecastTimeUtcSkipWeekend(timeSec: number): number {
  const d = new Date(timeSec * 1000);
  const day = d.getUTCDay();
  if (day !== 0 && day !== 6) return timeSec;
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  let dom = d.getUTCDate();
  if (day === 6) dom += 2;
  else dom += 1;
  return Math.floor(Date.UTC(y, m, dom, 0, 0, 0) / 1000);
}

function isUtcWeekend(timeSec: number): boolean {
  const day = new Date(timeSec * 1000).getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Re-stamp generative forecast bars so no bar sits on Sat–Sun UTC (typical FX / cash metals).
 * Uses a fixed step from the last **history** bar; Kronos timestamps are replaced for display only.
 */
export function shiftGenerativeForecastTimesSkipWeekendsUtc(
  lastHistTimeSec: number,
  stepSec: number,
  forecast: OhlcBar[],
): OhlcBar[] {
  if (forecast.length === 0) return forecast;
  if (!Number.isFinite(lastHistTimeSec) || !Number.isFinite(stepSec) || stepSec < 1) return forecast;
  let prev = lastHistTimeSec;
  const out: OhlcBar[] = [];
  for (const b of forecast) {
    let t = prev + stepSec;
    while (isUtcWeekend(t)) {
      t = rollForecastTimeUtcSkipWeekend(t);
    }
    while (t <= prev) {
      t += stepSec;
      while (isUtcWeekend(t)) {
        t = rollForecastTimeUtcSkipWeekend(t);
      }
    }
    prev = t;
    out.push({ ...b, time: t });
  }
  return out;
}

function medianSorted(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

/**
 * Single “forecast” candle: open at last close, body/wicks scaled from recent bar ranges.
 * Not a price target — encodes model class (-1/0/1) for chart context only.
 */
export type ForecastBarOptions = {
  /** Fixed step between bars (use for multi-step so spacing stays like the real series). */
  barStepSec?: number;
  /**
   * Default true: forecast bar time never sits on Sat/Sun UTC (jumps to Monday open).
   * Set false for always-on markets (e.g. some crypto).
   */
  skipWeekends?: boolean;
};

export function buildForecastOhlcBar(
  bars: OhlcBar[],
  direction: number,
  proba?: number[],
  options?: ForecastBarOptions,
): OhlcBar | null {
  if (bars.length < 2) return null;
  const last = bars[bars.length - 1]!;
  const period = options?.barStepSec ?? inferMedianBarPeriodSeconds(bars) ?? 3600;
  let t = last.time + period;
  while (bars.some((b) => b.time === t)) t += 1;
  const skipWeekends = options?.skipWeekends !== false;
  if (skipWeekends) {
    t = rollForecastTimeUtcSkipWeekend(t);
    while (bars.some((b) => b.time === t)) t += 1;
  }

  const n = Math.min(50, bars.length);
  const ranges = bars
    .slice(-n)
    .map((b) => Math.abs(b.high - b.low))
    .filter((x) => Number.isFinite(x) && x > 0);
  const medianRange = medianSorted(ranges) ?? Math.max(Math.abs(last.high - last.low), 1e-8);

  const topP = proba?.length ? Math.max(...proba) : 1 / 3;
  const strength = Math.min(1, Math.max(0.2, (topP - 0.33) / 0.45 + 0.35));

  const o = last.close;
  let bodyMove = 0;
  if (direction > 0) bodyMove = medianRange * 0.38 * strength;
  else if (direction < 0) bodyMove = -medianRange * 0.38 * strength;

  const c = o + bodyMove;
  const wick = medianRange * 0.22;
  const hi = Math.max(o, c) + wick;
  const lo = Math.min(o, c) - wick;

  return {
    time: t,
    open: o,
    high: hi,
    low: lo,
    close: c,
    volume: undefined,
  };
}

/**
 * Shift every forecast OHLC by a constant so the first bar opens at `lastClose`.
 * Preserves model bar-to-bar deltas; fixes the common “teleport away from last price” chart artifact.
 */
export function anchorForecastSeriesToLastClose(
  lastClose: number,
  forecast: OhlcBar[],
): OhlcBar[] {
  if (forecast.length === 0) return forecast;
  const firstOpen = forecast[0]!.open;
  if (!Number.isFinite(lastClose) || !Number.isFinite(firstOpen)) return forecast;
  const delta = lastClose - firstOpen;
  if (!Number.isFinite(delta)) return forecast;
  return forecast.map((b) => ({
    ...b,
    open: b.open + delta,
    high: b.high + delta,
    low: b.low + delta,
    close: b.close + delta,
  }));
}

/** Ensure high/low bracket open and close (and fix inverted extremes from noisy model output). */
export function clampForecastOhlcInvariants(forecast: OhlcBar[]): OhlcBar[] {
  return forecast.map((b) => {
    const top = Math.max(b.open, b.close, b.high, b.low);
    const bot = Math.min(b.open, b.close, b.high, b.low);
    return { ...b, high: top, low: bot };
  });
}

export function prepareGenerativeForecastForChart(
  lastClose: number,
  forecast: OhlcBar[],
  options?: {
    /** Last history bar unix sec + median step — skips Sat/Sun UTC on the violet series. */
    skipWeekendsUtc?: { lastHistTimeSec: number; barStepSec: number };
  },
): OhlcBar[] {
  let next = clampForecastOhlcInvariants(anchorForecastSeriesToLastClose(lastClose, forecast));
  const sk = options?.skipWeekendsUtc;
  if (sk && Number.isFinite(sk.lastHistTimeSec) && Number.isFinite(sk.barStepSec)) {
    next = shiftGenerativeForecastTimesSkipWeekendsUtc(sk.lastHistTimeSec, sk.barStepSec, next);
  }
  return next;
}
