/**
 * Same-origin browser telemetry relay. The browser client never holds the
 * Zenoh capability (see server/telemetry.ts); it POSTs bounded, validated
 * events here and this forwards them with the server's own capability.
 * A complete no-op unless TELPHER_TELEMETRY_INGRESS_URL/CAPABILITY resolve.
 */
import { createBrowserZenohRelay } from "@telpher/zotel-js-zenoh-bun";

type FetchImpl = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface BrowserRelayOptions {
  /** Overrides process.env.TELPHER_TELEMETRY_INGRESS_URL for tests. */
  ingressUrl?: string;
  /** Overrides process.env.TELPHER_TELEMETRY_INGRESS_CAPABILITY for tests. */
  capability?: string;
  fetchImpl?: FetchImpl;
  now?: () => number;
  /** Requests allowed per client per rolling minute; defaults to 60. */
  ratePerMinute?: number;
}

export interface BrowserRelayRoute {
  handle: (request: Request) => Promise<Response>;
}

const noopRoute: BrowserRelayRoute = {
  async handle() {
    return Response.json({ error: "telemetry_disabled" }, { status: 404 });
  },
};

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export function createBrowserRelayRoute(
  options: BrowserRelayOptions = {},
): BrowserRelayRoute {
  const ingressUrl =
    options.ingressUrl ?? process.env.TELPHER_TELEMETRY_INGRESS_URL?.trim();
  const capability =
    options.capability ??
    process.env.TELPHER_TELEMETRY_INGRESS_CAPABILITY?.trim();
  if (!ingressUrl || !capability) return noopRoute;

  const relay = createBrowserZenohRelay({
    serviceName: "muchadoaboutoneside",
    ingressUrl,
    capability,
    scope: "prod",
    site: "presvd1",
    node: "muchadoaboutoneside",
    fetchImpl: options.fetchImpl,
  });

  const now = options.now ?? Date.now;
  const ratePerMinute = options.ratePerMinute ?? 60;
  const windowMs = 60_000;
  // Bounded by unique client count for a small internal tool; entries for
  // clients that stop visiting are never evicted, which is an acceptable
  // trade for staying a plain in-memory counter here.
  const hits = new Map<string, { windowStart: number; count: number }>();

  const rateLimited = (key: string): boolean => {
    const current = now();
    const entry = hits.get(key);
    if (entry === undefined || current - entry.windowStart >= windowMs) {
      hits.set(key, { windowStart: current, count: 1 });
      return false;
    }
    entry.count += 1;
    return entry.count > ratePerMinute;
  };

  return {
    handle: async (request) => {
      // Exact same-origin check: the Origin header must match this request's
      // own origin exactly. No wildcard, no allowlist of other hosts.
      const origin = request.headers.get("origin");
      if (origin !== new URL(request.url).origin) {
        return Response.json({ error: "origin_mismatch" }, { status: 403 });
      }
      if (rateLimited(clientKey(request))) {
        return Response.json(
          { error: "rate_limited" },
          { status: 429, headers: { "retry-after": "60" } },
        );
      }
      return relay.handle(request);
    },
  };
}
