/** Site wording selection, immutable browser copies, and optional live drafts. */
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  DEFAULT_POEM,
  DEFAULT_POEM_VERSION_ID,
  isPoemId,
  POEM_VERSIONS,
  type PoemId,
  type PoemVersion,
} from "../../shared/poem";
import { applyDraft } from "../../shared/poem-drafts";
import type { SavePoemVersionInput } from "../../shared/poem-library";
import {
  getPoemLibrary,
  INITIAL_POEM_LIBRARY,
  type PoemLibrary,
} from "./poem-library";

export const POEM_VERSION_STORAGE_KEY = "muchado.poem-version";
export const DRAFT_PREVIEW_STORAGE_KEY = "muchado.poem-draft-preview";

export interface PoemVersionContextValue {
  /** The wording the site shows: the selected snapshot or its previewed draft. */
  version: PoemVersion;
  base: PoemVersion;
  /** The two protected originals always precede the privately saved copies. */
  versions: readonly PoemVersion[];
  ready: boolean;
  error: string | null;
  setVersionId(id: PoemId): void;
  saveVersion(input: SavePoemVersionInput): Promise<PoemVersion>;
  deleteVersion(id: PoemId): Promise<void>;
  draftPreview: ReadonlySet<PoemId>;
  setDraftPreview(id: PoemId, enabled: boolean): void;
}

const PoemVersionContext = createContext<PoemVersionContextValue>({
  version: DEFAULT_POEM,
  base: DEFAULT_POEM,
  versions: POEM_VERSIONS,
  ready: false,
  error: null,
  setVersionId() {},
  async saveVersion() {
    throw new Error("The poem library is still opening.");
  },
  async deleteVersion() {
    throw new Error("The poem library is still opening.");
  },
  draftPreview: new Set(),
  setDraftPreview() {},
});

function readInitialId(): PoemId {
  if (typeof window === "undefined") return DEFAULT_POEM_VERSION_ID;
  try {
    const requested = new URLSearchParams(window.location.search).get("poem");
    if (isPoemId(requested)) return requested;
    const stored = window.localStorage.getItem(POEM_VERSION_STORAGE_KEY);
    if (isPoemId(stored)) return stored;
  } catch {}
  return DEFAULT_POEM_VERSION_ID;
}

function readInitialPreview(): ReadonlySet<PoemId> {
  if (typeof window === "undefined") return new Set();
  try {
    const stored = window.localStorage.getItem(DRAFT_PREVIEW_STORAGE_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    if (Array.isArray(parsed)) return new Set(parsed.filter(isPoemId));
  } catch {}
  return new Set();
}

function rememberSelection(id: PoemId) {
  try {
    window.localStorage.setItem(POEM_VERSION_STORAGE_KEY, id);
  } catch {}
}

const subscribeBeforeReady = () => () => {};
const initialSnapshot = () => INITIAL_POEM_LIBRARY;

export function PoemVersionProvider({ children }: { children: ReactNode }) {
  const [library, setLibrary] = useState<PoemLibrary | null>(null);
  const state = useSyncExternalStore(
    library?.subscribe ?? subscribeBeforeReady,
    library?.getSnapshot ?? initialSnapshot,
    initialSnapshot,
  );
  const { versions, ready, error } = state;
  const [id, setId] = useState<PoemId>(readInitialId);
  const [draftPreview, setPreviewSet] =
    useState<ReadonlySet<PoemId>>(readInitialPreview);
  const [draftTexts, setDraftTexts] = useState<Partial<Record<PoemId, string>>>(
    {},
  );

  useEffect(() => {
    setLibrary(getPoemLibrary());
  }, []);

  useEffect(() => {
    if (!ready || error) return;
    if (!versions.some((version) => version.id === id)) {
      setId(DEFAULT_POEM_VERSION_ID);
      rememberSelection(DEFAULT_POEM_VERSION_ID);
    }
    setPreviewSet((current) => {
      const remaining = [...current].filter((target) =>
        versions.some((version) => version.id === target),
      );
      return remaining.length === current.size ? current : new Set(remaining);
    });
  }, [versions, ready, error, id]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        DRAFT_PREVIEW_STORAGE_KEY,
        JSON.stringify([...draftPreview]),
      );
    } catch {}
  }, [draftPreview]);

  useEffect(() => {
    if (draftPreview.size === 0) return;
    let active = true;
    const unsubscribes: (() => void)[] = [];
    import("@/lib/poem-drafts").then(({ draftSession }) => {
      if (!active) return;
      for (const previewed of draftPreview) {
        const base = versions.find((version) => version.id === previewed);
        if (!base) continue;
        const session = draftSession(base);
        const update = () => {
          if (!active) return;
          const text = session.text.toString();
          setDraftTexts((current) =>
            current[previewed] === text
              ? current
              : { ...current, [previewed]: text },
          );
        };
        session.ready.then(update);
        unsubscribes.push(session.subscribeText(update));
      }
    });
    return () => {
      active = false;
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
  }, [draftPreview, versions]);

  const setVersionId = useCallback(
    (next: PoemId) => {
      if (!versions.some((version) => version.id === next)) return;
      setId(next);
      rememberSelection(next);
    },
    [versions],
  );

  const saveVersion = useCallback(
    async (input: SavePoemVersionInput) => {
      if (!library) throw new Error("The poem library is still opening.");
      const saved = await library.saveVersion({
        ...input,
        baseId: input.baseId ?? id,
      });
      setId(saved.id);
      rememberSelection(saved.id);
      return saved;
    },
    [library, id],
  );

  const deleteVersion = useCallback(
    async (target: PoemId) => {
      if (!library) throw new Error("The poem library is still opening.");
      try {
        await library.deleteVersion(target);
      } finally {
        // Metadata deletion may succeed even when another tab blocks draft cleanup.
        if (
          !library
            .getSnapshot()
            .versions.some((version) => version.id === target)
        ) {
          setPreviewSet((current) => {
            if (!current.has(target)) return current;
            const remaining = new Set(current);
            remaining.delete(target);
            return remaining;
          });
          setId((current) => {
            if (current !== target) return current;
            rememberSelection(DEFAULT_POEM_VERSION_ID);
            return DEFAULT_POEM_VERSION_ID;
          });
        }
      }
    },
    [library],
  );

  const setDraftPreview = useCallback(
    (target: PoemId, enabled: boolean) => {
      if (!versions.some((version) => version.id === target)) return;
      setPreviewSet((current) => {
        if (current.has(target) === enabled) return current;
        const next = new Set(current);
        if (enabled) next.add(target);
        else next.delete(target);
        return next;
      });
    },
    [versions],
  );

  const value = useMemo<PoemVersionContextValue>(() => {
    const base = versions.find((version) => version.id === id) ?? DEFAULT_POEM;
    const draft = draftPreview.has(base.id) ? draftTexts[base.id] : undefined;
    return {
      version: draft === undefined ? base : applyDraft(base, draft),
      base,
      versions,
      ready,
      error,
      setVersionId,
      saveVersion,
      deleteVersion,
      draftPreview,
      setDraftPreview,
    };
  }, [
    id,
    versions,
    ready,
    error,
    draftPreview,
    draftTexts,
    setVersionId,
    saveVersion,
    deleteVersion,
    setDraftPreview,
  ]);

  return (
    <PoemVersionContext.Provider value={value}>
      {children}
    </PoemVersionContext.Provider>
  );
}

export function usePoemVersion() {
  return useContext(PoemVersionContext);
}
