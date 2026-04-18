import { NextResponse } from "next/server";
import { getLocalLlmSettings } from "@/lib/local-llm-config";

export const dynamic = "force-dynamic";

type Check = {
  id: string;
  ok: boolean;
  label: string;
  hint: string;
};

async function probeLocalOpenAiCompatible(baseURL: string): Promise<{ ok: boolean; hint: string }> {
  const url = `${baseURL.replace(/\/+$/, "")}/models`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(url, { method: "GET", cache: "no-store", signal: ctrl.signal });
    clearTimeout(t);
    if (r.ok) {
      return {
        ok: true,
        hint: "The assistant is configured for a local OpenAI-compatible LLM and the server reached it.",
      };
    }
    return {
      ok: false,
      hint: "LOCAL_LLM_BASE_URL is set, but the models listing returned an error. Check the base path (many local servers use a path ending in /v1; llama.cpp-style gateways often use /engines/llama.cpp/v1).",
    };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      ok: false,
      hint: aborted
        ? "The local LLM endpoint timed out. Confirm the inference service is running and reachable from this process."
        : "The server could not reach the local LLM. From containers, LOCAL_LLM_BASE_URL must resolve inside the web container (Compose often uses host.docker.internal for a host-bound server); on the host, try localhost with the port your server uses.",
    };
  }
}

export async function GET() {
  const mlBase = (
    process.env.ML_API_URL ??
    process.env.NEXT_PUBLIC_ML_API_URL ??
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "");

  let mlOk = false;
  let mlHint =
    "Train and predict use a separate analysis service. If you use the recommended setup, start the full application stack; otherwise ask whoever deployed this for you.";

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(`${mlBase}/health`, { cache: "no-store", signal: ctrl.signal });
    clearTimeout(t);
    mlOk = r.ok;
    mlHint = mlOk
      ? "Train and predict are available."
      : "The analysis service responded with an error. Ask your administrator to check that the service is running and healthy.";
  } catch {
    mlHint =
      "The analysis service did not respond. Start the packaged stack or ask your administrator — connection details are not shown here.";
  }

  const localLlm = getLocalLlmSettings();
  const localProbe = localLlm ? await probeLocalOpenAiCompatible(localLlm.baseURL) : null;

  const agentOk = localProbe?.ok === true;
  let agentHint =
    "The assistant needs LOCAL_LLM_BASE_URL (and optionally LOCAL_LLM_MODEL) pointing at an OpenAI-compatible local API. Ask your administrator to deploy an inference endpoint reachable from the web service and restart the web app.";
  if (localProbe) {
    agentHint = localProbe.hint;
  }

  const memoryOk = Boolean(process.env.DATABASE_URL?.trim());
  const memoryHint = memoryOk
    ? "Optional: chat notes can be saved between messages on this deployment."
    : "Optional: long chat memory may use the default in-memory store unless your administrator adds a database.";

  const alphaVantage = Boolean(process.env.ALPHA_VANTAGE_API_KEY?.trim());
  const marketHint = alphaVantage
    ? "Loading forex from the market API is available."
    : "Loading forex from the market API is not configured; use CSV upload or ask your administrator.";

  const checks: Check[] = [
    { id: "ml", ok: mlOk, label: "Train & predict", hint: mlHint },
    { id: "agent", ok: agentOk, label: "Chat assistant", hint: agentHint },
    { id: "memory", ok: memoryOk, label: "Saved memory (optional)", hint: memoryHint },
    { id: "market", ok: alphaVantage, label: "Live forex (optional)", hint: marketHint },
  ];

  return NextResponse.json({ checks });
}
