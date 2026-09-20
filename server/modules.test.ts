import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import * as awarenessProtocol from "y-protocols/awareness";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";
import { createApp } from "./app";
import { loadWebModule, MODULE_TEXT_NAME } from "./modules";
import { PostgresPrefsStore } from "./prefs";
import { MemoryRoomStore, PostgresRoomStore } from "./room-store";

const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()?.();
});

// The live database, if any, is only for the one test that asks for it.
// Everything else must never build a store from the environment.
const liveDatabase = {
  url: process.env.EREBE_DATABASE_URL,
  caFile: process.env.EREBE_DATABASE_CA_FILE,
  serverName: process.env.EREBE_DATABASE_SERVER_NAME,
};
process.env.EREBE_DATABASE_URL = "";

async function moduleDir() {
  const dir = await mkdtemp(resolve(tmpdir(), "muchado-module-"));
  cleanups.push(() => rm(dir, { recursive: true, force: true }));
  await mkdir(resolve(dir, "dist"), { recursive: true });
  await writeFile(resolve(dir, "dist/index.html"), "<h1>Erebe</h1>");
  await writeFile(
    resolve(dir, "rooms.json"),
    JSON.stringify({ "erebe-notes": { text: "Bring straps.\n" } }),
  );
  return dir;
}

async function startApp(dir: string) {
  const erebe = await loadWebModule({ name: "erebe", host: "erebe.test", dir });
  const app = createApp({ modules: [erebe] }).listen({
    hostname: "127.0.0.1",
    port: 0,
  });
  const port = app.server?.port;
  if (!port) throw new Error("Server did not start");
  let stopped: Promise<unknown> | undefined;
  const stop = () => {
    stopped ??= app.stop(true);
    return stopped.then(() => undefined);
  };
  cleanups.push(stop);
  return { origin: `http://127.0.0.1:${port}`, stop };
}

function join(origin: string, room: string) {
  const doc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(doc);
  const provider = new WebsocketProvider(
    `${origin.replace("http", "ws")}/api/modules/erebe/rooms`,
    room,
    doc,
    { awareness, disableBc: true, WebSocketPolyfill: WebSocket },
  );
  cleanups.push(() => provider.destroy());
  const synced = new Promise<void>((done) =>
    provider.once("sync", () => done()),
  );
  return { doc, text: doc.getText(MODULE_TEXT_NAME), synced };
}

function waitFor(condition: () => boolean, timeoutMs = 3000) {
  return new Promise<void>((done, fail) => {
    const started = Date.now();
    const tick = () => {
      if (condition()) return done();
      if (Date.now() - started > timeoutMs) return fail(new Error("Timed out"));
      setTimeout(tick, 10);
    };
    tick();
  });
}

describe("web modules", () => {
  test("serves its pages for its host only and leaves the main site alone", async () => {
    const { origin } = await startApp(await moduleDir());
    const forErebe = await fetch(`${origin}/`, {
      headers: { host: "erebe.test" },
    });
    expect(forErebe.status).toBe(200);
    expect(await forErebe.text()).toBe("<h1>Erebe</h1>");
    // Deep links fall back to the module's index, like the main site does.
    expect(
      (await fetch(`${origin}/tasks`, { headers: { host: "erebe.test" } }))
        .status,
    ).toBe(200);
    // No main static dir was configured, so the apex still has nothing.
    expect((await fetch(`${origin}/`)).status).toBe(404);
    expect(await (await fetch(`${origin}/api/collab/status`)).json()).toEqual({
      enabled: false,
      rooms: [],
    });
  });

  test("rooms are seeded, shared live, and gone when the process stops", async () => {
    const dir = await moduleDir();
    const { origin, stop } = await startApp(dir);
    expect(
      await (await fetch(`${origin}/api/modules/erebe/status`)).json(),
    ).toEqual({ enabled: true, rooms: ["erebe-notes"] });
    const first = join(origin, "erebe-notes");
    await first.synced;
    expect(first.text.toString()).toBe("Bring straps.\n");
    first.text.insert(0, "Chipper: ");
    const second = join(origin, "erebe-notes");
    await second.synced;
    await waitFor(() => second.text.toString().startsWith("Chipper: "));
    expect(second.text.toString()).toBe("Chipper: Bring straps.\n");
    const mirror = await fetch(
      `${origin}/api/modules/erebe/rooms/erebe-notes/text`,
    );
    expect(await mirror.text()).toBe("Chipper: Bring straps.\n\n");
    expect(
      (await fetch(`${origin}/api/modules/erebe/rooms/nope/text`)).status,
    ).toBe(404);
    await stop();
    expect(existsSync(resolve(dir, "erebe-notes.yjs"))).toBe(false);
  });
});

