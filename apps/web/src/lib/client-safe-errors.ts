/**
 * User-facing error strings for API routes.
 * Do not expose internal URLs, hostnames, file paths, env var names, or subprocess output to the browser.
 */

export const CHAT_NOT_CONFIGURED =
  "The assistant could not start because no local LLM is configured. Ask whoever runs this app to set a local OpenAI-compatible base URL (for example a self-hosted vLLM or Ollama-compatible endpoint), ensure it accepts connections from the web process, and restart the web service.";

export const MARKET_DATA_NOT_CONFIGURED =
  "Live market loading is not available here. Upload a CSV instead, or ask your administrator to enable the market data connection.";

