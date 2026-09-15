import sourceManifest from "../source/assets/manifest.json";
import { SHEET } from "./calligraphy-guide";
import printManifest from "./print-manifest.json";

export type DimensionUnit = "mm" | "in";

export const DIMENSIONS = {
  maquette: {
    width: printManifest.dimensionsMm.x,
    height: printManifest.dimensionsMm.z,
    depth: printManifest.dimensionsMm.y,
  },
  sculpture: {
    width: sourceManifest.model.dimensions.width * 25.4,
    height: sourceManifest.model.dimensions.height * 25.4,
    depth: sourceManifest.model.dimensions.depth * 25.4,
  },
  paper: { width: SHEET.widthMm, height: SHEET.heightMm },
} as const;

/** Display conversion only: model and template coordinates stay untouched. */
export function formatDimension(millimeters: number, unit: DimensionUnit) {
  const value = unit === "in" ? millimeters / 25.4 : millimeters;
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: unit === "in" ? 2 : 1,
  }).format(value);
}
