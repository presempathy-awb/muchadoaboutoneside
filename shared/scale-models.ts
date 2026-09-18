import sourceManifest from "../source/assets/manifest.json";
import printManifest from "./print-manifest.json";

export type ScaleModelId = "archival" | "maquette";

/** Each source keeps its own proportions, units and construction history. */
export const SCALE_MODELS = {
  archival: {
    id: "archival",
    name: "Archival wood construction",
    heightInches: sourceManifest.model.dimensions.height,
    widthInches: sourceManifest.model.dimensions.width,
    depthInches: sourceManifest.model.dimensions.depth,
    description:
      "Original construction proportions, including its base. The six-foot study uses this source.",
  },
  maquette: {
    id: "maquette",
    name: "Printable maquette",
    heightInches: printManifest.dimensionsMm.z / 25.4,
    widthInches: printManifest.dimensionsMm.x / 25.4,
    depthInches: printManifest.dimensionsMm.y / 25.4,
    description:
      "Actual boolean-unioned 180 mm print mesh, including its integrated plinth.",
  },
} as const;

export function modelScaleForHeight(
  modelId: ScaleModelId,
  heightInches: number,
): number {
  if (!Number.isFinite(heightInches) || heightInches <= 0)
    throw new RangeError("Model height must be a positive finite number.");
  return Math.min(
    30,
    Math.max(0.02, heightInches / SCALE_MODELS[modelId].heightInches),
  );
}

export function scaledModelDimensions(modelId: ScaleModelId, scale: number) {
  const model = SCALE_MODELS[modelId];
  if (!Number.isFinite(scale) || scale < 0.02 || scale > 30)
    throw new RangeError("Model scale must be between 0.02 and 30.");
  return {
    width: model.widthInches * scale,
    height: model.heightInches * scale,
    depth: model.depthInches * scale,
  };
}
