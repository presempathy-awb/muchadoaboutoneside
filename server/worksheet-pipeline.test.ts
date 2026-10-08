import { expect, test } from "bun:test";
import { createWorksheetPipelineRoute } from "./worksheet-pipeline";

const profile = {
  id: "test-profile",
  label: "Qwen + VecGlypher",
  styleModel: "qwen3.5:27b",
  generatorModel: "vec-test",
  reviewModel: "qwen3.5:27b",
  maxRounds: 3,
};
const base = "https://muchadoaboutoneside.com/api/worksheet/glyph-jobs";
function request(
  body: unknown,
  origin = "https://muchadoaboutoneside.com",
): Request {
  return new Request(base, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const input = {
  key: "00000000-0000-4000-8000-000000000001",
  profile: profile.id,
  glyph: "a",
  style: "Fine italic hairlines",
  rounds: 2,
};
const jobId = "4d42769d-1dfc-43bc-aa49-0ba13cb97c7c";

test("pipeline stays disabled without a registered server-only caller configuration", async () => {
  const route = createWorksheetPipelineRoute();
  expect(route.capability.available).toBe(false);
  expect((await route.submit(request(input))).status).toBe(503);
});

test("a canceled upload releases the named submission slot without replacing its request key", async () => {
  const route = createWorksheetPipelineRoute({
    url: "http://127.0.0.1:9000",
    token: "fixture-only-not-a-credential",
    profiles: [profile],
    fetchImpl: async () =>
      Response.json(
        { data: { job_id: jobId, state: "accepted" } },
        { status: 202 },
      ),
  });
  const controller = new AbortController();
  let stream!: ReadableStreamDefaultController<Uint8Array>;
  const upload = new Request(base, {
    method: "POST",
    headers: {
      origin: "https://muchadoaboutoneside.com",
      "content-type": "application/json",
    },
    signal: controller.signal,
    body: new ReadableStream<Uint8Array>({
      start(value) {
        stream = value;
      },
    }),
  });
  const pending = route.submit(upload);
  controller.abort();
  const deadline = AbortSignal.timeout(1000);
  try {
    const response = await Promise.race([
      pending,
      new Promise<Response>((_, reject) =>
        deadline.addEventListener(
          "abort",
          () => reject(new Error("Canceled upload retained submission slot")),
          { once: true },
        ),
      ),
    ]);
    expect(response.status).toBe(400);
    expect((await route.submit(request(input))).status).toBe(202);
  } finally {
    if (upload.body?.locked) stream.close();
    await pending;
  }
});

test("submission retains idempotency and isolates result access with an expiring signed job capability", async () => {
  let clock = 1000;
  const sent: { url: string; init?: RequestInit }[] = [];
  const route = createWorksheetPipelineRoute({
    url: "http://127.0.0.1:9000",
    token: "fixture-only-not-a-credential",
    profiles: [profile],
    now: () => clock,
    fetchImpl: async (url, init) => {
      sent.push({ url, init });
      return Response.json(
        { data: { job_id: jobId, state: "accepted" } },
        { status: 202 },
      );
    },
  });
  const response = await route.submit(request(input));
  expect(response.status).toBe(202);
  const result = await response.json();
  expect(JSON.stringify(result)).not.toContain("fixture-only");
  expect(new Headers(sent[0]?.init?.headers).get("Idempotency-Key")).toBe(
    input.key,
  );
  expect(JSON.parse(String(sent[0]?.init?.body))).toEqual({
    work_type: "calligraphy-glyph-v1",
    input: {
      pipeline: profile.id,
      glyph: "a",
      style: input.style,
      width: 1000,
      height: 1000,
      rounds: 2,
    },
  });
  const count = sent.length;
  expect(
    (
      await route.query(
        request({
          access: `${result.access.slice(0, -1)}x`,
          resource: "progress",
        }),
      )
    ).status,
  ).toBe(404);
  expect(sent.length).toBe(count);
  clock += 86_400_001;
  expect(
    (
      await route.query(
        request({ access: result.access, resource: "progress" }),
      )
    ).status,
  ).toBe(404);
  expect(sent.length).toBe(count);
});

test("request rejects unknown profiles, remote origins, malformed letters and arbitrary model routing", async () => {
  let calls = 0;
  const route = createWorksheetPipelineRoute({
    url: "http://127.0.0.1:9000",
    token: "fixture-only-not-a-credential",
    profiles: [profile],
    fetchImpl: async () => {
      calls++;
      return Response.json({});
    },
  });
  for (const body of [
    { ...input, profile: "missing" },
    { ...input, glyph: "ab" },
    { ...input, rounds: 4 },
    { ...input, style: "x".repeat(2049) },
    { ...input, model: "download-this" },
  ])
    expect((await route.submit(request(body))).status).toBe(400);
  expect(
    (await route.submit(request(input, "https://other.example"))).status,
  ).toBe(403);
  expect(calls).toBe(0);
  expect(() =>
    createWorksheetPipelineRoute({
      url: "https://other.example",
      token: "fixture",
      profiles: [profile],
    }),
  ).toThrow();
});

test("accepted artifacts are bound to the submitted letter and validated before returning", async () => {
  let artifact: unknown = {
    accepted: true,
    round: 1,
    profile: profile.id,
    glyph: "a",
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><path d="M0 0 L20 20 Z"/></svg>',
    feedback: "",
    measurements: null,
    models: {
      style: profile.styleModel,
      generate: profile.generatorModel,
      review: profile.reviewModel,
    },
  };
  const route = createWorksheetPipelineRoute({
    url: "http://127.0.0.1:9000",
    token: "fixture-only-not-a-credential",
    profiles: [profile],
    fetchImpl: async (url) =>
      Response.json(
        {
          data: url.endsWith("/v1/jobs")
            ? { job_id: jobId, state: "accepted" }
            : artifact,
        },
        { status: url.endsWith("/v1/jobs") ? 202 : 200 },
      ),
  });
  const { access } = await (await route.submit(request(input))).json();
  expect(
    (await route.query(request({ access, resource: "result" }))).status,
  ).toBe(200);
  artifact = { ...(artifact as object), glyph: "b" };
  expect(
    (await route.query(request({ access, resource: "result" }))).status,
  ).toBe(502);
  artifact = {
    ...(artifact as object),
    glyph: "a",
    svg: "<svg><script>alert(1)</script></svg>",
  };
  expect(
    (await route.query(request({ access, resource: "result" }))).status,
  ).toBe(502);
});

test("progress preserves durable holds and cancel targets only the signed job", async () => {
  let resource = "";
  let progress: unknown = {
    profile: profile.id,
    job: {
      job_id: jobId,
      state: "held",
      reconciliation_required: true,
      error_code: "uncertain_step",
    },
    steps: [
      {
        ordinal: 1,
        step_name: "style",
        model: profile.styleModel,
        state: "ambiguous",
      },
    ],
  };
  const route = createWorksheetPipelineRoute({
    url: "http://127.0.0.1:9000",
    token: "fixture-only-not-a-credential",
    profiles: [profile],
    fetchImpl: async (url, init) => {
      resource = url;
      if (url.endsWith("/v1/jobs"))
        return Response.json(
          { data: { job_id: jobId, state: "accepted" } },
          { status: 202 },
        );
      if (url.endsWith("/cancel")) {
        expect(init?.method).toBe("POST");
        return Response.json({ data: { job_id: jobId, state: "canceled" } });
      }
      return Response.json({ data: progress });
    },
  });
  const { access } = await (await route.submit(request(input))).json();
  const held = await route.query(request({ access, resource: "progress" }));
  expect(await held.json()).toEqual({
    state: "held",
    reconciliationRequired: true,
    errorCode: "uncertain_step",
    steps: [
      {
        ordinal: 1,
        name: "style",
        model: profile.styleModel,
        state: "ambiguous",
        errorCode: "",
      },
    ],
  });
  expect(
    (await route.query(request({ access, resource: "cancel" }))).status,
  ).toBe(200);
  expect(resource).toBe(`http://127.0.0.1:9000/v1/jobs/${jobId}/cancel`);
  progress = {
    profile: profile.id,
    job: { job_id: jobId, state: "running" },
    steps: [
      {
        ordinal: 1,
        step_name: "style",
        model: profile.generatorModel,
        state: "completed",
      },
    ],
  };
  expect(
    (await route.query(request({ access, resource: "progress" }))).status,
  ).toBe(502);
  progress = {
    profile: profile.id,
    job: { job_id: jobId, state: "running" },
    steps: [
      {
        ordinal: 6,
        step_name: "generate-3",
        model: profile.generatorModel,
        state: "completed",
      },
    ],
  };
  expect(
    (await route.query(request({ access, resource: "progress" }))).status,
  ).toBe(502);
});

test("uncertain submission can retry the same key after the submission limit without automatic model replay", async () => {
  let clock = 1000;
  const keys: string[] = [];
  const route = createWorksheetPipelineRoute({
    url: "http://127.0.0.1:9000",
    token: "fixture-only-not-a-credential",
    profiles: [profile],
    now: () => clock,
    fetchImpl: async (_, init) => {
      keys.push(new Headers(init?.headers).get("Idempotency-Key") ?? "");
      if (keys.length === 1) throw new Error("fixture connection lost");
      return Response.json(
        { data: { job_id: jobId, state: "accepted" } },
        { status: 202 },
      );
    },
  });
  expect((await route.submit(request(input))).status).toBe(502);
  expect((await route.submit(request(input))).status).toBe(429);
  expect(keys).toEqual([input.key]);
  clock += 30_000;
  expect((await route.submit(request(input))).status).toBe(202);
  expect(keys).toEqual([input.key, input.key]);
});
