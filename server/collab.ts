/**
 * Live sync for the poem drafts. Speaks the y-websocket protocol so the
 * browser's WebsocketProvider can join: one Y.Doc per known poem room, kept in
 * memory and written to the configured directory as a Yjs update plus a
 * plain-text mirror. Registered only when a directory is configured, so a site
 * without COLLAB_DIR serves exactly what it served before.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Elysia } from "elysia";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import * as awarenessProtocol from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import * as Y from "yjs";
import { POEM_VERSIONS, poemVersionById } from "../shared/poem";
import {
  DRAFT_TEXT_NAME,
  draftRoom,
  seedUpdate,
  versionIdForRoom,
} from "../shared/poem-drafts";
import { applyStored, type RoomStore } from "./room-store";

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const SAVE_DELAY_MS = 400;
const noStore = { "cache-control": "no-store" };

export const COLLAB_ROOMS = POEM_VERSIONS.map((version) =>
  draftRoom(version.id),
);

interface Connection {
  send(message: Uint8Array): void;
  /** Awareness client ids this connection introduced. */
  controlledIds: Set<number>;
}

interface AwarenessChange {
  added: number[];
  updated: number[];
  removed: number[];
}

function isMissingFile(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

class Room {
  readonly doc = new Y.Doc();
  readonly awareness = new awarenessProtocol.Awareness(this.doc);
  readonly connections = new Set<Connection>();
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private pending: Promise<void> = Promise.resolve();
  private closed = false;

  constructor(
    readonly name: string,
    private readonly textName: string,
    private readonly label: string,
    /** Without files the room lives in memory only and never saves. */
    private readonly file?: string,
    private readonly textFile?: string,
    private readonly store?: RoomStore,
  ) {
    // The server is a relay, not a participant, so it has no presence.
    this.awareness.setLocalState(null);
    this.doc.on("update", (update: Uint8Array, origin: unknown) => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      this.broadcast(encoding.toUint8Array(encoder), origin);
      // A stored room appends every update as it happens; files batch instead.
      if (this.store && origin !== "load" && origin !== "seed")
        this.queueAppend(update);
      else this.scheduleSave();
    });
    this.awareness.on(
      "update",
      ({ added, updated, removed }: AwarenessChange, origin: unknown) => {
        if (this.connections.has(origin as Connection)) {
          const connection = origin as Connection;
          for (const id of added) connection.controlledIds.add(id);
          for (const id of removed) connection.controlledIds.delete(id);
        }
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(this.awareness, [
            ...added,
            ...updated,
            ...removed,
          ]),
        );
        this.broadcast(encoding.toUint8Array(encoder));
      },
    );
  }

  async load(seed: Uint8Array) {
    if (this.store)
      applyStored(this.doc, await this.store.load(this.name), "load");
    if (this.file) {
      try {
        Y.applyUpdate(
          this.doc,
          new Uint8Array(await readFile(this.file)),
          "load",
        );
      } catch (error) {
        if (!isMissingFile(error)) throw error;
      }
    }
    // Idempotent: the seed is the same bytes every browser applies.
    Y.applyUpdate(this.doc, seed, "seed");
  }

  text() {
    return this.doc.getText(this.textName).toString();
  }

  join(connection: Connection) {
    this.connections.add(connection);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, this.doc);
    connection.send(encoding.toUint8Array(encoder));
    const states = this.awareness.getStates();
    if (states.size > 0) {
      const presence = encoding.createEncoder();
      encoding.writeVarUint(presence, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        presence,
        awarenessProtocol.encodeAwarenessUpdate(
          this.awareness,
          Array.from(states.keys()),
        ),
      );
      connection.send(encoding.toUint8Array(presence));
    }
  }

  leave(connection: Connection) {
    if (!this.connections.delete(connection)) return;
    awarenessProtocol.removeAwarenessStates(
      this.awareness,
      Array.from(connection.controlledIds),
      null,
    );
  }

  receive(connection: Connection, message: Uint8Array) {
    const decoder = decoding.createDecoder(message);
    const encoder = encoding.createEncoder();
    switch (decoding.readVarUint(decoder)) {
      case MESSAGE_SYNC: {
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        syncProtocol.readSyncMessage(decoder, encoder, this.doc, connection);
        if (encoding.length(encoder) > 1)
          connection.send(encoding.toUint8Array(encoder));
        break;
      }
      case MESSAGE_AWARENESS: {
        awarenessProtocol.applyAwarenessUpdate(
          this.awareness,
          decoding.readVarUint8Array(decoder),
          connection,
        );
        break;
      }
      default:
        break;
    }
  }

  /** Writes the current state; safe to call while more updates arrive. */
  flush() {
    clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    return this.queueSave();
  }

  async close() {
    this.closed = true;
    this.awareness.destroy();
    await this.flush();
    if (this.store) {
      // Compact: one snapshot replaces the log so the next open is quick.
      await this.pending;
      await this.store
        .snapshot(this.name, Y.encodeStateAsUpdate(this.doc))
        .catch((error: unknown) => {
          console.error(
            `Could not snapshot ${this.label} room ${this.name}:`,
            error,
          );
        });
    }
    this.doc.destroy();
  }

  private broadcast(message: Uint8Array, except?: unknown) {
    for (const connection of this.connections)
      if (connection !== except) connection.send(message);
  }

  private queueAppend(update: Uint8Array) {
    const store = this.store;
    if (!store || this.closed) return;
    this.pending = this.pending
      .then(() => store.append(this.name, update))
      .catch((error: unknown) => {
        console.error(
          `Could not store ${this.label} room ${this.name}:`,
          error,
        );
      });
  }

  private scheduleSave() {
    if (this.closed || !this.file) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = undefined;
      this.queueSave();
    }, SAVE_DELAY_MS);
  }

  /** One save at a time; a failed write is logged and never blocks the next. */
  private queueSave() {
    this.pending = this.pending
      .then(() => this.save())
      .catch((error: unknown) => {
        console.error(`Could not save ${this.label} room ${this.name}:`, error);
      });
    return this.pending;
  }

  private async save() {
    if (!this.file || !this.textFile) return;
    const state = Y.encodeStateAsUpdate(this.doc);
    const temporary = `${this.file}.tmp`;
    await writeFile(temporary, state);
    await rename(temporary, this.file);
    await writeFile(this.textFile, `${this.text()}\n`);
  }
}

