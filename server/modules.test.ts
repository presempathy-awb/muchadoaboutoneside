import { afterEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import * as awarenessProtocol from "y-protocols/awareness";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";
import { createApp } from "./app";
import { loadWebModule, MODULE_TEXT_NAME } from "./modules";

const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()?.();
});

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
