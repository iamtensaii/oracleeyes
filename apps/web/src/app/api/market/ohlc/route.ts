/**
 * Server-side proxy for forex OHLC via Alpha Vantage. API key stays on the server.
 *
 * Alpha Vantage: forex intraday (FX_INTRADAY) is premium-only; free keys get daily / weekly / monthly.
 * When the client asks for 1–60m we try intraday first, then fall back to FX_DAILY with a resolution note.
 */
import { NextResponse } from "next/server";
import type { OhlcBar } from "@/types/market";
import type { CsvDatasetMeta } from "@/lib/parse-csv";
import { MARKET_DATA_NOT_CONFIGURED } from "@/lib/client-safe-errors";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 5000;
const DEFAULT_LIMIT = 500;

const RES_TO_SEC: Record<string, number> = {
  "1": 60,
  "5": 300,
  "15": 900,
  "30": 1800,
  "60": 3600,
  D: 86400,
  W: 604800,
  M: 2592000,
};

/** Alpha Vantage FX_INTRADAY interval parameter */
const RES_TO_AV_INTRADAY: Record<string, string> = {
  "1": "1min",
  "5": "5min",
  "15": "15min",
  "30": "30min",
  "60": "60min",
};

const INTRADAY_RES = new Set(["1", "5", "15", "30", "60"]);

function parsePair(pair: string): { from: string; to: string } {
  const compact = pair.trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (compact.length !== 6) {
    throw new Error("Pair must be six letters, e.g. EUR_USD or EURUSD");
  }
  return { from: compact.slice(0, 3), to: compact.slice(3, 6) };
}

function normalizePairLabel(pair: string): string {
  const compact = pair.trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (compact.length === 6) return `${compact.slice(0, 3)}/${compact.slice(3, 6)}`;
  return pair.trim().toUpperCase();
}

function resolutionLabel(res: string): string {
  if (res === "D") return "1d";
  if (res === "W") return "1w";
  if (res === "M") return "1M";
  return `${res}m`;
}

/** Find the time-series object (key name varies by function). */
function extractFxTimeSeries(j: Record<string, unknown>): Record<string, Record<string, string>> | null {
  for (const [k, v] of Object.entries(j)) {
    if (k.includes("Time Series") && typeof v === "object" && v !== null && !Array.isArray(v)) {
      return v as Record<string, Record<string, string>>;
    }
  }
  return null;
}

function avTimestampToUnixSec(dt: string): number {
  const trimmed = dt.trim();
  if (trimmed.includes(" ")) {
    const iso = trimmed.replace(" ", "T");
    const ms = Date.parse(`${iso}Z`);
    return Math.floor(ms / 1000);
  }
  const ms = Date.parse(`${trimmed}T00:00:00.000Z`);
  return Math.floor(ms / 1000);
}

function timeSeriesToBars(series: Record<string, Record<string, string>>, limit: number): OhlcBar[] {
  const out: OhlcBar[] = [];

  for (const [timeKey, row] of Object.entries(series)) {
    const o = row["1. open"];
    const h = row["2. high"];
    const l = row["3. low"];
    const c = row["4. close"];
    const open = Number.parseFloat(String(o ?? ""));
    const high = Number.parseFloat(String(h ?? ""));
    const low = Number.parseFloat(String(l ?? ""));
    const close = Number.parseFloat(String(c ?? ""));
    if (![open, high, low, close].every((x) => Number.isFinite(x))) continue;

    const t = avTimestampToUnixSec(timeKey);
    if (!Number.isFinite(t)) continue;

    out.push({ time: t, open, high, low, close });
  }

  out.sort((a, b) => a.time - b.time);
  if (out.length > limit) return out.slice(-limit);
  return out;
}

