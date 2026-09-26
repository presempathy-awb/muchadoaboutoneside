import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createApp } from "./app";
import {
  FileWorksheetAccountStore,
  MemoryWorksheetAccountStore,
} from "./worksheet-account";

const signed = {
  "x-authentik-uid": "11111111-1111-1111-1111-111111111111",
  "x-authentik-username": "ada",
};
const other = {
  "x-authentik-uid": "22222222-2222-2222-2222-222222222222",
  "x-authentik-username": "bea",
};

function worksheet() {
  return { version: 1, settings: {}, text: "the quick brown fox" };
}

async function put(
  app: ReturnType<typeof createApp>,
  headers: Record<string, string>,
  body: unknown,
) {
  return app.handle(
    new Request("http://erebe.local/crew/api/worksheet", {
      method: "PUT",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

describe("crew worksheet account", () => {
  test("stays closed without Authentik identity", async () => {
    const app = createApp({
      worksheetAccounts: new MemoryWorksheetAccountStore(),
    });
    const response = await app.handle(
      new Request("http://erebe.local/crew/api/worksheet"),
    );
    expect(response.status).toBe(401);
  });

  test("saves one worksheet per person and refuses a stale revision", async () => {
    const app = createApp({
      worksheetAccounts: new MemoryWorksheetAccountStore(),
    });
    const first = await put(app, signed, {
      baseRevision: 0,
      snapshot: worksheet(),
    });
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ revision: 1 });

    const loaded = await app.handle(
      new Request("http://erebe.local/crew/api/worksheet", { headers: signed }),
    );
    expect(await loaded.json()).toMatchObject({
      revision: 1,
      snapshot: { text: "the quick brown fox" },
    });

    const otherView = await app.handle(
      new Request("http://erebe.local/crew/api/worksheet", { headers: other }),
    );
    expect(await otherView.json()).toEqual({ revision: 0, snapshot: null });

    const stale = await put(app, signed, {
      baseRevision: 0,
      snapshot: { ...worksheet(), text: "overwritten" },
    });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ revision: 1 });

    const next = await put(app, signed, {
      baseRevision: 1,
      snapshot: { ...worksheet(), text: "second" },
    });
    expect(next.status).toBe(200);
    expect(await next.json()).toMatchObject({
      revision: 2,
      snapshot: { text: "second" },
    });
  });

  test("keeps the file after a new store opens the same directory", async () => {
    const dir = await mkdtemp(resolve(tmpdir(), "muchado-worksheet-account-"));
    try {
      const first = createApp({
        worksheetAccounts: new FileWorksheetAccountStore(dir),
      });
      const saved = await put(first, signed, {
        baseRevision: 0,
        snapshot: worksheet(),
      });
      expect(saved.status).toBe(200);
      const second = createApp({
        worksheetAccounts: new FileWorksheetAccountStore(dir),
      });
      const loaded = await second.handle(
        new Request("http://erebe.local/crew/api/worksheet", {
          headers: signed,
        }),
      );
      expect(await loaded.json()).toMatchObject({ revision: 1 });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("lets the public studio call the crew host", async () => {
    const app = createApp({
      worksheetAccounts: new MemoryWorksheetAccountStore(),
    });
    const response = await app.handle(
      new Request("http://erebe.local/crew/api/worksheet", {
        method: "OPTIONS",
        headers: { origin: "https://muchadoaboutoneside.com" },
      }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://muchadoaboutoneside.com",
    );
    expect(response.headers.get("access-control-allow-credentials")).toBe(
      "true",
    );
  });
});
