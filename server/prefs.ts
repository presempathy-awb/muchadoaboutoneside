/**
 * Per-user, visual-only preferences for a web module: which page, which model
 * version, filters, theme. Shared data is not stored here and nothing here is
 * broadcast — these are personal choices that follow a person between devices.
 *
 * The subject is the Authentik uid when the request came through forward-auth
 * (`X-authentik-uid`), otherwise a device key the page keeps in localStorage
 * and sends as `X-erebe-device`. A later login can claim a device key by
 * sending both headers once.
 */
import { Elysia } from "elysia";

export interface PrefsStore {
  get(subject: string): Promise<Record<string, unknown> | undefined>;
  set(subject: string, prefs: Record<string, unknown>): Promise<void>;
  /** Move a device's prefs under a user (device wins nothing the user already set). */
  claim(device: string, user: string): Promise<void>;
}

export const PREFS_MAX_BYTES = 16 * 1024;
const noStore = { "cache-control": "no-store" };
const subjectPattern = /^[A-Za-z0-9._:-]{8,128}$/;

export class MemoryPrefsStore implements PrefsStore {
  readonly rows = new Map<string, Record<string, unknown>>();
  async get(subject: string) {
    return this.rows.get(subject);
  }
  async set(subject: string, prefs: Record<string, unknown>) {
    this.rows.set(subject, structuredClone(prefs));
  }
  async claim(device: string, user: string) {
    const fromDevice = this.rows.get(device);
    if (!fromDevice) return;
    this.rows.set(user, { ...fromDevice, ...(this.rows.get(user) ?? {}) });
    this.rows.delete(device);
  }
}

/** jsonb comes back as an object or, through the raw query path, as text. */
function asObject(value: unknown): Record<string, unknown> {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

/** Runs on the room store's Postgres client; `sql` is Bun's SQL instance. */
export class PostgresPrefsStore implements PrefsStore {
  private readonly table: string;
  private readonly ready: Promise<void>;
  constructor(
    private readonly sql: {
      unsafe(
        query: string,
        params?: unknown[],
      ): Promise<Record<string, unknown>[]>;
    },
    prefix = "erebe",
  ) {
    if (!/^[a-z][a-z0-9_]{0,30}$/.test(prefix))
      throw new Error(
        `prefs table prefix must be a plain identifier: ${prefix}`,
      );
    this.table = `${prefix}_prefs`;
    this.ready = sql
      .unsafe(
        `create table if not exists ${this.table} (
           subject text primary key,
           prefs jsonb not null,
           updated_at timestamptz not null default now()
         )`,
      )
      .then(() => undefined);
  }
  async get(subject: string) {
    await this.ready;
    const [row] = await this.sql.unsafe(
      `select prefs from ${this.table} where subject = $1`,
      [subject],
    );
    return row ? asObject(row.prefs) : undefined;
  }
  async set(subject: string, prefs: Record<string, unknown>) {
    await this.ready;
    await this.sql.unsafe(
      `insert into ${this.table} (subject, prefs) values ($1, $2::jsonb)
       on conflict (subject) do update set prefs = excluded.prefs, updated_at = now()`,
      [subject, JSON.stringify(prefs)],
    );
  }
  async claim(device: string, user: string) {
    await this.ready;
    await this.sql.unsafe(
      `insert into ${this.table} (subject, prefs)
         select $2, prefs from ${this.table} where subject = $1
       on conflict (subject) do update set prefs = ${this.table}.prefs || excluded.prefs, updated_at = now()`,
      [device, user],
    );
    await this.sql.unsafe(`delete from ${this.table} where subject = $1`, [
      device,
    ]);
  }
}

function subjectOf(request: Request) {
  const uid = request.headers.get("x-authentik-uid")?.trim();
  const device = request.headers.get("x-erebe-device")?.trim();
  const subject = uid ? `user:${uid}` : device ? `device:${device}` : undefined;
  if (!subject || !subjectPattern.test(subject.slice(subject.indexOf(":") + 1)))
    return undefined;
  return { subject, device: uid && device ? `device:${device}` : undefined };
}

export function createPrefsRoutes(options: {
  name: string;
  store: PrefsStore;
}) {
  const { store } = options;
  const bad = (message: string, status = 400) =>
    Response.json({ error: message }, { status, headers: noStore });
  return new Elysia({ name: `module-${options.name}-prefs` })
    .get(`/api/modules/${options.name}/prefs`, async ({ request }) => {
      const who = subjectOf(request);
      if (!who) return bad("Send X-authentik-uid or X-erebe-device", 401);
      if (who.device) await store.claim(who.device, who.subject);
      return Response.json(
        { subject: who.subject, prefs: (await store.get(who.subject)) ?? {} },
        { headers: noStore },
      );
    })
    .put(`/api/modules/${options.name}/prefs`, async ({ request }) => {
      const who = subjectOf(request);
      if (!who) return bad("Send X-authentik-uid or X-erebe-device", 401);
      const text = await request.text();
      if (text.length > PREFS_MAX_BYTES)
        return bad("Preferences too large", 413);
      let prefs: unknown;
      try {
        prefs = JSON.parse(text);
      } catch {
        return bad("Preferences must be a JSON object");
      }
      if (typeof prefs !== "object" || prefs === null || Array.isArray(prefs))
        return bad("Preferences must be a JSON object");
      if (who.device) await store.claim(who.device, who.subject);
      await store.set(who.subject, prefs as Record<string, unknown>);
      return Response.json(
        { subject: who.subject, prefs },
        { headers: noStore },
      );
    });
}
