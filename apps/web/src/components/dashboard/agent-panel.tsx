"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChatMarkdown } from "@/components/chat/chat-markdown";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ASSISTANT_EMPTY_STATE } from "@/lib/product-copy";
import { POST_PREDICT_USER_MESSAGE } from "@/lib/post-predict-analysis";
import { REPLY_DEPTH_CHOICES } from "@/lib/reply-depth";
import type { ReplyDepth } from "@/lib/reply-depth";
import { newSessionId } from "@/lib/session-id";
import type { PredictResult } from "@/lib/ml-api";
import type { CsvDatasetMeta } from "@/lib/parse-csv";
import type { OhlcBar } from "@/types/market";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Server infers intent per message; no manual persona picker. */
const AGENT_ROLE_ADAPTIVE = "adaptive" as const;

type Props = {
  bars: OhlcBar[];
  datasetMeta: CsvDatasetMeta | null;
  forecastBars: OhlcBar[];
  lastForecastPred: PredictResult | null;
  /** Incremented after a successful one-click predict; triggers one assistant reply. */
  autoAnalyzeNonce: number;
  /** Optional markdown from TradingAgents thin bridge (server-side subprocess). */
  tradingAgentsMemo?: string | null;
};

function renderMessageParts(
  parts: { type: string; text?: string }[] | undefined,
  opts?: { compact?: boolean },
): ReactNode {
  if (!parts?.length) return null;
  const compact = opts?.compact === true;
  const chunks: ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!;
    if (p.type === "text" && p.text) {
      chunks.push(
        <ChatMarkdown
          key={`t-${i}`}
          content={p.text}
          className={compact ? "[&_p]:mb-1 [&_p]:last:mb-0 [&_p]:text-[15px]" : undefined}
        />,
      );
      continue;
    }
    if (p.type === "reasoning" && typeof p.text === "string" && p.text.trim()) {
      chunks.push(
        <details key={`r-${i}`} className="text-muted-foreground mt-2 text-xs">
          <summary className="text-muted-foreground/90 cursor-pointer select-none text-[11px] font-medium tracking-wide hover:text-foreground">
            Thinking
          </summary>
          <div className="text-muted-foreground mt-1.5 max-h-40 overflow-y-auto text-[13px] leading-relaxed">
            <ChatMarkdown content={p.text.trim()} />
          </div>
        </details>,
      );
    }
  }
  return chunks.length ? <div className="min-w-0 space-y-1">{chunks}</div> : null;
}