async function fetchAvJson(url: string): Promise<Record<string, unknown>> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Alpha Vantage HTTP ${r.status}: ${t.slice(0, 200)}`);
  }
  return (await r.json()) as Record<string, unknown>;
}

function throwIfNoteOrError(j: Record<string, unknown>): void {
  if (typeof j.Note === "string") {
    throw new Error(
      `Alpha Vantage rate limit or usage note: ${j.Note.slice(0, 280)} (free tier: ~5 calls/min, 25 requests/day)`,
    );
  }
  if (typeof j["Error Message"] === "string") {
    throw new Error(`Alpha Vantage: ${j["Error Message"]}`);
  }
}

type FetchResult = {
  bars: OhlcBar[];
  /** Resolution key used for bar spacing / meta (may differ from request after free-tier fallback). */
  servingResolution: string;
  /** Shown to the client when intraday was requested but daily data was returned instead. */
  resolutionNote?: string;
};

async function fetchAlphaVantage(pair: string, resolution: string, limit: number, apikey: string): Promise<FetchResult> {
  const { from, to } = parsePair(pair);

  const buildUrl = (fn: string, extra: Record<string, string> = {}) => {
    const url = new URL("https://www.alphavantage.co/query");
    url.searchParams.set("apikey", apikey);
    url.searchParams.set("function", fn);
    url.searchParams.set("from_symbol", from);
    url.searchParams.set("to_symbol", to);
    for (const [k, v] of Object.entries(extra)) {
      url.searchParams.set(k, v);
    }
    return url.toString();
  };

  const fetchNonIntraday = async (fn: "FX_DAILY" | "FX_WEEKLY" | "FX_MONTHLY"): Promise<FetchResult> => {
    const extra: Record<string, string> =
      fn === "FX_DAILY" ? { outputsize: "full" } : {};
    const j = await fetchAvJson(buildUrl(fn, extra));
    throwIfNoteOrError(j);
    const info = typeof j.Information === "string" ? j.Information : null;
    const series = extractFxTimeSeries(j);
    if (info && (!series || Object.keys(series).length === 0)) {
      throw new Error(`Alpha Vantage: ${info.slice(0, 400)}`);
    }
    if (!series || Object.keys(series).length === 0) {
      return { bars: [], servingResolution: fn === "FX_DAILY" ? "D" : fn === "FX_WEEKLY" ? "W" : "M" };
    }
    const key = fn === "FX_DAILY" ? "D" : fn === "FX_WEEKLY" ? "W" : "M";
    return { bars: timeSeriesToBars(series, limit), servingResolution: key };
  };

  if (resolution === "D") {
    return fetchNonIntraday("FX_DAILY");
  }
  if (resolution === "W") {
    return fetchNonIntraday("FX_WEEKLY");
  }
  if (resolution === "M") {
    return fetchNonIntraday("FX_MONTHLY");
  }

  const interval = RES_TO_AV_INTRADAY[resolution];
  if (!interval) {
    throw new Error(`Unsupported intraday resolution: ${resolution}`);
  }

  const intradayUrl = buildUrl("FX_INTRADAY", { interval, outputsize: "full" });
  const jIntra = await fetchAvJson(intradayUrl);
  throwIfNoteOrError(jIntra);

  const intraSeries = extractFxTimeSeries(jIntra);
  const intraInfo = typeof jIntra.Information === "string" ? jIntra.Information : null;

  if (intraSeries && Object.keys(intraSeries).length > 0) {
    return {
      bars: timeSeriesToBars(intraSeries, limit),
      servingResolution: resolution,
    };
  }

  /** Forex intraday is not available on the free tier (premium); use daily OHLC. */
  const jDaily = await fetchAvJson(buildUrl("FX_DAILY", { outputsize: "full" }));
  throwIfNoteOrError(jDaily);
  const dailyInfo = typeof jDaily.Information === "string" ? jDaily.Information : null;
  const dailySeries = extractFxTimeSeries(jDaily);
  if (dailyInfo && (!dailySeries || Object.keys(dailySeries).length === 0)) {
    throw new Error(`Alpha Vantage: ${dailyInfo.slice(0, 400)}`);
  }
  if (!dailySeries || Object.keys(dailySeries).length === 0) {
    return { bars: [], servingResolution: "D" };
  }

  const requested = resolutionLabel(resolution);
  const resolutionNote = `Requested ${requested}; Alpha Vantage free tier does not include forex intraday (FX_INTRADAY) — returned FX_DAILY (${resolutionLabel("D")}) bars instead.${intraInfo ? ` (${intraInfo.slice(0, 160)}${intraInfo.length > 160 ? "…" : ""})` : ""}`;

  return {
    bars: timeSeriesToBars(dailySeries, limit),
    servingResolution: "D",
    resolutionNote,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pair = searchParams.get("pair") ?? "EUR_USD";
  /** Default to daily — matches Alpha Vantage free-tier forex access. */
  const resolution = searchParams.get("resolution") ?? "D";
  let limit = Number.parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
  limit = Math.min(limit, MAX_LIMIT);

  const barSec = RES_TO_SEC[resolution];
  if (!barSec) {
    return NextResponse.json(
      { error: "resolution must be one of: 1, 5, 15, 30, 60, D, W, M" },
      { status: 400 },
    );
  }

  const apikey = process.env.ALPHA_VANTAGE_API_KEY?.trim();
  if (!apikey) {
    return NextResponse.json({ error: MARKET_DATA_NOT_CONFIGURED }, { status: 503 });
  }

  try {
    const { bars, servingResolution, resolutionNote } = await fetchAlphaVantage(pair, resolution, limit, apikey);

    if (bars.length < 1) {
      return NextResponse.json(
        {
          error:
            "No OHLC bars returned. Check the pair (e.g. EUR_USD), API key, or Alpha Vantage limits (free tier: ~25 requests/day).",
        },
        { status: 404 },
      );
    }

    const provider = "alphavantage";
    const sym = normalizePairLabel(pair).replace("/", "");
    const meta: CsvDatasetMeta = {
      format: "api_market",
      symbol: normalizePairLabel(pair),
      timeframe: resolutionLabel(servingResolution),
      sourceFilename: `${provider}:${sym}_${servingResolution}`,
    };

    return NextResponse.json({
      bars,
      meta,
      provider,
      count: bars.length,
      ...(resolutionNote ? { resolutionNote } : {}),
      /** Echo when intraday was requested but daily bars were served (free tier). */
      ...(INTRADAY_RES.has(resolution) && servingResolution === "D"
        ? { requestedResolution: resolution }
        : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
