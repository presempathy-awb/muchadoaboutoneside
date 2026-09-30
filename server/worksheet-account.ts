/**
 * One current calligraphy worksheet per Authentik user. Identity is only
 * present on the Erebe `/crew` router; every other router strips it. The
 * anonymous studio is a different store and is never read or written here.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Elysia } from "elysia";
import {
  parseWorksheetAccountSnapshot,
  WORKSHEET_ACCOUNT_MAX_BYTES,
  WorksheetAccountRejected,
  type WorksheetAccountSnapshot,
} from "../shared/worksheet-account";
import { identityOf } from "./identity";

const noStore = { "cache-control": "no-store" };
const CREW_PAGE_ORIGIN = "https://muchadoaboutoneside.com";

export interface WorksheetAccountRecord {
  revision: number;
  snapshot: WorksheetAccountSnapshot;
}

export interface WorksheetAccountStore {
  get(uid: string): Promise<WorksheetAccountRecord | undefined>;
  /** Replace the record when `baseRevision` is the stored revision, or 0 if none. */
  compareAndSwap(
    uid: string,
    baseRevision: number,
    snapshot: WorksheetAccountSnapshot,
  ): Promise<
    | { ok: true; record: WorksheetAccountRecord }
    | { ok: false; record: WorksheetAccountRecord | undefined }
  >;
}

export class MemoryWorksheetAccountStore implements WorksheetAccountStore {
  readonly rows = new Map<string, WorksheetAccountRecord>();
  async get(uid: string) {
    const row = this.rows.get(uid);
    return row ? structuredClone(row) : undefined;
  }
  async compareAndSwap(
    uid: string,
    baseRevision: number,
    snapshot: WorksheetAccountSnapshot,
  ) {
    const current = this.rows.get(uid);
    if ((current?.revision ?? 0) !== baseRevision)
      return {
        ok: false as const,
        record: current ? structuredClone(current) : undefined,
      };
    const record = { revision: baseRevision + 1, snapshot };
    this.rows.set(uid, structuredClone(record));
    return { ok: true as const, record };
  }
}

export class FileWorksheetAccountStore implements WorksheetAccountStore {
  private ready: Promise<unknown>;
  constructor(private readonly dir: string) {
    this.ready = mkdir(dir, { recursive: true, mode: 0o700 });
  }
  private path(uid: string) {
    const name = createHash("sha256").update(uid).digest("hex");
    return resolve(this.dir, `${name}.json`);
  }
  async get(uid: string) {
    await this.ready;
    try {
      const parsed: unknown = JSON.parse(
        await readFile(this.path(uid), "utf8"),
      );
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        typeof (parsed as { revision?: unknown }).revision !== "number"
      )
        return undefined;
      const row = parsed as { revision: number; snapshot: unknown };
      return {
        revision: row.revision,
        snapshot: parseWorksheetAccountSnapshot(row.snapshot),
      };
    } catch (error) {
      if ((error as { code?: string }).code === "ENOENT") return undefined;
      throw error;
    }
  }
  async compareAndSwap(
    uid: string,
    baseRevision: number,
    snapshot: WorksheetAccountSnapshot,
  ) {
    await this.ready;
    const current = await this.get(uid);
    if ((current?.revision ?? 0) !== baseRevision)
      return { ok: false as const, record: current };
    const record = { revision: baseRevision + 1, snapshot };
    const file = this.path(uid);
    const temporary = `${file}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(record), { mode: 0o600 });
    await rename(temporary, file);
    return { ok: true as const, record };
  }
}

function json(body: unknown, status = 200, origin?: string | null) {
  const headers = new Headers(noStore);
  if (
    origin === CREW_PAGE_ORIGIN ||
    origin === "http://127.0.0.1:5173" ||
    origin === "http://localhost:5173"
  ) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-credentials", "true");
    headers.set("vary", "Origin");
  }
  return Response.json(body, { status, headers });
}

export function createWorksheetAccountRoutes(store: WorksheetAccountStore) {
  const fail = (error: unknown) => {
    console.error("Worksheet account store failed:", error);
    return json({ error: "Worksheet account is unavailable right now" }, 503);
  };
  return new Elysia({ name: "worksheet-account" })
    .options("/crew/api/worksheet", ({ request }) => {
      const origin = request.headers.get("origin");
      const response = json(null, 204, origin);
      response.headers.set("access-control-allow-methods", "GET, PUT, OPTIONS");
      response.headers.set("access-control-allow-headers", "content-type");
      return response;
    })
    .get("/crew/api/worksheet", async ({ request }) => {
      const who = identityOf(request);
      if (!who)
        return json(
          { error: "Sign in at /crew/ first" },
          401,
          request.headers.get("origin"),
        );
      try {
        const record = await store.get(who.uid);
        return json(
          record ?? { revision: 0, snapshot: null },
          200,
          request.headers.get("origin"),
        );
      } catch (error) {
        return fail(error);
      }
    })
    .put("/crew/api/worksheet", async ({ request }) => {
      const origin = request.headers.get("origin");
      const who = identityOf(request);
      if (!who) return json({ error: "Sign in at /crew/ first" }, 401, origin);
      const text = await request.text();
      if (text.length > WORKSHEET_ACCOUNT_MAX_BYTES)
        return json({ error: "worksheet is too large" }, 413, origin);
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        return json({ error: "worksheet must be JSON" }, 400, origin);
      }
      if (typeof body !== "object" || body === null)
        return json({ error: "worksheet must be an object" }, 400, origin);
      const raw = body as { baseRevision?: unknown; snapshot?: unknown };
      if (
        typeof raw.baseRevision !== "number" ||
        !Number.isInteger(raw.baseRevision) ||
        raw.baseRevision < 0
      )
        return json(
          { error: "baseRevision must be a whole number" },
          400,
          origin,
        );
      let snapshot: WorksheetAccountSnapshot;
      try {
        snapshot = parseWorksheetAccountSnapshot(raw.snapshot);
      } catch (error) {
        if (error instanceof WorksheetAccountRejected)
          return json({ error: error.message }, 400, origin);
        throw error;
      }
      try {
        const result = await store.compareAndSwap(
          who.uid,
          raw.baseRevision,
          snapshot,
        );
        if (!result.ok)
          return json(
            {
              error: "The crew copy changed",
              revision: result.record?.revision ?? 0,
              snapshot: result.record?.snapshot ?? null,
            },
            409,
            origin,
          );
        return json(result.record, 200, origin);
      } catch (error) {
        return fail(error);
      }
    });
}
