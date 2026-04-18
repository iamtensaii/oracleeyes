"use client";

/**
 * TradingView lightweight-charts candlestick pane.
 * Shift + horizontal drag: zoom visible range to selection.
 * Top-left OHLC legend updates on crosshair hover (research only — no trade buttons).
 */
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type OhlcData,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  barIndexAtTime,
  formatDurationSeconds,
  neighborSpacingForBar,
} from "@/lib/bar-time-spacing";
import { inferMedianBarPeriodSeconds } from "@/lib/chart-insights";
import { smaPoints, volumeHistogramPoints } from "@/lib/chart-indicators";
import { colorsForLightweightCharts } from "@/lib/chart-theme-colors";
import { RESEARCH_ONLY_LINE } from "@/lib/product-copy";
import { cn } from "@/lib/utils";
import type { OhlcBar } from "@/types/market";

const MIN_H = 200;
const MIN_ZOOM_DRAG_PX = 8;

type OhlcSnapshot = {
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  pct: number;
  timeSec: number;
};

type Props = {
  bars: OhlcBar[];
  /** Illustrative forecast candles from ML (violet series). */
  forecastBars?: OhlcBar[];
  /** TradingView-style overlays */
  showVolume?: boolean;
  showMa20?: boolean;
  showMa50?: boolean;
  className?: string;
  /** Fixed pixels, or "flex" to fill a flex parent (needs parent min-h-0 + flex-1). */
  height?: number | "flex";
  /** First line of legend, e.g. "XAUUSD · H1" */
  symbolLabel?: string | null;
};

function timeValue(t: Time): number {
  if (typeof t === "number") return t;
  const d = t as { year: number; month: number; day: number };
  return Date.UTC(d.year, d.month - 1, d.day) / 1000;
}

function fmtPrice(n: number): string {
  const a = Math.abs(n);
  if (a >= 1000) return n.toFixed(2);
  if (a >= 1) return n.toFixed(4);
  if (a >= 0.01) return n.toFixed(5);
  return n.toFixed(6);
}

function barToSnapshot(b: OhlcBar): OhlcSnapshot {
  const change = b.close - b.open;
  const pct = b.open !== 0 ? (change / b.open) * 100 : 0;
  return {
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    change,
    pct,
    timeSec: b.time,
  };
}

