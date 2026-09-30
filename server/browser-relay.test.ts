import { describe, expect, test } from "bun:test";
import { createBrowserRelayRoute } from "./browser-relay";

const RELAY_URL = "http://local/api/telemetry/relay";
const SAME_ORIGIN = "http://local";

function relayRequest(
  body: unknown,
  init: { origin?: string | null; xForwardedFor?: string } = {},
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (init.origin !== null) headers.origin = init.origin ?? SAME_ORIGIN;
  if (init.xForwardedFor) headers["x-forwarded-for"] = init.xForwardedFor;
  return new Request(RELAY_URL, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function relayMessage(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "telpher.browser.telemetry.relay.v1",
    run_id: "run-1",
    event_class: "ui.click",
    timestamp_unix_ms: 1_700_000_000_000,
    telemetry_signal: "logs",
    event_id: "evt-1",
    message: "one",
    ...overrides,
  };
}

describe("createBrowserRelayRoute", () => {
  test("is a no-op without an ingress URL or capability", async () => {
    const route = createBrowserRelayRoute({});

    const response = await route.handle(relayRequest(relayMessage()));

    expect(response.status).toBe(404);
  });

  test("forwards a valid same-origin request with the server's capability", async () => {
    const calls: string[] = [];
    const route = createBrowserRelayRoute({
      ingressUrl: "http://127.0.0.1",
      capability: "test-capability",
      fetchImpl: async (input) => {
        calls.push(String(input));
        return new Response(null, { status: 201 });
      },
    });

    const response = await route.handle(relayRequest(relayMessage()));

    expect(response.status).toBe(202);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/logs/");
  });

  test("rejects a request whose Origin does not exactly match this host", async () => {
    const route = createBrowserRelayRoute({
      ingressUrl: "http://127.0.0.1",
      capability: "test-capability",
      fetchImpl: async () => new Response(null, { status: 201 }),
    });

    const crossOrigin = await route.handle(
      relayRequest(relayMessage(), { origin: "http://evil.invalid" }),
    );
    const missingOrigin = await route.handle(
      relayRequest(relayMessage(), { origin: null }),
    );

    expect(crossOrigin.status).toBe(403);
    expect(missingOrigin.status).toBe(403);
  });

  test("rate-limits a client after it exceeds its per-minute allowance", async () => {
    let now = 0;
    const route = createBrowserRelayRoute({
      ingressUrl: "http://127.0.0.1",
      capability: "test-capability",
      fetchImpl: async () => new Response(null, { status: 201 }),
      now: () => now,
      ratePerMinute: 2,
    });
    const req = () =>
      relayRequest(relayMessage(), { xForwardedFor: "203.0.113.9" });

    expect((await route.handle(req())).status).toBe(202);
    expect((await route.handle(req())).status).toBe(202);
    const limited = await route.handle(req());

    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");

    now += 60_000;
    expect((await route.handle(req())).status).toBe(202);
  });

  test("rate-limits per client, not globally", async () => {
    const route = createBrowserRelayRoute({
      ingressUrl: "http://127.0.0.1",
      capability: "test-capability",
      fetchImpl: async () => new Response(null, { status: 201 }),
      ratePerMinute: 1,
    });

    const first = await route.handle(
      relayRequest(relayMessage(), { xForwardedFor: "203.0.113.1" }),
    );
    const second = await route.handle(
      relayRequest(relayMessage(), { xForwardedFor: "203.0.113.2" }),
    );

    expect(first.status).toBe(202);
    expect(second.status).toBe(202);
  });

  test("caps request body size", async () => {
    const route = createBrowserRelayRoute({
      ingressUrl: "http://127.0.0.1",
      capability: "test-capability",
      fetchImpl: async () => new Response(null, { status: 201 }),
    });

    const oversized = "x".repeat(70 * 1024);
    const response = await route.handle(
      relayRequest(relayMessage({ message: oversized })),
    );

    expect(response.status).toBe(413);
  });
});
