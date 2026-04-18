/**
 * HTTP client for OracleEyes ML API (FastAPI).
 */
import type { OhlcBar } from "@/types/market";

const base = () => process.env.NEXT_PUBLIC_ML_API_URL ?? "http://127.0.0.1:8000";

async function assertMlOk(res: Response): Promise<void> {
  if (res.ok) return;
  const raw = (await res.text().catch(() => "")).trim();
  if (res.status === 404) {
    throw new Error(
      "This action is not available from the analysis service (it may be an older version). Ask your administrator to rebuild and restart the ML API container, then try again.",
    );
  }
  throw new Error((raw || res.statusText).slice(0, 480));
}

export type TrainResult = {
  model_id: string;
  train_accuracy: number;
  test_accuracy: number;
  n_train: number;
  n_test: number;
  leakage_warning: string;
  /** Present after ml-api includes baseline metrics (rebuild container if missing). */
  baseline_majority_class?: number;
  baseline_majority_test_accuracy?: number;
  baseline_always_flat_test_accuracy?: number;
  baseline_random_expected_accuracy?: number;
};

export async function trainModel(
  bars: OhlcBar[],
  testFraction = 0.2,
  horizon = 1,
): Promise<TrainResult> {
  const res = await fetch(`${base()}/train`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bars,
      test_fraction: testFraction,
      horizon,
    }),
  });
  if (!res.ok) await assertMlOk(res);
  return res.json() as Promise<TrainResult>;
}

export type PredictResult = {
  direction: number;
  proba: number[];
  disclaimer: string;
};

export async function predictModel(modelId: string, bars: OhlcBar[]): Promise<PredictResult> {
  const res = await fetch(`${base()}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model_id: modelId, bars }),
  });
  if (!res.ok) await assertMlOk(res);
  return res.json() as Promise<PredictResult>;
}

export type KronosPredictResult = {
  model_name: string;
  pred_len: number;
  forecast: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    amount: number;
  }>;
  disclaimer: string;
};

export type OracleForecastResult = {
  engine: string;
  model_name: string;
  tokenizer_name: string;
  max_context: number;
  history_bars: number;
  pred_len: number;
  temperature: number;
  top_p: number;
  sample_count: number;
  forecast: KronosPredictResult["forecast"];
  notes: string[];
  disclaimer: string;
};

/** Kronos windows history; sending tens of thousands of bars can stall or fail the browser request. */
export const ORACLE_REQUEST_MAX_BARS = 8192;

/** Same slice as `forecastOracleDeep` sends — use its last bar when post-processing the response. */
export function sliceBarsForOracleRequest(bars: OhlcBar[]): OhlcBar[] {
  return bars.length > ORACLE_REQUEST_MAX_BARS ? bars.slice(-ORACLE_REQUEST_MAX_BARS) : bars;
}

/** Single curated deep forecast (Kronos ensemble + auto stack). */
export async function forecastOracleDeep(
  bars: OhlcBar[],
  predLen = 48,
): Promise<OracleForecastResult> {
  const payloadBars = sliceBarsForOracleRequest(bars);
  const res = await fetch(`${base()}/forecast/oracle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bars: payloadBars, pred_len: predLen }),
  });
  if (!res.ok) await assertMlOk(res);
  return res.json() as Promise<OracleForecastResult>;
}

export async function predictKronos(
  bars: OhlcBar[],
  predLen = 24,
  modelName = "NeoQuasar/Kronos-small",
): Promise<KronosPredictResult> {
  const res = await fetch(`${base()}/predict/kronos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bars,
      pred_len: predLen,
      model_name: modelName,
      tokenizer_name: "NeoQuasar/Kronos-Tokenizer-base",
      max_context: 512,
      temperature: 1.0,
      top_p: 0.9,
      sample_count: 1,
    }),
  });
  if (!res.ok) await assertMlOk(res);
  return res.json() as Promise<KronosPredictResult>;
}

export type BacktestResult = {
  total_return: number;
  sharpe_approx: number;
  n_trades: number;
  win_rate: number;
  equity_curve: { t: number; eq: number }[];
};

export async function backtestModel(
  modelId: string,
  bars: OhlcBar[],
  feeBps = 0,
): Promise<BacktestResult> {
  const res = await fetch(`${base()}/backtest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model_id: modelId, bars, fee_bps: feeBps }),
  });
  if (!res.ok) await assertMlOk(res);
  return res.json() as Promise<BacktestResult>;
}
