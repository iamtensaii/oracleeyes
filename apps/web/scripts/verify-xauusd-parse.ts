/**
 * Sanity-check MT5 headerless XAUUSD H1 CSV parsing (matches typical XAUUSDH1.csv export).
 * Sample on disk is UTF-16 LE + BOM (common MT5 default) — same as decodeCsvText in the app.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeCsvText } from "../src/lib/decode-csv-text";
import { parseOhlcvCsv } from "../src/lib/parse-csv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sample = join(__dirname, "../public/samples/XAUUSDH1.csv");
const buf = readFileSync(sample);
const text = decodeCsvText(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const r = parseOhlcvCsv(text, { filename: "XAUUSDH1.csv" });

if (!r.ok) {
  console.error("parse failed:", r.error);
  process.exit(1);
}
if (r.meta.format !== "mt5_compact") {
  console.error("expected mt5_compact, got", r.meta.format);
  process.exit(1);
}
if (r.meta.symbol !== "XAUUSD" || r.meta.timeframe !== "H1") {
  console.error("filename meta mismatch:", r.meta);
  process.exit(1);
}
if (r.bars.length < 100) {
  console.error("too few bars:", r.bars.length);
  process.exit(1);
}
const first = r.bars[0];
const last = r.bars[r.bars.length - 1];
if (first.time >= last.time) {
  console.error("bars not sorted ascending by time");
  process.exit(1);
}
if (first.high < first.low || last.high < last.low) {
  console.error("clampOhlc invariant broken");
  process.exit(1);
}
console.log("verify-xauusd-parse: ok", r.bars.length, "bars", r.meta);

const dailyCompact = [
  "2024.01.02,2045.1,2050.2,2040.0,2048.5,1000,0",
  "2024.01.03,2048.5,2060.0,2045.0,2055.0,1100,0",
].join("\n");
const d = parseOhlcvCsv(dailyCompact, { filename: "XAUUSDDaily.csv" });
if (!d.ok || d.bars.length !== 2 || d.meta.format !== "mt5_compact") {
  console.error("daily compact parse failed", d);
  process.exit(1);
}
if (d.bars[0]!.time >= d.bars[1]!.time) {
  console.error("daily bars not ascending");
  process.exit(1);
}

const dupName = parseOhlcvCsv(dailyCompact, { filename: "XAUUSDM5 (1).csv" });
if (!dupName.ok) {
  console.error("dup filename parse failed", dupName.error);
  process.exit(1);
}
if (dupName.meta.symbol !== "XAUUSD" || dupName.meta.timeframe !== "M5") {
  console.error("expected filename strip + meta", dupName.meta);
  process.exit(1);
}

console.log("verify-xauusd-parse: daily compact + filename strip ok");
