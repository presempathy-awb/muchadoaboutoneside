import { useCallback, useEffect, useRef, useState } from "react";
import type { ScaleBuildUp } from "../../shared/scale-measurements";
import type { ScaleStudy, ScaleStudySettings } from "../../shared/scale-study";
import { ScaleStudyCache } from "./scale-study-cache";

export interface ScaleStudyRequest {
  requestId: number;
  settings: ScaleStudySettings;
}

export interface ScaleStudyResponse {
  requestId: number;
  study: ScaleStudy | null;
  error: string;
}

interface ScaleStudyInputs {
  geometry: ScaleStudySettings;
  layers: ScaleBuildUp;
}

interface StudyState {
  study: ScaleStudy | null;
  snapshot: ScaleStudyInputs | null;
  computing: boolean;
  error: string;
  fallback: boolean;
  cacheHit: boolean;
}

/** Keeps the last successful preview while a cancellable worker builds its replacement. */
export function useScaleStudy(
  input: ScaleStudyInputs,
): StudyState & { retry: () => void } {
  const latestRequest = useRef(0);
  const [cache] = useState(() => new ScaleStudyCache());
  const [retryCount, setRetryCount] = useState(0);
  const retry = useCallback(() => setRetryCount((count) => count + 1), []);
  const [state, setState] = useState<StudyState>({
    study: null,
    snapshot: null,
    computing: true,
    error: "",
    fallback: false,
    cacheHit: false,
  });

  useEffect(() => {
    void retryCount;
    const settings = input.geometry;
    const requestId = ++latestRequest.current;
    let active = true;
    let worker: Worker | undefined;
    const fallback = typeof Worker === "undefined";
    const cached = cache.get(settings);
    if (cached) {
      setState({
        study: cached,
        snapshot: input,
        computing: false,
        error: "",
        fallback,
        cacheHit: true,
      });
      return;
    }
    setState((current) => ({
      ...current,
      computing: true,
      error: "",
      fallback,
    }));
    const isCurrent = () => active && requestId === latestRequest.current;
    const fail = (error: string) => {
      if (isCurrent())
        setState((current) => ({ ...current, computing: false, error }));
    };
    const accept = (result: ScaleStudyResponse) => {
      if (!isCurrent() || result.requestId !== requestId) return;
      if (result.study) {
        cache.set(settings, result.study);
        setState({
          study: result.study,
          snapshot: input,
          computing: false,
          error: "",
          fallback,
          cacheHit: false,
        });
      } else fail(result.error || "The scale geometry could not be built.");
      worker?.terminate();
    };

    // Engines without workers use the same bounded generator after a paint opportunity.
    // A failed worker never silently retries the expensive work on the UI thread.
    const timer = fallback
      ? window.setTimeout(() => {
          const loadGenerator = import("../../shared/scale-study").then(
            async ({ generateScaleStudy, normalizeScaleStudySettings }) => {
              const normalized = normalizeScaleStudySettings(settings);
              const generate =
                normalized.modelId === "maquette"
                  ? (await import("../../shared/scale-maquette"))
                      .generateMaquetteScaleStudy
                  : generateScaleStudy;
              return { generate, normalized };
            },
          );
          void loadGenerator.then(
            ({ generate, normalized }) => {
              if (!isCurrent()) return;
              try {
                accept({
                  requestId,
                  study: generate(normalized),
                  error: "",
                });
              } catch (error) {
                fail(
                  error instanceof Error
                    ? error.message
                    : "The scale geometry could not be built.",
                );
              }
            },
            () =>
              fail(
                "The scale builder could not be loaded. Reload the page to retry.",
              ),
          );
        }, 0)
      : undefined;

    if (!fallback) {
      try {
        worker = new Worker(
          new URL("./scale-study.worker.ts", import.meta.url),
          { type: "module" },
        );
        worker.onmessage = (event: MessageEvent<ScaleStudyResponse>) =>
          accept(event.data);
        worker.onerror = (event) => {
          event.preventDefault();
          fail(
            event.message ||
              "The scale builder stopped. Adjust a setting to retry.",
          );
          worker?.terminate();
        };
        worker.onmessageerror = () => {
          fail(
            "The scale builder returned unreadable geometry. Adjust a setting to retry.",
          );
          worker?.terminate();
        };
        worker.postMessage({ requestId, settings } satisfies ScaleStudyRequest);
      } catch (error) {
        worker?.terminate();
        fail(
          error instanceof Error
            ? error.message
            : "This browser could not start the scale builder.",
        );
      }
    }

    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
      worker?.terminate();
    };
  }, [input, cache, retryCount]);
  return {
    ...state,
    retry,
    // Reflect a new request immediately, before its effect starts the next worker.
    computing: state.computing || (!state.error && state.snapshot !== input),
  };
}
