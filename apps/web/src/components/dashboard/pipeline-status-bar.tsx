"use client";

export type PipelineState = {
  trained: boolean;
  predicted: boolean;
  backtested: boolean;
};

/** One-line pipeline summary for the dashboard status bar. */
export function PipelineStatusBar({
  barCount,
  pipeline,
  visitedAssistant,
}: {
  barCount: number;
  pipeline: PipelineState;
  visitedAssistant: boolean;
}) {
  const cells = [
    { k: "Data", ok: barCount >= 80 },
    { k: "Train", ok: pipeline.trained },
    { k: "Pred", ok: pipeline.predicted },
    { k: "BT", ok: pipeline.backtested },
    { k: "Swarm", ok: visitedAssistant },
  ];
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-[11px] leading-tight sm:text-xs">
      <span className="text-foreground/90 font-sans text-[11px] font-semibold sm:text-xs">Pipeline</span>
      {cells.map((c) => (
        <span key={c.k}>
          {c.k}{" "}
          <span className={c.ok ? "text-emerald-600 dark:text-emerald-400" : ""}>{c.ok ? "✓" : "·"}</span>
        </span>
      ))}
    </div>
  );
}
