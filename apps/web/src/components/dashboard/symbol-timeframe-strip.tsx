"use client";

import type { StoredChartSession } from "@/lib/chart-sessions-storage";
import { formatBarDateRange, formatBarDateRangeShort } from "@/lib/chart-session-summary";
import {
  displayTimeframeLabel,
  normalizeSymbolKey,
  sessionsForSymbol,
} from "@/lib/symbol-timeframe-group";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OhlcBar } from "@/types/market";

type Props = {
  sessions: StoredChartSession[];
  activeId: string | null;
  hasUnsaved: boolean;
  unsavedSymbol: string | null;
  unsavedTimeframe: string | null;
  /** Optional: show date range on the “current upload” pill */
  unsavedBars?: OhlcBar[];
  onSelectSession: (s: StoredChartSession) => void;
  /** Slim row for terminal-style shell */
  compact?: boolean;
  className?: string;
};

/**
 * When multiple snapshots share a symbol, switch timeframes without hunting tabs.
 */
export function SymbolTimeframeStrip({
  sessions,
  activeId,
  hasUnsaved,
  unsavedSymbol,
  unsavedTimeframe,
  unsavedBars,
  onSelectSession,
  compact = false,
  className,
}: Props) {
  const activeSession = activeId ? sessions.find((s) => s.id === activeId) : null;
  let symbolKey = normalizeSymbolKey(activeSession?.meta?.symbol);
  if (!symbolKey && hasUnsaved) symbolKey = normalizeSymbolKey(unsavedSymbol);
  if (!symbolKey) return null;

  const related = sessionsForSymbol(sessions, symbolKey);
  const showUnsavedPill =
    hasUnsaved && normalizeSymbolKey(unsavedSymbol) === symbolKey && activeId === null;
  const total = related.length + (showUnsavedPill ? 1 : 0);
  if (total < 2) return null;

  return (
    <div
      className={cn(
        "border-[var(--tv-line)] bg-[var(--tv-chrome-elevated)] flex w-full min-w-0 flex-wrap items-center gap-2 border-b px-2",
        compact ? "py-0.5 sm:px-2" : "py-1.5 sm:px-3",
        className,
      )}
    >
      <span
        className={cn(
          "text-muted-foreground shrink-0 font-semibold tracking-wide uppercase",
          compact ? "text-[10px]" : "text-sm",
        )}
      >
        {symbolKey} timeframes
      </span>
      <div className={cn("flex min-w-0 flex-1 flex-wrap items-center", compact ? "gap-0.5" : "gap-1")}>
        {showUnsavedPill ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className={cn(
              "text-muted-foreground h-auto flex-col gap-0 px-2 py-0.5 font-medium",
              compact ? "min-h-6 text-[11px]" : "min-h-7 text-sm",
            )}
            disabled
            title={
              unsavedBars?.length
                ? `${unsavedTimeframe?.trim() || "Upload"} · ${formatBarDateRange(unsavedBars)} · ${unsavedBars.length.toLocaleString()} bars`
                : "Current upload (save as a tab to keep it with other timeframes)"
            }
          >
            <span className="text-foreground">{unsavedTimeframe?.trim() || "Upload"} · current</span>
            {unsavedBars?.length ? (
              <span className="font-normal text-[9px] leading-tight">
                {formatBarDateRangeShort(unsavedBars)}
              </span>
            ) : null}
          </Button>
        ) : null}
        {related.map((s) => {
          const active = s.id === activeId;
          return (
            <Button
              key={s.id}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              className={cn(
                "h-auto flex-col gap-0 px-2 py-0.5 font-medium",
                compact ? "min-h-6 text-[11px]" : "min-h-7 text-sm",
                active && "pointer-events-none",
              )}
              onClick={() => onSelectSession(s)}
              title={`${s.name}\n${displayTimeframeLabel(s)} · ${formatBarDateRange(s.bars) ?? "—"}\n${s.bars.length.toLocaleString()} bars`}
            >
              <span>{displayTimeframeLabel(s)}</span>
              {s.bars.length > 0 ? (
                <span
                  className={cn(
                    "font-normal text-[9px] leading-tight",
                    active ? "text-primary-foreground/80" : "text-muted-foreground",
                  )}
                >
                  {formatBarDateRangeShort(s.bars) ?? "—"}
                </span>
              ) : null}
            </Button>
          );
        })}
      </div>
      {!compact ? (
        <p className="text-muted-foreground hidden max-w-[15rem] text-sm leading-snug lg:block">
          Save each timeframe as a tab (+). More bars per symbol generally help train / backtest.
        </p>
      ) : null}
    </div>
  );
}
