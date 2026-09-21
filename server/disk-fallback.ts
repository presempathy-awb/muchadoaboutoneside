/**
 * Disk fallbacks for a web module's services. Every service a module leans on
 * can be missing: not configured on a laptop, or down on the host. With
 * `<NAME>_STATE_DIR` set, each one keeps a copy on disk so the module keeps
 * working:
 *
 *   rooms      an append-only log and a snapshot per room, mirrored with
 *              Postgres when both exist. Yjs updates are idempotent and
 *              commutative, so loading merges whatever is reachable and the
 *              two copies converge at the next snapshot.
 *   prefs      one JSON file per subject, written on every set.
 *   inventory  the last good pacinman snapshot (see inventory.ts).
 *   blobs      `<NAME>_ASSETS_DIR` (see blobs.ts).
 *
 * Authentication has no disk fallback on purpose: if Authentik is unreachable
 * the crew area fails closed.
 */
import { createHash } from "node:crypto";
import {
  appendFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import type { PrefsStore } from "./prefs";
import type { RoomStore } from "./room-store";

/** `<NAME>_STATE_DIR`: a writable directory for the module's disk fallbacks. */
export function stateDirFromEnv(name: string, env = process.env) {
  const value =
    env[`${name.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_STATE_DIR`];
  return value?.trim() ? resolve(value.trim()) : undefined;
}

async function readIfPresent(file: string) {
  try {
    return new Uint8Array(await readFile(file));
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") return undefined;
    throw error;
  }
}

async function writeAtomic(file: string, data: Uint8Array | string) {
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, data, { mode: 0o600 });
  await rename(temporary, file);
}

const roomPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** Rooms on disk: `<room>.snapshot` plus `<room>.log` of length-prefixed updates. */
export class FileRoomStore implements RoomStore {
  private ready: Promise<unknown>;
  constructor(private readonly dir: string) {
    this.ready = mkdir(dir, { recursive: true, mode: 0o700 });
  }
  private path(room: string, suffix: string) {
    if (!roomPattern.test(room)) throw new Error(`Invalid room name: ${room}`);
    return resolve(this.dir, `${room}.${suffix}`);
  }
  async load(room: string) {
    await this.ready;
    const snapshot = await readIfPresent(this.path(room, "snapshot"));
    const log = await readIfPresent(this.path(room, "log"));
    const updates: Uint8Array[] = [];
    if (log) {
      const view = new DataView(log.buffer, log.byteOffset, log.byteLength);
      let offset = 0;
      // A torn final frame (crash mid-append) is dropped; everything before it is kept.
      while (offset + 4 <= log.byteLength) {
        const length = view.getUint32(offset);
        if (offset + 4 + length > log.byteLength) break;
        updates.push(log.slice(offset + 4, offset + 4 + length));
        offset += 4 + length;
      }
    }
    return { snapshot, updates };
  }
  async append(room: string, update: Uint8Array) {
    await this.ready;
    const frame = new Uint8Array(4 + update.byteLength);
    new DataView(frame.buffer).setUint32(0, update.byteLength);
    frame.set(update, 4);
    await appendFile(this.path(room, "log"), frame, { mode: 0o600 });
  }
  async snapshot(room: string, state: Uint8Array) {
    await this.ready;
    await writeAtomic(this.path(room, "snapshot"), state);
    await rm(this.path(room, "log"), { force: true });
  }
  async close() {}
}

/**
 * Writes to both stores and reads from both. One store failing is logged and
 * survived; only both failing is an error. Reads merge, which is safe for Yjs.
 */
export class MirroredRoomStore implements RoomStore {
  constructor(
    readonly primary: RoomStore,
    readonly disk: RoomStore,
    private readonly report: (message: string, error: unknown) => void = (
      message,
      error,
    ) => console.error(message, error),
  ) {}
  private async both(what: string, run: (store: RoomStore) => Promise<void>) {
    const results = await Promise.allSettled([
      run(this.primary),
      run(this.disk),
    ]);
    const [primary, disk] = results;
    if (primary.status === "rejected")
      this.report(`Room store: database ${what} failed`, primary.reason);
    if (disk.status === "rejected")
      this.report(`Room store: disk ${what} failed`, disk.reason);
    if (primary.status === "rejected" && disk.status === "rejected")
      throw primary.reason;
  }
  async load(room: string) {
    const results = await Promise.allSettled([
      this.primary.load(room),
      this.disk.load(room),
    ]);
    const updates: Uint8Array[] = [];
    for (const [index, result] of results.entries()) {
      if (result.status === "rejected") {
        this.report(
          `Room store: ${index === 0 ? "database" : "disk"} load failed`,
          result.reason,
        );
        continue;
      }
      // A stored snapshot is a Yjs state update, so it merges like any other.
      if (result.value.snapshot) updates.push(result.value.snapshot);
      updates.push(...result.value.updates);
    }
    if (results.every((result) => result.status === "rejected"))
      throw (results[0] as PromiseRejectedResult).reason;
    return { updates };
  }
  append(room: string, update: Uint8Array) {
    return this.both("append", (store) => store.append(room, update));
  }
  snapshot(room: string, state: Uint8Array) {
    return this.both("snapshot", (store) => store.snapshot(room, state));
  }
  async close() {
    await Promise.allSettled([this.primary.close(), this.disk.close()]);
  }
}

/** Prefs on disk: one file per subject, named by hash so a subject is never a path. */
export class FilePrefsStore implements PrefsStore {
  private ready: Promise<unknown>;
  constructor(private readonly dir: string) {
    this.ready = mkdir(dir, { recursive: true, mode: 0o700 });
  }
  private path(subject: string) {
    const name = createHash("sha256").update(subject).digest("hex");
    return resolve(this.dir, `${name}.json`);
  }
  async get(subject: string) {
    await this.ready;
    const raw = await readIfPresent(this.path(subject));
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(new TextDecoder().decode(raw));
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : undefined;
  }
  async set(subject: string, prefs: Record<string, unknown>) {
    await this.ready;
    await writeAtomic(this.path(subject), JSON.stringify(prefs));
  }
  async claim(device: string, user: string) {
    const fromDevice = await this.get(device);
    if (!fromDevice) return;
    await this.set(user, { ...fromDevice, ...((await this.get(user)) ?? {}) });
    await rm(this.path(device), { force: true });
  }
}

/** The database answers when it can; the disk copy answers when it cannot. */
export class FallbackPrefsStore implements PrefsStore {
  constructor(
    readonly primary: PrefsStore,
    readonly disk: PrefsStore,
  ) {}
  async get(subject: string) {
    try {
      return await this.primary.get(subject);
    } catch {
      return this.disk.get(subject);
    }
  }
  private async both(run: (store: PrefsStore) => Promise<void>) {
    const [primary, disk] = await Promise.allSettled([
      run(this.primary),
      run(this.disk),
    ]);
    if (primary.status === "rejected" && disk.status === "rejected")
      throw primary.reason;
  }
  set(subject: string, prefs: Record<string, unknown>) {
    return this.both((store) => store.set(subject, prefs));
  }
  claim(device: string, user: string) {
    return this.both((store) => store.claim(device, user));
  }
}