describe("module blobs from lakeFS", () => {
  const glb = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 1, 2, 3, 4, 5, 6, 7, 8]);
  const sha = createHash("sha256").update(glb).digest("hex");
  const manifest = `# generated
[[asset]]
path           = "deliveries/R05_whole/model/A.glb"
content_sha256 = "${sha}"
bytes          = ${glb.byteLength}
lane           = "lakefs"
lakefs_repo    = "erebe-assets"
lakefs_commit  = "abc123"
lakefs_path    = "deliveries/R05_whole/model/A.glb"
`;
  const lakefs = {
    endpoint: "http://lakefs.test",
    accessKeyId: "k",
    secretAccessKey: "s",
  };
  async function startWithManifest(serve: (url: string) => Response) {
    const dir = await moduleDir();
    await writeFile(resolve(dir, "asset-manifest.toml"), manifest);
    const seen: string[] = [];
    const erebe = await loadWebModule({
      name: "erebe",
      host: "erebe.test",
      dir,
      lakefs,
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        seen.push(
          `${url} ${new Headers(init?.headers).get("authorization") ?? ""}`,
        );
        return serve(url);
      }) as typeof fetch,
    });
    const app = createApp({ modules: [erebe] }).listen({
      hostname: "127.0.0.1",
      port: 0,
    });
    const port = app.server?.port;
    if (!port) throw new Error("Server did not start");
    let stopped: Promise<unknown> | undefined;
    cleanups.push(() => {
      stopped ??= app.stop(true);
      return stopped.then(() => undefined);
    });
    return { origin: `http://127.0.0.1:${port}`, seen };
  }

  test("serves a manifest blob from the pinned lakeFS commit, verified and immutable", async () => {
    const { origin, seen } = await startWithManifest(() => new Response(glb));
    const res = await fetch(`${origin}/api/modules/erebe/blob/${sha}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("model/gltf-binary");
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(res.headers.get("etag")).toBe(`"${sha}"`);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(glb);
    expect(seen[0]).toContain(
      "/api/v1/repositories/erebe-assets/refs/abc123/objects?path=deliveries%2FR05_whole%2Fmodel%2FA.glb",
    );
    expect(seen[0]).toContain("Basic ");
  });

  test("refuses a tier object whose bytes do not match the manifest", async () => {
    const { origin } = await startWithManifest(
      () => new Response(new Uint8Array([9, 9, 9])),
    );
    const res = await fetch(`${origin}/api/modules/erebe/blob/${sha}`);
    expect(res.status).toBe(502);
  });

  test("unknown hashes are 404 and never reach the tier", async () => {
    const { origin, seen } = await startWithManifest(() => new Response(glb));
    expect(
      (await fetch(`${origin}/api/modules/erebe/blob/${"0".repeat(64)}`))
        .status,
    ).toBe(404);
    expect(seen).toHaveLength(0);
  });
});

describe("stored rooms", () => {
  async function startStored(store: MemoryRoomStore | PostgresRoomStore) {
    const dir = await moduleDir();
    const erebe = await loadWebModule({
      name: "erebe",
      host: "erebe.test",
      dir,
      store,
    });
    const app = createApp({ modules: [erebe] }).listen({
      hostname: "127.0.0.1",
      port: 0,
    });
    const port = app.server?.port;
    if (!port) throw new Error("Server did not start");
    let stopped: Promise<unknown> | undefined;
    const stop = () => {
      stopped ??= app.stop(true);
      return stopped.then(() => undefined);
    };
    cleanups.push(stop);
    return { origin: `http://127.0.0.1:${port}`, stop };
  }

  test("edits survive a restart through the store and the seed is not re-applied", async () => {
    const store = new MemoryRoomStore();
    const first = await startStored(store);
    const a = join(first.origin, "erebe-notes");
    await a.synced;
    a.text.insert(0, "Inani: ");
    await waitFor(
      () => (store.rooms.get("erebe-notes")?.updates.length ?? 0) > 0,
    );
    await first.stop();
    // closing compacts the log into one snapshot
    expect(store.rooms.get("erebe-notes")?.snapshot).toBeDefined();
    expect(store.rooms.get("erebe-notes")?.updates).toHaveLength(0);
    const second = await startStored(store);
    const b = join(second.origin, "erebe-notes");
    await b.synced;
    expect(b.text.toString()).toBe("Inani: Bring straps.\n");
  });

  test.skipIf(!liveDatabase.url)(
    "round-trips through the real PG18 database",
    async () => {
      const { readFile } = await import("node:fs/promises");
      const room = `test-${Date.now()}`;
      const store = new PostgresRoomStore({
        url: liveDatabase.url as string,
        ca: liveDatabase.caFile
          ? await readFile(liveDatabase.caFile, "utf8")
          : undefined,
        serverName: liveDatabase.serverName,
        prefix: "test_room",
      });
      cleanups.push(() => store.close());
      const doc = new Y.Doc();
      doc.getText("t").insert(0, "hello");
      await store.append(room, Y.encodeStateAsUpdate(doc));
      doc.getText("t").insert(5, " playa");
      await store.append(room, Y.encodeStateAsUpdate(doc));
      let stored = await store.load(room);
      expect(stored.snapshot).toBeUndefined();
      expect(stored.updates).toHaveLength(2);
      await store.snapshot(room, Y.encodeStateAsUpdate(doc));
      stored = await store.load(room);
      expect(stored.updates).toHaveLength(0);
      const back = new Y.Doc();
      Y.applyUpdate(back, stored.snapshot as Uint8Array);
      expect(back.getText("t").toString()).toBe("hello playa");
    },
  );
});

