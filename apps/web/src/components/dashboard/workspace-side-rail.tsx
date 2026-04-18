"use client";

import { BarChart3, MessageSquare, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WorkspaceTab } from "@/types/workspace-tab";

type Props = {
  activeTab: WorkspaceTab;
  panelOpen: boolean;
  onSelect: (tab: WorkspaceTab) => void;
  className?: string;
  /** Vertical stack (desktop); horizontal row (mobile) */
  orientation?: "vertical" | "horizontal";
};

const BTNS: { tab: WorkspaceTab; label: string; Icon: typeof BarChart3 }[] = [
  { tab: "predict", label: "ML & forecast", Icon: BarChart3 },
  { tab: "agents", label: "Agent swarm — analysis & decisions", Icon: MessageSquare },
  { tab: "table", label: "Raw OHLCV table", Icon: Table2 },
];

/**
 * TradingView-style icon strip: click toggles the matching side panel; click again collapses.
 */
export function WorkspaceSideRail({
  activeTab,
  panelOpen,
  onSelect,
  className,
  orientation = "vertical",
}: Props) {
  return (
    <div
      className={cn(
        "border-[var(--tv-line)] bg-[var(--tv-chrome)] flex shrink-0 gap-0.5 border-l",
        orientation === "vertical"
          ? "w-11 flex-col items-center border-t-0 py-1.5"
          : "w-full flex-row justify-center border-l-0 border-t px-1 py-1",
        className,
      )}
      role="toolbar"
      aria-label="Workspace panels"
    >
      {BTNS.map(({ tab, label, Icon }) => {
        const active = panelOpen && activeTab === tab;
        return (
          <Button
            key={tab}
            type="button"
            variant={active ? "secondary" : "ghost"}
            size="icon"
            className={cn(
              "size-9 shrink-0 rounded-md",
              active &&
                "bg-accent text-accent-foreground ring-border/60 dark:ring-border shadow-sm ring-1",
            )}
            title={label}
            aria-label={label}
            aria-pressed={active}
            onClick={() => onSelect(tab)}
          >
            <Icon className="size-4" />
          </Button>
        );
      })}
    </div>
  );
}
