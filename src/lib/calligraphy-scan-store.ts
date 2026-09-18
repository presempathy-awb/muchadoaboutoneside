import {
  type CalligraphyScan,
  type CalligraphyScanSummary,
  validateCalligraphyScan,
} from "../../shared/calligraphy-scan";

const DATABASE = "muchado-calligraphy-scans-v1";
const CHANNEL = "muchado:calligraphy-scans:v1";
const MAX_SAVED_SCANS = 20;
const MAX_SAVED_BYTES = 128 * 1024 * 1024;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | undefined;

interface StoredSummary extends CalligraphyScanSummary {
  storedBytes: number;
}

function storageError(error: unknown): Error {
  if (
    error instanceof Error &&
    error.message.startsWith("Cannot save handwriting:")
  )
    return error;
  const quota = error instanceof Error && error.name === "QuotaExceededError";
  return new Error(
    quota
      ? "Browser storage is full. This handwriting was not saved. Export or remove an older scan and try again."
      : "Browser storage is unavailable. This handwriting was not saved. Enable local storage and try again.",
    { cause: error },
  );
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(storageError(undefined));
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DATABASE, 1);
    } catch (error) {
      reject(storageError(error));
      return;
    }
    let blocked = false;
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore("scans", { keyPath: "id" });
      db.createObjectStore("summaries", { keyPath: "id" });
    };
    request.onerror = () => reject(storageError(request.error));
    request.onblocked = () => {
      blocked = true;
      reject(
        new Error(
          "The handwriting library is busy in another tab. Close that tab and try again.",
        ),
      );
    };
    request.onsuccess = () => {
      if (blocked) {
        request.result.close();
        return;
      }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

function summary(scan: CalligraphyScan): CalligraphyScanSummary {
  const {
    version,
    id,
    name,
    calligrapher,
    text,
    createdAt,
    algorithmVersion,
    emHeightPx,
    confirmed,
  } = scan;
  return {
    version,
    id,
    name,
    calligrapher,
    text,
    createdAt,
    algorithmVersion,
    emHeightPx,
    confirmed,
  };
}

function changed(broadcast = true) {
  for (const listener of listeners) listener();
  if (broadcast) channel?.postMessage("changed");
}

export function subscribeCalligraphyScans(listener: () => void): () => void {
  listeners.add(listener);
  if (!channel && typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = () => changed(false);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      channel?.close();
      channel = undefined;
    }
  };
}

export async function listCalligraphyScans(): Promise<
  CalligraphyScanSummary[]
> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("summaries", "readonly");
      const request = tx.objectStore("summaries").getAll();
      tx.oncomplete = () =>
        resolve(
          (request.result as StoredSummary[])
            .map(({ storedBytes: _, ...item }) => item)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        );
      tx.onabort = tx.onerror = () => reject(storageError(tx.error));
    });
  } finally {
    db.close();
  }
}

export async function getCalligraphyScan(
  id: string,
): Promise<CalligraphyScan | undefined> {
  const db = await openDatabase();
  try {
    const value = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction("scans", "readonly");
      const request = tx.objectStore("scans").get(id);
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = tx.onerror = () => reject(storageError(tx.error));
    });
    return value === undefined ? undefined : validateCalligraphyScan(value);
  } finally {
    db.close();
  }
}

export async function saveCalligraphyScan(
  input: CalligraphyScan,
): Promise<void> {
  const scan = validateCalligraphyScan(input);
  await verifyCalligraphyScanOriginal(scan);
  const storedBytes = new TextEncoder().encode(JSON.stringify(scan)).byteLength;
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["scans", "summaries"], "readwrite");
      const metadata = tx.objectStore("summaries");
      const existing = tx.objectStore("scans").get(scan.id);
      const read = metadata.getAll();
      let failure: Error | undefined;
      read.onsuccess = () => {
        if (existing.result !== undefined) {
          if (JSON.stringify(existing.result) !== JSON.stringify(scan)) {
            failure = new Error(
              "Cannot save handwriting: this identifier already belongs to a different saved scan.",
            );
            tx.abort();
          }
          return;
        }
        const other = (read.result as StoredSummary[]).filter(
          (item) => item.id !== scan.id,
        );
        if (
          other.length >= MAX_SAVED_SCANS ||
          other.reduce((sum, item) => sum + item.storedBytes, storedBytes) >
            MAX_SAVED_BYTES
        ) {
          failure = new Error(
            "Cannot save handwriting: this browser library allows 20 scans and 128 MB. Export or remove an older scan first.",
          );
          tx.abort();
          return;
        }
        tx.objectStore("scans").put(scan);
        metadata.put({ ...summary(scan), storedBytes });
      };
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(failure ?? storageError(tx.error));
    });
  } finally {
    db.close();
  }
  changed();
}

export async function verifyCalligraphyScanOriginal(
  scan: CalligraphyScan,
): Promise<void> {
  const bytes = Uint8Array.from(
    atob(scan.original.dataUrl.split(",")[1] ?? ""),
    (char) => char.charCodeAt(0),
  );
  const digest = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  if (digest !== scan.original.sha256)
    throw new Error(
      "The original image does not match its saved SHA-256 digest. The handwriting was not saved.",
    );
}

export async function deleteCalligraphyScan(id: string): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["scans", "summaries"], "readwrite");
      tx.objectStore("scans").delete(id);
      tx.objectStore("summaries").delete(id);
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(storageError(tx.error));
    });
  } finally {
    db.close();
  }
  changed();
}
