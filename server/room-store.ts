/**
 * Durable storage for live rooms. A room's document is an append-only log of
 * Yjs updates plus an occasional snapshot; opening a room replays the snapshot
 * and every update after it. This is the "shared data lives in PG18" rule for
 * the crew board: text survives restarts and stays multiplayer, because the
 * relay still broadcasts every update the moment it arrives.
 *
 * The store is an interface so tests use memory and production uses Bun's
 * built-in Postgres client (no extra dependency). Configure it with
 * EREBE_DATABASE_URL (no password in it) and EREBE_DATABASE_PASSWORD, plus EREBE_DATABASE_CA_FILE and
 * EREBE_DATABASE_SERVER_NAME for the wrapper's TLS.
 */
import { readFile } from "node:fs/promises";
import { SQL } from "bun";
import * as Y from "yjs";

export interface RoomStore {
  /** Everything needed to rebuild the doc: a snapshot (or none) and later updates. */
  load(room: string): Promise<{ snapshot?: Uint8Array; updates: Uint8Array[] }>;
  /** Append one update; called on every change, so it must be cheap. */
  append(room: string, update: Uint8Array): Promise<void>;
  /** Replace the log with one snapshot of the current state. */
  snapshot(room: string, state: Uint8Array): Promise<void>;
  close(): Promise<void>;
}

/** Folds a stored snapshot and updates into a doc; used by every store. */
export function applyStored(
  doc: Y.Doc,
  stored: { snapshot?: Uint8Array; updates: Uint8Array[] },
  origin: unknown,
) {
  if (stored.snapshot) Y.applyUpdate(doc, stored.snapshot, origin);
  for (const update of stored.updates) Y.applyUpdate(doc, update, origin);
}

export class MemoryRoomStore implements RoomStore {
  readonly rooms = new Map<
    string,
    { snapshot?: Uint8Array; updates: Uint8Array[] }
  >();
  private entry(room: string) {
    let entry = this.rooms.get(room);
    if (!entry) {
      entry = { updates: [] };
      this.rooms.set(room, entry);
    }
    return entry;
  }
  async load(room: string) {
    const entry = this.entry(room);
    return { snapshot: entry.snapshot, updates: [...entry.updates] };
  }
  async append(room: string, update: Uint8Array) {
    this.entry(room).updates.push(new Uint8Array(update));
  }
  async snapshot(room: string, state: Uint8Array) {
    this.rooms.set(room, { snapshot: new Uint8Array(state), updates: [] });
  }
  async close() {}
}

export interface PostgresRoomStoreOptions {
  url: string;
  /** PEM of the CA that signed the server certificate; verification is on. */
  ca?: string;
  /** Name on the server certificate when it differs from the host connected to. */
  serverName?: string;
  /** Table name prefix; one store per module keeps rooms apart. */
  prefix?: string;
}

export class PostgresRoomStore implements RoomStore {
  private readonly sql: SQL;
  private readonly updates: string;
  private readonly snapshots: string;
  private ready: Promise<void>;

  constructor(options: PostgresRoomStoreOptions) {
    const prefix = options.prefix ?? "room";
    if (!/^[a-z][a-z0-9_]{0,30}$/.test(prefix))
      throw new Error(
        `room store prefix must be a plain identifier: ${prefix}`,
      );
    this.updates = `${prefix}_updates`;
    this.snapshots = `${prefix}_snapshots`;
    this.sql = new SQL(options.url, {
      tls: options.ca
        ? { ca: options.ca, serverName: options.serverName }
        : undefined,
      max: 4,
    });
    this.ready = this.migrate();
  }

  private async migrate() {
    await this.sql.unsafe(`
      create table if not exists ${this.snapshots} (
        room text primary key,
        state bytea not null,
        seq bigint not null,
        saved_at timestamptz not null default now()
      );
      create table if not exists ${this.updates} (
        seq bigserial primary key,
        room text not null,
        update bytea not null,
        at timestamptz not null default now()
      );
      create index if not exists ${this.updates}_room_seq on ${this.updates} (room, seq);
    `);
  }

  async load(room: string) {
    await this.ready;
    const [snap] = await this.sql.unsafe(
      `select state, seq from ${this.snapshots} where room = $1`,
      [room],
    );
    const since = snap ? Number(snap.seq) : 0;
    const rows = await this.sql.unsafe(
      `select update from ${this.updates} where room = $1 and seq > $2 order by seq`,
      [room, since],
    );
    return {
      snapshot: snap ? new Uint8Array(snap.state) : undefined,
      updates: rows.map(
        (r: { update: Uint8Array }) => new Uint8Array(r.update),
      ),
    };
  }

  async append(room: string, update: Uint8Array) {
    await this.ready;
    await this.sql.unsafe(
      `insert into ${this.updates} (room, update) values ($1, $2)`,
      [room, Buffer.from(update)],
    );
  }

  /** One transaction: record the snapshot at the current tail, drop the log below it. */
  async snapshot(room: string, state: Uint8Array) {
    await this.ready;
    await this.sql.begin(async (tx) => {
      const [{ seq }] = await tx.unsafe(
        `select coalesce(max(seq), 0) as seq from ${this.updates} where room = $1`,
        [room],
      );
      await tx.unsafe(
        `insert into ${this.snapshots} (room, state, seq) values ($1, $2, $3)
         on conflict (room) do update set state = excluded.state, seq = excluded.seq, saved_at = now()`,
        [room, Buffer.from(state), Number(seq)],
      );
      await tx.unsafe(
        `delete from ${this.updates} where room = $1 and seq <= $2`,
        [room, Number(seq)],
      );
    });
  }

  /** The shared client, for sibling stores (preferences) on the same database. */
  get client() {
    return this.sql;
  }

  async close() {
    await this.ready.catch(() => undefined);
    await this.sql.end();
  }
}

/**
 * The URL is configuration and may sit in a unit file; the password is a secret
 * and arrives separately (`hid-in run` injects EREBE_DATABASE_PASSWORD), so no
 * file on the host ever holds it. A password already in the URL is left alone.
 */
export function withPassword(url: string, password: string | undefined) {
  if (!password) return url;
  const parsed = new URL(url);
  if (parsed.password) return url;
  parsed.password = password;
  return parsed.toString();
}

export async function postgresRoomStoreFromEnv(
  env = process.env,
  prefix?: string,
): Promise<PostgresRoomStore | undefined> {
  const configured = env.EREBE_DATABASE_URL?.trim();
  if (!configured) return undefined;
  const url = withPassword(configured, env.EREBE_DATABASE_PASSWORD);
  const caFile = env.EREBE_DATABASE_CA_FILE?.trim();
  return new PostgresRoomStore({
    url,
    ca: caFile ? await readFile(caFile, "utf8") : undefined,
    serverName: env.EREBE_DATABASE_SERVER_NAME?.trim() || undefined,
    prefix,
  });
}
