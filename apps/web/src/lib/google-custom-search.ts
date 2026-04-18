/**
 * Server-only Google Programmable Search (Custom Search JSON API).
 */
import "server-only";

export type WebSearchHit = {
  title: string;
  link: string;
  snippet: string;
};

export async function googleCustomSearch(query: string, maxResults = 5): Promise<WebSearchHit[]> {
  const key = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY?.trim();
  const cx = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID?.trim();
  if (!key || !cx) {
    throw new Error("Web search is not enabled on this server. Ask your administrator if you need it.");
  }

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", key);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query.trim().slice(0, 200));
  url.searchParams.set("num", String(Math.min(10, Math.max(1, maxResults))));

  const r = await fetch(url.toString(), { cache: "no-store" });
  if (!r.ok) {
    await r.text().catch(() => "");
    throw new Error(`Web search returned an error (${r.status}). Try again later or rephrase your query.`);
  }

  const j = (await r.json()) as {
    items?: Array<{ title?: string; link?: string; snippet?: string }>;
  };
  const items = j.items ?? [];
  return items.map((it) => ({
    title: it.title ?? "(no title)",
    link: it.link ?? "",
    snippet: it.snippet ?? "",
  }));
}
