/**
 * Shared UI copy: forecast card, assistant hints, disclaimers.
 * Central place to align ML panel, chart, and chat wording.
 */

export const FORECAST_CARD_TITLE = "Forecast on chart";

/**
 * Single-line product disclaimer — reuse on forecast card, chart hints, and agent context.
 */
export const RESEARCH_ONLY_LINE =
  "Research and learning only — not trading advice, signals, or guaranteed prices.";

/** Violet card subtitle (no performance claims). */
export const FORECAST_CARD_DESCRIPTION = `One tap draws up to {maxBars} violet “what-if” candles from the analysis service (uses the most recent history if your file is very long). Orange / blue on the chart are moving averages. ${RESEARCH_ONLY_LINE}`;

export function formatForecastCardDescription(maxBars: number): string {
  return FORECAST_CARD_DESCRIPTION.replace("{maxBars}", String(maxBars));
}

/** Shown in chat as the user line after a one-click predict (not internal tooling text). */
export const POST_PREDICT_USER_MESSAGE =
  "Tight recap of the forecast I just ran: TL;DR bullets, then a short expert snapshot with the key numbers (educational only).";

/** Agent swarm panel when there are no messages yet. */
export const ASSISTANT_EMPTY_STATE =
  "Just type — one assistant figures out if you need a plain explanation, numbers, risk, scenarios, or code. Use Answer format for length (Quick / Balanced / Full). Run Predict / Run forecast first, then open this tab for an auto recap.";
