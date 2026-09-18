import {
  DEFAULT_SCALE_DESIGN,
  normalizeScaleDesign,
  type ScaleDesign,
} from "./scale-design";

export const SCALE_HISTORY_STORAGE_KEY = "muchado.scale-shape-history.v1";
export const MAX_SCALE_SHAPE_HISTORY = 8;
const MAX_HISTORY_CHARACTERS = 64 * 1024;

/** Shape history deliberately keeps the current wording, font and notes on a hop. */
export type ScaleShapeSnapshot = Pick<
  ScaleDesign,
  "geometry" | "layers" | "buildMethod" | "densityMode" | "densityReference"
>;

export interface ScaleShapeVersion {
  id: string;
  label: string;
  shape: ScaleShapeSnapshot;
  createdAt: number;
}

function shapeFromDesign(design: ScaleDesign): ScaleShapeSnapshot {
  const normalized = normalizeScaleDesign({
    ...DEFAULT_SCALE_DESIGN,
    geometry: design.geometry,
    layers: design.layers,
    buildMethod: design.buildMethod,
    densityMode: design.densityMode,
    densityReference: design.densityReference,
  });
  return {
    geometry: normalized.geometry,
    layers: normalized.layers,
    buildMethod: normalized.buildMethod,
    densityMode: normalized.densityMode,
    ...(normalized.densityReference
      ? { densityReference: normalized.densityReference }
      : {}),
  };
}

export function captureScaleShapeVersion(
  design: ScaleDesign,
  label: string,
  now = Date.now(),
): ScaleShapeVersion {
  const shape = shapeFromDesign(design);
  return {
    // The bounded canonical payload is also a collision-free identity.
    id: JSON.stringify(shape),
    label: label.trim().slice(0, 100) || "Working shape",
    shape,
    createdAt: Number.isFinite(now) ? Math.max(0, now) : 0,
  };
}

/** Reopening an existing shape keeps navigation order stable. */
export function rememberScaleShapeVersion(
  history: ScaleShapeVersion[],
  version: ScaleShapeVersion,
): ScaleShapeVersion[] {
  if (history.some((existing) => existing.id === version.id)) return history;
  return [...history, version].slice(-MAX_SCALE_SHAPE_HISTORY);
}

export function applyScaleShapeVersion(
  design: ScaleDesign,
  version: ScaleShapeVersion,
): ScaleDesign {
  return normalizeScaleDesign({
    ...design,
    ...version.shape,
    densityReference: version.shape.densityReference,
  });
}

/** Local storage is untrusted; retain only small, normalized shape records. */
export function parseScaleShapeHistory(
  raw: string | null,
): ScaleShapeVersion[] {
  if (!raw || raw.length > MAX_HISTORY_CHARACTERS) return [];
  try {
    const input: unknown = JSON.parse(raw);
    if (!Array.isArray(input) || input.length > MAX_SCALE_SHAPE_HISTORY)
      return [];
    let history: ScaleShapeVersion[] = [];
    for (const entry of input) {
      if (!entry || typeof entry !== "object") continue;
      const value = entry as Record<string, unknown>;
      if (
        typeof value.label !== "string" ||
        typeof value.createdAt !== "number" ||
        !value.shape ||
        typeof value.shape !== "object" ||
        Array.isArray(value.shape)
      )
        continue;
      const shape = value.shape as Record<string, unknown>;
      if (!shape.geometry || !shape.layers) continue;
      const design = normalizeScaleDesign({
        ...DEFAULT_SCALE_DESIGN,
        geometry: shape.geometry,
        layers: shape.layers,
        buildMethod: shape.buildMethod,
        densityMode: shape.densityMode,
        densityReference: shape.densityReference,
      });
      const version = captureScaleShapeVersion(
        design,
        value.label,
        value.createdAt,
      );
      history = rememberScaleShapeVersion(history, version);
    }
    return history;
  } catch {
    return [];
  }
}
