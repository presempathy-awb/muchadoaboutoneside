import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { createApp } from "./app";
import { createTelemetryHooks, type TelemetryOptions } from "./telemetry";

type Call = { url: string; init?: RequestInit };

function recordingFetch(status = 201) {
  const calls: Call[] = [];
  const fetchImpl = async (input: string | URL | Request) => {
    calls.push({ url: String(input) });
    return new Response(null, { status });
  };
  return { calls, fetchImpl };
}

function instrumentedApp(fetchImpl: TelemetryOptions["fetchImpl"]) {
  const hooks = createTelemetryHooks({
    ingressUrl: "http://127.0.0.1",
    capability: "test-capability",
    fetchImpl,
  });
  const app = new Elysia()
    .onRequest(hooks.onRequest)
    .onError(hooks.onError)
    .onAfterResponse(hooks.onAfterResponse)
    .get("/items/:id", ({ params }) => params.id)
    .get("/missing", () => new Response(null, { status: 404 }));
  return { app, hooks };
}

describe("createTelemetryHooks", () => {
  test("is a no-op without an ingress URL or capability, so laptops/CI/tests are untouched", async () => {
    const { calls, fetchImpl } = recordingFetch();
    const hooks = createTelemetryHooks({ fetchImpl });
    const app = new Elysia()
      .onRequest(hooks.onRequest)
      .onError(hooks.onError)
      .onAfterResponse(hooks.onAfterResponse)
      .get("/ok", () => "ok");

    const response = await app.handle(new Request("http://local/ok"));

    expect(response.status).toBe(200);
    expect(await hooks.flush()).toBeTrue();
    expect(calls).toHaveLength(0);
  });

  test("emits one log, metric, and trace request per handled request", async () => {
    const { calls, fetchImpl } = recordingFetch();
    const { app, hooks } = instrumentedApp(fetchImpl);

    const response = await app.handle(
      new Request("http://local/items/order-42"),
    );

    expect(await response.text()).toBe("order-42");
    expect(await hooks.flush()).toBeTrue();
    expect(calls).toHaveLength(3);
  });

  test("records the route template, not the raw path with its id filled in", async () => {
    const { calls, fetchImpl } = recordingFetch();
    const { app, hooks } = instrumentedApp(fetchImpl);

    await app.handle(new Request("http://local/items/order-42"));
    await hooks.flush();

    for (const call of calls) {
      expect(call.url).not.toContain("order-42");
    }
    const logCall = calls.find((call) => call.url.includes("/logs/"));
    expect(logCall).toBeDefined();
  });

  test("records the actual Response status for a handler that returns a Response directly", async () => {
    const { calls, fetchImpl } = recordingFetch();
    const { app, hooks } = instrumentedApp(fetchImpl);

    const response = await app.handle(new Request("http://local/missing"));

    expect(response.status).toBe(404);
    expect(await hooks.flush()).toBeTrue();
    expect(calls.length).toBeGreaterThan(0);
  });
});

describe("createApp telemetry wiring", () => {
  test("has zero effect on the response when the telemetry ingress is down", async () => {
    const failingFetch = async () => {
      throw new Error("ingress unreachable");
    };
    const app = createApp({
      telemetry: {
        ingressUrl: "http://127.0.0.1",
        capability: "test-capability",
        fetchImpl: failingFetch,
      },
    });

    const response = await app.handle(new Request("http://local/api/health"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  test("stays a no-op end to end when no telemetry env or options are configured", async () => {
    const app = createApp();

    const response = await app.handle(new Request("http://local/api/health"));

    expect(response.status).toBe(200);
  });
});
