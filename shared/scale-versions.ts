import {
  DEFAULT_SCALE_DESIGN,
  normalizeScaleDesign,
  type ScaleDesign,
} from "./scale-design";
import type { ScaleBuildUp } from "./scale-measurements";
import { modelScaleForHeight } from "./scale-models";
import type { ScaleStudySettings } from "./scale-study";

export {
  resizeScaleDesign,
  scaleDensityStatus,
  setScaleDensityMode,
  updateScaleDensity,
} from "./scale-design";

export interface ScaleVersionPreset {
  id: string;
  name: string;
  description: string;
  geometry: ScaleStudySettings;
  layers: ScaleBuildUp;
  buildMethod: ScaleDesign["buildMethod"];
}

const THIN_METAL: ScaleBuildUp = {
  supportInches: 0,
  backingInches: 0,
  adhesiveMm: 0,
  metalMm: 0.127,
  finishMm: 0,
  overlapMm: 0,
};

function preset(
  id: string,
  name: string,
  description: string,
  geometry: Partial<ScaleStudySettings>,
  layers: ScaleBuildUp,
  buildMethod: ScaleDesign["buildMethod"],
): ScaleVersionPreset {
  const normalized = normalizeScaleDesign({
    ...DEFAULT_SCALE_DESIGN,
    geometry: { ...DEFAULT_SCALE_DESIGN.geometry, ...geometry },
    layers,
    buildMethod,
  });
  return {
    id,
    name,
    description,
    geometry: normalized.geometry,
    layers: normalized.layers,
    buildMethod,
  };
}

/** Previewable studies, not certified fabrication or collision-clearance plans. */
export const SCALE_VERSION_PRESETS: readonly ScaleVersionPreset[] = [
  preset(
    "maquette-180",
    "180 mm · small scales",
    "Actual print mesh with 0.127 mm metal, 0.5 mm relief and no added support.",
    {
      modelId: "maquette",
      modelScale: 1,
      columns: 36,
      rows: 3,
      relief: 0.5 / 25.4,
      variation: 0.35,
      seed: 1,
    },
    THIN_METAL,
    "printed",
  ),
  preset(
    "maquette-240-flat",
    "240 mm · quiet surface",
    "Actual print mesh with low-density targets, thin metal and zero relief.",
    {
      modelId: "maquette",
      modelScale: 240 / 180,
      columns: 24,
      rows: 2,
      relief: 0,
      variation: 0.1,
      gap: 0.08,
      seed: 2,
    },
    THIN_METAL,
    "printed",
  ),
  preset(
    "maquette-360",
    "360 mm · flowing scales",
    "Double-height print study with thin metal and 1 mm relief.",
    {
      modelId: "maquette",
      modelScale: 2,
      columns: 60,
      rows: 4,
      relief: 1 / 25.4,
      variation: 0.5,
      seed: 3,
    },
    THIN_METAL,
    "printed",
  ),
  preset(
    "maquette-720",
    "720 mm · sculptural scales",
    "Large print study with thin metal and 2 mm relief; joining still needs design.",
    {
      modelId: "maquette",
      modelScale: 4,
      columns: 96,
      rows: 5,
      relief: 2 / 25.4,
      variation: 0.65,
      seed: 4,
    },
    THIN_METAL,
    "hybrid",
  ),
  preset(
    "wood-36",
    "36 in · tabletop wood",
    "Archival proportions with 1/8 in support, thin metal and 0.08 in relief.",
    {
      modelId: "archival",
      modelScale: modelScaleForHeight("archival", 36),
      columns: 36,
      rows: 3,
      relief: 0.08,
      variation: 0.35,
      seed: 5,
    },
    { ...THIN_METAL, supportInches: 0.125 },
    "wood",
  ),
  preset(
    "wood-72",
    "72 in · curved wood scales",
    "Six-foot archival study with 1/4 in support, thin metal and 0.18 in relief.",
    {
      modelId: "archival",
      modelScale: modelScaleForHeight("archival", 72),
      columns: 72,
      rows: 4,
      relief: 0.18,
      variation: 0.6,
      seed: 6,
    },
    { ...THIN_METAL, supportInches: 0.25 },
    "wood",
  ),
  preset(
    "hybrid-72-planar",
    "72 in · planar plates",
    "Flat plate study: 1/8 in support plus 1/8 in adapters and 0.12 in relief.",
    {
      modelId: "archival",
      modelScale: modelScaleForHeight("archival", 72),
      columns: 60,
      rows: 3,
      relief: 0.12,
      surfaceMode: "planar",
      variation: 0.3,
      seed: 7,
    },
    { ...THIN_METAL, supportInches: 0.125, backingInches: 0.125 },
    "hybrid",
  ),
  preset(
    "wood-archival",
    "Archival height · full scales",
    "Original source dimensions with 1 in support, thin metal and 0.65 in relief.",
    DEFAULT_SCALE_DESIGN.geometry,
    DEFAULT_SCALE_DESIGN.layers,
    "wood",
  ),
];

/** Switch only construction data; all wording, typography and notes stay intact. */
export function applyScaleVersionPreset(
  design: ScaleDesign,
  id: string,
): ScaleDesign {
  const version = SCALE_VERSION_PRESETS.find((entry) => entry.id === id);
  if (!version) throw new RangeError("Choose a listed scale version.");
  const { modelId, modelScale, columns, rows } = version.geometry;
  return normalizeScaleDesign({
    ...design,
    geometry: version.geometry,
    layers: version.layers,
    buildMethod: version.buildMethod,
    densityReference:
      design.densityMode === "adaptive"
        ? { modelId, modelScale, columns, rows }
        : undefined,
  });
}

/** The current typography may differ without changing the selected construction. */
export function matchingScaleVersionPreset(
  design: ScaleDesign,
): ScaleVersionPreset | undefined {
  const current = normalizeScaleDesign({
    ...DEFAULT_SCALE_DESIGN,
    geometry: design.geometry,
    layers: design.layers,
    buildMethod: design.buildMethod,
    densityMode: design.densityMode,
    densityReference: design.densityReference,
  });
  return SCALE_VERSION_PRESETS.find(
    (version) =>
      version.buildMethod === current.buildMethod &&
      (Object.keys(version.geometry) as (keyof ScaleStudySettings)[]).every(
        (key) => version.geometry[key] === current.geometry[key],
      ) &&
      (Object.keys(version.layers) as (keyof ScaleBuildUp)[]).every(
        (key) => version.layers[key] === current.layers[key],
      ),
  );
}
