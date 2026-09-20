/**
 * The crew's inventory lives in pacinman (workspace `erebe`). This proxy lets
 * the crew page read it and flip statuses as the signed-in person: pacinman's
 * sync API accepts a trusted caller address on its allow-list, so the request
 * carries the Authentik email. No identity, no inventory — and the address
 * must be on pacinman's list, which is that project's call.
 */
import { Elysia } from "elysia";
import { identityOf } from "./identity";

export interface InventoryOptions {
  name: string;
  /** pacinman sync API base, e.g. http://172.26.0.36:42426 */
  syncUrl?: string;
  /** An origin on pacinman's allow-list; browser-path writes require it. */
  origin?: string;
  workspace?: string;
  fetch?: typeof fetch;
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
  const base = `/api/modules/${options.name}`;
  const upstream = (path: string, email: string, init: RequestInit = {}) =>
    doFetch(`${options.syncUrl}/api/packing/workspaces/${workspace}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        "x-auth-request-email": email,
        origin: options.origin ?? "",
      },
    });

  return new Elysia({ name: `module-${options.name}-inventory` })
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
        return json({ error: "Inventory is not configured" }, 503);
      const res = await upstream("", who.email);
      if (res.status === 403)
        return json({ error: "pacinman does not know this address yet" }, 403);
      if (!res.ok)
        return json({ error: `pacinman returned ${res.status}` }, 502);
      const body = (await res.json()) as {
        data?: { workspace: unknown; items: unknown[] };
        workspace?: unknown;
        items?: unknown[];
      };
      const snap = body.data ?? body;
      return json({ workspace: snap.workspace, items: snap.items ?? [] });
    })
    .post(`${base}/inventory/mutations`, async ({ request }) => {
      const who = identityOf(request);
      if (!who) return json({ error: "Sign in at /crew/ first" }, 401);
      if (!who.email) return json({ error: "Your account has no email" }, 403);
      if (!options.syncUrl)
        return json({ error: "Inventory is not configured" }, 503);
      const text = await request.text();
      if (text.length > 256 * 1024) return json({ error: "Too large" }, 413);
      const res = await upstream("/mutations", who.email, {
        method: "POST",
        body: text,
        headers: { "content-type": "application/json" },
      });
      const out = await res.text();
      return new Response(out, {
        status: res.status,
        headers: { ...noStore, "content-type": "application/json" },
      });
    });
}