class RoomRegistry {
  private readonly rooms = new Map<string, Promise<Room>>();
  private readonly prepared: Promise<void>;

  constructor(
    private readonly spec: RoomSpec,
    private readonly dir?: string,
    private readonly store?: RoomStore,
  ) {
    this.prepared = dir
      ? mkdir(dir, { recursive: true }).then(() => undefined)
      : Promise.resolve();
  }

  room(name: string): Promise<Room> {
    let room = this.rooms.get(name);
    if (!room) {
      const seed = this.spec.seed(name);
      if (!seed) throw new Error(`Unknown ${this.spec.label} room: ${name}`);
      const dir = this.dir;
      room = this.prepared.then(async () => {
        const created = new Room(
          name,
          this.spec.textName,
          this.spec.label,
          dir && resolve(dir, `${name}.yjs`),
          dir && resolve(dir, `${name}.txt`),
          this.store,
        );
        await created.load(seed);
        return created;
      });
      this.rooms.set(name, room);
    }
    return room;
  }

  async close() {
    const rooms = await Promise.all(this.rooms.values());
    this.rooms.clear();
    await Promise.all(rooms.map((room) => room.close()));
  }
}

interface Attachment {
  closed: boolean;
  ready: Promise<{ room: Room; connection: Connection } | undefined>;
}

