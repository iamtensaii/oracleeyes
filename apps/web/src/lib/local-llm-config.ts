/**
 * Local LLM — OpenAI-compatible base URL (host gateway, sidecar container, etc.).
 * /api/chat requires LOCAL_LLM_BASE_URL — there is no cloud chat provider in this stack.
 */
import "server-only";

/** Default model id (must match your inference server; example only). */
export const DEFAULT_LOCAL_LLM_MODEL = "docker.io/ai/gemma4:latest";

export type LocalLlmSettings = {
  baseURL: string;
  model: string;
  apiKey: string;
};

/**
 * Returns trimmed OpenAI-compatible API base when local chat is enabled.
 * Example (host): http://localhost:12434/engines/llama.cpp/v1
 * Example (from Compose `web` container): http://host.docker.internal:12434/engines/llama.cpp/v1
 */
export function getLocalLlmSettings(): LocalLlmSettings | null {
  const raw = process.env.LOCAL_LLM_BASE_URL?.trim();
  if (!raw) return null;
  const baseURL = raw.replace(/\/+$/, "");
  const model = process.env.LOCAL_LLM_MODEL?.trim() || DEFAULT_LOCAL_LLM_MODEL;
  const apiKey = process.env.LOCAL_LLM_API_KEY?.trim() || "not-needed";
  return { baseURL, model, apiKey };
}
