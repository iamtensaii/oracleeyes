/**
 * Parse OHLCV from user CSV:
 * - MetaTrader 5 **headerless** export: `YYYY.MM.DD HH:MM,open,high,low,close,volume,spread` (intraday)
 *   or `YYYY.MM.DD,open,high,low,close,...` (many daily/weekly/monthly exports — time omitted)
 * - MT5 tab export with `<DATE>`, `<TIME>` headers
 * - Generic header CSV
 */
import Papa from "papaparse";
import { inferFromMt5Filename } from "@/lib/mt5-filename";
import type { OhlcBar } from "@/types/market";

const COL = (s: string) => s.replace(/[<>]/g, "").trim().toUpperCase();

/**
 * First column starts like MT5 **headerless** export (no `<DATE>` row).
 * Daily / weekly / monthly bars often use date only: `YYYY.MM.DD` (no time).
 * Intraday uses `YYYY.MM.DD HH:MM` or with seconds.
 */
const MT5_COMPACT_FIRST_COL =
  /^\d{4}\.\d{2}\.\d{2}(?:\s+\d{2}:\d{2}(?::\d{2})?)?$/;

function detectDelimiter(sample: string): string {
  const tab = (sample.match(/\t/g) || []).length;
  const comma = (sample.match(/,/g) || []).length;
  const semi = (sample.match(/;/g) || []).length;
  if (tab >= comma && tab >= semi) return "\t";
  if (semi > comma) return ";";
  return ",";
}

/** lightweight-charts throws if high < low; MT5 glitches can produce bad rows. */
function clampOhlc(open: number, high: number, low: number, close: number) {
  let h = high;
  let l = low;
  if (h < l) [h, l] = [l, h];
  h = Math.max(h, open, close);
  l = Math.min(l, open, close);
  return { open, high: h, low: l, close };
}

function firstNonEmptyLine(text: string): string {
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (t) return t;
  }
  return "";
}

function parseMt5CompactDateTime(s: string): number | null {
  const trimmed = s.trim();
  let m = trimmed.match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const [, y, mo, d, h, mi, sec] = m;
    const iso = `${y}-${mo}-${d}T${h}:${mi}:${sec ?? "00"}Z`;
    const t = Date.parse(iso);
    return Number.isFinite(t) ? Math.floor(t / 1000) : null;
  }
  m = trimmed.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
  if (m) {
    const [, y, mo, d] = m;
    const iso = `${y}-${mo}-${d}T00:00:00Z`;
    const t = Date.parse(iso);
    return Number.isFinite(t) ? Math.floor(t / 1000) : null;
  }
  return null;
}

function parseMt5DateTime(dateStr: string, timeStr: string): number | null {
  const d = dateStr.replace(/\./g, "-");
  const iso = `${d}T${timeStr}Z`;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}

function rowToRecord(
  row: Record<string, string>,
  headers: string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of headers) {
    const key = COL(h);
    const v = row[h] ?? row[key] ?? "";
    out[key] = String(v).trim();
  }
  return out;
}

function findColumn(rec: Record<string, string>, names: string[]): string | undefined {
  const keys = Object.keys(rec);
  for (const n of names) {
    const u = n.toUpperCase();
    const hit = keys.find((k) => COL(k) === u);
    if (hit && rec[hit] !== undefined) return rec[hit];
  }
  return undefined;
}

export type CsvDatasetMeta = {
  format: "mt5_compact" | "mt5_tab_header" | "generic_header" | "api_market";
  symbol?: string;
  timeframe?: string;
  sourceFilename?: string;
};

export type ParseCsvResult =
  | { ok: true; bars: OhlcBar[]; rowCount: number; meta: CsvDatasetMeta }
  | { ok: false; error: string };

function parseHeaderlessMt5Compact(text: string, delim: string): OhlcBar[] {
  const parsed = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: true,
    delimiter: delim,
  });
  const bars: OhlcBar[] = [];
  for (const row of parsed.data) {
    if (!row.length || row.length < 5) continue;
    const dt = String(row[0] ?? "").replace(/^\uFEFF/, "").trim();
    const time = parseMt5CompactDateTime(dt);
    if (!MT5_COMPACT_FIRST_COL.test(dt) || time === null) continue;
    const open = parseFloat(String(row[1] ?? ""));
    const high = parseFloat(String(row[2] ?? ""));
    const low = parseFloat(String(row[3] ?? ""));
    const close = parseFloat(String(row[4] ?? ""));
    const volRaw = row[5];
    const volume =
      volRaw !== undefined && String(volRaw).trim() !== ""
        ? parseFloat(String(volRaw))
        : undefined;
    if (
      time === null ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    ) {
      continue;
    }
    const q = clampOhlc(open, high, low, close);
    bars.push({
      time,
      open: q.open,
      high: q.high,
      low: q.low,
      close: q.close,
      volume: Number.isFinite(volume) ? volume : undefined,
    });
  }
  return bars;
}