export function AgentPanel({
  bars,
  datasetMeta,
  forecastBars,
  lastForecastPred,
  autoAnalyzeNonce,
  tradingAgentsMemo = null,
}: Props) {
  const [sessionId] = useState(() => newSessionId());
  const [replyDepth, setReplyDepth] = useState<ReplyDepth>("layered");
  const lastAutoNonceAppliedRef = useRef(0);

  const chatPayloadRef = useRef({
    sessionId,
    agentRole: AGENT_ROLE_ADAPTIVE,
    replyDepth,
    bars,
    datasetMeta,
    forecastBars,
    lastForecastPred,
    tradingAgentsMemo,
  });
  useLayoutEffect(() => {
    chatPayloadRef.current = {
      sessionId,
      agentRole: AGENT_ROLE_ADAPTIVE,
      replyDepth,
      bars,
      datasetMeta,
      forecastBars,
      lastForecastPred,
      tradingAgentsMemo,
    };
  }, [sessionId, replyDepth, bars, datasetMeta, forecastBars, lastForecastPred, tradingAgentsMemo]);

  /* eslint-disable react-hooks/refs */
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: async ({
          id,
          messages,
          body: mergedBody,
          trigger,
          messageId,
        }) => {
          const ctx = chatPayloadRef.current;
          return {
            body: {
              ...(mergedBody ?? {}),
              sessionId: ctx.sessionId,
              agentRole: ctx.agentRole,
              replyDepth: ctx.replyDepth,
              bars: ctx.bars,
              datasetMeta: ctx.datasetMeta,
              forecastBars: ctx.forecastBars,
              lastForecastPred: ctx.lastForecastPred,
              tradingAgentsMemo: ctx.tradingAgentsMemo,
              messages,
              id,
              trigger,
              messageId,
            },
          };
        },
      }),
    [],
  );
  /* eslint-enable react-hooks/refs */

  const { messages, sendMessage, status, error, clearError } = useChat({
    transport,
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (!autoAnalyzeNonce || autoAnalyzeNonce <= lastAutoNonceAppliedRef.current) return;
    lastAutoNonceAppliedRef.current = autoAnalyzeNonce;
    void sendMessage(
      { text: POST_PREDICT_USER_MESSAGE },
      { body: { postPredictAnalysis: true } },
    );
  }, [autoAnalyzeNonce, sendMessage]);

  const showLocalLlmHelp =
    error != null &&
    /ECONNREFUSED|fetch failed|Failed to fetch|ENOTFOUND|12434|model-runner|429|rate.?limit|local LLM|not configured/i.test(
      error.message,
    );

  return (
    <div className="assistant-panel flex min-h-0 flex-1 flex-col">
      <div className="border-border/60 flex shrink-0 flex-col gap-1.5 border-b pb-2">
        <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">Answer format</span>
        <Select value={replyDepth} onValueChange={(v) => setReplyDepth(v as ReplyDepth)}>
          <SelectTrigger className="h-8 w-full max-w-[min(100%,20rem)] border-border/70 text-xs shadow-none">
            <SelectValue placeholder="Format" />
          </SelectTrigger>
          <SelectContent className="text-sm">
            {REPLY_DEPTH_CHOICES.map((c) => (
              <SelectItem key={c.value} value={c.value} title={c.oneLiner}>
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-[11px] leading-snug">
          One assistant infers what you mean (chart, risk, scenarios, code…) — no role picker.{" "}
          <span className="text-foreground/85 font-medium">Balanced</span> is the default. After Predict / Run forecast,
          the auto recap stays short regardless of this setting.
        </p>
      </div>

      {error ? (
        <div
          className="bg-destructive/10 text-destructive shrink-0 rounded-xl px-3 py-2.5 text-sm leading-relaxed"
          role="alert"
        >
          <p className="font-medium break-words">
            {error.message.length > 900 ? `${error.message.slice(0, 900)}…` : error.message}
          </p>
          {showLocalLlmHelp ? (
            <p className="text-foreground/90 mt-2 text-xs leading-relaxed dark:text-foreground/85">
              Chat uses only a <span className="font-medium">local</span> LLM. Confirm Docker Model Runner (or your
              OpenAI-compatible server) is running, TCP is enabled if needed, and{" "}
              <span className="font-mono">LOCAL_LLM_BASE_URL</span> / <span className="font-mono">LOCAL_LLM_MODEL</span>{" "}
              match your setup (from the <span className="font-mono">web</span> container, often{" "}
              <span className="font-mono">model-runner.docker.internal</span> on port{" "}
              <span className="font-mono">12434</span>).
            </p>
          ) : null}
          <Button type="button" variant="ghost" size="sm" className="mt-1.5 h-7 px-2 text-xs" onClick={() => clearError()}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <p className="text-muted-foreground shrink-0 py-1 text-[11px] leading-snug">
        After <span className="text-foreground/90 font-medium">Run forecast</span> or{" "}
        <span className="text-foreground/90 font-medium">Predict on chart</span>, opening this tab sends a short recap.
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1 pr-1">
        {messages.length === 0 ? (
          <p className="text-muted-foreground py-3 text-sm leading-relaxed">{ASSISTANT_EMPTY_STATE}</p>
        ) : (
          <div className="flex flex-col gap-5">
            {messages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={cn("flex w-full min-w-0", isUser ? "justify-end" : "justify-start")}
                >
                  {isUser ? (
                    <div className="bg-muted/85 text-foreground max-w-[min(100%,92%)] rounded-3xl px-3.5 py-2 sm:max-w-[85%]">
                      {renderMessageParts(m.parts as { type: string; text?: string }[], { compact: true })}
                    </div>
                  ) : (
                    <div className="text-foreground max-w-full min-w-0 pr-1 sm:pr-2">
                      {renderMessageParts(m.parts as { type: string; text?: string }[])}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <form
        className="border-border/60 mt-1 shrink-0 border-t pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const text = String(fd.get("text") ?? "").trim();
          if (!text) return;
          void sendMessage({ text });
          e.currentTarget.reset();
        }}
      >
        <div className="border-border/70 bg-muted/25 dark:bg-muted/15 flex items-end gap-2 rounded-2xl border px-2 py-1.5 shadow-none">
          <Textarea
            name="text"
            placeholder="Ask in your own words — the assistant adapts…"
            rows={1}
            className="max-h-32 min-h-[2.5rem] flex-1 resize-none border-0 bg-transparent px-2 py-2 text-[15px] leading-relaxed shadow-none focus-visible:ring-0"
          />
          <Button
            type="submit"
            size="icon"
            className="mb-0.5 size-9 shrink-0 rounded-full"
            disabled={status === "streaming" || status === "submitted"}
            aria-label={status === "streaming" ? "Sending" : "Send message"}
          >
            <Send className="size-4" />
          </Button>
        </div>
        {status === "streaming" || status === "submitted" ? (
          <p className="text-muted-foreground mt-1 text-center text-[10px]">Waiting for reply…</p>
        ) : null}
      </form>
    </div>
  );
}
