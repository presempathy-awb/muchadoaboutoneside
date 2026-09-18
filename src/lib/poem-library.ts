import {
  isSavedPoemId,
  POEM_VERSIONS,
  type PoemId,
  type PoemVersion,
  type SavedPoemId,
} from "../../shared/poem";
import {
  assertDeletablePoemId,
  createSavedPoemRecord,
  parseSavedPoemRecord,
  poemNameKey,
  type SavedPoemRecord,
  type SavePoemVersionInput,
  savedPoemVersion,
} from "../../shared/poem-library";

const DATABASE_NAME = "muchado-poem-library-v1";
const STORE_NAME = "versions";
const DELETED_STORE_NAME = "deleted-versions";
const CHANNEL_NAME = "muchado:poem-library:v1";
const CHANGE_KEY = "muchado.poem-library-change";

export interface PoemLibrarySnapshot {
  readonly versions: readonly PoemVersion[];
  readonly ready: boolean;
  readonly error: string | null;
}

export const INITIAL_POEM_LIBRARY: PoemLibrarySnapshot = Object.freeze({
  versions: POEM_VERSIONS,
  ready: false,
  error: null,
});

/** A save resolves only after the complete immutable record is committed. */
export interface PoemLibraryStorage {
  read(): Promise<readonly SavedPoemRecord[]>;
  save(record: SavedPoemRecord): Promise<void>;
  delete(id: PoemId): Promise<void>;
  deleted(): Promise<readonly SavedPoemId[]>;
}

export interface PoemLibrary {
  readonly ready: Promise<void>;
  getSnapshot(): PoemLibrarySnapshot;
  subscribe(listener: () => void): () => void;
  refresh(): Promise<void>;
  saveVersion(input: SavePoemVersionInput): Promise<PoemVersion>;
  deleteVersion(id: PoemId): Promise<void>;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(
        new Error("Browser storage is unavailable. The version was not saved."),
      );
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, 2);
    let settled = false;
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        const store = request.result.createObjectStore(STORE_NAME, {
          keyPath: "id",
        });
        store.createIndex("nameKey", "nameKey", { unique: true });
      }
      if (!request.result.objectStoreNames.contains(DELETED_STORE_NAME))
        request.result.createObjectStore(DELETED_STORE_NAME);
    };
    request.onsuccess = () => {
      if (settled) request.result.close();
      else {
        settled = true;
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      }
    };
    request.onerror = () => {
      settled = true;
      reject(
        request.error ?? new Error("The poem library could not be opened."),
      );
    };
    request.onblocked = () => {
      settled = true;
      reject(
        new Error(
          "Another tab is blocking the poem library. Close it and try again.",
        ),
      );
    };
  });
}

function transactionError(error: DOMException | null): Error {
  if (error?.name === "ConstraintError")
    return new Error("That version name already exists. Choose a unique name.");
  if (error?.name === "QuotaExceededError")
    return new Error("Browser storage is full. The version was not saved.");
  return (
    error ??
    new Error("The poem library could not finish saving. Please try again.")
  );
}

export function browserPoemLibraryStorage(): PoemLibraryStorage {
  return {
    async read() {
      const database = await openDatabase();
      try {
        return await new Promise<readonly SavedPoemRecord[]>(
          (resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, "readonly");
            const request = transaction.objectStore(STORE_NAME).getAll();
            let result: readonly SavedPoemRecord[] = [];
            request.onsuccess = () => {
              try {
                result = request.result.map(parseSavedPoemRecord);
              } catch (error) {
                transaction.abort();
                reject(error);
              }
            };
            transaction.oncomplete = () => resolve(result);
            transaction.onabort = () =>
              reject(transactionError(transaction.error));
            transaction.onerror = () =>
              reject(transactionError(transaction.error));
          },
        );
      } finally {
        database.close();
      }
    },
    async save(record) {
      const valid = parseSavedPoemRecord(record);
      const database = await openDatabase();
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction(
            [STORE_NAME, DELETED_STORE_NAME],
            "readwrite",
          );
          let failure: Error | undefined;
          const deleted = transaction
            .objectStore(DELETED_STORE_NAME)
            .getKey(valid.id);
          // add, never put: neither an existing id nor its snapshot can be replaced.
          deleted.onsuccess = () => {
            if (deleted.result !== undefined) {
              failure = new Error(
                "This poem version was deleted and cannot be restored under its old id.",
              );
              transaction.abort();
              return;
            }
            transaction
              .objectStore(STORE_NAME)
              .add({ ...valid, nameKey: poemNameKey(valid.name) });
          };
          transaction.oncomplete = () => resolve();
          transaction.onabort = () =>
            reject(failure ?? transactionError(transaction.error));
          transaction.onerror = () =>
            reject(transactionError(transaction.error));
        });
      } finally {
        database.close();
      }
    },
    async delete(id) {
      assertDeletablePoemId(id);
      const database = await openDatabase();
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction(
            [STORE_NAME, DELETED_STORE_NAME],
            "readwrite",
          );
          transaction.objectStore(STORE_NAME).delete(id);
          // The tombstone contains no poem text. It prevents stale tabs seeding it again.
          transaction.objectStore(DELETED_STORE_NAME).put(true, id);
          transaction.oncomplete = () => resolve();
          transaction.onabort = () =>
            reject(transactionError(transaction.error));
          transaction.onerror = () =>
            reject(transactionError(transaction.error));
        });
      } finally {
        database.close();
      }
    },
    async deleted() {
      const database = await openDatabase();
      try {
        return await new Promise<readonly SavedPoemId[]>((resolve, reject) => {
          const transaction = database.transaction(
            DELETED_STORE_NAME,
            "readonly",
          );
          const request = transaction
            .objectStore(DELETED_STORE_NAME)
            .getAllKeys();
          transaction.oncomplete = () =>
            resolve(request.result.filter(isSavedPoemId));
          transaction.onabort = () =>
            reject(transactionError(transaction.error));
          transaction.onerror = () =>
            reject(transactionError(transaction.error));
        });
      } finally {
        database.close();
      }
    },
  };
}

