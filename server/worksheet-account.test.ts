import { describe, expect, spyOn, test } from "bun:test";
import * as fsPromises from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { parseWorksheetAccountSnapshot } from "../shared/worksheet-account";
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
  test("the public cockpit never accepts a forged crew identity", async () => {
    const app = createApp({
      worksheetAccounts: new MemoryWorksheetAccountStore(),
    });
    expect(
      (await put(app, signed, { baseRevision: 0, snapshot: worksheet() }))
        .status,
    ).toBe(200);
    for (const host of [
      "hotgoddesshotpen.muchadoaboutoneside.com",
      "HotGoddessHotPen.muchadoaboutoneside.com.:443",
    ]) {
      const response = await app.handle(
        new Request("http://erebe.local/crew/api/worksheet", {
          headers: { ...signed, host },
        }),
      );
      expect(response.status).toBe(401);
      const write = await put(
        app,
        { ...signed, host },
        {
          baseRevision: 1,
          snapshot: { ...worksheet(), text: "forged overwrite" },
        },
      );
      expect(write.status).toBe(401);
    }
    const crew = await app.handle(
      new Request("http://erebe.local/crew/api/worksheet", { headers: signed }),
    );
    expect(crew.status).toBe(200);
    expect(await crew.json()).toMatchObject({
      revision: 1,
      snapshot: { text: "the quick brown fox" },
    });
  });

  test("the HTTP listener rejects cockpit identity headers before crew handlers run", async () => {
    const app = createApp({
      worksheetAccounts: new MemoryWorksheetAccountStore(),
    }).listen({ hostname: "127.0.0.1", port: 0 });
    try {
      const url = `http://127.0.0.1:${app.server?.port}/crew/api/worksheet`;
      const headers = {
        ...signed,
        host: "hotgoddesshotpen.muchadoaboutoneside.com",
      };
      expect((await fetch(url, { headers })).status).toBe(401);
      expect(
        (
          await fetch(url, {
            method: "PUT",
            headers: { ...headers, "content-type": "application/json" },
            body: JSON.stringify({ baseRevision: 0, snapshot: worksheet() }),
          })
        ).status,
      ).toBe(401);
      const crew = await fetch(url, { headers: signed });
      expect(crew.status).toBe(200);
      expect(await crew.json()).toEqual({ revision: 0, snapshot: null });
    } finally {
      await app.stop(true);
    }
  });

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

  test("serializes concurrent file saves for the same revision", async () => {
    const dir = await mkdtemp(resolve(tmpdir(), "muchado-worksheet-account-"));
    try {
      const app = createApp({
        worksheetAccounts: new FileWorksheetAccountStore(dir),
      });
      const responses = await Promise.all([
        put(app, signed, {
          baseRevision: 0,
          snapshot: { ...worksheet(), text: "first concurrent save" },
        }),
        put(app, signed, {
          baseRevision: 0,
          snapshot: { ...worksheet(), text: "second concurrent save" },
        }),
      ]);

      expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
      const loaded = await app.handle(
        new Request("http://erebe.local/crew/api/worksheet", {
          headers: signed,
        }),
      );
      expect(await loaded.json()).toMatchObject({ revision: 1 });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("releases a failed file save for a clean same-user retry", async () => {
    const dir = await mkdtemp(resolve(tmpdir(), "muchado-worksheet-account-"));
    const failure = Object.assign(new Error("forced rename failure"), {
      code: "EIO",
    });
    const rename = spyOn(fsPromises, "rename").mockRejectedValueOnce(failure);
    try {
      const store = new FileWorksheetAccountStore(dir);
      const snapshot = parseWorksheetAccountSnapshot(worksheet());
      const [failed, retried] = await Promise.allSettled([
        store.compareAndSwap(signed["x-authentik-uid"], 0, snapshot),
        store.compareAndSwap(signed["x-authentik-uid"], 0, {
          ...snapshot,
          text: "retry after failure",
        }),
      ]);

      expect(failed.status).toBe("rejected");
      if (failed.status === "rejected") expect(failed.reason).toBe(failure);
      expect(retried).toMatchObject({
        status: "fulfilled",
        value: { ok: true, record: { revision: 1 } },
      });
      expect(await store.get(signed["x-authentik-uid"])).toMatchObject({
        revision: 1,
        snapshot: { text: "retry after failure" },
      });
      const files = await fsPromises.readdir(dir);
      expect(files).toHaveLength(1);
      expect(files[0]?.endsWith(".tmp")).toBe(false);
    } finally {
      rename.mockRestore();
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

  test("permits only the exact cockpit origin without granting crew identity", async () => {
    const app = createApp({
      worksheetAccounts: new MemoryWorksheetAccountStore(),
    });
    for (const [origin, allowed] of [
      ["https://hotgoddesshotpen.muchadoaboutoneside.com", true],
      [
        "https://hotgoddesshotpen.muchadoaboutoneside.com.attacker.invalid",
        false,
      ],
      ["http://hotgoddesshotpen.muchadoaboutoneside.com", false],
    ] as const) {
      for (const method of ["OPTIONS", "GET"]) {
        const response = await app.handle(
          new Request("http://erebe.local/crew/api/worksheet", {
            method,
            headers: { origin },
          }),
        );
        expect(response.status).toBe(method === "OPTIONS" ? 204 : 401);
        expect(response.headers.get("access-control-allow-origin")).toBe(
          allowed ? origin : null,
        );
        expect(response.headers.get("access-control-allow-credentials")).toBe(
          allowed ? "true" : null,
        );
      }
    }
  });
});
