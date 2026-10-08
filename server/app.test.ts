import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WORKSHEET_FONT_CATALOG } from "../shared/worksheet-font-catalog";
import { createApp } from "./app";
import { project } from "./project";

const app = createApp();

describe("project API", () => {
  test("returns health and source-derived project metadata", async () => {
    const health = await app.handle(new Request("http://local/api/health"));
    expect(health.status).toBe(200);
    expect(health.headers.get("cache-control")).toBe("no-store");
    expect(await health.json()).toEqual({ status: "ok" });

    const response = await app.handle(new Request("http://local/api/project"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toEqual(project);
    expect(body.model.parts).toHaveLength(7);
    expect(
      body.model.parts.reduce(
        (total: number, part: { triangles: number }) => total + part.triangles,
        0,
      ),
    ).toBe(13_876);
    expect(body.source.conversationImported).toBe(false);
  });

  test("serves archived bytes with render and download headers", async () => {
    for (const asset of project.assets) {
      const response = await app.handle(
        new Request(`http://local${asset.url}`),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(Number(response.headers.get("content-length"))).toBe(asset.bytes);
      expect(
        new Bun.CryptoHasher("sha256")
          .update(await response.arrayBuffer())
          .digest("hex"),
      ).toBe(asset.sha256);
    }

    const glb = await app.handle(
      new Request("http://local/api/assets/snake_build.glb"),
    );
    expect(glb.headers.get("content-type")).toBe("model/gltf-binary");
    expect(glb.headers.get("content-disposition")).toBeNull();

    const html = await app.handle(
      new Request("http://local/api/assets/snake_build_viewer.html"),
    );
    expect(html.headers.get("content-disposition")).toBe(
      'attachment; filename="snake_build_viewer.html"',
    );
  });

  test("rejects unknown and traversal-shaped asset requests", async () => {
    for (const path of [
      "/api/assets/unknown.glb",
      "/api/assets/%2e%2e%2fsnake_build.glb",
      "/api/assets/%252e%252e%252fsnake_build.glb",
      "/api/missing",
    ]) {
      const response = await app.handle(new Request(`http://local${path}`));
      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
    }
  });
});

describe("shared Ollama admission", () => {
  test("assistant and photo sizing cannot start concurrent upstream workloads", async () => {
    let finishAssistant: ((response: Response) => void) | undefined;
    let assistantCalls = 0;
    let visionCalls = 0;
    const aiApp = createApp({
      calligraphyAssistant: {
        url: "http://127.0.0.1:11434",
        models: ["qwen3.5:27b"],
        searchToken: "",
        fetchImpl: async () => {
          assistantCalls++;
          return new Promise<Response>((resolve) => {
            finishAssistant = resolve;
          });
        },
      },
      worksheetVision: {
        url: "http://127.0.0.1:11434",
        models: ["qwen3.5:27b"],
        fetchImpl: async () => {
          visionCalls++;
          return Response.json({});
        },
      },
    });
    const assistantRequest = new Request(
      "http://local/api/worksheet/assistant",
      {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1:5173",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          kind: "chat",
          question: "How should I practise italic?",
          model: "qwen3.5:27b",
          web: false,
          history: [],
        }),
      },
    );
    const first = aiApp.handle(assistantRequest);
    for (let count = 0; count < 30 && !finishAssistant; count++)
      await Promise.resolve();
    expect(assistantCalls).toBe(1);

    const png = Buffer.alloc(32);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
    png.writeUInt32BE(200, 16);
    png.writeUInt32BE(100, 20);
    const vision = await aiApp.handle(
      new Request("http://local/api/worksheet/vision", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1:5173",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          dataUrl: `data:image/png;base64,${png.toString("base64")}`,
          pixelWidth: 200,
          pixelHeight: 100,
          mmPerPixel: 0.2,
        }),
      }),
    );
    expect(vision.status).toBe(429);
    expect(visionCalls).toBe(0);

    finishAssistant?.(
      Response.json({
        model: "qwen3.5:27b",
        done: true,
        message: {
          content: JSON.stringify({
            answer: "Practise slow, separate strokes.",
            citations: [],
            advice: { xHeightMm: null, rowGapMm: null },
          }),
        },
      }),
    );
    expect((await first).status).toBe(200);
  });
});

