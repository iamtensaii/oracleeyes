"use client";

import { useCallback, useState } from "react";
import { Upload } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { decodeCsvText } from "@/lib/decode-csv-text";
import { parseOhlcvCsv, type CsvDatasetMeta } from "@/lib/parse-csv";
import type { OhlcBar } from "@/types/market";
import { toast } from "sonner";

type Props = {
  onParsed: (bars: OhlcBar[], meta: CsvDatasetMeta) => void;
  /** Outline button (toolbar). Minimal = borderless icon + label. toolbar-icon = icon-only strip. */
  variant?: "default" | "minimal" | "toolbar-icon";
  /** Larger icon stack when placed in empty chart area */
  centered?: boolean;
  className?: string;
};

export function CsvUploader({
  onParsed,
  variant = "default",
  centered = false,
  className,
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setLoading(true);
      try {
        const text = decodeCsvText(await file.arrayBuffer());
        const result = parseOhlcvCsv(text, { filename: file.name });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        const hint =
          result.meta.symbol && result.meta.timeframe
            ? ` (${result.meta.symbol} ${result.meta.timeframe})`
            : "";
        toast.success(`Loaded ${result.bars.length} bars${hint}`);
        onParsed(result.bars, result.meta);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`Could not read CSV: ${msg}`);
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [onParsed],
  );

  const minimal = variant === "minimal";
  const toolbarIcon = variant === "toolbar-icon";

  if (toolbarIcon) {
    return (
      <label
        className={cn(
          "text-muted-foreground hover:bg-[var(--tv-tab-inactive)] hover:text-foreground inline-flex size-9 cursor-pointer items-center justify-center rounded border border-transparent transition-colors",
          "focus-visible:ring-ring focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          loading && "pointer-events-none opacity-50",
          className,
        )}
        title={loading ? "Reading…" : "Load OHLC CSV"}
      >
        <Upload className="size-4 shrink-0" aria-hidden />
        <span className="sr-only">{loading ? "Reading CSV" : "Load OHLC CSV"}</span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          disabled={loading}
          onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
        />
      </label>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <label
        className={cn(
          minimal
            ? cn(
                "text-foreground hover:bg-muted/50 inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-base font-medium transition-colors",
                "border-0 bg-transparent shadow-none outline-none",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                centered && "flex-col gap-3 px-6 py-4 text-base",
                loading && "pointer-events-none opacity-50",
              )
            : cn(
                buttonVariants({ variant: "outline" }),
                loading && "pointer-events-none opacity-50",
                "cursor-pointer",
              ),
        )}
      >
        <Upload
          className={cn(
            "shrink-0",
            minimal ? (centered ? "size-10 text-muted-foreground" : "size-4") : "mr-2 size-4",
          )}
          aria-hidden
        />
        <span>{loading ? "Reading…" : "Upload CSV"}</span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          disabled={loading}
          onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
        />
      </label>
    </div>
  );
}
