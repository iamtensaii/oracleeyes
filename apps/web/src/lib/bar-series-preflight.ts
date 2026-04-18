/**
 * Client-side checks before ML / forecast requests — avoids nonsense charts and hard-to-debug API errors.
 */
import type { OhlcBar } from "@/types/market";

export type BarsPreflightResult = { ok: true } | { ok: false; message: string };

const EPS = 1e-9;

/**
 * Validates monotonic bar time and basic OHLC consistency (finite values, high/low bracket body).
 */
export function preflightOhlcSeriesForMl(bars: OhlcBar[]): BarsPreflightResult {
  if (bars.length === 0) return { ok: true };

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i]!;
    const { time, open, high, low, close } = b;
    const row = i + 1;

    if (!Number.isFinite(time)) {
      return { ok: false, message: `Bar ${row}: time is not a finite number (fix CSV or data source).` };
    }
    for (const [k, v] of [
      ["open", open],
      ["high", high],
      ["low", low],
      ["close", close],
    ] as const) {
      if (!Number.isFinite(v)) {
        return { ok: false, message: `Bar ${row}: ${k} is not a finite number (fix CSV or data source).` };
      }
    }

    const top = Math.max(open, close);
    const bot = Math.min(open, close);
    if (high + EPS < top) {
      return {
        ok: false,
        message: `Bar ${row}: high must be ≥ open and close (invalid OHLC).`,
      };
    }
    if (low - EPS > bot) {
      return {
        ok: false,
        message: `Bar ${row}: low must be ≤ open and close (invalid OHLC).`,
      };
    }
    if (high + EPS < low) {
      return { ok: false, message: `Bar ${row}: high must be ≥ low (invalid OHLC).` };
    }

    if (i > 0) {
      const prevT = bars[i - 1]!.time;
      if (time <= prevT) {
        return {
          ok: false,
          message:
            "Bar times must strictly increase (oldest → newest). Found duplicate or out-of-order timestamps — sort by time and remove duplicates, then reload.",
        };
      }
    }
  }

  return { ok: true };
}
