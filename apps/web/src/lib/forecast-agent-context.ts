/**
 * Text block for the research agent: violet forecast chain + last RF step.
 */
import { RESEARCH_ONLY_LINE } from "@/lib/product-copy";
import type { PredictResult } from "@/lib/ml-api";
import type { OhlcBar } from "@/types/market";

export function buildForecastContextForAgent(
  forecastBars: OhlcBar[],
  lastPred: PredictResult | null,
): string {
  if (!forecastBars.length && !lastPred) return "";
  const bits: string[] = [];

  if (forecastBars.length > 0) {
    const n = forecastBars.length;
    if (lastPred) {
      bits.push(
        `The UI shows ${n} chained violet “forecast” candle(s): each step is the RF’s next-bar class (−1/0/1) turned into synthetic OHLC using recent bar range; not real predicted prices. Bar times skip Sat–Sun UTC. These are the next N bars after the chart’s last timestamp — not a promise of when a given price level will hit on the calendar (real moves can arrive earlier or later).`,
      );
    } else {
      bits.push(
        `The UI shows ${n} violet “scenario” candle(s) from the generative forecast path (neural / service model, not the stepwise RF chain): a continuation sketch for learning, not guaranteed prices or trade targets. For chart continuity the client shifts the whole path vertically so the first bar opens at the last historical close (bar-to-bar OHLC deltas from the model are preserved). Bar timestamps are then re-stamped onto Mon–Fri UTC slots using your chart’s median bar step so Sat–Sun do not appear (typical FX cash session; wrong for 24/7 assets). Dates advance from the chart’s last bar — not a reliable calendar for when real trades would occur.`,
      );
    }
    const a = forecastBars[0]!;
    const z = forecastBars[forecastBars.length - 1]!;
    bits.push(
      `Illustrative closes: first ${a.close.toFixed(5)}, last ${z.close.toFixed(5)} (do not treat as targets).`,
    );
  }

  if (lastPred) {
    bits.push(
      `Last forward step: direction=${lastPred.direction}, class probabilities=${lastPred.proba.map((p) => p.toFixed(3)).join(",")}. Disclaimer: ${lastPred.disclaimer}`,
    );
  }
  const body = bits.join(" ");
  if (!body) return "";
  return `${body} ${RESEARCH_ONLY_LINE}`;
}
