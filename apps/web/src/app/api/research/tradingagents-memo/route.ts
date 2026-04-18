/**
 * Optional thin bridge to TauricResearch/TradingAgents: run one propagate(symbol, date)
 * via a subprocess + repo checkout. Server-only.
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NextResponse } from "next/server";
import { TRADINGAGENTS_NOT_ENABLED, TRADINGAGENTS_RUN_FAILED } from "@/lib/client-safe-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYMBOL_RE = /^[A-Za-z0-9^.\-]{1,24}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const MAX_TIMEOUT_MS = Number.parseInt(process.env.TRADINGAGENTS_BRIDGE_TIMEOUT_MS ?? "480000", 10);

type BridgeOk = {
  ok: true;
  symbol: string;
  date: string;
  memo_markdown: string;
  decision: unknown;
};

type BridgeErr = { ok: false; error: string };

export async function POST(req: Request) {
  const repo = process.env.TRADINGAGENTS_REPO?.trim();
  if (!repo) {
    return NextResponse.json({ ok: false, error: TRADINGAGENTS_NOT_ENABLED } satisfies BridgeErr, { status: 503 });
  }

  let body: { symbol?: string; analysisDate?: string };
  try {
    body = (await req.json()) as { symbol?: string; analysisDate?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." } satisfies BridgeErr, { status: 400 });
  }

  const symbol = (body.symbol ?? "").trim().toUpperCase();
  const analysisDate = (body.analysisDate ?? "").trim();

  if (!SYMBOL_RE.test(symbol)) {
    return NextResponse.json(
      { ok: false, error: "Use a valid ticker (letters, digits, and . ^ - only)." } satisfies BridgeErr,
      { status: 400 },
    );
  }
  if (!DATE_RE.test(analysisDate)) {
    return NextResponse.json(
      { ok: false, error: "Use a calendar date in YYYY-MM-DD form." } satisfies BridgeErr,
      { status: 400 },
    );
  }

  const pythonBin = process.env.TRADINGAGENTS_PYTHON?.trim() || "python3";
  const routeDir = dirname(fileURLToPath(import.meta.url));
  const scriptPath = join(routeDir, "..", "..", "..", "..", "..", "scripts", "tradingagents_memo_bridge.py");

  const chunks: Buffer[] = [];
  const errChunks: Buffer[] = [];

  const code = await new Promise<number>((resolve) => {
    const child = spawn(pythonBin, [scriptPath, symbol, analysisDate], {
      cwd: repo,
      env: {
        ...process.env,
        TRADINGAGENTS_REPO: repo,
      },
      timeout: MAX_TIMEOUT_MS,
    });
    child.stdout.on("data", (d: Buffer) => chunks.push(d));
    child.stderr.on("data", (d: Buffer) => errChunks.push(d));
    child.on("error", () => resolve(127));
    child.on("close", (c) => resolve(c ?? 1));
  });

  const rawOut = Buffer.concat(chunks).toString("utf-8").trim();
  const rawErr = Buffer.concat(errChunks).toString("utf-8").trim();

  if (code !== 0) {
    console.error("[tradingagents-memo] bridge exit", code, { stderr: rawErr.slice(0, 2000), stdout: rawOut.slice(0, 500) });
    return NextResponse.json({ ok: false, error: TRADINGAGENTS_RUN_FAILED } satisfies BridgeErr, { status: 502 });
  }

  try {
    const parsed = JSON.parse(rawOut) as BridgeOk | BridgeErr;
    if (!parsed || typeof parsed !== "object" || !("ok" in parsed)) {
      console.error("[tradingagents-memo] invalid JSON envelope");
      return NextResponse.json({ ok: false, error: TRADINGAGENTS_RUN_FAILED } satisfies BridgeErr, { status: 502 });
    }
    if (!parsed.ok) {
      console.error("[tradingagents-memo] bridge reported ok:false", String(parsed.error).slice(0, 500));
      return NextResponse.json({ ok: false, error: TRADINGAGENTS_RUN_FAILED } satisfies BridgeErr, { status: 502 });
    }
    return NextResponse.json(parsed);
  } catch {
    console.error("[tradingagents-memo] JSON parse failed", rawOut.slice(0, 300));
    return NextResponse.json({ ok: false, error: TRADINGAGENTS_RUN_FAILED } satisfies BridgeErr, { status: 502 });
  }
}
