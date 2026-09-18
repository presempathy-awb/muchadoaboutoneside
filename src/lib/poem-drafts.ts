/**
 * Browser-side draft sessions: one Yjs document per poem version, saved in
 * this browser's IndexedDB, mirrored between its open tabs, and joined to the
 * site's live sync room whenever the server offers one.
 */
import { useSyncExternalStore } from "react";
import { IndexeddbPersistence } from "y-indexeddb";
import { Awareness } from "y-protocols/awareness";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";
import {
  isPoemVersionId,
  type PoemId,
  type PoemVersion,
  type SavedPoemId,
} from "../../shared/poem";
import {
  DRAFT_TEXT_NAME,
  draftRoom,
  draftSource,
  seedUpdate,
} from "../../shared/poem-drafts";
import {
  assertDeletablePoemId,
  MAX_POEM_TEXT_LENGTH,
} from "../../shared/poem-library";
import { isSavedPoemDeleted } from "./poem-library";

export interface DraftStatus {
  /** Where the draft is kept between visits. */
  storage: "loading" | "browser" | "memory";
  /** The site's live sync room, when the server offers one. */
  sync: "off" | "connecting" | "connected" | "disconnected";
  /** Other people currently in the room. */
  peers: number;
  deleted?: boolean;
  error?: string;
}

export interface DraftSession {
  readonly version: PoemVersion;
  readonly room: string;
  readonly doc: Y.Doc;
  readonly text: Y.Text;
  readonly awareness: Awareness;
  readonly undo: Y.UndoManager;
  /** Resolves once the stored draft is loaded and seeded. */
  readonly ready: Promise<void>;
  getStatus(): DraftStatus;
  subscribeStatus(listener: () => void): () => void;
  subscribeText(listener: () => void): () => void;
  /** Replaces the draft with the fixed wording, as one undoable step. */
  reset(): void;
  /** Replaces the working text as one undoable step, preserving its formatting. */
  setText(text: string): void;
}

interface EditorUser {
  name: string;
  color: string;
  colorLight: string;
}

const USER_KEY = "muchado.poem-editor-user";
const COLORS = ["#b8862f", "#658253", "#8f6a42", "#5d735b", "#bd6546"];
const sessions = new Map<PoemId, DraftSession>();
const privateDisposers = new Map<SavedPoemId, () => Promise<void>>();
const deletedSavedIds = new Set<SavedPoemId>();
let liveSyncOffer: Promise<boolean> | undefined;

