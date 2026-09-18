import { expect, spyOn, test } from "bun:test";
import { POEM_VERSIONS, type SavedPoemId } from "../../shared/poem";
import {
  createSavedPoemRecord,
  savedPoemVersion,
} from "../../shared/poem-library";
import { deleteDraftSession, draftSession } from "./poem-drafts";

test("a saved poem draft stays private, preserves its source, and resets undoably", async () => {
  const source = " First line\n\n\nLast line  \n";
  const saved = savedPoemVersion(
    createSavedPoemRecord(
      { name: "Private copy", text: source },
      POEM_VERSIONS,
      `saved-${crypto.randomUUID()}`,
      "2026-09-18T12:00:00Z",
    ),
  );
  const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ enabled: true }),
  );
  const session = draftSession(saved);
  try {
    await session.ready;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(session.getStatus().sync).toBe("off");
    expect(session.room).toStartWith("private-poem-saved-");
    expect(session.text.toString()).toBe(source);
    session.setText("Replacement\n\nwords");
    expect(saved.sourceText).toBe(source);
    session.reset();
    expect(session.text.toString()).toBe(source);
    session.undo.undo();
    expect(session.text.toString()).toBe("Replacement\n\nwords");
    expect(() => session.setText("x".repeat(20_001))).toThrow("20,000");
  } finally {
    fetchSpy.mockRestore();
    session.undo.destroy();
    session.awareness.destroy();
    session.doc.destroy();
  }
});

test("deleting a private draft clears only its database and prevents reuse of stale session objects", async () => {
  const saved = savedPoemVersion(
    createSavedPoemRecord(
      { name: "Delete this copy", text: "Private working words" },
      POEM_VERSIONS,
      `saved-${crypto.randomUUID()}`,
      "2026-09-18T12:00:00Z",
    ),
  );
  const session = draftSession(saved);
  await session.ready;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
  const deletedDatabases: string[] = [];
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: {
      deleteDatabase(name: string) {
        deletedDatabases.push(name);
        const request = { onsuccess: undefined as (() => void) | undefined };
        queueMicrotask(() => request.onsuccess?.());
        return request;
      },
    },
  });
  try {
    for (const original of POEM_VERSIONS)
      await expect(deleteDraftSession(original.id)).rejects.toThrow(
        "cannot be deleted",
      );
    expect(deletedDatabases).toEqual([]);
    await deleteDraftSession(saved.id);
    expect(deletedDatabases).toEqual([`private-poem-${saved.id}`]);
    expect(session.getStatus().deleted).toBe(true);
    expect(() => session.setText("Bring it back")).toThrow("deleted");
    expect(() => draftSession(saved)).toThrow("deleted");
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "indexedDB", descriptor);
    else Reflect.deleteProperty(globalThis, "indexedDB");
  }
});

test("a persisted deletion tombstone prevents a fresh private session from opening or seeding a draft database", async () => {
  const id: SavedPoemId = `saved-${crypto.randomUUID()}`;
  const saved = savedPoemVersion(
    createSavedPoemRecord(
      { name: "Deleted in another tab", text: "Do not bring this back" },
      POEM_VERSIONS,
      id,
      "2026-09-18T12:00:00Z",
    ),
  );
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
  const openedDatabases: string[] = [];
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: {
      open(name: string) {
        openedDatabases.push(name);
        const database = {
          close() {},
          transaction(store: string) {
            expect(store).toBe("deleted-versions");
            const transaction = {
              oncomplete: undefined as (() => void) | undefined,
              objectStore: () => ({ getAllKeys: () => ({ result: [id] }) }),
            };
            queueMicrotask(() => transaction.oncomplete?.());
            return transaction;
          },
        };
        const request = {
          result: database,
          onsuccess: undefined as (() => void) | undefined,
        };
        queueMicrotask(() => request.onsuccess?.());
        return request;
      },
    },
  });
  try {
    const session = draftSession(saved);
    await session.ready;
    expect(openedDatabases).toEqual(["muchado-poem-library-v1"]);
    expect(session.getStatus().deleted).toBe(true);
    expect(session.text.toString()).toBe("");
    expect(() => draftSession(saved)).toThrow("deleted");
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "indexedDB", descriptor);
    else Reflect.deleteProperty(globalThis, "indexedDB");
  }
});