describe("production static site", () => {
  let staticDir: string;

  beforeAll(async () => {
    staticDir = await mkdtemp(join(tmpdir(), "much-ado-static-"));
    await writeFile(
      join(staticDir, "index.html"),
      "<!doctype html><title>fixture app</title>",
    );
    await writeFile(
      join(staticDir, "cockpit.html"),
      "<!doctype html><title>calligraphy fixture</title>",
    );
    await writeFile(join(staticDir, "app.js"), "globalThis.fixture = true;");
    await writeFile(join(staticDir, "guide.html"), "<h1>stable guide</h1>");
    await mkdir(join(staticDir, "assets"));
    await writeFile(
      join(staticDir, "assets", "index-D4f7A9bc.js"),
      "globalThis.hashedFixture = true;",
    );
    await writeFile(
      join(staticDir, "assets", "stable.js"),
      "globalThis.stableFixture = true;",
    );
    await writeFile(
      join(staticDir, "assets", "hb-Abc12345.wasm"),
      new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]),
    );
    await writeFile(
      join(staticDir, "assets", "script-Abc12345.woff2"),
      new Uint8Array([119, 79, 70, 50]),
    );
    await mkdir(join(staticDir, "fabrication"));
    await mkdir(join(staticDir, "fonts"));
    await writeFile(
      join(staticDir, "fonts", "GreatVibes-Regular.ttf"),
      "font fixture",
    );
    await writeFile(join(staticDir, "fabrication", "fresh.zip"), "fresh zip");
  });

  afterAll(async () => {
    await rm(staticDir, { recursive: true, force: true });
  });

  test("the calligraphy hostname selects its targeted SPA while sharing the existing API", async () => {
    const app = createApp({ staticDir });
    const cockpit = await app.handle(
      new Request("https://hotgoddesshotpen.muchadoaboutoneside.com/", {
        headers: { host: "hotgoddesshotpen.muchadoaboutoneside.com" },
      }),
    );
    expect(await cockpit.text()).toContain(
      "<title>calligraphy fixture</title>",
    );
    const original = await app.handle(
      new Request("https://muchadoaboutoneside.com/", {
        headers: { host: "muchadoaboutoneside.com" },
      }),
    );
    expect(await original.text()).toContain("<title>fixture app</title>");
    const health = await app.handle(
      new Request(
        "https://hotgoddesshotpen.muchadoaboutoneside.com/api/health",
      ),
    );
    expect(await health.json()).toEqual({ status: "ok" });
    const pipeline = await app.handle(
      new Request(
        "https://hotgoddesshotpen.muchadoaboutoneside.com/api/worksheet/glyph-jobs",
      ),
    );
    expect(await pipeline.json()).toEqual({ available: false, profiles: [] });
  });

  test("only caches a curated TTF immutably when its exact digest is requested", async () => {
    const font = WORKSHEET_FONT_CATALOG[0];
    const staticApp = createApp({ staticDir });
    for (const [query, expectedCache] of [
      [`?sha256=${font.sha256}`, "public, max-age=31536000, immutable"],
      ["", "no-store"],
      [`?v=${font.sha256}`, "no-store"],
      [`?sha256=${"0".repeat(64)}`, "no-store"],
    ] as const) {
      const response = await staticApp.handle(
        new Request(`http://local${font.path}${query}`),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("font/ttf");
      expect(response.headers.get("cache-control")).toBe(expectedCache);
    }
    const html = await staticApp.handle(
      new Request(`http://local/guide.html?sha256=${font.sha256}`),
    );
    expect(html.headers.get("cache-control")).toBe("no-store");
  });

  test.each([
    ["hb-Abc12345.wasm", "application/wasm", 8],
    ["script-Abc12345.woff2", "font/woff2", 4],
  ])(
    "serves lazy typography asset %s with the correct MIME",
    async (name, type, bytes) => {
      const response = await createApp({ staticDir }).handle(
        new Request(`http://local/assets/${name}`),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(type);
      expect(response.headers.get("cache-control")).toBe(
        "public, max-age=31536000, immutable",
      );
      expect((await response.arrayBuffer()).byteLength).toBe(bytes);
    },
  );

  test("serves static files and falls back to the SPA for client routes", async () => {
    const staticApp = createApp({ staticDir });
    const script = await staticApp.handle(new Request("http://local/app.js"));
    expect(script.status).toBe(200);
    expect(script.headers.get("content-type")).toBe(
      "text/javascript; charset=utf-8",
    );
    expect(await script.text()).toContain("fixture");
    expect(script.headers.get("cache-control")).toBe("no-store");

    const zip = await staticApp.handle(
      new Request("http://local/fabrication/fresh.zip?v=abc123"),
    );
    expect(zip.status).toBe(200);
    expect(zip.headers.get("content-type")).toBe("application/zip");
    expect(zip.headers.get("cache-control")).toBe("no-store");

    const stableHtml = await staticApp.handle(
      new Request("http://local/guide.html?v=abc123"),
    );
    expect(stableHtml.status).toBe(200);
    expect(stableHtml.headers.get("cache-control")).toBe("no-store");

    const hashedEntry = await staticApp.handle(
      new Request("http://local/assets/index-D4f7A9bc.js"),
    );
    expect(hashedEntry.status).toBe(200);
    expect(hashedEntry.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );

    const unhashedAsset = await staticApp.handle(
      new Request("http://local/assets/stable.js"),
    );
    expect(unhashedAsset.status).toBe(200);
    expect(unhashedAsset.headers.get("cache-control")).toBe("no-store");

    const route = await staticApp.handle(
      new Request("http://local/model/ribs"),
    );
    expect(route.status).toBe(200);
    expect(await route.text()).toContain("fixture app");

    for (const path of ["/", "/assets"]) {
      const directoryRoute = await staticApp.handle(
        new Request(`http://local${path}`),
      );
      expect(directoryRoute.status).toBe(200);
      expect(await directoryRoute.text()).toContain("fixture app");
      expect(directoryRoute.headers.get("cache-control")).toBe("no-store");
    }

    const missingApi = await staticApp.handle(
      new Request("http://local/api/nope"),
    );
    expect(missingApi.status).toBe(404);
    expect(await missingApi.text()).not.toContain("fixture app");

    const missingAsset = await staticApp.handle(
      new Request("http://local/missing.js"),
    );
    expect(missingAsset.status).toBe(404);
    expect(await missingAsset.text()).not.toContain("fixture app");

    const missingAssetWithQuery = await staticApp.handle(
      new Request("http://local/missing.js?v=abc123"),
    );
    expect(missingAssetWithQuery.status).toBe(404);
    expect(missingAssetWithQuery.headers.get("cache-control")).toBe("no-store");
    expect(await missingAssetWithQuery.text()).not.toContain("fixture app");

    const encodedTraversal = await staticApp.handle(
      new Request("http://local/%2e%2e%2foutside"),
    );
    expect(encodedTraversal.status).toBe(404);
    expect(await encodedTraversal.text()).not.toContain("fixture app");
  });
});
