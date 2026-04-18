import { createOpenAI } from "@ai-sdk/openai";
import { parseAgentRole, type AgentRole } from "@/lib/agent-roles";
import { systemLeadForRole } from "@/lib/agent-swarm-system";
import { buildPostPredictSystemBlock } from "@/lib/post-predict-analysis";
import type { ReplyDepth } from "@/lib/reply-depth";
import { getLocalLlmSettings } from "@/lib/local-llm-config";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { listMemory, saveMemory } from "@/lib/agent-memory";
import { summarizeChartTechnicals } from "@/lib/chart-indicators";
import { buildLoadedDatasetContext } from "@/lib/chart-session-summary";
import { buildForecastContextForAgent } from "@/lib/forecast-agent-context";
import type { PredictResult } from "@/lib/ml-api";
import type { CsvDatasetMeta } from "@/lib/parse-csv";
import { googleCustomSearch } from "@/lib/google-custom-search";
import type { OhlcBar } from "@/types/market";
import { CHAT_NOT_CONFIGURED } from "@/lib/client-safe-errors";

export const maxDuration = 120;

const ML_BASE = process.env.ML_API_URL ?? process.env.NEXT_PUBLIC_ML_API_URL ?? "http://127.0.0.1:8000";

async function trainModelSrv(bars: OhlcBar[]) {
  const res = await fetch(`${ML_BASE}/train`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bars, test_fraction: 0.2, horizon: 1 }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{
    model_id: string;
    train_accuracy: number;
    test_accuracy: number;
    baseline_majority_test_accuracy?: number;
    baseline_always_flat_test_accuracy?: number;
    baseline_random_expected_accuracy?: number;
  }>;
}

async function predictModelSrv(modelId: string, bars: OhlcBar[]) {
  const res = await fetch(`${ML_BASE}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model_id: modelId, bars }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ direction: number; proba: number[]; disclaimer: string }>;
}

async function backtestModelSrv(modelId: string, bars: OhlcBar[], feeBps: number) {
  const res = await fetch(`${ML_BASE}/backtest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model_id: modelId, bars, fee_bps: feeBps }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ total_return: number; sharpe_approx: number }>;
}

/** JSON error bodies break `useChat` / DefaultChatTransport; stream a UI error chunk instead. */
function chatConfigErrorResponse(errorText: string) {
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute({ writer }) {
        writer.write({ type: "error", errorText });
      },
    }),
  });
}

function augmentLocalLlmErrorMessage(message: string): string {
  const m = message.trim();
  if (/ECONNREFUSED|fetch failed|Failed to fetch|ENOTFOUND|network error|connect/i.test(m)) {
    const head = m.split("\n")[0]!.slice(0, 280);
    return `${head}\n\nThe server could not reach the configured local LLM. Ensure an OpenAI-compatible API is listening at LOCAL_LLM_BASE_URL. With the bundled Compose defaults (host-bound server on port 12434), containers often use http://host.docker.internal:12434/engines/llama.cpp/v1; on the host with npm run dev, use http://localhost:12434/engines/llama.cpp/v1 or the URL your operator documented.`;
  }
  if (/429|rate.?limit|temporarily unavailable|too many requests/i.test(m)) {
    return `${m.slice(0, 400)}\n\nYour local model or inference server may be busy or rate-limited. Wait a moment and retry, or check that service’s logs.`;
  }
  if (/\bnot found\b|404/i.test(m)) {
    return `${m.slice(0, 400)}\n\nThe local server rejected the request (often “Not Found” if the runner does not support the OpenAI Responses API path). This app uses chat completions; check LOCAL_LLM_BASE_URL ends with …/v1 and your runner exposes POST /v1/chat/completions.`;
  }
  return m.length > 600 ? `${m.slice(0, 600)}…` : m;
}

