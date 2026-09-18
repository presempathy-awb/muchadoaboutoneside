import { afterEach, describe, expect, test } from "bun:test";
import type { CalligraphyScan } from "../../shared/calligraphy-scan";
import {
  deleteCalligraphyScan,
  getCalligraphyScan,
  listCalligraphyScans,
  saveCalligraphyScan,
  subscribeCalligraphyScans,
  verifyCalligraphyScanOriginal,
} from "./calligraphy-scan-store";

/** A bounded transactional IDB double; writes become visible only on completion. */
function installDatabase() {
  const data: Record<string, Map<string, unknown>> = {
    scans: new Map(),
    summaries: new Map(),
  };
  const reads: string[] = [];
  let failCommit = false;
  const db = {
    close() {},
    onversionchange: null,
    transaction(_names: string | string[], mode: string) {
      const draft = Object.fromEntries(
        Object.entries(data).map(([name, records]) => [name, new Map(records)]),
      );
      let pending = 0;
      let finished = false;
      const tx = {
        error: null as DOMException | null,
        oncomplete: null as (() => void) | null,
        onabort: null as (() => void) | null,
        onerror: null as (() => void) | null,
        abort() {
          finished = true;
          queueMicrotask(() => tx.onabort?.());
        },
        objectStore(name: string) {
          function request(operation: () => unknown) {
            const result = {
              result: undefined as unknown,
              onsuccess: null as (() => void) | null,
            };
            pending++;
            queueMicrotask(() => {
              if (finished) return;
              result.result = operation();
              result.onsuccess?.();
              pending--;
              queueMicrotask(() => {
                if (pending || finished) return;
                if (failCommit && mode === "readwrite") {
                  tx.error = new DOMException("Full", "QuotaExceededError");
                  tx.abort();
                  return;
                }
                finished = true;
                if (mode === "readwrite")
                  for (const [key, value] of Object.entries(draft))
                    data[key] = value;
                tx.oncomplete?.();
              });
            });
            return result;
          }
          return {
            get(id: string) {
              reads.push(`${name}:${id}`);
              return request(() => structuredClone(draft[name]?.get(id)));
            },
            getAll() {
              reads.push(`${name}:all`);
              return request(() =>
                structuredClone(Array.from(draft[name]?.values() ?? [])),
              );
            },
            put(value: { id: string }) {
              return request(() => {
                draft[name]?.set(value.id, structuredClone(value));
              });
            },
            delete(id: string) {
              return request(() => draft[name]?.delete(id));
            },
          };
        },
      };
      return tx;
    },
  };
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: {
      open() {
        const request = { result: db, onsuccess: null as (() => void) | null };
        queueMicrotask(() => request.onsuccess?.());
        return request;
      },
    },
  });
  return {
    data,
    reads,
    failNextCommit() {
      failCommit = true;
    },
  };
}

const originalIndexedDB = Object.getOwnPropertyDescriptor(
  globalThis,
  "indexedDB",
);
afterEach(() => {
  if (originalIndexedDB)
    Object.defineProperty(globalThis, "indexedDB", originalIndexedDB);
  else Reflect.deleteProperty(globalThis, "indexedDB");
});

async function fixture(): Promise<CalligraphyScan> {
  const dataUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/9l8AAAAASUVORK5CYII=";
  const bytes = Uint8Array.from(atob(dataUrl.split(",")[1] ?? ""), (char) =>
    char.charCodeAt(0),
  );
  const sha256 = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  return {
    version: 1,
    id: "scan-one",
    name: "A poem",
    calligrapher: "Jill Winters",
    text: "Hello!",
    createdAt: "2026-09-18T00:00:00.000Z",
    algorithmVersion: "projection-occurrences-1",
    original: {
      name: "original.png",
      type: "image/png",
      bytes: bytes.length,
      dataUrl,
      sha256,
    },
    image: { width: 1, height: 1, dataUrl },
    emHeightPx: 1,
    segments: [
      {
        text: "Hello!",
        wordStart: 0,
        wordEnd: 1,
        lineIndex: 0,
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      },
    ],
    confirmed: true,
  };
}