function editorUser(): EditorUser {
  try {
    const stored = window.localStorage.getItem(USER_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<EditorUser>;
      if (parsed.name && parsed.color && parsed.colorLight)
        return parsed as EditorUser;
    }
  } catch {}
  const color = COLORS[Math.floor(Math.random() * COLORS.length)] ?? "#658253";
  const user = {
    name: `Reader ${Math.floor(1000 + Math.random() * 9000)}`,
    color,
    colorLight: `${color}55`,
  };
  try {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {}
  return user;
}

/** Asks the site once whether it relays drafts between browsers. */
function liveSyncOffered() {
  liveSyncOffer ??= fetch("/api/collab/status", { cache: "no-store" })
    .then(async (response): Promise<{ enabled?: boolean }> => {
      if (!response.ok) return {};
      return (await response.json()) as { enabled?: boolean };
    })
    .then((status) => Boolean(status.enabled))
    .catch(() => false);
  return liveSyncOffer;
}

/** The session for a fixed wording, created once per page load. */
export function draftSession(version: PoemVersion): DraftSession {
  if (!isPoemVersionId(version.id) && deletedSavedIds.has(version.id))
    throw new Error(
      "This saved poem version was deleted. Select another version.",
    );
  const existing = sessions.get(version.id);
  if (existing) return existing;

  const room = draftRoom(version.id);
  const doc = new Y.Doc({ guid: room });
  const text = doc.getText(DRAFT_TEXT_NAME);
  const awareness = new Awareness(doc);
  awareness.setLocalStateField("user", editorUser());
  const undo = new Y.UndoManager(text, { captureTimeout: 400 });
  let disposed = false;
  let persistence: IndexeddbPersistence | undefined;

  let status: DraftStatus = { storage: "loading", sync: "off", peers: 0 };
  const statusListeners = new Set<() => void>();
  const setStatus = (patch: Partial<DraftStatus>) => {
    status = { ...status, ...patch };
    for (const listener of statusListeners) listener();
  };

  // Other tabs of this browser share the draft through a BroadcastChannel;
  // a new tab asks for the full state so nothing written moments ago is missed.
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(`muchado:${room}`);
  } catch {
    channel = null;
  }
  if (channel) {
    const tabs = channel;
    tabs.onmessage = (event: MessageEvent<unknown>) => {
      if (disposed) return;
      const data = event.data;
      if (data instanceof Uint8Array) Y.applyUpdate(doc, data, tabs);
      else if (
        typeof data === "object" &&
        data !== null &&
        "hello" in data &&
        text.length > 0
      )
        tabs.postMessage(Y.encodeStateAsUpdate(doc));
    };
    doc.on("update", (update: Uint8Array, origin: unknown) => {
      if (!disposed && origin !== tabs) tabs.postMessage(update);
    });
  }

  const dispose = async () => {
    if (!disposed) {
      disposed = true;
      channel?.close();
      undo.destroy();
      awareness.destroy();
      sessions.delete(version.id);
      setStatus({
        storage: "memory",
        sync: "off",
        peers: 0,
        deleted: true,
        error: "This saved poem version was deleted. Select another version.",
      });
    }
    await persistence?.destroy();
    doc.destroy();
  };

  const ready = (async () => {
    try {
      if (typeof indexedDB === "undefined")
        throw new Error("IndexedDB is unavailable");
      if (
        !isPoemVersionId(version.id) &&
        (await isSavedPoemDeleted(version.id))
      ) {
        deletedSavedIds.add(version.id);
        await dispose();
        return;
      }
      if (disposed) return;
      persistence = new IndexeddbPersistence(room, doc);
      await persistence.whenSynced;
      if (disposed) return;
      setStatus({ storage: "browser" });
    } catch {
      setStatus({ storage: "memory" });
    }
    if (disposed) return;
    // The seed is the same bytes everywhere, so applying it never duplicates.
    if (text.length === 0) Y.applyUpdate(doc, seedUpdate(version), "seed");
    channel?.postMessage({ hello: true });
  })();

  ready
    // Named copies are private. Never probe or join the public relay for them.
    .then(() => (isPoemVersionId(version.id) ? liveSyncOffered() : false))
    .then((offered) => {
      if (!offered) return;
      const url = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/api/collab/rooms`;
      const provider = new WebsocketProvider(url, room, doc, {
        awareness,
        disableBc: true,
      });
      setStatus({ sync: "connecting" });
      provider.on("status", ({ status: next }) => {
        setStatus({
          sync:
            next === "connected"
              ? "connected"
              : next === "connecting"
                ? "connecting"
                : "disconnected",
        });
      });
    })
    .catch(() => {});
  awareness.on("change", () => {
    setStatus({ peers: Math.max(0, awareness.getStates().size - 1) });
  });

  const session: DraftSession = {
    version,
    room,
    doc,
    text,
    awareness,
    undo,
    ready,
    getStatus: () => status,
    subscribeStatus(listener) {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    subscribeText(listener) {
      const handler = () => listener();
      text.observe(handler);
      return () => text.unobserve(handler);
    },
    reset() {
      session.setText(draftSource(version));
    },
    setText(nextText) {
      if (disposed)
        throw new Error(
          "This saved poem version was deleted. Select another version.",
        );
      if (nextText.length > MAX_POEM_TEXT_LENGTH)
        throw new Error("Poem text must be 20,000 characters or fewer.");
      undo.stopCapturing();
      doc.transact(() => {
        text.delete(0, text.length);
        text.insert(0, nextText);
      });
      undo.stopCapturing();
    },
  };
  sessions.set(version.id, session);
  if (!isPoemVersionId(version.id)) privateDisposers.set(version.id, dispose);
  return session;
}

/** Removes only this private working draft, after its named snapshot was deleted. */
export async function deleteDraftSession(id: PoemId): Promise<void> {
  assertDeletablePoemId(id);
  deletedSavedIds.add(id);
  const dispose = privateDisposers.get(id);
  if (dispose) await dispose();
  privateDisposers.delete(id);
  await new Promise<void>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(
        new Error(
          "Browser storage is unavailable; the private draft could not be cleared.",
        ),
      );
      return;
    }
    const request = indexedDB.deleteDatabase(draftRoom(id));
    let timeout: ReturnType<typeof setTimeout> | undefined;
    request.onsuccess = () => {
      clearTimeout(timeout);
      resolve();
    };
    request.onerror = () => {
      clearTimeout(timeout);
      reject(
        request.error ??
          new Error("The private draft database could not be cleared."),
      );
    };
    request.onblocked = () => {
      timeout ??= setTimeout(
        () =>
          reject(new Error("Another tab still has this private draft open.")),
        2000,
      );
    };
  });
}

export function useDraftText(session: DraftSession) {
  return useSyncExternalStore(
    session.subscribeText,
    () => session.text.toString(),
    () => "",
  );
}

export function useDraftStatus(session: DraftSession) {
  return useSyncExternalStore(
    session.subscribeStatus,
    session.getStatus,
    session.getStatus,
  );
}