function formatBarTime(sec: number): string {
  try {
    return new Date(sec * 1000).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function ohlcFromSeriesData(raw: unknown): OhlcData<Time> | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as OhlcData<Time>;
  if (typeof o.open !== "number" || typeof o.close !== "number") return null;
  return o;
}

export function CandlestickChart({
  bars,
  forecastBars = [],
  showVolume = true,
  showMa20 = true,
  showMa50 = true,
  className,
  height = 420,
  symbolLabel,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const forecastSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const ma20SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ma50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const { resolvedTheme } = useTheme();
  const isFlex = height === "flex";
  const fixedPx = typeof height === "number" ? height : 420;

  const [brush, setBrush] = useState<{ x1: number; x2: number } | null>(null);
  /** null = show last bar; non-null = bar under crosshair */
  const [hoverOhlc, setHoverOhlc] = useState<OhlcSnapshot | null>(null);

  const lastSnapshot = useMemo(() => {
    const b = bars.at(-1);
    return b ? barToSnapshot(b) : null;
  }, [bars]);

  const displayOhlc = hoverOhlc ?? lastSnapshot;

  const medianBarStepSec = useMemo(() => inferMedianBarPeriodSeconds(bars), [bars]);

  const barTimeCompare = useMemo(() => {
    if (!displayOhlc || bars.length < 1) return null;
    const idx = barIndexAtTime(bars, displayOhlc.timeSec);
    if (idx < 0) return null;
    return neighborSpacingForBar(bars, idx);
  }, [bars, displayOhlc]);

  const ma20Data = useMemo(() => smaPoints(bars, 20), [bars]);
  const ma50Data = useMemo(() => smaPoints(bars, 50), [bars]);
  const volData = useMemo(() => volumeHistogramPoints(bars), [bars]);
  const hasVolumeColumn = useMemo(
    () => bars.some((b) => b.volume !== undefined && Number.isFinite(b.volume) && (b.volume as number) > 0),
    [bars],
  );

  const attachBrushZoom = useCallback(
    (chart: IChartApi, wrap: HTMLDivElement) => {
      let dragging = false;
      let startX = 0;
      let pointerId: number | null = null;

      const localX = (clientX: number) => {
        const r = wrap.getBoundingClientRect();
        return clientX - r.left;
      };

      const finish = () => {
        dragging = false;
        pointerId = null;
        setBrush(null);
      };

      const onPointerDown = (e: PointerEvent) => {
        if (!e.shiftKey || e.button !== 0 || bars.length < 2) return;
        dragging = true;
        pointerId = e.pointerId;
        startX = localX(e.clientX);
        setBrush({ x1: startX, x2: startX });
        try {
          wrap.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        e.preventDefault();
        e.stopPropagation();
      };

      const onPointerMove = (e: PointerEvent) => {
        if (!dragging || e.pointerId !== pointerId) return;
        const x = localX(e.clientX);
        setBrush({ x1: startX, x2: x });
        e.preventDefault();
      };

      const onPointerUp = (e: PointerEvent) => {
        if (!dragging || e.pointerId !== pointerId) return;
        const endX = localX(e.clientX);
        const lo = Math.min(startX, endX);
        const hi = Math.max(startX, endX);
        try {
          wrap.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }

        if (hi - lo >= MIN_ZOOM_DRAG_PX) {
          const tLo = chart.timeScale().coordinateToTime(lo);
          const tHi = chart.timeScale().coordinateToTime(hi);
          try {
            if (tLo !== null && tHi !== null) {
              const from = timeValue(tLo) <= timeValue(tHi) ? tLo : tHi;
              const to = timeValue(tLo) <= timeValue(tHi) ? tHi : tLo;
              if (from !== to) chart.timeScale().setVisibleRange({ from, to });
            } else {
              const l1 = chart.timeScale().coordinateToLogical(lo);
              const l2 = chart.timeScale().coordinateToLogical(hi);
              if (l1 !== null && l2 !== null) {
                chart.timeScale().setVisibleLogicalRange({
                  from: Math.min(l1, l2),
                  to: Math.max(l1, l2),
                });
              }
            }
          } catch (err) {
            console.warn("zoom-to-range failed", err);
          }
        }
        finish();
        e.preventDefault();
        e.stopPropagation();
      };

      const onPointerCancel = (e: PointerEvent) => {
        if (e.pointerId !== pointerId) return;
        try {
          wrap.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        finish();
      };

      wrap.addEventListener("pointerdown", onPointerDown, { capture: true });
      wrap.addEventListener("pointermove", onPointerMove, { capture: true });
      wrap.addEventListener("pointerup", onPointerUp, { capture: true });
      wrap.addEventListener("pointercancel", onPointerCancel, { capture: true });

      return () => {
        wrap.removeEventListener("pointerdown", onPointerDown, { capture: true });
        wrap.removeEventListener("pointermove", onPointerMove, { capture: true });
        wrap.removeEventListener("pointerup", onPointerUp, { capture: true });
        wrap.removeEventListener("pointercancel", onPointerCancel, { capture: true });
      };
    },
    [bars.length],
  );

  useEffect(() => {
    const wrap = wrapperRef.current;
    const el = containerRef.current;
    if (!wrap || !el) return;

    const doc = el.ownerDocument;
    const hint = resolvedTheme === "dark" ? "dark" : resolvedTheme === "light" ? "light" : undefined;
    const { textColor } = colorsForLightweightCharts(doc, hint);

    const measure = () => {
      const w = Math.max(el.clientWidth || el.getBoundingClientRect().width, 200);
      const h = isFlex
        ? Math.max(el.clientHeight || el.getBoundingClientRect().height, MIN_H)
        : fixedPx;
      return { w, h };
    };

    const { w, h } = measure();

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { width: 1 as const, labelVisible: true },
        horzLine: { width: 1 as const, labelVisible: true },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: { time: true, price: true },
        axisDoubleClickReset: { time: true, price: true },
      },
      rightPriceScale: { borderVisible: true },
      width: w,
      height: h,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderVisible: true,
        rightOffset: 8,
        barSpacing: 5,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#16a34a",
      downColor: "#dc2626",
      borderVisible: false,
      wickUpColor: "#16a34a",
      wickDownColor: "#dc2626",
    });

    const forecastSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#8b5cf6",
      downColor: "#c026d3",
      borderVisible: true,
      borderUpColor: "#7c3aed",
      borderDownColor: "#a21caf",
      wickUpColor: "#a78bfa",
      wickDownColor: "#e879f9",
    });

    const ma20Series = chart.addSeries(LineSeries, {
      color: "rgba(245, 158, 11, 0.95)",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    const ma50Series = chart.addSeries(LineSeries, {
      color: "rgba(59, 130, 246, 0.9)",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: "volume",
      priceFormat: { type: "volume" },
      base: 0,
    });

    series.priceScale().applyOptions({ scaleMargins: { top: 0.02, bottom: 0.22 } });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });

    chartRef.current = chart;
    seriesRef.current = series;
    forecastSeriesRef.current = forecastSeries;
    ma20SeriesRef.current = ma20Series;
    ma50SeriesRef.current = ma50Series;
    volumeSeriesRef.current = volumeSeries;

    const onCrosshairMove = (param: MouseEventParams<Time>) => {
      if (param.point === undefined) {
        setHoverOhlc(null);
        return;
      }
      const row = ohlcFromSeriesData(param.seriesData.get(series));
      if (!row) {
        setHoverOhlc(null);
        return;
      }
      const change = row.close - row.open;
      const pct = row.open !== 0 ? (change / row.open) * 100 : 0;
      const timeSec =
        typeof row.time === "number" ? row.time : timeValue(row.time as Time);
      setHoverOhlc({
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        change,
        pct,
        timeSec,
      });
    };

    chart.subscribeCrosshairMove(onCrosshairMove);

    const detachBrush = attachBrushZoom(chart, wrap);

    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
      const c = containerRef.current;
      const cw = Math.max(c.clientWidth || c.getBoundingClientRect().width, 200);
      const ch = isFlex
        ? Math.max(c.clientHeight || c.getBoundingClientRect().height, MIN_H)
        : fixedPx;
      chartRef.current.applyOptions({ width: cw, height: ch });
    });
    ro.observe(el);

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      detachBrush();
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      forecastSeriesRef.current = null;
      ma20SeriesRef.current = null;
      ma50SeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [resolvedTheme, isFlex, fixedPx, attachBrushZoom]);

  useEffect(() => {
    const main = seriesRef.current;
    const forecastSeries = forecastSeriesRef.current;
    const ma20s = ma20SeriesRef.current;
    const ma50s = ma50SeriesRef.current;
    const vol = volumeSeriesRef.current;
    if (!main) return;

    const data = bars.map((b) => ({
      time: b.time as UTCTimestamp,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));

    try {
      main.setData(data);
      if (forecastSeries) {
        forecastSeries.setData(
          forecastBars.map((b) => ({
            time: b.time as UTCTimestamp,
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close,
          })),
        );
      }
      if (ma20s) {
        ma20s.setData(
          showMa20 ? ma20Data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })) : [],
        );
        ma20s.applyOptions({ visible: showMa20 && ma20Data.length > 0 });
      }
      if (ma50s) {
        ma50s.setData(
          showMa50 ? ma50Data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })) : [],
        );
        ma50s.applyOptions({ visible: showMa50 && ma50Data.length > 0 });
      }
      if (vol) {
        vol.setData(
          showVolume
            ? volData.map((p) => ({
                time: p.time as UTCTimestamp,
                value: p.value,
                color: p.color,
              }))
            : [],
        );
        vol.applyOptions({ visible: showVolume && hasVolumeColumn });
      }
      chartRef.current?.timeScale().fitContent();
    } catch (e) {
      console.error("lightweight-charts setData failed", e);
    }
  }, [
    bars,
    forecastBars,
    ma20Data,
    ma50Data,
    volData,
    showMa20,
    showMa50,
    showVolume,
    hasVolumeColumn,
    resolvedTheme,
    isFlex,
    fixedPx,
  ]);

  useEffect(() => {
    const chart = chartRef.current;
    const main = seriesRef.current;
    const vol = volumeSeriesRef.current;
    if (!chart || !main || !vol) return;
    const hasVol = showVolume && hasVolumeColumn;
    main.priceScale().applyOptions({
      scaleMargins: { top: 0.02, bottom: hasVol ? 0.22 : 0.05 },
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: hasVol ? 0.78 : 0, bottom: 0 },
    });
  }, [showVolume, hasVolumeColumn]);

  const brushStyle =
    brush !== null
      ? {
          left: Math.min(brush.x1, brush.x2),
          width: Math.max(Math.abs(brush.x2 - brush.x1), 1),
        }
      : null;

  const changeColor =
    displayOhlc && displayOhlc.change >= 0
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-rose-600 dark:text-rose-400";

  const legend = displayOhlc ? (
    <div
      className="pointer-events-none absolute top-2 left-2 z-[4] max-w-[min(100%,28rem)] rounded-md border border-border/60 bg-background/85 px-2.5 py-2 shadow-sm backdrop-blur-sm"
      aria-live="polite"
    >
      {symbolLabel ? (
        <div className="text-foreground mb-1 text-sm font-semibold tracking-tight">{symbolLabel}</div>
      ) : null}
      <div className="text-muted-foreground mb-0.5 text-sm">
        {formatBarTime(displayOhlc.timeSec)}
        {hoverOhlc ? " · crosshair" : " · last bar"}
      </div>
      <div className={cn("font-mono text-sm leading-relaxed tracking-tight tabular-nums", changeColor)}>
        O {fmtPrice(displayOhlc.open)} H {fmtPrice(displayOhlc.high)} L {fmtPrice(displayOhlc.low)} C{" "}
        {fmtPrice(displayOhlc.close)}{" "}
        <span className="whitespace-nowrap">
          {displayOhlc.change >= 0 ? "+" : ""}
          {fmtPrice(displayOhlc.change)} ({displayOhlc.pct >= 0 ? "+" : ""}
          {displayOhlc.pct.toFixed(2)}%)
        </span>
      </div>
      {barTimeCompare && bars.length >= 2 ? (
        <div className="text-muted-foreground mt-1.5 border-border/50 border-t pt-1.5 text-sm leading-snug">
          <span className="text-foreground/85 font-medium">Time vs neighbors</span>
          <div className="mt-0.5 font-mono tabular-nums">
            Δt since prev bar:{" "}
            {barTimeCompare.prevSec != null ? formatDurationSeconds(barTimeCompare.prevSec) : "—"}
            <span className="text-muted-foreground/80 mx-1">·</span>
            Δt to next bar:{" "}
            {barTimeCompare.nextSec != null ? formatDurationSeconds(barTimeCompare.nextSec) : "—"}
          </div>
          {medianBarStepSec != null ? (
            <div className="mt-0.5 font-mono text-[9px] tabular-nums opacity-90">
              Median step (series): {formatDurationSeconds(medianBarStepSec)}
              {barTimeCompare.prevSec != null &&
              barTimeCompare.nextSec != null &&
              medianBarStepSec > 0 &&
              (Math.abs(barTimeCompare.prevSec - medianBarStepSec) > medianBarStepSec * 0.25 ||
                Math.abs(barTimeCompare.nextSec - medianBarStepSec) > medianBarStepSec * 0.25) ? (
                <span className="text-amber-700 dark:text-amber-400/90 ml-1">
                  (this bar’s gaps differ from typical — compare movement in context)
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  ) : null;

  const forecastHint =
    forecastBars.length > 0 ? (
      <div className="pointer-events-none absolute right-2 bottom-2 z-[4] max-w-[min(100%,20rem)] rounded-md border border-violet-500/40 bg-background/90 px-2 py-1.5 text-sm leading-snug text-foreground/90 shadow-sm backdrop-blur-sm">
        <span className="font-semibold text-violet-700 dark:text-violet-300">
          Forecast ({forecastBars.length} bars)
        </span>
        : violet — chained sketches; generative path opens at the last close, then times are Mon–Fri UTC (Sat–Sun omitted using your bar step). Not price targets. {RESEARCH_ONLY_LINE}
      </div>
    ) : null;

  const inner = (
    <>
      <div ref={containerRef} className="absolute inset-0" />
      {legend}
      {forecastHint}
      {brushStyle ? (
        <div
          className="border-primary/70 bg-primary/15 pointer-events-none absolute top-0 bottom-0 z-[2] border-l border-r"
          style={{ left: brushStyle.left, width: brushStyle.width }}
          aria-hidden
        />
      ) : null}
    </>
  );

  if (isFlex) {
    return (
      <div className={cn("flex h-full min-h-[280px] w-full min-w-0 flex-1 flex-col", className)}>
        <div ref={wrapperRef} className="relative min-h-0 w-full min-w-0 flex-1">
          {inner}
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className={cn("relative w-full", className)} style={{ minHeight: fixedPx }}>
      {inner}
    </div>
  );
}
