"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CandlestickChart } from "@/components/chart/candlestick-chart";
import { AgentPanel } from "@/components/dashboard/agent-panel";
import { ChartContextStrip } from "@/components/dashboard/chart-context-strip";
import { ChartToolRail } from "@/components/dashboard/chart-tool-rail";
import { ChartSessionTabs } from "@/components/dashboard/chart-session-tabs";
import { SavedSymbolInventory } from "@/components/dashboard/saved-symbol-inventory";
import { SymbolTimeframeStrip } from "@/components/dashboard/symbol-timeframe-strip";
import { PipelineStatusBar, type PipelineState } from "@/components/dashboard/pipeline-status-bar";
import { PredictPanel } from "@/components/dashboard/predict-panel";
import { CsvUploader } from "@/components/csv-uploader";
import { OhlcTable } from "@/components/ohlc-table";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceSideRail } from "@/components/dashboard/workspace-side-rail";
import { useChartSessions } from "@/hooks/use-chart-sessions";
import { defaultSessionName, type StoredChartSession } from "@/lib/chart-sessions-storage";
import type { PredictResult } from "@/lib/ml-api";
import type { CsvDatasetMeta } from "@/lib/parse-csv";
import type { OhlcBar } from "@/types/market";
import type { WorkspaceTab } from "@/types/workspace-tab";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type { WorkspaceTab };

type Props = {
  initialWorkspaceTab?: WorkspaceTab;
};

function tabFromQuery(v: string | null): WorkspaceTab | null {
  if (v === "agents" || v === "table" || v === "predict") return v;
  return null;
}

