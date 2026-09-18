import type { ScaleDesign } from "../../shared/scale-design";
import {
  assessScaleSizeFit,
  type ScaleSizeFitResult,
  type ScaleSizeFitSearchOptions,
  searchScaleSizeFit,
} from "../../shared/scale-size-fit";
import type { ScaleStudy, ScaleStudySettings } from "../../shared/scale-study";
import type { ScaleTypography } from "./scale-typography";
import type { ScaleStudyRequest, ScaleStudyResponse } from "./use-scale-study";

const CANDIDATE_TIMEOUT_MS = 15_000;

function buildCandidateStudy(
  settings: ScaleStudySettings,
  signal: AbortSignal,
): Promise<ScaleStudy> {
  signal.throwIfAborted();
  if (typeof Worker === "undefined")
    return Promise.reject(
      new Error("Model size search needs browser worker support."),
    );
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./scale-study.worker.ts", import.meta.url),
      {
        type: "module",
      },
    );
    let finished = false;
    const finish = (error: unknown, study?: ScaleStudy) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
      if (error) reject(error);
      else if (study) resolve(study);
    };
    const abort = () => finish(signal.reason);
    const timeout = setTimeout(
      () =>
        finish(new Error("This model size exceeded its geometry time limit.")),
      CANDIDATE_TIMEOUT_MS,
    );
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = (event: MessageEvent<ScaleStudyResponse>) => {
      if (signal.aborted) {
        finish(signal.reason);
        return;
      }
      const response = event.data;
      if (response?.requestId !== 1) return;
      if (response.error || !response.study) {
        finish(
          new Error(response.error || "Geometry worker returned no study."),
        );
      } else {
        finish(null, response.study);
      }
    };
    worker.onerror = (event) => {
      finish(new Error(event.message || "Geometry worker failed."));
    };
    worker.onmessageerror = () => {
      finish(new Error("Geometry worker returned an unreadable study."));
    };
    try {
      signal.throwIfAborted();
      worker.postMessage({
        requestId: 1,
        settings,
      } satisfies ScaleStudyRequest);
    } catch (error) {
      finish(error);
    }
  });
}

/**
 * Builds only one candidate at a time, without filling the interactive geometry
 * cache. Each worker is terminated before measurement or the next candidate.
 */
export function searchScaleSizeForText(
  design: ScaleDesign,
  typography: Pick<ScaleTypography, "measure" | "measureLine" | "segments">,
  options: ScaleSizeFitSearchOptions = {},
): Promise<ScaleSizeFitResult> {
  return searchScaleSizeFit(
    design,
    async (candidate, signal) => {
      const study = await buildCandidateStudy(candidate.geometry, signal);
      signal.throwIfAborted();
      return assessScaleSizeFit(
        study.plates,
        candidate.text,
        {
          fontSizeMm: candidate.fontSizeMm,
          marginMm: candidate.marginMm,
          measure: typography.measure,
          measureLine: typography.measureLine,
          segments: typography.segments,
        },
        signal,
      );
    },
    options,
  );
}
