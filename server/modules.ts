/**
 * Web modules: a built site served for one Host, with its own ephemeral
 * y-websocket rooms. The module is a directory the host never writes to:
 *   <dir>/dist/         the built pages (index.html + assets)
 *   <dir>/rooms.json    { "<room>": { "text": "<seed>" } }
 * Rooms live in memory only; when the process stops they are gone. That is the
 * point for a crew board edited by whoever opens it, logged in or not.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type AnyElysia, Elysia } from "elysia";
import * as Y from "yjs";
import {
  type BlobEntry,
  createBlobRoutes,
  type LakefsConfig,
  lakefsFromEnv,
  loadManifest,
} from "./blobs";
import { createRooms, type RoomSpec } from "./collab";
import {
  createPrefsRoutes,
  MemoryPrefsStore,
  PostgresPrefsStore,
  type PrefsStore,
} from "./prefs";
import {
  PostgresRoomStore,
  postgresRoomStoreFromEnv,
  type RoomStore,
} from "./room-store";

export interface WebModuleOptions {
  /** Short name; routes mount under /api/modules/<name>. */
  name: string;
  /** Host header (without port) that selects this module's pages. */
  host: string;
  /** Directory holding dist/, rooms.json and optionally asset-manifest.toml. */
  dir: string;
  /** lakeFS credentials for the module's heavy assets; env by default. */
  lakefs?: LakefsConfig;
  /** Test seam for the lakeFS fetch. */
  fetch?: typeof fetch;
  /** Durable room storage; env (EREBE_DATABASE_URL) by default, memory when absent. */
  store?: RoomStore;
  /** Per-user preferences; shares the room store's database when it is Postgres. */
  prefs?: PrefsStore;
}

export interface WebModule {
  readonly name: string;
  readonly host: string;
  readonly staticDir: string;
  readonly plugin: AnyElysia;
  /** sha256 -> lakeFS locator for the module's heavy assets. */
  readonly blobs: Map<string, BlobEntry>;
  close(): Promise<void>;
}

export const MODULE_TEXT_NAME = "text";
/** Every seed is written by this client id, so identical seeds merge as one. */
const SEED_CLIENT_ID = 1;

function seedFor(text: string) {
  const doc = new Y.Doc();
  doc.clientID = SEED_CLIENT_ID;
  doc.getText(MODULE_TEXT_NAME).insert(0, text);
  return Y.encodeStateAsUpdate(doc);
}

export async function loadModuleRooms(
  dir: string,
  label: string,
): Promise<RoomSpec> {
  const raw = JSON.parse(await readFile(resolve(dir, "rooms.json"), "utf8"));
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    throw new Error(`${label}: rooms.json must be an object of rooms`);
  const seeds = new Map<string, Uint8Array>();
  for (const [room, value] of Object.entries(raw as Record<string, unknown>)) {
    const text =
      typeof value === "object" && value !== null && "text" in value
        ? (value as { text?: unknown }).text
        : undefined;
    if (typeof text !== "string")
      throw new Error(`${label}: room ${room} needs a string "text" seed`);
    seeds.set(room, seedFor(text));
  }
  return {
    list: [...seeds.keys()],
    seed: (room) => seeds.get(room),
    textName: MODULE_TEXT_NAME,
    label,
  };
}

export async function loadWebModule(
  options: WebModuleOptions,
): Promise<WebModule> {
  const dir = resolve(options.dir);
  const rooms = await loadModuleRooms(dir, options.name);
  const store =
    options.store ??
    (await postgresRoomStoreFromEnv(process.env, options.name));
  const collab = createRooms({
    name: `module-${options.name}`,
    prefix: `/api/modules/${options.name}`,
    rooms,
    store,
  });
  const blobs = await loadManifest(dir);
  const prefs =
    options.prefs ??
    (store instanceof PostgresRoomStore
      ? new PostgresPrefsStore(store.client, options.name)
      : new MemoryPrefsStore());
  const plugin = new Elysia({ name: `module-${options.name}-plugin` })
    .use(collab.plugin)
    .use(createPrefsRoutes({ name: options.name, store: prefs }))
    .use(
      createBlobRoutes({
        name: options.name,
        entries: blobs,
        lakefs: options.lakefs ?? lakefsFromEnv(),
        fetch: options.fetch,
      }),
    );
  return {
    name: options.name,
    host: options.host,
    staticDir: resolve(dir, "dist"),
    plugin,
    blobs,
    close: collab.close,
  };
}
