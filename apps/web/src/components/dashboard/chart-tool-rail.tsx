"use client";

import { CsvUploader } from "@/components/csv-uploader";
import type { CsvDatasetMeta } from "@/lib/parse-csv";
import type { OhlcBar } from "@/types/market";
import { cn } from "@/lib/utils";

type Props = {
  onParsed: (bars: OhlcBar[], meta: CsvDatasetMeta) => void;
  className?: string;
};

/**
 * Narrow vertical strip (TradingView-style) for chart-adjacent actions.
 */
export function ChartToolRail({ onParsed, className }: Props) {
  return (
    <div
      className={cn(
        "border-[var(--tv-line)] bg-[var(--tv-chrome)] flex w-9 shrink-0 flex-col items-center gap-1 border-r py-1 sm:w-10",
        className,
      )}
      role="toolbar"
      aria-label="Chart tools"
    >
      <CsvUploader variant="toolbar-icon" onParsed={onParsed} />
    </div>
  );
}
