"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  backtestModel,
  forecastOracleDeep,
  ORACLE_REQUEST_MAX_BARS,
  predictKronos,
  sliceBarsForOracleRequest,
  predictModel,
  trainModel,
  type BacktestResult,
  type KronosPredictResult,
  type OracleForecastResult,
  type PredictResult,
  type TrainResult,
} from "@/lib/ml-api";
import { preflightOhlcSeriesForMl } from "@/lib/bar-series-preflight";
import { inferMedianBarPeriodSeconds } from "@/lib/chart-insights";
import { shortDatasetBlurb } from "@/lib/chart-session-summary";
import {
  FORECAST_CARD_TITLE,
  formatForecastCardDescription,
  RESEARCH_ONLY_LINE,
} from "@/lib/product-copy";
import {
  buildForecastOhlcBar,
  prepareGenerativeForecastForChart,
} from "@/lib/ml-forecast-candle";
import { distributionEntropy, maxProba } from "@/lib/ml-proba-labels";
import type { CsvDatasetMeta } from "@/lib/parse-csv";
import type { OhlcBar } from "@/types/market";
import { toast } from "sonner";
import { MlEquityLineChart } from "@/components/dashboard/ml-equity-line-chart";

export type PipelineProgress = {
  trained: boolean;
  predicted: boolean;
  backtested: boolean;
};

export type ForecastStatePayload = {
  bars: OhlcBar[];
  lastPred: PredictResult | null;
};

type Props = {
  bars: OhlcBar[];
  datasetMeta?: CsvDatasetMeta | null;
  onPipelineProgress?: (p: Partial<PipelineProgress>) => void;
  /** Violet forecast chain + last RF step (for chart + assistant). */
  onForecastStateChange?: (s: ForecastStatePayload) => void;
  /** After a successful one-click train + max-step forecast (opens Assistant from parent). */
  onPredictOnChartComplete?: () => void;
};

function directionLabel(d: number): string {
  if (d <= -1) return "Down (−1)";
  if (d >= 1) return "Up (+1)";
  return "Flat (0)";
}

/** Max violet forecast candles (matches ML API `OracleForecastRequest.pred_len` upper bound). */
const MAX_VISUAL_CANDLES = 240;

/** Mon–Fri UTC-style spacing for violet generative candles (matches RF `buildForecastOhlcBar` weekend skip). */
function skipWeekendsUtcOpts(b: OhlcBar[]) {
  if (b.length === 0) return undefined;
  return {
    skipWeekendsUtc: {
      lastHistTimeSec: b[b.length - 1]!.time,
      barStepSec: inferMedianBarPeriodSeconds(b) ?? 3600,
    },
  };
}

const FORECAST_STEP_OPTIONS = [48, 72, 96, 120, 240] as const;

