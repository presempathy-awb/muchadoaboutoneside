import sourceManifest from "../source/assets/manifest.json";
import reference from "./six-foot-reference.json";

const targetHeightInches = 72;
const scale = targetHeightInches / sourceManifest.model.dimensions.height;
const { min, max } = reference.bodyBoundsInches;

/** Reference proportions before new cladding; the finished target includes it. */
export const SIX_FOOT_STUDY = {
  targetHeightInches,
  scale,
  bodyWidthInches: ((max[0] ?? 0) - (min[0] ?? 0)) * scale,
  bodyDepthInches: ((max[2] ?? 0) - (min[2] ?? 0)) * scale,
  referenceBaseWidthInches: sourceManifest.model.dimensions.width * scale,
  referenceBaseDepthInches: sourceManifest.model.dimensions.depth * scale,
  skinAreaSqFt: reference.skinAreaSquareInches.map(
    (area) => (area * scale ** 2) / 144,
  ),
} as const;