export function parseOhlcvCsv(
  text: string,
  options?: { filename?: string },
): ParseCsvResult {
  const delim = detectDelimiter(text.slice(0, 4096));
  const firstLine = firstNonEmptyLine(text);
  const filenameMeta = options?.filename
    ? inferFromMt5Filename(options.filename)
    : null;

  const firstCell = firstLine.split(delim)[0]?.replace(/^\uFEFF/, "").trim() ?? "";
  if (firstLine && MT5_COMPACT_FIRST_COL.test(firstCell)) {
    const rawBars = parseHeaderlessMt5Compact(text, delim);
    rawBars.sort((a, b) => a.time - b.time);
    const byTime = new Map<number, OhlcBar>();
    for (const b of rawBars) byTime.set(b.time, b);
    const deduped = Array.from(byTime.values()).sort((a, b) => a.time - b.time);
    if (!deduped.length) {
      return {
        ok: false,
        error:
          "Could not parse MT5 compact CSV rows. Daily/weekly/monthly exports often use YYYY.MM.DD without time — re-save as UTF-8 or the same format as your M5 file, or use MT5 “save with headers” (<DATE>,<TIME>,…).",
      };
    }
    return {
      ok: true,
      bars: deduped,
      rowCount: rawBars.length,
      meta: {
        format: "mt5_compact",
        symbol: filenameMeta?.symbol,
        timeframe: filenameMeta?.timeframe,
        sourceFilename: options?.filename,
      },
    };
  }

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter: delim,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length) {
    const e = parsed.errors[0];
    return { ok: false, error: e.message || "CSV parse error" };
  }

  const rows = parsed.data.filter((r) => Object.keys(r).some((k) => String(r[k]).trim()));
  if (!rows.length) return { ok: false, error: "No data rows" };

  const headers = parsed.meta.fields || Object.keys(rows[0]);
  const headerKey = headers.map((h) => COL(String(h))).join("|");
  /** Daily exports sometimes omit &lt;TIME&gt;; still MT5 tabular if DATE + OHLC. */
  const isMt5Tab = headerKey.includes("DATE") && headerKey.includes("OPEN");

  const bars: OhlcBar[] = [];

  for (const raw of rows) {
    const rec = rowToRecord(raw, headers);

    const dateCol = findColumn(rec, ["DATE", "DATETIME", "TIME"]);
    const timeCol = findColumn(rec, ["TIME"]);
    const tsCol = findColumn(rec, ["TIMESTAMP", "TIME_UNIX", "UNIX"]);

    let time: number | null = null;
    if (tsCol && /^\d+$/.test(tsCol)) {
      const n = parseInt(tsCol, 10);
      time = n > 1e12 ? Math.floor(n / 1000) : n;
    } else if (dateCol && dateCol.includes(".") && timeCol?.trim()) {
      time = parseMt5DateTime(dateCol, timeCol.trim());
    } else if (dateCol && dateCol.includes(".")) {
      time =
        parseMt5CompactDateTime(dateCol.trim()) ?? parseMt5DateTime(dateCol.replace(/\./g, "-"), "00:00:00");
    } else if (dateCol) {
      const t = Date.parse(dateCol.replace(/\./g, "-"));
      time = Number.isFinite(t) ? Math.floor(t / 1000) : null;
    }

    const open = parseFloat(findColumn(rec, ["OPEN", "O"]) ?? "");
    const high = parseFloat(findColumn(rec, ["HIGH", "H"]) ?? "");
    const low = parseFloat(findColumn(rec, ["LOW", "L"]) ?? "");
    const close = parseFloat(findColumn(rec, ["CLOSE", "C"]) ?? "");
    const volStr = findColumn(rec, ["VOLUME", "VOL", "TICKVOL", "TICK_VOLUME"]);
    const volume = volStr !== undefined ? parseFloat(volStr) : undefined;

    if (
      time === null ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    ) {
      continue;
    }

    const q = clampOhlc(open, high, low, close);
    bars.push({
      time,
      open: q.open,
      high: q.high,
      low: q.low,
      close: q.close,
      volume: Number.isFinite(volume) ? volume : undefined,
    });
  }

  bars.sort((a, b) => a.time - b.time);

  const byTime = new Map<number, OhlcBar>();
  for (const b of bars) byTime.set(b.time, b);
  const deduped = Array.from(byTime.values()).sort((a, b) => a.time - b.time);

  if (!deduped.length) {
    return {
      ok: false,
      error:
        "Could not parse OHLC columns. Expect MT5 export (date+time,OHLC,vol) or DATE/TIME headers plus OPEN,HIGH,LOW,CLOSE.",
    };
  }

  return {
    ok: true,
    bars: deduped,
    rowCount: rows.length,
    meta: {
      format: isMt5Tab ? "mt5_tab_header" : "generic_header",
      symbol: filenameMeta?.symbol,
      timeframe: filenameMeta?.timeframe,
      sourceFilename: options?.filename,
    },
  };
}
