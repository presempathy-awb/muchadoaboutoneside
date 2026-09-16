import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import * as awarenessProtocol from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import * as Y from "yjs";
import { CANONICAL_POEM } from "../shared/poem";
import { DRAFT_TEXT_NAME, draftSource } from "../shared/poem-drafts";
import { createApp } from "./app";

const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()?.();
});

async function startApp(collabDir?: string) {
  const app = createApp({ collabDir }).listen({
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
  return { app, origin: `http://127.0.0.1:${port}`, stop };
}

function waitFor(condition: () => boolean, timeoutMs = 3000) {
  return new Promise<void>((resolveWait, reject) => {
    const started = Date.now();
    const tick = () => {
      if (condition()) return resolveWait();
      if (Date.now() - started > timeoutMs)
        return reject(new Error("Timed out waiting for a condition"));
      setTimeout(tick, 10);
    };
    tick();
  });
}

/** A minimal y-websocket client: sync step 1, replies, and outgoing updates. */
async function connect(origin: string, room: string) {
  const doc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(doc);
  const socket = new WebSocket(
    `${origin.replace("http", "ws")}/api/collab/rooms/${room}`,
  );
  socket.binaryType = "arraybuffer";
  let synced = false;
  let closeCode = 0;
  socket.addEventListener("message", (event) => {
    const decoder = decoding.createDecoder(
      new Uint8Array(event.data as ArrayBuffer),
    );
    const encoder = encoding.createEncoder();
    const type = decoding.readVarUint(decoder);
    if (type === 0) {
      encoding.writeVarUint(encoder, 0);
      const step = syncProtocol.readSyncMessage(decoder, encoder, doc, socket);
      if (encoding.length(encoder) > 1)
        socket.send(encoding.toUint8Array(encoder));
      if (step === syncProtocol.messageYjsSyncStep2) synced = true;
    } else if (type === 1) {
      awarenessProtocol.applyAwarenessUpdate(
        awareness,
        decoding.readVarUint8Array(decoder),
        socket,
      );
    }
  });
  socket.addEventListener("close", (event) => {
    closeCode = event.code;
  });
  doc.on("update", (update: Uint8Array, origin: unknown) => {
    if (origin === socket) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 0);
    syncProtocol.writeUpdate(encoder, update);
    socket.send(encoding.toUint8Array(encoder));
  });
  awareness.on(
    "update",
    (
      {
        added,
        updated,
        removed,
      }: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown,
    ) => {
      if (origin === socket) return;
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, 1);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(awareness, [
          ...added,
          ...updated,
          ...removed,
        ]),
      );
      socket.send(encoding.toUint8Array(encoder));
    },
  );
  await new Promise<void>((settle) => {
    socket.addEventListener("open", () => settle(), { once: true });
    socket.addEventListener("close", () => settle(), { once: true });
    socket.addEventListener("error", () => settle(), { once: true });
  });
  if (socket.readyState === WebSocket.OPEN) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 0);
    syncProtocol.writeSyncStep1(encoder, doc);
    socket.send(encoding.toUint8Array(encoder));
  }
  let closed = false;
  const client = {
    doc,
    awareness,
    text: doc.getText(DRAFT_TEXT_NAME),
    socket,
    isSynced: () => synced,
    closeCode: () => closeCode,
    close: () => {
      if (closed) return;
      closed = true;
      awareness.destroy();
      socket.close();
    },
  };
  cleanups.push(() => client.close());
  return client;
}

describe("live poem drafts", () => {
  test("stays off without a directory: status says so and the room routes are absent", async () => {
    const { origin } = await startApp();
    const status = await fetch(`${origin}/api/collab/status`);
    expect(status.headers.get("cache-control")).toBe("no-store");
    expect(await status.json()).toEqual({ enabled: false, rooms: [] });
    expect(
      (await fetch(`${origin}/api/collab/rooms/poem-canonical/text`)).status,
    ).toBe(404);
  });

  test("seeds each room from the poem, relays edits between clients, and persists them", async () => {
    const dir = await mkdtemp(resolve(tmpdir(), "muchado-collab-"));
    cleanups.push(() => rm(dir, { recursive: true, force: true }));
    const { origin, stop } = await startApp(dir);
    expect(await (await fetch(`${origin}/api/collab/status`)).json()).toEqual({
      enabled: true,
      rooms: ["poem-canonical", "poem-extended"],
    });

    const first = await connect(origin, "poem-canonical");
    await waitFor(first.isSynced);
    expect(first.text.toString()).toBe(draftSource(CANONICAL_POEM));

    first.text.insert(0, "Draft: ");
    const second = await connect(origin, "poem-canonical");
    await waitFor(second.isSynced);
    expect(second.text.toString()).toBe(
      `Draft: ${draftSource(CANONICAL_POEM)}`,
    );

    second.text.delete(0, "Draft: ".length);
    second.text.insert(0, "Shared: ");
    await waitFor(() => first.text.toString().startsWith("Shared: "));
    expect(first.text.toString()).toBe(second.text.toString());

    first.awareness.setLocalStateField("user", { name: "Jill" });
    await waitFor(() => second.awareness.getStates().size === 2);
    expect(
      [...second.awareness.getStates().values()].some(
        (state) => state?.user?.name === "Jill",
      ),
    ).toBe(true);
    first.close();
    await waitFor(() => second.awareness.getStates().size === 1);

    const mirror = await fetch(
      `${origin}/api/collab/rooms/poem-canonical/text`,
    );
    expect(await mirror.text()).toBe(`${second.text.toString()}\n`);
    expect(
      (await fetch(`${origin}/api/collab/rooms/poem-missing/text`)).status,
    ).toBe(404);

    second.close();
    await stop();
    const saved = new Y.Doc();
    Y.applyUpdate(
      saved,
      new Uint8Array(await readFile(resolve(dir, "poem-canonical.yjs"))),
    );
    expect(saved.getText(DRAFT_TEXT_NAME).toString()).toStartWith("Shared: ");
    expect(
      await readFile(resolve(dir, "poem-canonical.txt"), "utf8"),
    ).toStartWith("Shared: ");

    const restarted = await startApp(dir);
    const third = await connect(restarted.origin, "poem-canonical");
    await waitFor(third.isSynced);
    expect(third.text.toString()).toStartWith("Shared: ");
    expect(third.text.toString()).toBe(
      saved.getText(DRAFT_TEXT_NAME).toString(),
    );
  });

  test("rejects unknown rooms with a close code the client will not retry", async () => {
    const dir = await mkdtemp(resolve(tmpdir(), "muchado-collab-"));
    cleanups.push(() => rm(dir, { recursive: true, force: true }));
    const { origin } = await startApp(dir);
    const client = await connect(origin, "poem-missing");
    await waitFor(() => client.closeCode() !== 0);
    expect(client.closeCode()).toBe(4404);
  });
});
