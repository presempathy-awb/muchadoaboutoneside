import { isIP } from "node:net";
import type { CalligraphySource } from "../shared/calligraphy-assistant";
import { readJson } from "./worksheet-vision";

export interface CalligraphyEvidence extends CalligraphySource {
  text: string;
}

/** Keep search citations public and inert; no result URL is ever fetched. */
export function publicSourceUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      isIP(url.hostname.replace(/^\[|\]$/g, "")) ||
      !url.hostname.includes(".") ||
      /\.(localhost|local|internal|test|invalid|onion)$/.test(url.hostname)
    )
      return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

/** Search only the operator's fixed provider; bound every returned excerpt. */
export async function searchCalligraphyWeb(
  query: string,
  token: string,
  signal: AbortSignal,
  fetchImpl: (input: string, init?: RequestInit) => Promise<Response>,
): Promise<CalligraphyEvidence[]> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.search = new URLSearchParams({
    q: query,
    count: "5",
    safesearch: "moderate",
    text_decorations: "false",
  }).toString();
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(15_000)]);
  const response = await fetchImpl(url.href, {
    redirect: "error",
    headers: { "X-Subscription-Token": token, accept: "application/json" },
    signal: deadline,
  });
  if (!response.ok) throw new Error("search_unavailable");
  const data = (await readJson(response, 262_144, deadline)) as {
    web?: { results?: unknown };
  };
  if (!Array.isArray(data?.web?.results))
    throw new Error("invalid_search_response");
  const sources: CalligraphyEvidence[] = [];
  for (const item of data.web.results.slice(0, 5)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const url = publicSourceUrl(row.url);
    if (
      !url ||
      typeof row.title !== "string" ||
      typeof row.description !== "string"
    )
      continue;
    sources.push({
      id: `web-${sources.length + 1}`,
      title: row.title.replace(/<[^>]*>/g, "").slice(0, 180),
      url,
      text: row.description.replace(/<[^>]*>/g, "").slice(0, 800),
      kind: "web",
    });
  }
  return sources;
}
