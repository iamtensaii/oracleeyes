/**
 * Server-side: major forex pairs for chart dropdowns (Alpha Vantage has no public pair list).
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export type MarketSymbolOption = { value: string; label: string };

/** Curated list — Alpha Vantage accepts from_symbol + to_symbol for these. */
const DEFAULT_FOREX_PAIRS: MarketSymbolOption[] = [
  { value: "EUR_USD", label: "EUR/USD" },
  { value: "GBP_USD", label: "GBP/USD" },
  { value: "USD_JPY", label: "USD/JPY" },
  { value: "USD_CHF", label: "USD/CHF" },
  { value: "AUD_USD", label: "AUD/USD" },
  { value: "USD_CAD", label: "USD/CAD" },
  { value: "NZD_USD", label: "NZD/USD" },
  { value: "EUR_GBP", label: "EUR/GBP" },
  { value: "EUR_JPY", label: "EUR/JPY" },
  { value: "GBP_JPY", label: "GBP/JPY" },
  { value: "EUR_CHF", label: "EUR/CHF" },
  { value: "AUD_JPY", label: "AUD/JPY" },
  { value: "EUR_AUD", label: "EUR/AUD" },
  { value: "USD_CNH", label: "USD/CNH" },
  { value: "USD_MXN", label: "USD/MXN" },
  { value: "USD_ZAR", label: "USD/ZAR" },
  { value: "USD_TRY", label: "USD/TRY" },
  { value: "USD_SEK", label: "USD/SEK" },
  { value: "USD_NOK", label: "USD/NOK" },
  { value: "USD_SGD", label: "USD/SGD" },
  { value: "USD_HKD", label: "USD/HKD" },
  { value: "USD_KRW", label: "USD/KRW" },
];

export async function GET() {
  return NextResponse.json({
    symbols: DEFAULT_FOREX_PAIRS,
    provider: "alphavantage",
    cached: false,
  });
}
