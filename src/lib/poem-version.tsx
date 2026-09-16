/**
 * Which wording of the poem the site is showing. The choice lives in the
 * browser only (URL `?poem=` on first load, then localStorage) and defaults to
 * the canonical version, so server rendering and tests see the canonical poem.
 * A version can also be previewed as its browser draft from the poem editor.
 */
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_POEM_VERSION_ID,
  isPoemVersionId,
  POEM_VERSIONS,
  type PoemVersion,
  type PoemVersionId,
  poemVersionById,
} from "../../shared/poem";
import { applyDraft } from "../../shared/poem-drafts";

export const POEM_VERSION_STORAGE_KEY = "muchado.poem-version";
export const DRAFT_PREVIEW_STORAGE_KEY = "muchado.poem-draft-preview";

interface PoemVersionContextValue {
  /** The wording the site shows: the fixed version, or its draft when previewed. */
  version: PoemVersion;
  /** The fixed wording the picker selected. */
  base: PoemVersion;
  versions: readonly PoemVersion[];
  setVersionId(id: PoemVersionId): void;
  /** Versions whose browser draft is shown across the site. */
  draftPreview: ReadonlySet<PoemVersionId>;
  setDraftPreview(id: PoemVersionId, enabled: boolean): void;
}

const canonical = poemVersionById(DEFAULT_POEM_VERSION_ID);

const PoemVersionContext = createContext<PoemVersionContextValue>({
  version: canonical,
  base: canonical,
  versions: POEM_VERSIONS,
  setVersionId() {},
  draftPreview: new Set(),
  setDraftPreview() {},
});

function readInitialId(): PoemVersionId {
  if (typeof window === "undefined") return DEFAULT_POEM_VERSION_ID;
  try {
    const requested = new URLSearchParams(window.location.search).get("poem");
    if (isPoemVersionId(requested)) return requested;
    const stored = window.localStorage.getItem(POEM_VERSION_STORAGE_KEY);
    if (isPoemVersionId(stored)) return stored;
  } catch {}
  return DEFAULT_POEM_VERSION_ID;
}

function readInitialPreview(): ReadonlySet<PoemVersionId> {
  if (typeof window === "undefined") return new Set();
  try {
    const stored = window.localStorage.getItem(DRAFT_PREVIEW_STORAGE_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    if (Array.isArray(parsed)) return new Set(parsed.filter(isPoemVersionId));
  } catch {}
  return new Set();
}

export function PoemVersionProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<PoemVersionId>(readInitialId);
  const [draftPreview, setPreviewSet] =
    useState<ReadonlySet<PoemVersionId>>(readInitialPreview);
  const [draftTexts, setDraftTexts] = useState<
    Partial<Record<PoemVersionId, string>>
  >({});

  useEffect(() => {
    try {
      window.localStorage.setItem(POEM_VERSION_STORAGE_KEY, id);
    } catch {}
  }, [id]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        DRAFT_PREVIEW_STORAGE_KEY,
        JSON.stringify([...draftPreview]),
      );
    } catch {}
  }, [draftPreview]);

  // Follow the previewed drafts; the Yjs code loads only when one is on.
  useEffect(() => {
    if (draftPreview.size === 0) return;
    let active = true;
    const unsubscribes: (() => void)[] = [];
    import("@/lib/poem-drafts").then(({ draftSession }) => {
      if (!active) return;
      for (const previewed of draftPreview) {
        const session = draftSession(poemVersionById(previewed));
        const update = () => {
          const text = session.text.toString();
          setDraftTexts((current) =>
            current[previewed] === text
              ? current
              : { ...current, [previewed]: text },
          );
        };
        session.ready.then(() => {
          if (active) update();
        });
        unsubscribes.push(session.subscribeText(update));
      }
    });
    return () => {
      active = false;
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
  }, [draftPreview]);

  const setVersionId = useCallback((next: PoemVersionId) => {
    if (isPoemVersionId(next)) setId(next);
  }, []);
  const setDraftPreview = useCallback(
    (target: PoemVersionId, enabled: boolean) => {
      setPreviewSet((current) => {
        if (current.has(target) === enabled) return current;
        const next = new Set(current);
        if (enabled) next.add(target);
        else next.delete(target);
        return next;
      });
    },
    [],
  );

  const value = useMemo<PoemVersionContextValue>(() => {
    const base = poemVersionById(id);
    const draft = draftPreview.has(id) ? draftTexts[id] : undefined;
    return {
      version: draft === undefined ? base : applyDraft(base, draft),
      base,
      versions: POEM_VERSIONS,
      setVersionId,
      draftPreview,
      setDraftPreview,
    };
  }, [id, draftPreview, draftTexts, setVersionId, setDraftPreview]);

  return (
    <PoemVersionContext.Provider value={value}>
      {children}
    </PoemVersionContext.Provider>
  );
}

export function usePoemVersion() {
  return useContext(PoemVersionContext);
}