export async function POST(req: Request) {
  const localLlm = getLocalLlmSettings();
  if (!localLlm) {
    return chatConfigErrorResponse(CHAT_NOT_CONFIGURED);
  }

  const body = (await req.json()) as {
    messages: UIMessage[];
    agentRole?: AgentRole;
    sessionId?: string;
    bars?: OhlcBar[];
    datasetMeta?: CsvDatasetMeta | null;
    forecastBars?: OhlcBar[];
    lastForecastPred?: PredictResult | null;
    /** When true, replace role lead with compact post-predict recap rules (user message stays short). */
    postPredictAnalysis?: boolean;
    /** Answer shape: quick / layered (default) / full orchestrator panels. Ignored when postPredictAnalysis. */
    replyDepth?: ReplyDepth;
  };

  const {
    messages: uiMessages,
    agentRole: agentRoleRaw,
    sessionId = "default",
    bars = [],
    datasetMeta = null,
    forecastBars = [],
    lastForecastPred = null,
    postPredictAnalysis = false,
    replyDepth: replyDepthRaw,
  } = body;
  const replyDepth: ReplyDepth =
    replyDepthRaw === "quick" || replyDepthRaw === "full" || replyDepthRaw === "layered"
      ? replyDepthRaw
      : "layered";
  const agentRole = parseAgentRole(agentRoleRaw);
  const localOpenai = createOpenAI({
    baseURL: localLlm.baseURL,
    apiKey: localLlm.apiKey,
  });
  const chatModelId = localLlm.model;
  const prior = await listMemory(sessionId, 20);
  const memoryContext =
    prior.length > 0
      ? `\nPrior session notes:\n${prior.map((p) => `- (${p.role ?? "note"}) ${p.content}`).join("\n")}`
      : "";

  const datasetContext = buildLoadedDatasetContext(bars, datasetMeta);
  const forecastCtx = buildForecastContextForAgent(forecastBars, lastForecastPred);
  const forecastBlock =
    forecastCtx.length > 0
      ? `\nCurrent forecast UI context: ${forecastCtx}\nUse this when explaining the violet candles after a predict run; do not contradict these mechanics.`
      : "";

  const roleLead = postPredictAnalysis
    ? buildPostPredictSystemBlock(forecastBars, lastForecastPred)
    : systemLeadForRole(agentRole, replyDepth);

  const system = `${roleLead}
${datasetContext}${memoryContext}${forecastBlock}
Shared rules: match the user's effort level — if they asked a narrow question, answer narrowly first.
When discussing forecasts or strategy: never claim certainty, guaranteed returns, or "100% accuracy." Markets are uncertain; past backtests and accuracy scores do not guarantee future outcomes.
For chart commentary (what moved, when, how strong, why it might have): call chart_technicals_snapshot first when bars are loaded — use returned numbers (SMA vs close, range, volume vs average, bar spacing, short trend) and explain in plain language. Do not invent OHLC or indicator values.
Prefer tool calls (train_ml_model, predict_ml, backtest_ml) when the user wants model output; combine with the snapshot for context (e.g. model direction vs where price sits vs MAs).
Use web_search when the user asks for recent news, macro context, or facts not on the chart. When web_search returns hits, cite each with title and URL in your answer.
Encourage using all informative history on the chart; other saved tabs are separate until the user switches.
Help the user think in terms of hypotheses, risks, and invalidation — not as a signal to blindly follow.`;

  const tools = {
      train_ml_model: tool({
        description:
          "Train the baseline RF model on the full OHLCV series currently on the chart (all loaded bars; needs 80+).",
        inputSchema: z.object({}),
        execute: async () => {
          if (bars.length < 80) return { error: "Need at least 80 bars" };
          const r = await trainModelSrv(bars);
          return {
            model_id: r.model_id,
            train_accuracy: r.train_accuracy,
            test_accuracy: r.test_accuracy,
            baseline_majority_test_accuracy: r.baseline_majority_test_accuracy ?? null,
            baseline_always_flat_test_accuracy: r.baseline_always_flat_test_accuracy ?? null,
            baseline_random_expected_accuracy: r.baseline_random_expected_accuracy ?? null,
          };
        },
      }),
      predict_ml: tool({
        description: "Run prediction for a trained model_id using the same loaded OHLCV series as on the chart.",
        inputSchema: z.object({ model_id: z.string() }),
        execute: async ({ model_id }) => {
          if (!bars.length) return { error: "No bars" };
          return predictModelSrv(model_id, bars);
        },
      }),
      backtest_ml: tool({
        description: "Run simple backtest on the loaded OHLCV series for model_id; fee in basis points.",
        inputSchema: z.object({ model_id: z.string(), fee_bps: z.number().default(2) }),
        execute: async ({ model_id, fee_bps }) => {
          if (!bars.length) return { error: "No bars" };
          return backtestModelSrv(model_id, bars, fee_bps);
        },
      }),
      chart_technicals_snapshot: tool({
        description:
          "Computed snapshot from loaded OHLCV: last returns, SMA20/SMA50 vs close, 20-bar high/low range, volume vs recent average, median bar step (time), 5-bar close trend. Use for chart analysis and explaining price action without guessing numbers.",
        inputSchema: z.object({
          lookback_bars: z.number().int().min(30).max(500).optional(),
        }),
        execute: async ({ lookback_bars }) => {
          if (!bars.length) return { error: "No bars loaded on chart" };
          return summarizeChartTechnicals(bars, lookback_bars ?? 120);
        },
      }),
      save_note: tool({
        description: "Persist a short note to session memory for later turns.",
        inputSchema: z.object({ note: z.string() }),
        execute: async ({ note }) => {
          await saveMemory(sessionId, note, agentRole);
          return { saved: true };
        },
      }),
      web_search: tool({
        description:
          "Search the public web (Google Programmable Search). Use for news, macro, or definitions not inferable from chart data. Results include title, link, snippet — cite sources in your reply.",
        inputSchema: z.object({
          query: z.string().min(2).max(200).describe("Search query"),
        }),
        execute: async ({ query }) => {
          try {
            const hits = await googleCustomSearch(query, 5);
            if (!hits.length) return { results: [], note: "No results returned." };
            return { results: hits };
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return { error: msg, results: [] as { title: string; link: string; snippet: string }[] };
          }
        },
      }),
    };

  const modelMessages = await convertToModelMessages(uiMessages, { tools });

  try {
    // Default `openai(modelId)` uses OpenAI's /v1/responses API; many local servers only expose /v1/chat/completions.
    const model = localOpenai.chat(chatModelId);

    const result = streamText({
      model,
      system,
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(12),
    });

    return result.toUIMessageStreamResponse({
      onError: (err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[api/chat] stream error:", msg);
        return augmentLocalLlmErrorMessage(msg);
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return chatConfigErrorResponse(augmentLocalLlmErrorMessage(msg));
  }
}
