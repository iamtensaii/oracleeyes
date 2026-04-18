/**
 * Human-readable spacing between OHLC bar timestamps (chart legend / comparison).
 */
import type { OhlcBar } from "@/types/market";

export function formatDurationSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "—";
  const s = Math.round(sec);
  if (s < 60) return `${s}s`;
  if (s < 3600) {
    const m = Math.round(s / 60);
    return `${m} min`;
  }
  if (s < 86400) {
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(s / 86400);
  const h = Math.round((s % 86400) / 3600);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

export function barIndexAtTime(bars: OhlcBar[], timeSec: number): number {
  return bars.findIndex((b) => b.time === timeSec);
}

export function neighborSpacingForBar(
  bars: OhlcBar[],
  index: number,
): { prevSec: number | null; nextSec: number | null } {
  if (index < 0 || index >= bars.length) return { prevSec: null, nextSec: null };
  const prevSec = index > 0 ? bars[index]!.time - bars[index - 1]!.time : null;
  const nextSec =
    index < bars.length - 1 ? bars[index + 1]!.time - bars[index]!.time : null;
  return { prevSec, nextSec };
}
