import { useEffect, useState } from "react";
import {
  type CalligraphyScanSummary,
  scanMatchesText,
} from "../../shared/calligraphy-scan";

/** Metadata only: original photographs load only when their face is selected. */
export function useCalligraphyFaces() {
  const [faces, setFaces] = useState<CalligraphyScanSummary[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let generation = 0;
    let unsubscribe = () => {};
    import("./calligraphy-scan-store")
      .then((store) => {
        if (!active) return;
        const refresh = async () => {
          const request = ++generation;
          try {
            const next = await store.listCalligraphyScans();
            if (!active || request !== generation) return;
            setFaces(next);
            setError("");
          } catch (reason) {
            if (!active || request !== generation) return;
            setError(
              reason instanceof Error
                ? reason.message
                : "Saved calligraphy could not load.",
            );
          } finally {
            if (active && request === generation) setReady(true);
          }
        };
        unsubscribe = store.subscribeCalligraphyScans(() => void refresh());
        void refresh();
      })
      .catch((reason) => {
        if (active) {
          setReady(true);
          setError(
            reason instanceof Error
              ? reason.message
              : "Saved calligraphy could not load.",
          );
        }
      });
    return () => {
      active = false;
      generation++;
      unsubscribe();
    };
  }, []);
  return { faces, ready, error };
}

export function matchingCalligraphyFaces(
  faces: readonly CalligraphyScanSummary[],
  text: string,
) {
  return faces.filter((face) => scanMatchesText(face, text));
}
