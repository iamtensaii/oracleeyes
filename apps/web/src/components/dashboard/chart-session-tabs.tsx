"use client";

import { LineChart, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StoredChartSession } from "@/lib/chart-sessions-storage";
import { sessionCoverageSummary, sessionTabTooltip } from "@/lib/chart-session-summary";
import { cn } from "@/lib/utils";

type Props = {
  /** Tighter tabs for fixed-viewport shell */
  dense?: boolean;
  /** Flat tabs, terminal chrome (TradingView-like) */
  tradingTerminal?: boolean;
  sessions: StoredChartSession[];
  activeId: string | null;
  /** In-memory chart (upload) not yet saved as a session */
  hasUnsaved: boolean;
  unsavedLabel: string;
  onSelectSession: (s: StoredChartSession) => void;
  /** Optional; unsaved tab is only active when no session id is set */
  onSelectUnsaved?: () => void;
  onCloseSession: (id: string) => void;
  onCloseUnsaved: () => void;
  onAddTab: () => void;
  onRenameSession: (id: string, name: string) => void;
  canSaveNew: boolean;
};

/**
 * TradingView-style horizontal chart tabs: one tab per saved snapshot + optional unsaved + new tab.
 */
export function ChartSessionTabs({
  dense = false,
  tradingTerminal = false,
  sessions,
  activeId,
  hasUnsaved,
  unsavedLabel,
  onSelectSession,
  onSelectUnsaved,
  onCloseSession,
  onCloseUnsaved,
  onAddTab,
  onRenameSession,
  canSaveNew,
}: Props) {
  const unsavedActive = hasUnsaved && activeId === null;

  return (
    <div
      className={cn(
        "flex w-full min-w-0 items-stretch gap-0",
        tradingTerminal
          ? "h-full min-h-8 border-0 bg-transparent"
          : "border-border/60 bg-muted/20 dark:bg-muted/10 border-b",
        dense ? "min-h-8" : "min-h-9",
        !tradingTerminal && dense ? "h-8 min-h-8" : null,
      )}
      role="tablist"
      aria-label="Chart tabs"
    >
      <div
        className={cn(
          "flex min-w-0 flex-1 items-end overflow-x-auto px-0.5",
          tradingTerminal ? "gap-px pt-0" : "gap-0.5 px-1",
          dense ? "pt-0" : "pt-0.5",
        )}
      >
        {hasUnsaved ? (
          <div
            key="__unsaved__"
            className={cn(
              "group flex max-w-[min(100%,14rem)] shrink-0 items-center gap-0.5 border px-2 text-left sm:max-w-[18rem]",
              tradingTerminal
                ? "border-[var(--tv-line)] rounded-none border-b-0"
                : "border-border rounded-t-md border-b-0",
              dense ? "py-0.5 text-xs" : "py-1.5 text-sm sm:text-sm",
              unsavedActive
                ? tradingTerminal
                  ? "bg-[var(--tv-tab-active)] text-foreground ring-foreground/20 border-b-primary border-b-2 ring-1"
                  : "bg-background text-foreground shadow-sm ring-border/60 dark:ring-border ring-1"
                : tradingTerminal
                  ? "bg-[var(--tv-tab-inactive)] text-muted-foreground hover:bg-[var(--tv-chrome-elevated)]"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted/70 dark:bg-muted/25 dark:hover:bg-muted/40",
            )}
            role="tab"
            aria-selected={unsavedActive}
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
              onClick={() => onSelectUnsaved?.()}
              title={unsavedLabel}
            >
              <LineChart className="text-muted-foreground size-3.5 shrink-0 sm:size-4" aria-hidden />
              <span className="truncate font-medium">{unsavedLabel}</span>
            </button>
            <button
              type="button"
              className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-0.5 opacity-70 hover:opacity-100"
              title="Clear chart"
              aria-label="Close unsaved chart"
              onClick={(e) => {
                e.stopPropagation();
                onCloseUnsaved();
              }}
            >
              <X className="size-3.5 sm:size-4" />
            </button>
          </div>
        ) : null}

        {sessions.map((s) => {
          const selected = activeId === s.id;
          return (
            <div
              key={s.id}
              className={cn(
                "group flex max-w-[min(100%,16rem)] shrink-0 items-center gap-0.5 border px-2 text-left sm:max-w-[20rem]",
                tradingTerminal
                  ? "border-[var(--tv-line)] rounded-none border-b-0"
                  : "border-border rounded-t-md border-b-0",
                dense ? "py-0.5 text-xs" : "py-1 text-sm sm:text-sm",
                selected
                  ? tradingTerminal
                    ? "bg-[var(--tv-tab-active)] text-foreground ring-foreground/20 border-b-primary border-b-2 ring-1"
                    : "bg-background text-foreground shadow-sm ring-border/60 dark:ring-border ring-1"
                  : tradingTerminal
                    ? "bg-[var(--tv-tab-inactive)] text-muted-foreground hover:bg-[var(--tv-chrome-elevated)]"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted/70 dark:bg-muted/25 dark:hover:bg-muted/40",
              )}
              role="tab"
              aria-selected={selected}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-start gap-1.5 text-left"
                onClick={() => onSelectSession(s)}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  const n = window.prompt("Chart name", s.name);
                  if (n?.trim()) onRenameSession(s.id, n.trim());
                }}
                title={`${sessionTabTooltip(s)} · double-click to rename`}
              >
                <LineChart className="text-muted-foreground mt-0.5 size-3.5 shrink-0 sm:size-4" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium leading-tight">{s.name}</span>
                  {s.bars.length > 0 ? (
                    <span className="text-muted-foreground block truncate text-sm leading-snug">
                      {sessionCoverageSummary(s)}
                    </span>
                  ) : null}
                </span>
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-0.5 opacity-70 hover:opacity-100"
                title="Close tab"
                aria-label={`Close ${s.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseSession(s.id);
                }}
              >
                <X className="size-3.5 sm:size-4" />
              </button>
            </div>
          );
        })}
      </div>

      <div
        className={cn(
          "flex shrink-0 items-end border-l px-0.5 pl-1",
          tradingTerminal ? "border-[var(--tv-line)]" : "border-border",
          dense ? "pb-0" : "pb-0.5",
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "text-muted-foreground hover:text-foreground rounded-md",
            dense ? "size-7" : "size-9",
          )}
          title={canSaveNew ? "Save current chart as new tab" : "Load data first"}
          aria-label="New chart tab"
          disabled={!canSaveNew}
          onClick={onAddTab}
        >
          <Plus className="size-5" />
        </Button>
      </div>
    </div>
  );
}