export function PredictPanel({
  bars,
  datasetMeta = null,
  onPipelineProgress,
  onForecastStateChange,
  onPredictOnChartComplete,
}: Props) {
  const [modelId, setModelId] = useState<string | null>(null);
  const [trainData, setTrainData] = useState<TrainResult | null>(null);
  const [predData, setPredData] = useState<PredictResult | null>(null);
  const [kronosData, setKronosData] = useState<KronosPredictResult | null>(null);
  const [oracleMeta, setOracleMeta] = useState<OracleForecastResult | null>(null);
  const [btData, setBtData] = useState<BacktestResult | null>(null);
  const [fee, setFee] = useState("2");
  const [backend, setBackend] = useState<"rf" | "kronos">("rf");
  const [forecastSteps, setForecastSteps] = useState<number>(MAX_VISUAL_CANDLES);
  const [loading, setLoading] = useState<string | null>(null);
  /** While oracle forecast runs: which sub-step + monotonic seconds for ETA-free progress UX. */
  const [oracleUi, setOracleUi] = useState<{ phase: "idle" | "ml_api" | "chart"; sec: number }>({
    phase: "idle",
    sec: 0,
  });
  const progressRef = useRef(onPipelineProgress);
  progressRef.current = onPipelineProgress;
  const forecastStateRef = useRef(onForecastStateChange);
  forecastStateRef.current = onForecastStateChange;

  const barsPreflight = useMemo(() => preflightOhlcSeriesForMl(bars), [bars]);
  const barsMlBlocked = bars.length > 0 && !barsPreflight.ok;

  const barsFingerprint =
    bars.length === 0 ? "0" : `${bars[0]?.time}-${bars.length}-${bars[bars.length - 1]?.time}`;

  useEffect(() => {
    setModelId(null);
    setTrainData(null);
    setPredData(null);
    setKronosData(null);
    setOracleMeta(null);
    setBtData(null);
    setForecastSteps(MAX_VISUAL_CANDLES);
    progressRef.current?.({
      trained: false,
      predicted: false,
      backtested: false,
    });
  }, [barsFingerprint, datasetMeta, bars]);

  useEffect(() => {
    setModelId(null);
    setTrainData(null);
    setPredData(null);
    setKronosData(null);
    setOracleMeta(null);
    setBtData(null);
    forecastStateRef.current?.({ bars: [], lastPred: null });
    progressRef.current?.({
      trained: false,
      predicted: false,
      backtested: false,
    });
  }, [backend]);

  useEffect(() => {
    if (loading !== "oracle") {
      setOracleUi({ phase: "idle", sec: 0 });
      return;
    }
    setOracleUi({ phase: "ml_api", sec: 0 });
    const id = window.setInterval(() => {
      setOracleUi((u) => ({ ...u, sec: u.sec + 1 }));
    }, 1000);
    return () => window.clearInterval(id);
  }, [loading]);

  const runMultiForecast = useCallback(
    async (mid: string, baseBars: OhlcBar[], steps: number) => {
      const stepSec = inferMedianBarPeriodSeconds(baseBars) ?? 3600;
      let work = [...baseBars];
      const out: OhlcBar[] = [];
      let lastPred: PredictResult | null = null;
      const n = Math.min(Math.max(1, steps), MAX_VISUAL_CANDLES);
      for (let i = 0; i < n; i++) {
        const r = await predictModel(mid, work);
        lastPred = r;
        const next = buildForecastOhlcBar(work, r.direction, r.proba, { barStepSec: stepSec });
        if (!next) break;
        out.push(next);
        work = [...work, next];
      }
      return { forecastBars: out, lastPred };
    },
    [],
  );

  const onOracleDeepForecast = useCallback(async () => {
    if (bars.length < 32) {
      toast.error("Need at least 32 bars on the chart.");
      return;
    }
    if (!barsPreflight.ok) {
      toast.error(barsPreflight.message);
      return;
    }
    const toastId = toast.loading(
      "Forecast: waiting for your ML container (first run can take several minutes while weights download)…",
    );
    setLoading("oracle");
    try {
      if (bars.length > ORACLE_REQUEST_MAX_BARS) {
        toast.message("Large file", {
          description: `Using the last ${ORACLE_REQUEST_MAX_BARS.toLocaleString()} bars for this forecast so the request stays reliable.`,
        });
      }
      const r = await forecastOracleDeep(bars, MAX_VISUAL_CANDLES);
      setOracleMeta(r);
      setKronosData(null);
      setPredData(null);
      setTrainData(null);
      setBtData(null);
      setModelId(r.engine);
      const historyForOracle = sliceBarsForOracleRequest(bars);
      const lastClose = historyForOracle[historyForOracle.length - 1]!.close;
      const forecastBars = prepareGenerativeForecastForChart(
        lastClose,
        r.forecast.map((b) => ({
          time: b.time,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
          volume: b.volume,
        })),
        skipWeekendsUtcOpts(historyForOracle),
      );
      setOracleUi((u) => ({ ...u, phase: "chart" }));
      toast.loading("Forecast: drawing violet candles on the chart (big series can take a few seconds)…", {
        id: toastId,
      });
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });
      forecastStateRef.current?.({ bars: forecastBars, lastPred: null });
      progressRef.current?.({ trained: false, predicted: true, backtested: false });
      toast.success(`Drew ${forecastBars.length} violet forecast candles on the chart`, { id: toastId });
      onPredictOnChartComplete?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Forecast failed", { id: toastId });
    } finally {
      setLoading(null);
    }
  }, [bars, barsPreflight, onPredictOnChartComplete]);

  const onPredictOnChart = useCallback(async () => {
    if (bars.length < 80) {
      toast.error("Need at least 80 bars (load a longer CSV).");
      return;
    }
    if (!barsPreflight.ok) {
      toast.error(barsPreflight.message);
      return;
    }
    setLoading("all");
    try {
      if (backend === "kronos") {
        setOracleMeta(null);
        const kronos = await predictKronos(bars, forecastSteps);
        const lastClose = bars[bars.length - 1]!.close;
        const forecastBars = prepareGenerativeForecastForChart(
          lastClose,
          kronos.forecast.map((b) => ({
            time: b.time,
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close,
            volume: b.volume,
          })),
          skipWeekendsUtcOpts(bars),
        );
        setModelId(kronos.model_name);
        setTrainData(null);
        setPredData(null);
        setKronosData(kronos);
        setBtData(null);
        forecastStateRef.current?.({ bars: forecastBars, lastPred: null });
        progressRef.current?.({ trained: true, predicted: true, backtested: false });
        toast.success(`Kronos forecasted ${forecastBars.length} bar(s) on chart`);
        onPredictOnChartComplete?.();
        return;
      }

      if (forecastSteps >= 64) {
        toast.message("Long RF chain", {
          description: `${forecastSteps} steps = ${forecastSteps} ML API calls; may take a minute.`,
        });
      }

      setOracleMeta(null);
      const tr = await trainModel(bars);
      setModelId(tr.model_id);
      setTrainData(tr);
      setKronosData(null);
      forecastStateRef.current?.({ bars: [], lastPred: null });
      progressRef.current?.({ trained: true, predicted: false, backtested: false });

      const { forecastBars, lastPred } = await runMultiForecast(tr.model_id, bars, forecastSteps);
      if (lastPred) setPredData(lastPred);
      forecastStateRef.current?.({ bars: forecastBars, lastPred });
      progressRef.current?.({ trained: true, predicted: true, backtested: false });
      toast.success(
        forecastBars.length
          ? `Trained + ${forecastBars.length} forecast bar(s) on chart`
          : "Trained; forecast empty",
      );
      onPredictOnChartComplete?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Run failed");
    } finally {
      setLoading(null);
    }
  }, [bars, backend, barsPreflight, forecastSteps, runMultiForecast, onPredictOnChartComplete]);

  const onTrain = useCallback(async () => {
    if (backend === "kronos") {
      toast.info("Kronos does not require local training in this UI. Use Predict instead.");
      return;
    }
    if (bars.length < 80) {
      toast.error("Need at least 80 bars (load a longer CSV).");
      return;
    }
    if (!barsPreflight.ok) {
      toast.error(barsPreflight.message);
      return;
    }
    setLoading("train");
    try {
      const r = await trainModel(bars);
      setModelId(r.model_id);
      setTrainData(r);
      setPredData(null);
      setKronosData(null);
      setOracleMeta(null);
      forecastStateRef.current?.({ bars: [], lastPred: null });
      progressRef.current?.({ trained: true, predicted: false, backtested: false });
      toast.success("Training complete");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Train failed");
    } finally {
      setLoading(null);
    }
  }, [bars, backend, barsPreflight]);

  const onPredict = useCallback(async () => {
    if (!bars.length) {
      toast.error("Load bars first.");
      return;
    }
    if (backend === "kronos") {
      if (!barsPreflight.ok) {
        toast.error(barsPreflight.message);
        return;
      }
      setLoading("predict");
      try {
        setOracleMeta(null);
        const kronos = await predictKronos(bars, forecastSteps);
        const lastClose = bars[bars.length - 1]!.close;
        const forecastBars = prepareGenerativeForecastForChart(
          lastClose,
          kronos.forecast.map((b) => ({
            time: b.time,
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close,
            volume: b.volume,
          })),
          skipWeekendsUtcOpts(bars),
        );
        setModelId(kronos.model_name);
        setTrainData(null);
        setPredData(null);
        setKronosData(kronos);
        forecastStateRef.current?.({ bars: forecastBars, lastPred: null });
        progressRef.current?.({ predicted: true });
        toast.success(`${forecastBars.length} Kronos forecast bar(s) on chart`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Predict failed");
      } finally {
        setLoading(null);
      }
      return;
    }
    if (!modelId) {
      toast.error("Train a model first (same bars as the chart).");
      return;
    }
    if (!barsPreflight.ok) {
      toast.error(barsPreflight.message);
      return;
    }
    setLoading("predict");
    try {
      setOracleMeta(null);
      const { forecastBars, lastPred } = await runMultiForecast(modelId, bars, forecastSteps);
      if (lastPred) setPredData(lastPred);
      forecastStateRef.current?.({ bars: forecastBars, lastPred });
      progressRef.current?.({ predicted: true });
      toast.success(
        forecastBars.length ? `${forecastBars.length} forecast bar(s) on chart` : "Prediction ready",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Predict failed");
    } finally {
      setLoading(null);
    }
  }, [backend, modelId, bars, barsPreflight, forecastSteps, runMultiForecast]);

  const onBacktest = useCallback(async () => {
    if (backend === "kronos") {
      toast.info("Backtest currently supports the RF endpoint only.");
      return;
    }
    if (!modelId || !bars.length) {
      toast.error("Train a model first.");
      return;
    }
    if (!barsPreflight.ok) {
      toast.error(barsPreflight.message);
      return;
    }
    setLoading("bt");
    try {
      const feeBps = Number.parseFloat(fee) || 0;
      const r = await backtestModel(modelId, bars, feeBps);
      setBtData(r);
      progressRef.current?.({ backtested: true });
      toast.success("Backtest complete");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Backtest failed");
    } finally {
      setLoading(null);
    }
  }, [backend, modelId, bars, barsPreflight, fee]);

  const predEntropy = predData ? distributionEntropy(predData.proba) : null;
  const predTop = predData ? maxProba(predData.proba) : null;

  const blurb = shortDatasetBlurb(bars, datasetMeta);

  const classicForecastExpertBlock = (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <Label htmlFor="backend-select" className="whitespace-nowrap text-sm">
            Forecast style
          </Label>
          <select
            id="backend-select"
            className="bg-background border-input h-9 rounded-md border px-2 text-sm"
            value={backend}
            onChange={(e) => setBackend(e.target.value === "kronos" ? "kronos" : "rf")}
            disabled={loading !== null}
            title="Classic = learn from your chart then extend. Neural path = one-shot AI candles without the train step."
          >
            <option value="rf">Classic — learn from chart, then extend</option>
            <option value="kronos">Neural path — AI candles in one step</option>
          </select>
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <Label htmlFor="forecast-steps" className="whitespace-nowrap text-sm">
            How many future bars
          </Label>
          <select
            id="forecast-steps"
            className="bg-background border-input h-9 rounded-md border px-2 text-sm"
            value={forecastSteps}
            onChange={(e) => setForecastSteps(Number.parseInt(e.target.value, 10))}
            disabled={loading !== null}
          >
            {FORECAST_STEP_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} bars
              </option>
            ))}
          </select>
        </div>
        <Button
          size="default"
          onClick={onPredictOnChart}
          disabled={
            loading !== null ||
            bars.length < 80 ||
            loading === "oracle" ||
            barsMlBlocked
          }
        >
          {loading === "all" ? "Training & forecasting…" : "Predict on chart (1 click)"}
        </Button>
        <span className="text-muted-foreground text-base leading-relaxed">
          Uses {forecastSteps} future bar(s) (max {MAX_VISUAL_CANDLES}).
        </span>
      </div>

      <details className="border-border bg-muted/20 dark:bg-muted/10 text-muted-foreground rounded-lg border text-sm leading-relaxed">
        <summary className="text-foreground cursor-pointer px-3 py-2 font-medium">
          Advanced: separate train / predict / backtest
        </summary>
        <div className="border-border flex flex-wrap gap-2 border-t px-3 py-3">
          <Button size="sm" onClick={onTrain} disabled={loading !== null || barsMlBlocked}>
            {loading === "train" ? "Working…" : "Train only"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onPredict}
            disabled={loading !== null || (backend === "rf" && !modelId) || barsMlBlocked}
          >
            {loading === "predict" ? "…" : `Predict only (${forecastSteps} steps)`}
          </Button>
          <Button size="sm" variant="outline" onClick={onBacktest} disabled={loading !== null || !modelId || barsMlBlocked}>
            {loading === "bt" ? "…" : "Backtest"}
          </Button>
        </div>
      </details>

      <details className="border-border bg-muted/20 dark:bg-muted/10 text-muted-foreground rounded-lg border text-sm leading-relaxed">
        <summary className="text-foreground cursor-pointer px-3 py-2 font-medium">
          Optional: trading cost (backtest)
        </summary>
        <p className="border-border w-full max-w-none border-t px-3 py-2 leading-relaxed">
          Basis points apply only to the rough backtest in Advanced.
        </p>
        <div className="flex items-center gap-2 px-3 pb-3">
          <Label htmlFor="fee-dash" className="whitespace-nowrap">
            Fee (bps)
          </Label>
          <Input
            id="fee-dash"
            className="h-9 w-24 text-base"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
          />
        </div>
      </details>
    </>
  );

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 max-w-none flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5 pb-4">
        <div className="flex flex-col gap-5">
      {blurb ? (
        <p className="text-muted-foreground bg-muted/40 dark:bg-muted/20 rounded-md border border-border/60 px-3 py-2 text-sm leading-relaxed">
          <span className="text-foreground/80 font-medium">Active for ML:</span> {blurb}
        </p>
      ) : null}

      {barsMlBlocked ? (
        <div
          role="alert"
          className="border-amber-600/35 bg-amber-500/[0.12] text-foreground dark:border-amber-500/30 dark:bg-amber-950/40 max-w-none rounded-lg border px-3 py-2.5 text-sm leading-relaxed"
        >
          <span className="font-medium">Series check — ML and forecast are disabled: </span>
          {barsPreflight.message}
        </div>
      ) : null}

      <Card className="border-violet-500/25 bg-violet-500/[0.04] shadow-sm dark:border-violet-400/20 dark:bg-violet-950/25 dark:shadow-none">
        <CardHeader className="p-3 pb-1">
          <CardTitle className="text-base sm:text-lg">{FORECAST_CARD_TITLE}</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            {formatForecastCardDescription(MAX_VISUAL_CANDLES)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-3 pt-0">
          <Button
            type="button"
            variant="default"
            size="lg"
            className="h-12 w-full max-w-md bg-violet-600 text-base text-white hover:bg-violet-600/90 dark:bg-violet-600 dark:hover:bg-violet-600/90 sm:w-auto sm:px-10"
            disabled={loading !== null || bars.length < 32 || barsMlBlocked}
            onClick={() => void onOracleDeepForecast()}
          >
            {loading === "oracle" ? "Drawing forecast…" : "Run forecast"}
          </Button>
          {loading === "oracle" ? (
            <div
              className="border-violet-500/25 bg-violet-500/[0.06] dark:border-violet-400/20 dark:bg-violet-950/30 max-w-md space-y-2 rounded-lg border px-3 py-2"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                <div className="bg-violet-500 h-full w-2/5 min-w-[4rem] animate-pulse rounded-full" />
              </div>
              <p className="text-foreground text-sm font-medium">
                {oracleUi.phase === "ml_api" ? "Step 1 — ML API" : "Step 2 — Chart"}{" "}
                <span className="text-muted-foreground font-mono font-normal tabular-nums">
                  {oracleUi.sec}s elapsed
                </span>
              </p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {oracleUi.phase === "ml_api"
                  ? "There is no percentage: the browser waits on one request to your :8000 service. Typical first run 1–5+ min (model download), then often under a minute."
                  : "Response received. Your chart may pause briefly while thousands of bars plus the violet path re-render."}
              </p>
            </div>
          ) : null}
          {bars.length < 32 ? (
            <p className="text-muted-foreground text-xs leading-relaxed">Load at least 32 bars (e.g. a longer CSV).</p>
          ) : barsMlBlocked ? (
            <p className="text-muted-foreground text-xs leading-relaxed">
              Fix the series issue in the amber notice above, then run forecast again.
            </p>
          ) : (
            <p className="text-muted-foreground text-xs leading-relaxed">
              First run can take several minutes while models load from the analysis service. If nothing appears, check
              that the ML API is running and up to date.
            </p>
          )}
          {oracleMeta ? (
            <p className="text-foreground text-sm font-medium">
              Last run: {oracleMeta.forecast.length} violet candle(s) on the chart.
            </p>
          ) : null}
          {oracleMeta ? (
            <details className="text-muted-foreground text-xs leading-relaxed">
              <summary className="text-foreground cursor-pointer font-medium">Technical notes</summary>
              <ul className="mt-2 list-inside list-disc space-y-1">
                {oracleMeta.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </details>
          ) : null}
          {oracleMeta ? (
            <p className="text-muted-foreground text-xs leading-snug">{oracleMeta.disclaimer}</p>
          ) : backend === "kronos" && kronosData ? (
            <p className="text-muted-foreground text-xs leading-snug">{kronosData.disclaimer}</p>
          ) : null}
          <p className="text-muted-foreground text-xs leading-snug">{RESEARCH_ONLY_LINE}</p>
        </CardContent>
      </Card>

      <details className="border-border bg-muted/20 dark:bg-muted/10 rounded-lg border">
        <summary className="text-foreground cursor-pointer px-3 py-2 text-sm font-medium">
          Expert: classic train on chart + RF chain or Kronos (optional)
        </summary>
        <div className="border-border space-y-3 border-t px-3 pb-3 pt-3">{classicForecastExpertBlock}</div>
      </details>
      {modelId ? (
        <p className="text-muted-foreground font-mono text-sm">
          model: <span className="text-foreground">{modelId}</span>
        </p>
      ) : null}

      <details className="border-border bg-muted/20 dark:bg-muted/10 text-muted-foreground rounded-lg border text-sm leading-7">
        <summary className="text-foreground cursor-pointer px-3 py-2 font-medium">
          Optional: backtest equity curve (chart)
        </summary>
        <div className="border-border space-y-2 border-t px-3 py-3">
          {btData ? (
            <>
              <p className="font-mono text-base">
                {(btData.total_return * 100).toFixed(2)}% return · {btData.n_trades} trades · Sharpe{" "}
                {btData.sharpe_approx.toFixed(2)}
              </p>
              <MlEquityLineChart points={btData.equity_curve} height={280} className="w-full" />
            </>
          ) : (
            <p className="leading-relaxed">Run Advanced → Backtest first.</p>
          )}
        </div>
      </details>

      <div className="grid w-full min-w-0 gap-3 lg:grid-cols-3">
        <Card className="min-w-0">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-base">Train snapshot</CardTitle>
            <CardDescription>Holdout test accuracy vs train</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 p-3 pt-0 text-base leading-7">
            {trainData ? (
              <>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Test accuracy</span>
                  <span className="text-foreground font-mono font-medium">
                    {(trainData.test_accuracy * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Train accuracy</span>
                  <span className="font-mono">{(trainData.train_accuracy * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Samples</span>
                  <span className="font-mono">
                    {trainData.n_train} / {trainData.n_test}
                  </span>
                </div>
                {trainData.baseline_majority_class !== undefined &&
                trainData.baseline_majority_test_accuracy !== undefined ? (
                  <div className="border-border text-muted-foreground space-y-1.5 border-t pt-2 text-sm leading-snug">
                    <p className="text-foreground font-medium">Same holdout: trivial rules</p>
                    <div className="flex justify-between gap-2">
                      <span>Always train majority ({directionLabel(trainData.baseline_majority_class)})</span>
                      <span className="font-mono">
                        {(trainData.baseline_majority_test_accuracy * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span>Always flat (0)</span>
                      <span className="font-mono">
                        {((trainData.baseline_always_flat_test_accuracy ?? 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span>Uniform random (1 / classes)</span>
                      <span className="font-mono">
                        {((trainData.baseline_random_expected_accuracy ?? 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground border-t pt-2 text-sm">
                    Rebuild the ML API container to see majority / flat / random baselines on the same holdout.
                  </p>
                )}
                {trainData.leakage_warning ? (
                  <p className="text-amber-700 dark:text-amber-400 border-amber-500/30 rounded border px-2 py-1 text-sm leading-snug">
                    {trainData.leakage_warning}
                  </p>
                ) : null}
                <p className="text-muted-foreground text-sm leading-snug">
                  If RF test is barely above majority / random, the model is not showing a strong edge on this split.
                  Educational only — not live trading accuracy.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">Run Predict on chart or Train only.</p>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-base">Latest prediction</CardTitle>
            <CardDescription>Last step in the forward chain</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 p-3 pt-0 text-base leading-7">
            {predData ? (
              <>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Argmax label</span>
                  <span className="text-foreground font-medium">{directionLabel(predData.direction)}</span>
                </div>
                {predTop !== null ? (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Top class weight</span>
                    <span className="font-mono">{(predTop * 100).toFixed(1)}%</span>
                  </div>
                ) : null}
                {predEntropy !== null ? (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Entropy</span>
                    <span className="font-mono">{predEntropy.toFixed(2)} bits</span>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                  {predData.proba.length >= 3 ? (
                    <>
                      <span>
                        <span className="text-muted-foreground">P(down)</span>{" "}
                        <span className="font-mono">{(predData.proba[0]! * 100).toFixed(1)}%</span>
                      </span>
                      <span>
                        <span className="text-muted-foreground">P(flat)</span>{" "}
                        <span className="font-mono">{(predData.proba[1]! * 100).toFixed(1)}%</span>
                      </span>
                      <span>
                        <span className="text-muted-foreground">P(up)</span>{" "}
                        <span className="font-mono">{(predData.proba[2]! * 100).toFixed(1)}%</span>
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground font-mono">
                      {predData.proba.map((x) => `${(x * 100).toFixed(1)}%`).join(" · ")}
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground border-t pt-2 text-sm leading-snug">
                  {predData.disclaimer} Violet candles are chained sketches, not targets.
                </p>
              </>
            ) : oracleMeta ? (
              <div className="space-y-2 text-sm leading-relaxed">
                <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs">
                  <span>
                    <span className="text-muted-foreground">engine</span> {oracleMeta.engine}
                  </span>
                  <span>
                    <span className="text-muted-foreground">model</span> {oracleMeta.model_name.split("/").pop()}
                  </span>
                  <span>
                    <span className="text-muted-foreground">ctx</span> {oracleMeta.max_context}
                  </span>
                  <span>
                    <span className="text-muted-foreground">samples</span> {oracleMeta.sample_count}
                  </span>
                </div>
              </div>
            ) : backend === "kronos" && kronosData ? (
              <p className="text-muted-foreground">
                Kronos returned {kronosData.forecast.length} direct OHLC forecast bars.
              </p>
            ) : (
              <p className="text-muted-foreground">Run Predict on chart.</p>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-base">Backtest snapshot</CardTitle>
            <CardDescription>Naive next-bar sim + fee bps</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 p-3 pt-0 text-base leading-7">
            {btData ? (
              <>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Total return</span>
                  <span className="font-mono font-medium">
                    {(btData.total_return * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Sharpe (approx)</span>
                  <span className="font-mono">{btData.sharpe_approx.toFixed(3)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Trades</span>
                  <span className="font-mono">{btData.n_trades}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Win rate</span>
                  <span className="font-mono">{(btData.win_rate * 100).toFixed(1)}%</span>
                </div>
                <p className="text-muted-foreground text-sm leading-snug">
                  Slippage not modeled. Compare runs only — not position sizing.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">Run Advanced → Backtest.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {(trainData || predData || btData) ? (
        <details className="text-sm leading-7">
          <summary className="text-foreground cursor-pointer font-medium">Raw JSON (API payloads)</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {trainData ? (
              <pre className="bg-muted max-h-48 overflow-auto rounded-md p-2 text-sm whitespace-pre-wrap">
                {JSON.stringify(trainData, null, 2)}
              </pre>
            ) : null}
            {predData ? (
              <pre className="bg-muted max-h-48 overflow-auto rounded-md p-2 text-sm whitespace-pre-wrap">
                {JSON.stringify(predData, null, 2)}
              </pre>
            ) : null}
            {btData ? (
              <pre className="bg-muted max-h-48 overflow-auto rounded-md p-2 text-sm whitespace-pre-wrap">
                {JSON.stringify(btData, null, 2)}
              </pre>
            ) : null}
          </div>
        </details>
      ) : null}
        </div>
      </div>
    </div>
  );
}
