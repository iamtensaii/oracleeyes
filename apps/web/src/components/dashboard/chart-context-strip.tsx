"use client";

import {
  inferMedianBarPeriodSeconds,
  minBarsHintForWindow,
  PERF_WINDOWS,
  returnOverWindow,
  type PerfWindowId,
} from "@/lib/chart-insights";
import type { CsvDatasetMeta } from "@/lib/parse-csv";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OhlcBar } from "@/types/market";

type Props = {
  bars: OhlcBar[];
  meta: CsvDatasetMeta | null;
  /** Card (default) or flat strip under the chart toolbar row */
  appearance?: "panel" | "strip";
};

function pctCell(value: number | null, needBars: number, haveBars: number): { text: string; pos: boolean | null } {
  if (value === null) {
    if (haveBars < needBars) return { text: "—", pos: null };
    return { text: "—", pos: null };
  }
  const sign = value >= 0 ? "+" : "";
  return { text: `${sign}${value.toFixed(2)}%`, pos: value >= 0 };
}

/**
 * Compact stats from loaded OHLCV: one top row (bars, symbol, disclosures) + Last / Δ bar row.
 */
export function ChartContextStrip({ bars, meta, appearance = "panel" }: Props) {
  if (bars.length < 2) return null;

  const strip = appearance === "strip";
  const last = bars[bars.length - 1]!;
  const prev = bars[bars.length - 2]!;
  const period = inferMedianBarPeriodSeconds(bars);
  const dayChange =
    prev.close !== 0 ? ((last.close - prev.close) / prev.close) * 100 : null;

  const rowBorder = strip ? "border-[var(--tv-line)]" : "border-border/70";
  const detailBorder = strip ? "border-[var(--tv-line)]" : "border-border/60";

  return (
    <section
      className={cn(
        "text-card-foreground",
        strip
          ? "border-[var(--tv-line)] bg-[var(--tv-chrome-elevated)]/90 border-b shadow-none"
          : "border-border bg-card rounded-md border shadow-sm dark:shadow-none",
      )}
      aria-label="Approximate performance from loaded history"
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-2 gap-y-1 border-b px-2 py-1 text-[11px] sm:gap-x-3 sm:px-2.5",
          rowBorder,
        )}
      >
        <span className="text-muted-foreground shrink-0 font-medium tabular-nums">{bars.length} bars</span>
        {meta?.symbol && meta?.timeframe ? (
          <Badge variant="outline" className="h-5 shrink-0 px-1.5 py-0 text-[10px] font-normal">
            {meta.symbol} · {meta.timeframe}
          </Badge>
        ) : null}
        {meta?.format === "mt5_compact" ? (
          <Badge variant="secondary" className="h-5 shrink-0 px-1.5 py-0 text-[10px] font-normal">
            MT5
          </Badge>
        ) : null}

        <details
          className={cn(
            "group min-w-0 shrink-0 border-l pl-2 sm:pl-3",
            detailBorder,
            "[&:open]:w-full [&:open]:basis-full",
          )}
        >
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer list-none text-[11px] font-medium [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">About this window ▾</span>
            <span className="hidden group-open:inline">About this window ▴</span>
          </summary>
          <div className="text-muted-foreground space-y-1.5 pb-1.5 pt-1 text-[11px] leading-snug">
            <p>
              Returns use this CSV slice only. ML, backtests, and the swarm use the same series. Violet = forecast;
              orange/blue = SMAs.
            </p>
            <p>
              Research only. If the swarm cites numbers, have it use the same train / predict / backtest tools as{" "}
              <span className="text-foreground/90 font-medium">ML &amp; forecast</span>.
            </p>
          </div>
        </details>

        <details
          className={cn(
            "group min-w-0 shrink-0 border-l pl-2 sm:pl-3",
            detailBorder,
            "[&:open]:w-full [&:open]:basis-full",
          )}
        >
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer list-none text-[11px] font-medium [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Return vs start of window ▾</span>
            <span className="hidden group-open:inline">Return vs start of window ▴</span>
          </summary>
          <div className="pb-1.5 pt-1">
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-7">
              {PERF_WINDOWS.map(({ id, label }) => {
                const need = minBarsHintForWindow(id as PerfWindowId, period);
                const ret = returnOverWindow(bars, id as PerfWindowId);
                const cell = pctCell(ret, need, bars.length);
                const thin = bars.length < need;
                return (
                  <div
                    key={id}
                    className={cn(
                      "rounded border border-border/60 bg-muted/20 px-1.5 py-1 dark:bg-muted/15",
                      thin && "opacity-75",
                    )}
                  >
                    <p className="text-muted-foreground truncate text-[10px] font-medium">{label}</p>
                    <p
                      className={cn(
                        "font-mono text-[11px] font-semibold tabular-nums",
                        cell.pos === true && "text-emerald-600 dark:text-emerald-400",
                        cell.pos === false && "text-rose-600 dark:text-rose-400",
                        cell.pos === null && "text-muted-foreground",
                      )}
                    >
                      {cell.text}
                    </p>
                    {thin ? <p className="text-muted-foreground text-[9px] leading-tight">~{need}+ bars</p> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </details>
      </div>

      <div className="text-muted-foreground flex flex-wrap items-end gap-x-4 gap-y-1 px-2 py-1.5 sm:px-2.5">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide">Last</p>
          <p className="text-foreground font-mono text-sm font-semibold tabular-nums">{last.close.toFixed(5)}</p>
        </div>
        {dayChange !== null ? (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide">Δ bar</p>
            <p
              className={cn(
                "font-mono text-xs font-semibold tabular-nums",
                dayChange >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
              )}
            >
              {dayChange >= 0 ? "+" : ""}
              {dayChange.toFixed(2)}%
            </p>
          </div>
        ) : null}
        {period ? (
          <p className="ml-auto text-[10px] leading-tight sm:text-[11px]">
            ~{period < 3600 ? `${Math.round(period / 60)}m` : period < 86400 ? `${Math.round(period / 3600)}h` : `${Math.round(period / 86400)}d`}{" "}
            median spacing
          </p>
        ) : null}
      </div>
    </section>
  );
}