export function TradingDashboard({ initialWorkspaceTab = "predict" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTab = tabFromQuery(searchParams.get("tab"));

  const [bars, setBars] = useState<OhlcBar[]>([]);
  const [datasetMeta, setDatasetMeta] = useState<CsvDatasetMeta | null>(null);
  const [forecastBars, setForecastBars] = useState<OhlcBar[]>([]);
  const [lastForecastPred, setLastForecastPred] = useState<PredictResult | null>(null);
  const [autoAnalyzeNonce, setAutoAnalyzeNonce] = useState(0);
  const [chartOverlays, setChartOverlays] = useState({
    volume: true,
    ma20: true,
    ma50: true,
  });

  const barsFingerprint = useMemo(
    () => (bars.length === 0 ? "0" : `${bars[0]?.time}-${bars.length}-${bars[bars.length - 1]?.time}`),
    [bars],
  );

  useEffect(() => {
    setForecastBars([]);
    setLastForecastPred(null);
  }, [barsFingerprint]);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>(
    urlTab ?? initialWorkspaceTab,
  );
  const [workspacePanelOpen, setWorkspacePanelOpen] = useState(() => Boolean(urlTab));

  useEffect(() => {
    setWorkspaceTab(urlTab ?? "predict");
    if (urlTab) setWorkspacePanelOpen(true);
  }, [urlTab]);

  const openWorkspaceTab = useCallback(
    (tab: WorkspaceTab) => {
      setWorkspaceTab(tab);
      setWorkspacePanelOpen(true);
      if (tab === "predict") router.replace("/", { scroll: false });
      else router.replace(`/?tab=${tab}`, { scroll: false });
    },
    [router],
  );

  const toggleWorkspaceTab = useCallback(
    (tab: WorkspaceTab) => {
      if (workspaceTab === tab && workspacePanelOpen) {
        setWorkspacePanelOpen(false);
        router.replace("/", { scroll: false });
        return;
      }
      openWorkspaceTab(tab);
    },
    [workspaceTab, workspacePanelOpen, openWorkspaceTab, router],
  );

  const {
    hydrated,
    sessions,
    activeId,
    setActiveId,
    getSession,
    saveSnapshot,
    deleteSession,
    renameSession,
  } = useChartSessions();

  const [pipeline, setPipeline] = useState<PipelineState>({
    trained: false,
    predicted: false,
    backtested: false,
  });
  const mergePipeline = useCallback((patch: Partial<PipelineState>) => {
    setPipeline((prev) => ({ ...prev, ...patch }));
  }, []);
  const [visitedAssistant, setVisitedAssistant] = useState(false);

  const [statusClock, setStatusClock] = useState("");

  useEffect(() => {
    const tick = () => {
      setStatusClock(
        new Date().toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const handleCloseSessionTab = useCallback(
    (id: string) => {
      const wasActive = activeId === id;
      const without = sessions.filter((s) => s.id !== id);
      const nextActive = wasActive ? (without[0] ?? null) : null;
      deleteSession(id);
      if (wasActive) {
        if (nextActive) {
          setActiveId(nextActive.id);
          setBars(nextActive.bars);
          setDatasetMeta(nextActive.meta);
        } else {
          setActiveId(null);
          setBars([]);
          setDatasetMeta(null);
        }
      }
    },
    [sessions, activeId, deleteSession, setActiveId],
  );

  const handleCloseUnsavedTab = useCallback(() => {
    setActiveId(null);
    setBars([]);
    setDatasetMeta(null);
  }, [setActiveId]);

  useEffect(() => {
    if (workspaceTab === "agents") setVisitedAssistant(true);
  }, [workspaceTab]);

  useEffect(() => {
    if (!hydrated || !activeId) return;
    const s = getSession(activeId);
    if (s?.bars.length) {
      setBars(s.bars);
      setDatasetMeta(s.meta);
    }
  }, [hydrated, activeId, getSession]);

  const onParsed = useCallback((b: OhlcBar[], m: CsvDatasetMeta) => {
    setBars(b);
    setDatasetMeta(m);
    setActiveId(null);
  }, [setActiveId]);

  const onSelectSession = useCallback((s: StoredChartSession) => {
    setActiveId(s.id);
    setBars(s.bars);
    setDatasetMeta(s.meta);
    toast.success("Loaded saved chart");
  }, [setActiveId]);

  const onSaveCurrent = useCallback(() => {
    if (!bars.length) return;
    const suggestion = defaultSessionName(datasetMeta, bars.length);
    const name = window.prompt("Name this chart", suggestion);
    if (name === null) return;
    saveSnapshot(bars, datasetMeta, name.trim() || suggestion);
    toast.success("Saved as new chart tab");
  }, [bars, datasetMeta, saveSnapshot]);

  return (
    <div className="oracle-tv bg-background text-foreground flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden text-[13px] leading-snug">
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="border-[var(--tv-line)] bg-[var(--tv-chrome)] flex h-8 shrink-0 items-stretch border-b">
          <div className="min-w-0 flex-1 overflow-hidden">
            <ChartSessionTabs
              dense
              tradingTerminal
              sessions={sessions}
              activeId={activeId}
              hasUnsaved={bars.length > 0 && activeId === null}
              unsavedLabel={defaultSessionName(datasetMeta, bars.length)}
              onSelectSession={onSelectSession}
              onCloseSession={handleCloseSessionTab}
              onCloseUnsaved={handleCloseUnsavedTab}
              onAddTab={onSaveCurrent}
              onRenameSession={renameSession}
              canSaveNew={bars.length > 0}
            />
          </div>
          {bars.length > 0 ? (
            <div
              className="text-foreground hidden shrink-0 items-center border-l border-[var(--tv-line)] px-2 font-mono text-[11px] font-semibold tabular-nums tracking-tight md:flex"
              title={datasetMeta?.sourceFilename ?? undefined}
            >
              {datasetMeta?.symbol && datasetMeta?.timeframe
                ? `${datasetMeta.symbol} · ${datasetMeta.timeframe}`
                : (datasetMeta?.sourceFilename?.replace(/\.[^.]+$/i, "") ?? "Chart")}
            </div>
          ) : null}
          <div className="border-[var(--tv-line)] flex shrink-0 items-center gap-0.5 border-l px-0.5">
            <ThemeToggle />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
          <ChartToolRail onParsed={onParsed} />

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <SymbolTimeframeStrip
              compact
              sessions={sessions}
              activeId={activeId}
              hasUnsaved={bars.length > 0 && activeId === null}
              unsavedSymbol={datasetMeta?.symbol ?? null}
              unsavedTimeframe={datasetMeta?.timeframe ?? null}
              unsavedBars={activeId === null && bars.length > 0 ? bars : undefined}
              onSelectSession={onSelectSession}
            />

            <SavedSymbolInventory
              compact
              sessions={sessions}
              activeId={activeId}
              onSelectSession={onSelectSession}
            />

            {bars.length > 0 ? (
              <ChartContextStrip appearance="strip" bars={bars} meta={datasetMeta} />
            ) : null}

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
              <section className="border-[var(--tv-line)] bg-background flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:border-r">
                <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                  {bars.length === 0 ? (
                    <div
                      id="dash-upload"
                      className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-4 py-6 text-center text-sm"
                    >
                      <CsvUploader variant="minimal" centered onParsed={onParsed} />
                      <div className="max-w-md space-y-1.5 text-left">
                        <p className="text-foreground text-sm font-semibold">Load OHLC CSV</p>
                        <p className="text-xs leading-relaxed">
                          Time + OHLC columns (volume optional). Right rail: ML, swarm, table.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <CandlestickChart
                      bars={bars}
                      forecastBars={forecastBars}
                      showVolume={chartOverlays.volume}
                      showMa20={chartOverlays.ma20}
                      showMa50={chartOverlays.ma50}
                      height="flex"
                      className="min-h-0 flex-1"
                      symbolLabel={
                        datasetMeta?.symbol && datasetMeta?.timeframe
                          ? `${datasetMeta.symbol} · ${datasetMeta.timeframe}`
                          : datasetMeta?.sourceFilename?.replace(/\.[^.]+$/i, "") ?? null
                      }
                    />
                  )}
                </div>
              </section>

              <aside
                id="dash-workspace"
                className="border-[var(--tv-line)] bg-[var(--tv-chrome-elevated)] shadow-none flex min-h-0 shrink-0 flex-col border-t lg:h-full lg:flex-row lg:border-l lg:border-t-0"
              >
              <WorkspaceSideRail
                activeTab={workspaceTab}
                panelOpen={workspacePanelOpen}
                onSelect={toggleWorkspaceTab}
                orientation="horizontal"
                className="lg:hidden"
              />
              <div
                className={cn(
                  "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:h-full",
                  workspacePanelOpen
                    ? "min-h-[36vh] max-h-[48vh] lg:max-h-none lg:min-h-0 lg:w-[min(420px,38vw)] lg:max-w-[480px] lg:flex-none"
                    : "max-h-0 min-h-0 overflow-hidden lg:max-h-full lg:w-0 lg:flex-none lg:overflow-hidden",
                )}
              >
                <div className="border-[var(--tv-line)] shrink-0 border-b px-3 py-1.5">
                  <h2 className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">
                    {workspaceTab === "predict"
                      ? "ML & forecast"
                      : workspaceTab === "agents"
                        ? "Agent swarm"
                        : "OHLC table"}
                  </h2>
                </div>
                {workspaceTab === "predict" ? (
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-2">
                    <PredictPanel
                      bars={bars}
                      datasetMeta={datasetMeta}
                      onPipelineProgress={mergePipeline}
                      onForecastStateChange={({ bars: fb, lastPred }) => {
                        setForecastBars(fb);
                        setLastForecastPred(lastPred);
                      }}
                      onPredictOnChartComplete={() => {
                        setAutoAnalyzeNonce((n) => n + 1);
                        openWorkspaceTab("agents");
                      }}
                    />
                  </div>
                ) : null}
                {workspaceTab === "table" ? (
                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-2">
                    <Card className="border-border/80 shadow-none">
                      <CardHeader className="py-2 pb-1">
                        <CardTitle className="text-sm">OHLC preview</CardTitle>
                        <CardDescription className="text-[11px]">Newest first</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {bars.length === 0 ? (
                          <p className="text-muted-foreground py-4 text-center text-sm">No data</p>
                        ) : (
                          <OhlcTable bars={bars} />
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ) : null}
                <div
                  className={cn(
                    "flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-2",
                    workspaceTab === "agents" ? "flex" : "hidden",
                  )}
                  aria-hidden={workspaceTab !== "agents"}
                >
                  <AgentPanel
                    bars={bars}
                    datasetMeta={datasetMeta}
                    forecastBars={forecastBars}
                    lastForecastPred={lastForecastPred}
                    autoAnalyzeNonce={autoAnalyzeNonce}
                  />
                </div>
              </div>
              <WorkspaceSideRail
                activeTab={workspaceTab}
                panelOpen={workspacePanelOpen}
                onSelect={toggleWorkspaceTab}
                orientation="vertical"
                className="hidden lg:flex"
              />
            </aside>
          </div>

          <footer className="border-[var(--tv-line)] bg-[var(--tv-chrome)] text-muted-foreground flex min-h-7 shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5 border-t px-2 py-0.5 text-[10px] sm:text-[11px]">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
              <PipelineStatusBar
                barCount={bars.length}
                pipeline={pipeline}
                visitedAssistant={visitedAssistant}
              />
            </div>
            {bars.length > 0 ? (
              <div className="text-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 border-[var(--tv-line)] sm:border-l sm:pl-2">
                <label className="flex cursor-pointer items-center gap-1 whitespace-nowrap">
                  <input
                    type="checkbox"
                    className="accent-primary size-3 rounded border-border"
                    checked={chartOverlays.volume}
                    onChange={(e) =>
                      setChartOverlays((o) => ({ ...o, volume: e.target.checked }))
                    }
                  />
                  Vol
                </label>
                <label className="flex cursor-pointer items-center gap-1 whitespace-nowrap">
                  <input
                    type="checkbox"
                    className="accent-primary size-3"
                    checked={chartOverlays.ma20}
                    onChange={(e) =>
                      setChartOverlays((o) => ({ ...o, ma20: e.target.checked }))
                    }
                  />
                  SMA20
                </label>
                <label className="flex cursor-pointer items-center gap-1 whitespace-nowrap">
                  <input
                    type="checkbox"
                    className="accent-primary size-3"
                    checked={chartOverlays.ma50}
                    onChange={(e) =>
                      setChartOverlays((o) => ({ ...o, ma50: e.target.checked }))
                    }
                  />
                  SMA50
                </label>
                <span className="text-muted-foreground hidden sm:inline" title="Shift+drag to zoom range">
                  Zoom
                </span>
              </div>
            ) : null}
            <div className="ml-auto flex shrink-0 items-center gap-2 tabular-nums">
              {bars.length > 0 ? (
                <span className="text-muted-foreground hidden sm:inline">{bars.length.toLocaleString()} bars</span>
              ) : null}
              <time className="text-foreground font-mono text-[10px] sm:text-[11px]" suppressHydrationWarning>
                {statusClock || "—"}
              </time>
            </div>
          </footer>
        </div>
      </div>
    </main>
    </div>
  );
}
