/**
 * SMA and volume helpers for lightweight-charts overlays.
 */
import type { OhlcBar } from "@/types/market";

export type LinePoint = { time: number; value: number };

export type VolumeBarPoint = {
  time: number;
  value: number;
  color: string;
};

export function smaPoints(bars: OhlcBar[], period: number): LinePoint[] {
  if (bars.length < period || period < 1) return [];
  const out: LinePoint[] = [];
  for (let i = period - 1; i < bars.length; i++) {
    let s = 0;
    for (let j = 0; j < period; j++) {
      s += bars[i - j]!.close;
    }
    out.push({ time: bars[i]!.time, value: s / period });
  }
  return out;
}

export function volumeHistogramPoints(bars: OhlcBar[]): VolumeBarPoint[] {
  return bars.map((b) => ({
    time: b.time,
    value: Number.isFinite(b.volume ?? NaN) ? (b.volume as number) : 0,
    color: b.close >= b.open ? "rgba(22,163,74,0.55)" : "rgba(220,38,38,0.55)",
  }));
}

export type ChartTechnicalsSummary = {
  n_bars: number;
  last_time_iso: string;
  last_close: number;
  last_open: number;
  change_1_bar_pct: number | null;
  change_5_bar_pct: number | null;
  high_20: number;
  low_20: number;
  range_20_pct: number | null;
  sma_20: number | null;
  sma_50: number | null;
  close_vs_sma20_pct: number | null;
  close_vs_sma50_pct: number | null;
  vol_last: number | null;
  vol_avg_20: number | null;
  recent_closes_trend: "up" | "down" | "mixed";
  median_bar_step_sec: number | null;
};

function medianPositiveDeltas(bars: OhlcBar[]): number | null {
  if (bars.length < 3) return null;
  const deltas: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const d = bars[i]!.time - bars[i - 1]!.time;
    if (d > 0 && d < 86400 * 400) deltas.push(d);
  }
  if (deltas.length === 0) return null;
  deltas.sort((a, b) => a - b);
  return deltas[Math.floor(deltas.length / 2)]!;
}

/**
 * Compact technical snapshot for the research agent (no extra HTTP).
 */
export function summarizeChartTechnicals(bars: OhlcBar[], tail = 120): ChartTechnicalsSummary {
  const slice = bars.length > tail ? bars.slice(-tail) : [...bars];
  const n = slice.length;
  const last = slice[n - 1];
  const prev = n > 1 ? slice[n - 2] : null;

  const change1 =
    last && prev && prev.close !== 0 ? ((last.close - prev.close) / prev.close) * 100 : null;
  const b5 = n > 5 ? slice[n - 6] : null;
  const change5 =
    last && b5 && b5.close !== 0 ? ((last.close - b5.close) / b5.close) * 100 : null;

  const win = slice.slice(-Math.min(20, n));
  const highs = win.map((b) => b.high);
  const lows = win.map((b) => b.low);
  const high20 = Math.max(...highs);
  const low20 = Math.min(...lows);
  const range20pct = last && last.close !== 0 ? ((high20 - low20) / last.close) * 100 : null;

  const ma20s = smaPoints(slice, 20);
  const ma50s = smaPoints(slice, 50);
  const sma20 = ma20s.length ? ma20s[ma20s.length - 1]!.value : null;
  const sma50 = ma50s.length ? ma50s[ma50s.length - 1]!.value : null;
  const closeVs = (sma: number | null) =>
    last && sma !== null && sma !== 0 ? ((last.close - sma) / sma) * 100 : null;

  const vols = slice.map((b) => b.volume).filter((v): v is number => Number.isFinite(v));
  const volLast = last?.volume !== undefined && Number.isFinite(last.volume) ? last.volume : null;
  const rv = vols.slice(-20);
  const volAvg20 = rv.length ? rv.reduce((a, b) => a + b, 0) / rv.length : null;

  const closes = slice.slice(-5).map((b) => b.close);
  let trend: "up" | "down" | "mixed" = "mixed";
  if (closes.length >= 3) {
    const up = closes.every((c, i) => i === 0 || c >= closes[i - 1]!);
    const down = closes.every((c, i) => i === 0 || c <= closes[i - 1]!);
    if (up) trend = "up";
    else if (down) trend = "down";
  }

  return {
    n_bars: bars.length,
    last_time_iso: last ? new Date(last.time * 1000).toISOString() : "",
    last_close: last?.close ?? 0,
    last_open: last?.open ?? 0,
    change_1_bar_pct: change1,
    change_5_bar_pct: change5,
    high_20: high20,
    low_20: low20,
    range_20_pct: range20pct,
    sma_20: sma20,
    sma_50: sma50,
    close_vs_sma20_pct: closeVs(sma20),
    close_vs_sma50_pct: closeVs(sma50),
    vol_last: volLast,
    vol_avg_20: volAvg20,
    recent_closes_trend: trend,
    median_bar_step_sec: medianPositiveDeltas(bars),
  };
}
