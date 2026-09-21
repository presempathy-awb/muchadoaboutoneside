/**
 * The crew's inventory lives in pacinman (workspace `erebe`). This proxy lets
 * the crew page read it and flip statuses as the signed-in person: pacinman's
 * sync API accepts a trusted caller address on its allow-list, so the request
 * carries the Authentik email. No identity, no inventory — and the address
 * must be on pacinman's list, which is that project's call.
 *
 * With `cacheDir` set, every good read is kept on disk. If pacinman is then
 * missing or down, a person pacinman has already accepted gets that last copy
 * back, marked `stale` with its time. Writes are refused while it is down:
 * queueing them would replay someone's authority later, unseen.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Elysia } from "elysia";
import { identityBases, identityOf } from "./identity";

export interface InventoryOptions {
  name: string;
  /** pacinman sync API base, e.g. http://172.26.0.36:42426 */
  syncUrl?: string;
  /** An origin on pacinman's allow-list; browser-path writes require it. */
  origin?: string;
  workspace?: string;
  /** Directory for the last good snapshot; see the disk fallback above. */
  cacheDir?: string;
  fetch?: typeof fetch;
}

interface CachedInventory {
  cachedAt: string;
  workspace: unknown;
  items: unknown[];
  /** sha256 of every address pacinman accepted; only these may read the copy. */
  readers: string[];
}

const readerKey = (email: string) =>
  createHash("sha256").update(email.trim().toLowerCase()).digest("hex");

function inventoryCache(dir: string, workspace: string) {
  const file = resolve(
    dir,
    `inventory-${readerKey(workspace).slice(0, 16)}.json`,
  );
  const read = async (): Promise<CachedInventory | undefined> => {
    try {
      return JSON.parse(await readFile(file, "utf8")) as CachedInventory;
    } catch {
      return undefined;
    }
  };
  return {
    read,
    async write(email: string, workspaceBody: unknown, items: unknown[]) {
      const readers = new Set((await read())?.readers ?? []);
      readers.add(readerKey(email));
      await mkdir(dir, { recursive: true, mode: 0o700 });
      const temporary = `${file}.${process.pid}.tmp`;
      await writeFile(
        temporary,
        JSON.stringify({
          cachedAt: new Date().toISOString(),
          workspace: workspaceBody,
          items,
          readers: [...readers],
        } satisfies CachedInventory),
        { mode: 0o600 },
      );
      await rename(temporary, file);
    },
  };
}

export function inventoryFromEnv(env = process.env) {
  return {
    syncUrl: env.PACINMAN_SYNC_URL?.trim() || undefined,
    origin: env.PACINMAN_ORIGIN?.trim() || "https://packing-man.telpher.stream",
    workspace: env.PACINMAN_WORKSPACE?.trim() || "erebe",
  };
}

const noStore = { "cache-control": "no-store" };
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: noStore });

export function createInventoryRoutes(options: InventoryOptions) {
  const doFetch = options.fetch ?? fetch;
  const workspace = options.workspace ?? "erebe";
  const cache = options.cacheDir
    ? inventoryCache(options.cacheDir, workspace)
    : undefined;
  /** The last good copy, for someone pacinman accepted before; else the failure. */
  const staleOr = async (email: string, failure: Response) => {
    const copy = await cache?.read();
    if (!copy?.readers.includes(readerKey(email))) return failure;
    return json({
      workspace: copy.workspace,
      items: copy.items,
      stale: true,
      cachedAt: copy.cachedAt,
    });
  };
  const upstream = (path: string, email: string, init: RequestInit = {}) =>
    doFetch(`${options.syncUrl}/api/packing/workspaces/${workspace}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        "x-auth-request-email": email,
        origin: options.origin ?? "",
      },
    });

  const app = new Elysia({ name: `module-${options.name}-inventory` });
  for (const base of identityBases(options.name))
    app
      .get(`${base}/whoami`, ({ request }) =>
        json({ identity: identityOf(request) ?? null }),
      )
      .get(`${base}/inventory`, async ({ request }) => {
        const who = identityOf(request);
        if (!who) return json({ error: "Sign in at /crew/ first" }, 401);
        if (!who.email)
          return json(
            { error: "Your account has no email; inventory needs one" },
            403,
          );
        if (!options.syncUrl)
          return staleOr(
            who.email,
            json({ error: "Inventory is not configured" }, 503),
          );
        let res: Response;
        try {
          res = await upstream("", who.email);
        } catch {
          return staleOr(
            who.email,
            json({ error: "pacinman is unreachable" }, 502),
          );
        }
        if (res.status === 403)
          return json(
            { error: "pacinman does not know this address yet" },
            403,
          );
        if (!res.ok)
          return staleOr(
            who.email,
            json({ error: `pacinman returned ${res.status}` }, 502),
          );
        const body = (await res.json()) as {
          data?: { workspace: unknown; items: unknown[] };
          workspace?: unknown;
          items?: unknown[];
        };
        const snap = body.data ?? body;
        const items = snap.items ?? [];
        await cache
          ?.write(who.email, snap.workspace, items)
          .catch((error: unknown) =>
            console.error("Could not cache the inventory:", error),
          );
        return json({ workspace: snap.workspace, items });
      })
      .post(`${base}/inventory/mutations`, async ({ request }) => {
        const who = identityOf(request);
        if (!who) return json({ error: "Sign in at /crew/ first" }, 401);
        if (!who.email)
          return json({ error: "Your account has no email" }, 403);
        if (!options.syncUrl)
          return json({ error: "Inventory is not configured" }, 503);
        const text = await request.text();
        if (text.length > 256 * 1024) return json({ error: "Too large" }, 413);
        let res: Response;
        try {
          res = await upstream("/mutations", who.email, {
            method: "POST",
            body: text,
            headers: { "content-type": "application/json" },
          });
        } catch {
          return json(
            { error: "pacinman is unreachable; nothing was changed" },
            503,
          );
        }
        const out = await res.text();
        return new Response(out, {
          status: res.status,
          headers: { ...noStore, "content-type": "application/json" },
        });
      });
  return app;
}
