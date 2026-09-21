import { afterEach, describe, expect, test } from "bun:test";
import { appendFile, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Elysia } from "elysia";
import * as Y from "yjs";
import {
  FallbackPrefsStore,
  FilePrefsStore,
  FileRoomStore,
  MirroredRoomStore,
  stateDirFromEnv,
} from "./disk-fallback";
import { createInventoryRoutes } from "./inventory";
import { MemoryPrefsStore, type PrefsStore } from "./prefs";
import { applyStored, MemoryRoomStore, type RoomStore } from "./room-store";

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
async function stateDir() {
  const dir = await mkdtemp(resolve(tmpdir(), "muchado-state-"));
  cleanups.push(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
const quiet = () => undefined;

function update(text: string, client: number) {
  const doc = new Y.Doc();
  doc.clientID = client;
  doc.getText("text").insert(0, text);
  return Y.encodeStateAsUpdate(doc);
}
function textOf(stored: { snapshot?: Uint8Array; updates: Uint8Array[] }) {
  const doc = new Y.Doc();
  applyStored(doc, stored, "test");
  return doc.getText("text").toString();
}

const down: RoomStore = {
  load: () => Promise.reject(new Error("database down")),
  append: () => Promise.reject(new Error("database down")),
  snapshot: () => Promise.reject(new Error("database down")),
  close: async () => undefined,
};

describe("rooms on disk", () => {
  test("appends survive a new store on the same directory, and a snapshot replaces the log", async () => {
    const dir = await stateDir();
    const first = new FileRoomStore(dir);
    await first.append("erebe-notes", update("hello", 7));
    expect(textOf(await new FileRoomStore(dir).load("erebe-notes"))).toBe(
      "hello",
    );
    await first.snapshot("erebe-notes", update("snap", 8));
    expect(await readdir(dir)).toEqual(["erebe-notes.snapshot"]);
    expect(textOf(await new FileRoomStore(dir).load("erebe-notes"))).toBe(
      "snap",
    );
  });

  test("a torn final frame is dropped and everything before it is kept", async () => {
    const dir = await stateDir();
    const store = new FileRoomStore(dir);
    await store.append("erebe-tasks", update("kept", 9));
    await appendFile(
      resolve(dir, "erebe-tasks.log"),
      new Uint8Array([0, 0, 1, 0, 1, 2, 3]),
    );
    const stored = await store.load("erebe-tasks");
    expect(stored.updates).toHaveLength(1);
    expect(textOf(stored)).toBe("kept");
  });

  test("a room name can never be a path", async () => {
    const store = new FileRoomStore(await stateDir());
    expect(store.append("../escape", update("x", 1))).rejects.toThrow(
      "Invalid room name",
    );
  });
});

describe("mirrored rooms", () => {
  test("keeps working on disk while the database is down", async () => {
    const disk = new FileRoomStore(await stateDir());
    const store = new MirroredRoomStore(down, disk, quiet);
    await store.append("erebe-notes", update("offline edit", 11));
    expect(textOf(await store.load("erebe-notes"))).toBe("offline edit");
  });

  test("merges what each side holds, so nothing is lost when the database returns", async () => {
    const database = new MemoryRoomStore();
    const disk = new FileRoomStore(await stateDir());
    await database.append("erebe-notes", update("from the database ", 21));
    await disk.append("erebe-notes", update("from the disk", 22));
    const merged = textOf(
      await new MirroredRoomStore(database, disk, quiet).load("erebe-notes"),
    );
    expect(merged).toContain("from the database ");
    expect(merged).toContain("from the disk");
  });

  test("writes reach both, and only both failing is an error", async () => {
    const database = new MemoryRoomStore();
    const disk = new FileRoomStore(await stateDir());
    await new MirroredRoomStore(database, disk, quiet).append(
      "erebe-notes",
      update("both", 31),
    );
    expect(textOf(await database.load("erebe-notes"))).toBe("both");
    expect(textOf(await disk.load("erebe-notes"))).toBe("both");
    const neither = new MirroredRoomStore(down, down, quiet);
    expect(neither.append("erebe-notes", update("x", 1))).rejects.toThrow(
      "database down",
    );
    expect(neither.load("erebe-notes")).rejects.toThrow("database down");
  });
});

describe("prefs on disk", () => {
  test("set, get and claim, with the subject never used as a file name", async () => {
    const dir = await stateDir();
    const store = new FilePrefsStore(dir);
    await store.set("device-../../etc", { page: "model" });
    await store.set("user-0001", { theme: "dark" });
    expect(
      (await readdir(dir)).every((f) => /^[0-9a-f]{64}\.json$/.test(f)),
    ).toBe(true);
    await store.claim("device-../../etc", "user-0001");
    expect(await new FilePrefsStore(dir).get("user-0001")).toEqual({
      page: "model",
      theme: "dark",
    });
    expect(await store.get("device-../../etc")).toBeUndefined();
  });

  test("the disk copy answers when the database cannot", async () => {
    const broken: PrefsStore = {
      get: () => Promise.reject(new Error("database down")),
      set: () => Promise.reject(new Error("database down")),
      claim: () => Promise.reject(new Error("database down")),
    };
    const disk = new FilePrefsStore(await stateDir());
    const store = new FallbackPrefsStore(broken, disk);
    await store.set("user-0002", { page: "crew" });
    expect(await store.get("user-0002")).toEqual({ page: "crew" });

    const healthy = new MemoryPrefsStore();
    const both = new FallbackPrefsStore(healthy, disk);
    await both.set("user-0003", { page: "tasks" });
    expect(await healthy.get("user-0003")).toEqual({ page: "tasks" });
    expect(await disk.get("user-0003")).toEqual({ page: "tasks" });
  });
});

describe("inventory on disk", () => {
  const as = (email: string) => ({
    headers: {
      "x-authentik-uid": `uid-${email}`,
      "x-authentik-username": email.split("@")[0] ?? "",
      "x-authentik-email": email,
    },
  });
  function routes(
    cacheDir: string,
    serve: () => Response,
    syncUrl = "http://pacinman.test",
  ) {
    return new Elysia().use(
      createInventoryRoutes({
        name: "erebe",
        syncUrl: syncUrl || undefined,
        cacheDir,
        fetch: (async () => serve()) as unknown as typeof fetch,
      }),
    );
  }
  const url = "http://erebe.test/api/modules/erebe/inventory";
  const good = () =>
    Response.json({
      data: { workspace: { revision: 4 }, items: [{ id: "a" }] },
    });
  const throws = () => {
    throw new Error("connect ECONNREFUSED");
  };

  test("serves the last good copy, marked stale, to someone pacinman accepted", async () => {
    const dir = await stateDir();
    const live = await routes(dir, good).handle(
      new Request(url, as("crew@erebe.test")),
    );
    expect(await live.json()).toEqual({
      workspace: { revision: 4 },
      items: [{ id: "a" }],
    });

    for (const broken of [throws, () => new Response("no", { status: 500 })]) {
      const res = await routes(dir, broken).handle(
        new Request(url, as("crew@erebe.test")),
      );
      const body = (await res.json()) as {
        stale?: boolean;
        cachedAt?: string;
        items: unknown[];
      };
      expect(res.status).toBe(200);
      expect(body.stale).toBe(true);
      expect(body.items).toEqual([{ id: "a" }]);
      expect(Number.isNaN(Date.parse(body.cachedAt ?? ""))).toBe(false);
    }
    const unconfigured = await routes(dir, good, "").handle(
      new Request(url, as("crew@erebe.test")),
    );
    expect(((await unconfigured.json()) as { stale?: boolean }).stale).toBe(
      true,
    );
  });

  test("never hands the copy to an address pacinman has not accepted, or to nobody", async () => {
    const dir = await stateDir();
    await routes(dir, good).handle(new Request(url, as("crew@erebe.test")));
    const stranger = await routes(dir, throws).handle(
      new Request(url, as("other@erebe.test")),
    );
    expect(stranger.status).toBe(502);
    expect(await stranger.json()).toEqual({ error: "pacinman is unreachable" });
    expect((await routes(dir, throws).handle(new Request(url))).status).toBe(
      401,
    );
    const refused = await routes(
      dir,
      () => new Response("no", { status: 403 }),
    ).handle(new Request(url, as("crew@erebe.test")));
    expect(refused.status).toBe(403);
  });

  test("refuses writes while pacinman is down instead of queueing them", async () => {
    const res = await routes(await stateDir(), throws).handle(
      new Request(`${url}/mutations`, {
        method: "POST",
        body: "{}",
        ...as("crew@erebe.test"),
      }),
    );
    expect(res.status).toBe(503);
  });
});

test("the state directory comes from <NAME>_STATE_DIR", () => {
  expect(
    stateDirFromEnv("erebe", { EREBE_STATE_DIR: " /var/lib/erebe " }),
  ).toBe("/var/lib/erebe");
  expect(stateDirFromEnv("erebe", {})).toBeUndefined();
});