/** Checked before opening a private draft, including in a newly loaded tab. */
export async function isSavedPoemDeleted(id: SavedPoemId): Promise<boolean> {
  return (await browserPoemLibraryStorage().deleted()).includes(id);
}

function libraryVersions(
  records: readonly SavedPoemRecord[],
): readonly PoemVersion[] {
  const ids = new Set<PoemId>(POEM_VERSIONS.map((version) => version.id));
  const names = new Set(
    POEM_VERSIONS.map((version) => poemNameKey(version.label)),
  );
  const saved = records
    .map(parseSavedPoemRecord)
    .sort(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) ||
        left.id.localeCompare(right.id),
    );
  for (const record of saved) {
    const name = poemNameKey(record.name);
    if (ids.has(record.id) || names.has(name))
      throw new Error(
        "The saved poem library contains duplicate versions. Existing copies were preserved.",
      );
    ids.add(record.id);
    names.add(name);
  }
  return Object.freeze([...POEM_VERSIONS, ...saved.map(savedPoemVersion)]);
}

export function createPoemLibrary(
  storage: PoemLibraryStorage = browserPoemLibraryStorage(),
  notify: () => void = () => {},
  deleteDraft: (id: SavedPoemId) => Promise<void> = async () => {},
): PoemLibrary {
  let snapshot = INITIAL_POEM_LIBRARY;
  const listeners = new Set<() => void>();
  let revision = 0;
  let operations: Promise<unknown> = Promise.resolve();
  const cleanups = new Map<SavedPoemId, Promise<void>>();
  const cleanup = (id: SavedPoemId) => {
    let result = cleanups.get(id);
    if (!result) {
      result = deleteDraft(id).catch((cause) => {
        cleanups.delete(id);
        throw new Error(
          `The named version was removed, but its private working draft could not be cleared. Close other tabs and reload to retry. ${cause instanceof Error ? cause.message : "Browser storage is unavailable."}`,
        );
      });
      cleanups.set(id, result);
    }
    return result;
  };
  const update = (patch: Partial<PoemLibrarySnapshot>) => {
    snapshot = Object.freeze({ ...snapshot, ...patch });
    for (const listener of listeners) listener();
  };
  const reportError = (cause: unknown) => {
    update({
      error:
        cause instanceof Error
          ? cause.message
          : "The saved poem library is unavailable.",
    });
  };
  const refresh = async () => {
    const current = ++revision;
    try {
      const versions = libraryVersions(await storage.read());
      if (current === revision) update({ versions, ready: true, error: null });
      // A deletion notification also closes any active private draft in this tab.
      await Promise.all((await storage.deleted()).map(cleanup));
    } catch (error) {
      if (current === revision) {
        reportError(error);
        update({ ready: true });
      }
    }
  };
  const ready = refresh();
  const enqueue = <T>(action: () => Promise<T>): Promise<T> => {
    const result = operations.then(action);
    operations = result.catch(() => {});
    return result;
  };
  return {
    ready,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    refresh,
    saveVersion(input) {
      const requested = { ...input };
      return enqueue(async () => {
        await ready;
        try {
          const records = await storage.read();
          const versions = libraryVersions(records);
          const record = createSavedPoemRecord(
            requested,
            versions,
            `saved-${crypto.randomUUID()}`,
            new Date().toISOString(),
          );
          await storage.save(record);
          // Only a completed storage transaction can make a saved version visible.
          revision += 1;
          update({
            versions: libraryVersions([...records, record]),
            ready: true,
            error: null,
          });
          notify();
          await refresh();
          return savedPoemVersion(record);
        } catch (error) {
          reportError(error);
          throw error;
        }
      });
    },
    deleteVersion(id) {
      return enqueue(async () => {
        await ready;
        try {
          assertDeletablePoemId(id);
          await storage.delete(id);
          revision += 1;
          update({
            versions: Object.freeze(
              snapshot.versions.filter((version) => version.id !== id),
            ),
            error: null,
          });
          notify();
          await cleanup(id);
          await refresh();
        } catch (error) {
          reportError(error);
          throw error;
        }
      });
    },
  };
}

let singleton: PoemLibrary | undefined;

export function getPoemLibrary(): PoemLibrary {
  if (singleton) return singleton;
  let channel: BroadcastChannel | undefined;
  try {
    if (typeof window !== "undefined")
      channel = new BroadcastChannel(CHANNEL_NAME);
  } catch {}
  const library = createPoemLibrary(
    browserPoemLibraryStorage(),
    () => {
      try {
        channel?.postMessage("changed");
      } catch {}
      try {
        window.localStorage.setItem(CHANGE_KEY, crypto.randomUUID());
      } catch {}
    },
    async (id) => {
      const { deleteDraftSession } = await import("./poem-drafts");
      await deleteDraftSession(id);
    },
  );
  if (channel) channel.onmessage = () => void library.refresh();
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
      if (event.key === CHANGE_KEY || event.key === null)
        void library.refresh();
    });
    window.addEventListener("focus", () => void library.refresh());
  }
  singleton = library;
  return library;
}
