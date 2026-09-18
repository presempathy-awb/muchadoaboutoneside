import {
  generateScaleStudy,
  normalizeScaleStudySettings,
} from "../../shared/scale-study";
import type { ScaleStudyRequest, ScaleStudyResponse } from "./use-scale-study";

self.onmessage = async (event: MessageEvent<ScaleStudyRequest>) => {
  const requestId = event.data?.requestId;
  const settings = event.data?.settings;
  let result: ScaleStudyResponse;
  try {
    if (!Number.isSafeInteger(requestId) || requestId < 1)
      throw new Error("The scale build request needs a positive request ID.");
    if (!settings || typeof settings !== "object" || Array.isArray(settings))
      throw new Error("The scale build request needs geometry settings.");
    const normalized = normalizeScaleStudySettings(settings);
    const study =
      normalized.modelId === "maquette"
        ? (
            await import("../../shared/scale-maquette")
          ).generateMaquetteScaleStudy(normalized)
        : generateScaleStudy(normalized);
    result = { requestId, study, error: "" };
  } catch (error) {
    result = {
      requestId,
      study: null,
      error:
        error instanceof Error
          ? error.message
          : "The scale geometry could not be built.",
    };
  }
  self.postMessage(result);
};
