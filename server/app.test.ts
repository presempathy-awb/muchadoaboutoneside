import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app";
import { project } from "./project";

const app = createApp();

describe("project API", () => {
  test("returns health and source-derived project metadata", async () => {
    const health = await app.handle(new Request("http://local/api/health"));
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });

    const response = await app.handle(new Request("http://local/api/project"));
    expect(response.status).toBe(200);
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

describe("production static site", () => {
  let staticDir: string;

  beforeAll(async () => {
    staticDir = await mkdtemp(join(tmpdir(), "much-ado-static-"));
    await writeFile(
      join(staticDir, "index.html"),
      "<!doctype html><title>fixture app</title>",
    );
    await writeFile(join(staticDir, "app.js"), "globalThis.fixture = true;");
    await mkdir(join(staticDir, "assets"));
  });

  afterAll(async () => {
    await rm(staticDir, { recursive: true, force: true });
  });

  test("serves static files and falls back to the SPA for client routes", async () => {
    const staticApp = createApp({ staticDir });
    const script = await staticApp.handle(new Request("http://local/app.js"));
    expect(script.status).toBe(200);
    expect(script.headers.get("content-type")).toBe(
      "text/javascript; charset=utf-8",
    );
    expect(await script.text()).toContain("fixture");

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

    const encodedTraversal = await staticApp.handle(
      new Request("http://local/%2e%2e%2foutside"),
    );
    expect(encodedTraversal.status).toBe(404);
    expect(await encodedTraversal.text()).not.toContain("fixture app");
  });
});
