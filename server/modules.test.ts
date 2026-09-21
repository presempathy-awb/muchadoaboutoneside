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
  async function startWithManifest(
    serve: (url: string) => Response,
    fallback: { local?: Uint8Array; tier?: boolean } = {},
  ) {
    const dir = await moduleDir();
    await writeFile(resolve(dir, "asset-manifest.toml"), manifest);
    let assetsDir: string | undefined;
    if (fallback.local) {
      assetsDir = await mkdtemp(resolve(tmpdir(), "muchado-assets-"));
      const root = assetsDir;
      cleanups.push(() => rm(root, { recursive: true, force: true }));
      await mkdir(resolve(root, "deliveries/R05_whole/model"), {
        recursive: true,
      });
      await writeFile(
        resolve(root, "deliveries/R05_whole/model/A.glb"),
        fallback.local,
      );
    }
    const seen: string[] = [];
    const erebe = await loadWebModule({
      name: "erebe",
      host: "erebe.test",
      dir,
      lakefs: fallback.tier === false ? undefined : lakefs,
      assetsDir,
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

  test("falls back to the filesystem when the tier is unreachable", async () => {
    const { origin } = await startWithManifest(
      () => {
        throw new Error("connect ECONNREFUSED");
      },
      { local: glb },
    );
    const res = await fetch(`${origin}/api/modules/erebe/blob/${sha}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-content-source")).toBe("filesystem");
    expect(res.headers.get("etag")).toBe(`"${sha}"`);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(glb);
  });

  test("falls back when the tier answers with an error or the wrong bytes", async () => {
    const down = await startWithManifest(
      () => new Response("no", { status: 503 }),
      { local: glb },
    );
    const wrong = await startWithManifest(
      () => new Response(new Uint8Array([9, 9, 9])),
      { local: glb },
    );
    for (const { origin } of [down, wrong]) {
      const res = await fetch(`${origin}/api/modules/erebe/blob/${sha}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("x-content-source")).toBe("filesystem");
    }
  });

  test("serves from the filesystem with no tier configured, and prefers the tier when it works", async () => {
    const noTier = await startWithManifest(() => new Response(glb), {
      local: glb,
      tier: false,
    });
    const res = await fetch(`${noTier.origin}/api/modules/erebe/blob/${sha}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-content-source")).toBe("filesystem");
    expect(noTier.seen).toHaveLength(0);

    const both = await startWithManifest(() => new Response(glb), {
      local: glb,
    });
    expect(
      (await fetch(`${both.origin}/api/modules/erebe/blob/${sha}`)).headers.get(
        "x-content-source",
      ),
    ).toBe("lakefs");
  });

  test("never serves a local file that does not match the manifest", async () => {
    const sameSize = new Uint8Array(glb);
    sameSize[11] = 0xff;
    for (const local of [sameSize, new Uint8Array([1, 2, 3])]) {
      const { origin } = await startWithManifest(
        () => new Response("no", { status: 503 }),
        { local },
      );
      const res = await fetch(`${origin}/api/modules/erebe/blob/${sha}`);
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: "Content tier returned 503" });
    }
  });

  test("is 503 with neither a tier nor a fallback directory", async () => {
    const { origin } = await startWithManifest(() => new Response(glb), {
      tier: false,
    });
    expect(
      (await fetch(`${origin}/api/modules/erebe/blob/${sha}`)).status,
    ).toBe(503);
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

  test("with no database, a state directory carries edits and prefs across a restart", async () => {
    const stateDir = await mkdtemp(resolve(tmpdir(), "muchado-state-"));
    cleanups.push(() => rm(stateDir, { recursive: true, force: true }));
    const start = async () => {
      const erebe = await loadWebModule({
        name: "erebe",
        host: "erebe.test",
        dir: await moduleDir(),
        stateDir,
      });
      const app = createApp({ modules: [erebe] }).listen({
        hostname: "127.0.0.1",
        port: 0,
      });
      const port = app.server?.port;
      if (!port) throw new Error("Server did not start");
      let stopped: Promise<unknown> | undefined;
      const stop = () => {
        stopped ??= app.stop(true).then(() => erebe.close());
        return stopped.then(() => undefined);
      };
      cleanups.push(stop);
      return { origin: `http://127.0.0.1:${port}`, stop };
    };
    const device = { "x-erebe-device": "device-0123456789" };
    const first = await start();
    const a = join(first.origin, "erebe-notes");
    await a.synced;
    a.text.insert(0, "Chipper: ");
    await fetch(`${first.origin}/api/modules/erebe/prefs`, {
      method: "PUT",
      headers: { ...device, "content-type": "application/json" },
      body: JSON.stringify({ page: "model" }),
    });
    await waitFor(() => existsSync(resolve(stateDir, "rooms/erebe-notes.log")));
    await first.stop();

    const second = await start();
    const b = join(second.origin, "erebe-notes");
    await b.synced;
    expect(b.text.toString()).toBe("Chipper: Bring straps.\n");
    const prefs = await fetch(`${second.origin}/api/modules/erebe/prefs`, {
      headers: device,
    });
    expect(JSON.stringify(await prefs.json())).toContain('"page":"model"');
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

describe("crew identity and inventory", () => {
  async function start(serve: (init?: RequestInit) => Response) {
    const dir = await moduleDir();
    const calls: {
      url: string;
      email: string | null;
      origin: string | null;
      method: string;
    }[] = [];
    const erebe = await loadWebModule({
      name: "erebe",
      host: "erebe.test",
      dir,
      inventory: {
        syncUrl: "http://pacinman.test",
        origin: "https://packing-man.test",
        fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
          const h = new Headers(init?.headers);
          calls.push({
            url: String(input),
            email: h.get("x-auth-request-email"),
            origin: h.get("origin"),
            method: init?.method ?? "GET",
          });
          return serve(init);
        }) as typeof fetch,
      },
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
    return { origin: `http://127.0.0.1:${port}/api/modules/erebe`, calls };
  }
  const inani = {
    "x-authentik-uid": "u-1",
    "x-authentik-username": "inani",
    "x-authentik-email": "inani@example.test",
    "x-authentik-groups": "erebe-writers|authentik Users",
  };

  test("the same routes answer under /crew/api, the only place Traefik lets identity through", async () => {
    const { origin, calls } = await start(() =>
      Response.json({ data: { workspace: { revision: 1 }, items: [] } }),
    );
    const crew = origin.replace("/api/modules/erebe", "/crew/api/erebe");
    const host = { host: "erebe.test" };
    expect(
      (
        (await (
          await fetch(`${crew}/whoami`, { headers: { ...inani, ...host } })
        ).json()) as { identity: { username: string } }
      ).identity.username,
    ).toBe("inani");
    // No headers, as on any route Traefik strips: nobody, on both bases.
    expect(
      await (await fetch(`${crew}/whoami`, { headers: host })).json(),
    ).toEqual({
      identity: null,
    });
    expect((await fetch(`${crew}/inventory`, { headers: host })).status).toBe(
      401,
    );
    expect(
      (await fetch(`${crew}/inventory`, { headers: { ...inani, ...host } }))
        .status,
    ).toBe(200);
    expect(calls[0]?.email).toBe("inani@example.test");
    // A signed-in person's prefs are filed under their uid, claiming the device key.
    const prefs = await fetch(`${crew}/prefs`, {
      method: "PUT",
      headers: {
        ...inani,
        ...host,
        "x-authentik-uid": "uid-inani-0001",
        "x-erebe-device": "device-0123456789",
        "content-type": "application/json",
      },
      body: JSON.stringify({ page: "crew" }),
    });
    expect(((await prefs.json()) as { subject: string }).subject).toBe(
      "user:uid-inani-0001",
    );
    // The crew page itself is still the module's index.html.
    const page = await fetch(crew.replace("/crew/api/erebe", "/crew/"), {
      headers: host,
    });
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toContain("text/html");
  });

  test("whoami reflects Authentik headers and nothing without them", async () => {
    const { origin } = await start(() => new Response("{}"));
    expect(await (await fetch(`${origin}/whoami`)).json()).toEqual({
      identity: null,
    });
    expect(
      (await (await fetch(`${origin}/whoami`, { headers: inani })).json())
        .identity,
    ).toEqual({
      uid: "u-1",
      username: "inani",
      email: "inani@example.test",
      name: "inani",
      groups: ["erebe-writers", "authentik Users"],
    });
  });

  test("inventory proxies the workspace as the signed-in address and forwards mutations", async () => {
    const snapshot = {
      data: {
        workspace: { id: "erebe", name: "Erebe", revision: 3 },
        items: [{ id: "bom-osb", item: "OSB", status: "to-buy" }],
        collaborators: [],
        access: null,
      },
    };
    const { origin, calls } = await start(
      (init) =>
        new Response(
          JSON.stringify(init?.method === "POST" ? { ok: true } : snapshot),
        ),
    );
    expect((await fetch(`${origin}/inventory`)).status).toBe(401);
    const res = await fetch(`${origin}/inventory`, { headers: inani });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      workspace: snapshot.data.workspace,
      items: snapshot.data.items,
    });
    expect(calls[0]).toMatchObject({
      url: "http://pacinman.test/api/packing/workspaces/erebe",
      email: "inani@example.test",
      origin: "https://packing-man.test",
      method: "GET",
    });
    const flip = await fetch(`${origin}/inventory/mutations`, {
      method: "POST",
      headers: { ...inani, "content-type": "application/json" },
      body: JSON.stringify({
        action: "upsert",
        mutationId: "m1",
        baseVersion: 3,
        item: { id: "bom-osb", status: "have" },
      }),
    });
    expect(flip.status).toBe(200);
    expect(calls.at(1)).toMatchObject({
      url: "http://pacinman.test/api/packing/workspaces/erebe/mutations",
      method: "POST",
    });
  });

  test("an address pacinman rejects is explained, not leaked", async () => {
    const { origin } = await start(() => new Response("nope", { status: 403 }));
    const res = await fetch(`${origin}/inventory`, { headers: inani });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain("does not know this address");
  });
});
