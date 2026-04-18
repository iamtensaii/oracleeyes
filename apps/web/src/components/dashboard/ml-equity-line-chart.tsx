"use client";

/**
 * Cumulative equity from backtest API (eq multiplies step returns; 1 = start).
 */
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import {
  ColorType,
  createChart,
  CrosshairMode,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { colorsForLightweightCharts } from "@/lib/chart-theme-colors";
import { cn } from "@/lib/utils";

export type EquityPoint = { t: number; eq: number };

type Props = {
  points: EquityPoint[];
  /** Fixed pixels, or "70vh" for a tall hero chart (parent should be full width). */
  height?: number | "70vh";
  className?: string;
};

const MIN_CHART_H = 120;

export function MlEquityLineChart({ points, height = 200, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const { resolvedTheme } = useTheme();
  const hasCurve = points.length >= 2;
  const isVh70 = height === "70vh";
  const fixedPx = typeof height === "number" ? height : 200;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (!hasCurve) {
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRef.current = null;
      return;
    }

    const doc = el.ownerDocument;
    const hint = resolvedTheme === "dark" ? "dark" : resolvedTheme === "light" ? "light" : undefined;
    const { textColor, gridColor } = colorsForLightweightCharts(doc, hint);

    const size = () => {
      const w = Math.max(el.clientWidth || el.getBoundingClientRect().width, 160);
      const h = Math.max(el.clientHeight || el.getBoundingClientRect().height, MIN_CHART_H);
      return { w, h };
    };

    const { w, h } = size();
    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor,
      },
      grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { width: 1 as const, labelVisible: true },
        horzLine: { width: 1 as const, labelVisible: true },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: { time: true, price: true } },
      rightPriceScale: { borderVisible: true },
      width: w,
      height: h,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderVisible: true,
      },
    });

    const series = chart.addSeries(LineSeries, {
      color: "#22c55e",
      lineWidth: 2,
      crosshairMarkerVisible: true,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
      const c = containerRef.current;
      const cw = Math.max(c.clientWidth || c.getBoundingClientRect().width, 160);
      const ch = Math.max(c.clientHeight || c.getBoundingClientRect().height, MIN_CHART_H);
      chartRef.current.applyOptions({ width: cw, height: ch });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [resolvedTheme, hasCurve, height]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart || points.length < 2) return;

    const data = points.map((p) => ({
      time: p.t as UTCTimestamp,
      value: p.eq,
    }));
    try {
      series.setData(data);
      chart.timeScale().fitContent();
    } catch {
      /* ignore */
    }
  }, [points]);

  const emptyH = isVh70 ? undefined : fixedPx;
  const emptyMinH = isVh70 ? "min-h-[70vh]" : undefined;

  if (points.length < 2) {
    return (
      <div
        className={cn(
          "bg-muted/30 text-muted-foreground flex items-center justify-center rounded-md border border-dashed text-sm",
          isVh70 && "min-h-[70vh] w-full",
          emptyMinH,
          className,
        )}
        style={emptyH !== undefined ? { height: emptyH } : undefined}
      >
        Not enough points to plot
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col",
        isVh70 && "h-[70vh] min-h-[240px]",
        className,
      )}
    >
      <p className="text-muted-foreground mb-1 shrink-0 text-sm">
        Green line = cumulative equity (starts at 1.0). Sharp rises can mean overfitting — compare to test
        accuracy.
      </p>
      <div
        ref={containerRef}
        className={cn("w-full min-w-0", isVh70 ? "min-h-0 flex-1" : "")}
        style={!isVh70 ? { height: fixedPx } : undefined}
      />
    </div>
  );
}
