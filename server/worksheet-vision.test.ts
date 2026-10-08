import { expect, test } from "bun:test";
import { createWorksheetVisionRoute, readJson } from "./worksheet-vision";

// A PNG header is sufficient for request dimension validation; the model owns decoding.
const bytes = Buffer.alloc(32);
Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
bytes.writeUInt32BE(200, 16);
bytes.writeUInt32BE(100, 20);
const body = {
  dataUrl: `data:image/png;base64,${bytes.toString("base64")}`,
  pixelWidth: 200,
  pixelHeight: 100,
  mmPerPixel: 0.2,
};
function request(
  value: unknown = body,
  origin = "https://muchadoaboutoneside.com",
): Request {
  return new Request("https://muchadoaboutoneside.com/api/worksheet/vision", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(value),
  });
}
const result = {
  xHeightPx: 20,
  lineSpacingPx: 60,
  letterWidthPx: 10,
  confidence: "medium",
  notes: "Two clear text rows.",
};
const response = () =>
  Promise.resolve(
    Response.json({ message: { content: JSON.stringify(result) } }),
  );

test("only one upload body is buffered while the first upload is incomplete", async () => {
  const route = createWorksheetVisionRoute({
    url: "http://127.0.0.1:11434",
    fetchImpl: response,
  });
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const slow = new Request(
    "https://muchadoaboutoneside.com/api/worksheet/vision",
    {
      method: "POST",
      headers: {
        origin: "https://muchadoaboutoneside.com",
        "content-type": "application/json",
      },
      body: new ReadableStream<Uint8Array>({
        start(value) {
          controller = value;
        },
      }),
    },
  );
  const first = route.handle(slow);
  try {
    const second = request();
    expect((await route.handle(second)).status).toBe(429);
    expect(second.bodyUsed).toBe(false);
  } finally {
    controller.enqueue(new TextEncoder().encode(JSON.stringify(body)));
    controller.close();
    await first;
  }
});