/** Which rooms exist, how each starts, and what the text mirror reads. */
export interface RoomSpec {
  /** Advertised by the status endpoint. */
  readonly list: readonly string[];
  /** Deterministic seed for a room, or undefined when the room is unknown. */
  seed(room: string): Uint8Array | undefined;
  /** The Y.Text key the plain-text mirror reads. */
  readonly textName: string;
  /** Word used in errors and logs: "poem", "erebe". */
  readonly label: string;
}

export interface CollabOptions {
  /** Elysia plugin name; unique per mounted instance. */
  name: string;
  /** Route prefix, e.g. "/api/collab". */
  prefix: string;
  rooms: RoomSpec;
  /** Persist rooms here. Without it rooms live in memory and end with the process. */
  dir?: string;
  /** Persist rooms in a store instead (PG18 in production); wins over dir. */
  store?: RoomStore;
}

export const POEM_ROOMS: RoomSpec = {
  list: COLLAB_ROOMS,
  seed(room) {
    const id = versionIdForRoom(room);
    return id ? seedUpdate(poemVersionById(id)) : undefined;
  },
  textName: DRAFT_TEXT_NAME,
  label: "poem",
};

/** Live poem drafts. Stays off without a directory, exactly as before. */
export function createCollab(dir?: string) {
  if (!dir) {
    const plugin = new Elysia({ name: "collab" }).get(
      "/api/collab/status",
      () => Response.json({ enabled: false, rooms: [] }, { headers: noStore }),
    );
    return { enabled: false, plugin, close: async () => {} };
  }
  return createRooms({
    name: "collab",
    prefix: "/api/collab",
    rooms: POEM_ROOMS,
    dir,
  });
}

/** A set of y-websocket rooms under one prefix; persistent only with a dir. */
export function createRooms(options: CollabOptions) {
  const { rooms } = options;
  const registry = new RoomRegistry(
    rooms,
    options.store ? undefined : options.dir ? resolve(options.dir) : undefined,
    options.store,
  );
  const unknown = () =>
    Response.json(
      { error: `Unknown ${rooms.label} room` },
      { status: 404, headers: noStore },
    );
  const attachments = new WeakMap<object, Attachment>();
  const plugin = new Elysia({ name: options.name, prefix: options.prefix })
    .get("/status", () =>
      Response.json({ enabled: true, rooms: rooms.list }, { headers: noStore }),
    )
    .get("/rooms/:room/text", async ({ params: { room } }) => {
      if (!rooms.seed(room)) return unknown();
      const loaded = await registry.room(room);
      return new Response(`${loaded.text()}\n`, {
        headers: { ...noStore, "content-type": "text/plain; charset=utf-8" },
      });
    })
    .ws("/rooms/:room", {
      maxPayloadLength: 1024 * 1024,
      open(ws) {
        const name = ws.data.params.room;
        if (!rooms.seed(name)) {
          ws.close(4404, `Unknown ${rooms.label} room`);
          return;
        }
        const attachment: Attachment = {
          closed: false,
          ready: registry.room(name).then((room) => {
            if (attachment.closed) return undefined;
            const connection: Connection = {
              send(message) {
                ws.raw.send(message);
              },
              controlledIds: new Set(),
            };
            room.join(connection);
            return { room, connection };
          }),
        };
        attachments.set(ws.raw, attachment);
      },
      async message(ws, message) {
        if (!(message instanceof Uint8Array)) return;
        const attached = await attachments.get(ws.raw)?.ready;
        attached?.room.receive(attached.connection, message);
      },
      async close(ws) {
        const attachment = attachments.get(ws.raw);
        if (!attachment) return;
        attachment.closed = true;
        attachments.delete(ws.raw);
        const attached = await attachment.ready;
        attached?.room.leave(attached.connection);
      },
    });
  return {
    enabled: true,
    plugin,
    close: async () => {
      await registry.close();
      await options.store?.close();
    },
  };
}
