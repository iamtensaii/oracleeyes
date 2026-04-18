"use client";

import type { StoredChartSession } from "@/lib/chart-sessions-storage";
import { formatBarDateRange, groupSessionsBySymbol } from "@/lib/chart-session-summary";
import { displayTimeframeLabel } from "@/lib/symbol-timeframe-group";
import { cn } from "@/lib/utils";

type Props = {
  sessions: StoredChartSession[];
  activeId: string | null;
  onSelectSession?: (s: StoredChartSession) => void;
  className?: string;
  /** Tighter summary line for terminal-style chrome */
  compact?: boolean;
};

function symbolHeading(key: string): string {
  if (key === "—") return "Unknown symbol";
  return key;
}

/**
 * Per-symbol list of saved timeframes with CSV date coverage (first bar → last bar).
 */
export function SavedSymbolInventory({
  sessions,
  activeId,
  onSelectSession,
  className,
  compact = false,
}: Props) {
  if (sessions.length === 0) return null;

  const groups = groupSessionsBySymbol(sessions);

  return (
    <details
      className={cn(
        "border-[var(--tv-line)] bg-[var(--tv-chrome-elevated)] group border-b px-2 sm:px-3",
        compact ? "py-0.5" : "py-1",
        className,
      )}
    >
      <summary
        className={cn(
          "text-muted-foreground cursor-pointer list-none font-semibold tracking-wide uppercase [&::-webkit-details-marker]:hidden",
          compact ? "text-[10px]" : "text-sm",
        )}
      >
        <span className="text-foreground group-open:hidden">Saved CSVs ▾</span>
        <span className="text-foreground hidden group-open:inline">Saved CSVs ▴</span>
      </summary>
      <div className={cn("space-y-3", compact ? "mt-1 mb-0.5" : "mt-2 mb-1")}>
        {groups.map((g) => (
          <div key={g.symbolKey} className="min-w-0">
            <p className="text-foreground mb-1 text-sm font-semibold tracking-tight">{symbolHeading(g.symbolKey)}</p>
            <ul className="space-y-1.5">
              {g.sessions.map((s) => {
                const range = formatBarDateRange(s.bars);
                const active = s.id === activeId;
                const interactive = Boolean(onSelectSession);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      disabled={!interactive}
                      onClick={() => onSelectSession?.(s)}
                      className={cn(
                        "w-full rounded-md border px-2 py-1.5 text-left text-sm transition-colors",
                        interactive && "hover:bg-muted/80 border-transparent hover:border-border",
                        !interactive && "border-border/60 cursor-default",
                        active && "bg-muted/60 border-border",
                      )}
                      title={interactive ? `Open: ${s.name}` : undefined}
                    >
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-foreground font-mono font-semibold tabular-nums">
                          {displayTimeframeLabel(s)}
                        </span>
                        {range ? (
                          <span className="text-muted-foreground">{range}</span>
                        ) : (
                          <span className="text-muted-foreground">No date range</span>
                        )}
                        <span className="text-muted-foreground ml-auto shrink-0">
                          {s.bars.length.toLocaleString()} bars
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-0.5 truncate text-sm" title={s.name}>
                        {s.name}
                        {s.meta?.sourceFilename ? ` · ${s.meta.sourceFilename}` : ""}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