test("aborted body reads release their reader", async () => {
  const controller = new AbortController();
  let stream!: ReadableStreamDefaultController<Uint8Array>;
  const message = new Response(
    new ReadableStream<Uint8Array>({
      start(value) {
        stream = value;
      },
    }),
  );
  const pending = readJson(message, 100, controller.signal);
  controller.abort();
  const deadline = AbortSignal.timeout(1000);
  try {
    await expect(
      Promise.race([
        pending,
        new Promise((_, reject) =>
          deadline.addEventListener(
            "abort",
            () => reject(new Error("Body read ignored cancellation")),
            { once: true },
          ),
        ),
      ]),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(message.body?.locked).toBe(false);
  } finally {
    if (message.body?.locked) stream.close();
  }
});

test("cooldown rejects a new body before decoding or reading another image", async () => {
  const route = createWorksheetVisionRoute({
    url: "http://127.0.0.1:11434",
    models: ["qwen3.5:27b"],
    now: () => 1000,
    fetchImpl: response,
  });
  expect((await route.handle(request())).status).toBe(200);
  const second = new Request(
    "https://muchadoaboutoneside.com/api/worksheet/vision",
    {
      method: "POST",
      headers: {
        origin: "https://muchadoaboutoneside.com",
        "content-type": "application/json",
      },
      body: "malformed JSON",
    },
  );
  expect((await route.handle(second)).status).toBe(429);
  expect(second.bodyUsed).toBe(false);
});

test("photo sizing selects only an operator-registered vision model", async () => {
  const route = createWorksheetVisionRoute({
    url: "http://127.0.0.1:11434",
    models: ["qwen3.5:27b", "qwen3.5:9b"],
    fetchImpl: async (_input, init) => {
      const submitted = JSON.parse(String(init?.body));
      // The response changes with the model actually sent to the runtime.
      return Response.json({
        message: {
          content: JSON.stringify({
            ...result,
            xHeightPx: submitted.model === "qwen3.5:9b" ? 15 : 20,
          }),
        },
      });
    },
  });
  expect(route.models).toEqual(["qwen3.5:27b", "qwen3.5:9b"]);
  expect(
    (await route.handle(request({ ...body, model: "unregistered" }))).status,
  ).toBe(400);
  const reply = await route.handle(request({ ...body, model: "qwen3.5:9b" }));
  expect(reply.status).toBe(200);
  expect((await reply.json()).xHeightMm).toBe(3);
  expect(() =>
    createWorksheetVisionRoute({ models: ["https://other.example"] }),
  ).toThrow();
  expect(() => createWorksheetVisionRoute({ models: [] })).toThrow();
});

test("vision measurements use calibrated physical scale and reject invalid input before inference", async () => {
  const route = createWorksheetVisionRoute({
    url: "http://127.0.0.1:11434",
    fetchImpl: response,
  });
  expect(
    (await route.handle(request({ ...body, pixelWidth: 999 }))).status,
  ).toBe(400);
  expect((await route.handle(request({ ...body, mmPerPixel: 0 }))).status).toBe(
    400,
  );
  expect(
    (await route.handle(request(body, "https://other.example"))).status,
  ).toBe(403);
  expect(
    (
      await route.handle(
        request({ ...body, dataUrl: "https://other.example/photo.png" }),
      )
    ).status,
  ).toBe(400);
  const reply = await route.handle(request());
  expect(reply.status).toBe(200);
  expect(await reply.json()).toEqual({
    xHeightMm: 4,
    lineSpacingMm: 12,
    letterWidthMm: 2,
    confidence: "medium",
    notes: result.notes,
  });
  expect(reply.headers.get("cache-control")).toBe("no-store");
  expect((await route.handle(request())).status).toBe(429);
});

test("vision rejects malformed model output and disabled routes cannot infer", async () => {
  const invalid = createWorksheetVisionRoute({
    url: "http://127.0.0.1:11434",
    fetchImpl: async () =>
      Response.json({
        message: { content: JSON.stringify({ ...result, xHeightPx: -20 }) },
      }),
  });
  expect((await invalid.handle(request())).status).toBe(422);
  expect(
    (await createWorksheetVisionRoute({ url: "" }).handle(request())).status,
  ).toBe(503);
});

test("vision constrains notes to the same bound enforced on model output", async () => {
  let payload: Record<string, unknown> = {};
  const route = createWorksheetVisionRoute({
    url: "http://127.0.0.1:11434",
    fetchImpl: async (_url, init) => {
      payload = JSON.parse(String(init?.body));
      return response();
    },
  });
  expect((await route.handle(request())).status).toBe(200);
  const format = payload.format as {
    properties?: { notes?: { maxLength?: number } };
  };
  const messages = payload.messages as Array<{ content?: string }>;
  expect(format.properties?.notes?.maxLength).toBe(500);
  expect(messages[1]?.content).toContain("at most 500 characters");

  const oversized = createWorksheetVisionRoute({
    url: "http://127.0.0.1:11434",
    fetchImpl: async () =>
      Response.json({
        message: {
          content: JSON.stringify({ ...result, notes: "x".repeat(501) }),
        },
      }),
  });
  expect((await oversized.handle(request())).status).toBe(422);
});

test("only one inference can run and upstream failures release the slot", async () => {
  let finish: ((value: Response) => void) | undefined;
  let now = 0;
  const route = createWorksheetVisionRoute({
    url: "http://127.0.0.1:11434",
    now: () => now,
    fetchImpl: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const first = route.handle(request());
  for (let count = 0; count < 30 && !finish; count++) await Promise.resolve();
  expect(finish).toBeDefined();
  expect((await route.handle(request())).status).toBe(429);
  finish?.(new Response("Unavailable", { status: 500 }));
  expect((await first).status).toBe(502);
  now = 60_000;
  const next = route.handle(request());
  for (let count = 0; count < 30; count++) await Promise.resolve();
  finish?.(await response());
  expect((await next).status).toBe(200);
});
