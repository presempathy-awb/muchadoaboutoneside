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
import type { PoemVersion, PoemVersionId } from "../../shared/poem";
import {
  DRAFT_TEXT_NAME,
  draftRoom,
  draftSource,
  seedUpdate,
} from "../../shared/poem-drafts";

export interface DraftStatus {
  /** Where the draft is kept between visits. */
  storage: "loading" | "browser" | "memory";
  /** The site's live sync room, when the server offers one. */
  sync: "off" | "connecting" | "connected" | "disconnected";
  /** Other people currently in the room. */
  peers: number;
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
}

interface EditorUser {
  name: string;
  color: string;
  colorLight: string;
}

const USER_KEY = "muchado.poem-editor-user";
const COLORS = ["#b8862f", "#658253", "#8f6a42", "#5d735b", "#bd6546"];
const sessions = new Map<PoemVersionId, DraftSession>();
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
  const existing = sessions.get(version.id);
  if (existing) return existing;

  const room = draftRoom(version.id);
  const doc = new Y.Doc({ guid: room });
  const text = doc.getText(DRAFT_TEXT_NAME);
  const awareness = new Awareness(doc);
  awareness.setLocalStateField("user", editorUser());
  const undo = new Y.UndoManager(text, { captureTimeout: 400 });

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
      if (origin !== tabs) tabs.postMessage(update);
    });
  }

  const ready = (async () => {
    try {
      if (typeof indexedDB === "undefined")
        throw new Error("IndexedDB is unavailable");
      const persistence = new IndexeddbPersistence(room, doc);
      await persistence.whenSynced;
      setStatus({ storage: "browser" });
    } catch {
      setStatus({ storage: "memory" });
    }
    // The seed is the same bytes everywhere, so applying it never duplicates.
    if (text.length === 0) Y.applyUpdate(doc, seedUpdate(version), "seed");
    channel?.postMessage({ hello: true });
  })();

  ready
    .then(liveSyncOffered)
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
      doc.transact(() => {
        text.delete(0, text.length);
        text.insert(0, draftSource(version));
      });
    },
  };
  sessions.set(version.id, session);
  return session;
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