describe("durable handwriting storage boundaries", () => {
  test("saves originals durably, lists metadata only, and removes both records", async () => {
    const database = installDatabase();
    const scan = await fixture();
    await saveCalligraphyScan(scan);
    database.reads.length = 0;
    const catalogue = await listCalligraphyScans();
    expect(database.reads).toEqual(["summaries:all"]);
    expect(catalogue).toHaveLength(1);
    expect(catalogue[0]).toMatchObject({
      id: scan.id,
      name: scan.name,
      text: scan.text,
    });
    expect(catalogue[0]).not.toHaveProperty("original");
    expect(catalogue[0]).not.toHaveProperty("image");
    expect(catalogue[0]).not.toHaveProperty("segments");
    expect(await getCalligraphyScan(scan.id)).toEqual(scan);
    await deleteCalligraphyScan(scan.id);
    expect(await listCalligraphyScans()).toEqual([]);
    expect(await getCalligraphyScan(scan.id)).toBeUndefined();
  });

  test("same-ID inserts are idempotent and cannot replace an original", async () => {
    installDatabase();
    const scan = await fixture();
    await saveCalligraphyScan(scan);
    await saveCalligraphyScan(structuredClone(scan));
    expect(await listCalligraphyScans()).toHaveLength(1);
    await expect(
      saveCalligraphyScan({ ...scan, name: "Changed" }),
    ).rejects.toThrow("different saved scan");
    expect(await getCalligraphyScan(scan.id)).toEqual(scan);
  });

  test("restoring an exported record after removal preserves existing study references", async () => {
    installDatabase();
    const scan = await fixture();
    await saveCalligraphyScan(scan);
    const backup = JSON.stringify(await getCalligraphyScan(scan.id));
    const existingStudyReference = scan.id;
    await deleteCalligraphyScan(scan.id);
    expect(await getCalligraphyScan(existingStudyReference)).toBeUndefined();
    await saveCalligraphyScan(JSON.parse(backup));
    expect(await getCalligraphyScan(existingStudyReference)).toEqual(scan);
    expect(await listCalligraphyScans()).toHaveLength(1);
  });

  test("failed commits leave no payload or catalogue entry and emit no success", async () => {
    const database = installDatabase();
    database.failNextCommit();
    let notifications = 0;
    const unsubscribe = subscribeCalligraphyScans(() => notifications++);
    try {
      await expect(saveCalligraphyScan(await fixture())).rejects.toThrow(
        "Browser storage is full",
      );
      expect(database.data.scans?.size).toBe(0);
      expect(database.data.summaries?.size).toBe(0);
      expect(notifications).toBe(0);
    } finally {
      unsubscribe();
    }
  });

  test("catalogue cap rejects additional saves without losing existing entries", async () => {
    installDatabase();
    const scan = await fixture();
    for (let i = 0; i < 20; i++)
      await saveCalligraphyScan({ ...scan, id: `scan-${i}` });
    await expect(
      saveCalligraphyScan({ ...scan, id: "scan-extra" }),
    ).rejects.toThrow("20 scans and 128 MB");
    expect(await listCalligraphyScans()).toHaveLength(20);
    expect(await getCalligraphyScan("scan-extra")).toBeUndefined();
  });
  test("verifies original bytes against SHA-256 before saving", async () => {
    const scan = await fixture();
    await expect(verifyCalligraphyScanOriginal(scan)).resolves.toBeUndefined();
    await expect(
      saveCalligraphyScan({
        ...scan,
        original: { ...scan.original, sha256: "0".repeat(64) },
      }),
    ).rejects.toThrow("SHA-256");
  });

  test("unavailable IndexedDB cannot report a successful memory-only save", async () => {
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      value: undefined,
    });
    const scan = await fixture();
    let notifications = 0;
    const unsubscribe = subscribeCalligraphyScans(() => notifications++);
    try {
      await expect(saveCalligraphyScan(scan)).rejects.toThrow("not saved");
      await expect(listCalligraphyScans()).rejects.toThrow(
        "storage is unavailable",
      );
      await expect(getCalligraphyScan(scan.id)).rejects.toThrow(
        "storage is unavailable",
      );
      expect(notifications).toBe(0);
    } finally {
      unsubscribe();
    }
  });

  test("reports quota exhaustion explicitly", async () => {
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      value: {
        open() {
          const request = {
            error: new DOMException("Full", "QuotaExceededError"),
            onerror: null as (() => void) | null,
          };
          queueMicrotask(() => request.onerror?.());
          return request;
        },
      },
    });
    await expect(saveCalligraphyScan(await fixture())).rejects.toThrow(
      "Browser storage is full",
    );
  });
});