describe("per-user preferences", () => {
  async function start() {
    const dir = await moduleDir();
    const erebe = await loadWebModule({
      name: "erebe",
      host: "erebe.test",
      dir,
    });
    const app = createApp({ modules: [erebe] }).listen({
      hostname: "127.0.0.1",
      port: 0,
    });
    const port = app.server?.port;
    if (!port) throw new Error("Server did not start");
    let stopped: Promise<unknown> | undefined;
    cleanups.push(() => {
      stopped ??= app.stop(true);
      return stopped.then(() => undefined);
    });
    return `http://127.0.0.1:${port}/api/modules/erebe/prefs`;
  }

  test("a device keeps its own visual prefs, and a login claims them", async () => {
    const url = await start();
    expect((await fetch(url)).status).toBe(401);
    const device = { "x-erebe-device": "phone-abcdef123456" };
    expect(await (await fetch(url, { headers: device })).json()).toEqual({
      subject: "device:phone-abcdef123456",
      prefs: {},
    });
    const put = await fetch(url, {
      method: "PUT",
      headers: { ...device, "content-type": "application/json" },
      body: JSON.stringify({ page: "model", version: "r05-b" }),
    });
    expect(put.status).toBe(200);
    expect(
      (await (await fetch(url, { headers: device })).json()).prefs,
    ).toEqual({ page: "model", version: "r05-b" });
    // Logged in on the same device: the device's prefs move under the user.
    const user = { "x-authentik-uid": "uid-inani-0001", ...device };
    expect(await (await fetch(url, { headers: user })).json()).toEqual({
      subject: "user:uid-inani-0001",
      prefs: { page: "model", version: "r05-b" },
    });
    expect(
      (await (await fetch(url, { headers: device })).json()).prefs,
    ).toEqual({});
  });

  test("rejects non-objects and oversized bodies", async () => {
    const url = await start();
    const h = {
      "x-erebe-device": "phone-abcdef123456",
      "content-type": "application/json",
    };
    expect(
      (await fetch(url, { method: "PUT", headers: h, body: "[1,2]" })).status,
    ).toBe(400);
    expect(
      (await fetch(url, { method: "PUT", headers: h, body: "not json" }))
        .status,
    ).toBe(400);
    expect(
      (
        await fetch(url, {
          method: "PUT",
          headers: h,
          body: JSON.stringify({ big: "x".repeat(17000) }),
        })
      ).status,
    ).toBe(413);
  });
});

describe("postgres prefs store", () => {
  test("returns objects whether jsonb arrives parsed or as text", async () => {
    const rows: Record<string, unknown>[][] = [
      [],
      [{ prefs: { page: "model" } }],
      [{ prefs: JSON.stringify({ page: "erebe-notes", version: "r05-b" }) }],
    ];
    const sql = { unsafe: async () => rows.shift() ?? [] };
    const store = new PostgresPrefsStore(sql, "unit");
    expect(await store.get("device:x")).toEqual({ page: "model" });
    expect(await store.get("device:y")).toEqual({
      page: "erebe-notes",
      version: "r05-b",
    });
  });
});
