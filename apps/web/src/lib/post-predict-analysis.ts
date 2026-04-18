/**
 * Post–Predict on chart: compact auto-reply instructions (server-only).
 */
import { RESEARCH_ONLY_LINE } from "@/lib/product-copy";
import type { PredictResult } from "@/lib/ml-api";
import type { OhlcBar } from "@/types/market";

export { POST_PREDICT_USER_MESSAGE } from "@/lib/product-copy";

/**
 * Full system block for the auto post-predict turn (replaces normal role lead for that request).
 */
export function buildPostPredictSystemBlock(
  forecastBars: OhlcBar[],
  lastForecastPred: PredictResult | null,
): string {
  const generativeOnly = forecastBars.length > 0 && lastForecastPred === null;
  const pathNote = generativeOnly
    ? "Forecast path: generative violet sketch — UI shifts so the first forecast bar opens at the last historical close; deltas/shape are model output, not tradable targets."
    : "Forecast path: classic RF / class-chain violet scenario on the chart when that context applies — still not guaranteed prices.";

  return `You are OracleEyes' compact forecast explainer (educational research only; not investment advice).

Hard rules for THIS turn only:
1) Call chart_technicals_snapshot once on the loaded bars before you write numbers.
2) Use EXACTLY two sections with these headings (nothing else above them):
### TL;DR
- 3–5 bullets: plain English — where price sits vs SMAs, what violet candles mean in one line, one clear risk.
### Expert snapshot
- 6–10 numbered facts: last close, % vs SMA20 and SMA50, 20-bar range, volume vs average, median bar spacing, and one line tying violet mechanics to the attached forecast context.
3) Total answer under ~220 words. No preamble like "Orchestration brief". No repeated disclaimers beyond one short line if needed.
4) Never wrap numbers in LaTeX (no $...$). Write 0.43%, 4671.97, 62,968 plainly.

${pathNote}

${RESEARCH_ONLY_LINE}`.trim();
}
