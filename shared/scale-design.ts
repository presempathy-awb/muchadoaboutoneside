import {
  buildUpSupportOffsetInches,
  DEFAULT_SCALE_BUILD_UP,
  normalizeScaleBuildUp,
  type ScaleBuildUp,
} from "./scale-measurements";
import {
  DEFAULT_SCALE_STUDY_SETTINGS,
  normalizeScaleStudySettings,
  type ScaleStudySettings,
} from "./scale-study";
import type { WorksheetSettings } from "./worksheet";
import { isWorksheetBundledFontId } from "./worksheet-font-catalog";

export type ScaleDensityMode = "fixed" | "adaptive";
export type ScaleLetteringQuality = "balanced" | "crisp";

/** A stable physical anchor prevents rounding drift during repeated resizing. */
export type ScaleDensityReference = Pick<
  ScaleStudySettings,
  "modelId" | "modelScale" | "columns" | "rows"
>;

export interface ScaleDesign {
  schema: 1;
  geometry: ScaleStudySettings;
  densityMode?: ScaleDensityMode;
  densityReference?: ScaleDensityReference;
  layers: ScaleBuildUp;
  buildMethod: "wood" | "printed" | "hybrid";
  notes: string;
  text: string;
  fontId: WorksheetSettings["fontId"];
  /** Prefer matching original handwriting, a particular local scan, or fonts. */
  calligraphyFaceId?: string;
  customFont?: { name: string; dataUrl: string };
  shapingEngine: "fontkit" | "harfbuzz";
  fontFeatures: string;
  fontSizeMm: number;
  minFontSizeMm: number;
  marginMm: number;
  autoFit: boolean;
  showLettering: boolean;
  /** Preview texture detail only; physical lettering dimensions stay unchanged. */
  letteringQuality?: ScaleLetteringQuality;
  inkColor: string;
  plateColor: string;
}

export const DEFAULT_SCALE_DESIGN: ScaleDesign = {
  schema: 1,
  geometry: {
    ...DEFAULT_SCALE_STUDY_SETTINGS,
    supportOffsetInches: buildUpSupportOffsetInches(DEFAULT_SCALE_BUILD_UP),
  },
  densityMode: "fixed",
  layers: DEFAULT_SCALE_BUILD_UP,
  buildMethod: "wood",
  notes: "",
  text: "",
  fontId: "great-vibes",
  calligraphyFaceId: "auto",
  shapingEngine: "fontkit",
  fontFeatures: "",
  fontSizeMm: 16,
  minFontSizeMm: 3,
  marginMm: 2,
  autoFit: true,
  showLettering: true,
  letteringQuality: "crisp",
  inkColor: "#17201c",
  plateColor: "#b7946c",
};

function bounded(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

function color(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[a-f\d]{6}$/i.test(value)
    ? value.toLowerCase()
    : fallback;
}

function densityReference(geometry: ScaleStudySettings): ScaleDensityReference {
  const { modelId, modelScale, columns, rows } = geometry;
  return { modelId, modelScale, columns, rows };
}

function normalizeDensityReference(
  input: unknown,
  geometry: ScaleStudySettings,
): ScaleDensityReference {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return densityReference(geometry);
  const value = input as Record<string, unknown>;
  if (
    value.modelId !== geometry.modelId ||
    !["modelScale", "columns", "rows"].every(
      (key) => typeof value[key] === "number" && Number.isFinite(value[key]),
    )
  )
    return densityReference(geometry);
  return densityReference(normalizeScaleStudySettings(value));
}

function adaptiveDensity(reference: ScaleDensityReference, scale: number) {
  const ratio = scale / reference.modelScale;
  const requestedColumns = Math.round(reference.columns * ratio);
  const requestedRows = Math.round(reference.rows * ratio);
  const columns = Math.max(4, requestedColumns);
  const rows = Math.max(2, requestedRows);
  // Preserve the requested aspect ratio when the shared 600-cell budget binds.
  // Final normalization also enforces the generator's own bounds.
  const factor = Math.min(
    1,
    240 / columns,
    12 / rows,
    Math.sqrt(600 / (columns * rows)),
  );
  const bounded = normalizeScaleStudySettings({
    columns: Math.max(4, Math.floor(columns * factor)),
    rows: Math.max(2, Math.floor(rows * factor)),
  });
  return {
    columns: bounded.columns,
    rows: bounded.rows,
    requestedColumns,
    requestedRows,
    limited:
      bounded.columns !== requestedColumns || bounded.rows !== requestedRows,
  };
}

/** Whether the requested physical density meets a minimum or preview budget. */
export function scaleDensityStatus(design: ScaleDesign) {
  if (design.densityMode !== "adaptive") {
    return {
      columns: design.geometry.columns,
      rows: design.geometry.rows,
      requestedColumns: design.geometry.columns,
      requestedRows: design.geometry.rows,
      limited: false,
    };
  }
  return adaptiveDensity(
    normalizeDensityReference(design.densityReference, design.geometry),
    design.geometry.modelScale,
  );
}

export function resizeScaleDesign(
  design: ScaleDesign,
  scale: number,
): ScaleDesign {
  if (!Number.isFinite(scale) || scale <= 0)
    throw new RangeError("Model scale must be a positive finite number.");
  return normalizeScaleDesign({
    ...design,
    geometry: { ...design.geometry, modelScale: scale },
  });
}

export function setScaleDensityMode(
  design: ScaleDesign,
  mode: ScaleDensityMode,
): ScaleDesign {
  const current = normalizeScaleDesign(design);
  if (current.densityMode === mode) return current;
  return normalizeScaleDesign({
    ...current,
    densityMode: mode,
    densityReference:
      mode === "adaptive" ? densityReference(current.geometry) : undefined,
  });
}

/** A deliberate density edit sets a new physical anchor at the current size. */
export function updateScaleDensity(
  design: ScaleDesign,
  patch: Partial<Pick<ScaleStudySettings, "columns" | "rows">>,
): ScaleDesign {
  const current = normalizeScaleDesign(design);
  const geometry = normalizeScaleStudySettings({
    ...current.geometry,
    ...patch,
  });
  return normalizeScaleDesign({
    ...current,
    geometry,
    densityReference:
      current.densityMode === "adaptive"
        ? densityReference(geometry)
        : undefined,
  });
}

export const MAX_SCALE_DESIGN_BYTES = 3 * 1024 * 1024;
const MAX_FONT_BASE64_LENGTH = Math.ceil((2 * 1024 * 1024) / 3) * 4;

/** Embedded fonts travel with a saved design; remote font URLs never do. */
function customFont(input: unknown): ScaleDesign["customFont"] {
  if (input === undefined) return undefined;
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("The custom font must be an embedded TTF or OTF file.");
  const value = input as Record<string, unknown>;
  if (
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.length > 100
  )
    throw new Error("The custom font needs a name of at most 100 characters.");
  if (
    typeof value.dataUrl !== "string" ||
    value.dataUrl.length > MAX_FONT_BASE64_LENGTH + 100
  )
    throw new Error("The custom font exceeds the 2 MB limit.");
  if (
    !/^data:(?:font\/(?:ttf|otf)|application\/(?:x-font-ttf|x-font-otf|font-sfnt));base64,[a-z\d+/]+={0,2}$/i.test(
      value.dataUrl,
    )
  )
    throw new Error("Choose an embedded TTF or OTF font, not a remote URL.");
  return { name: value.name.trim(), dataUrl: value.dataUrl };
}

/** Whitelists portable data; the lazy font loader validates SFNT bytes before parsing. */
export function normalizeScaleDesign(input: unknown): ScaleDesign {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Choose a scale study JSON file exported by this page.");
  const value = input as Record<string, unknown>;
  if (value.schema !== 1)
    throw new Error("This scale study file has an unsupported format version.");
  if (typeof value.text !== "string" || value.text.length > 20_000)
    throw new Error("A scale study needs text of at most 20,000 characters.");
  const fontSizeMm = bounded(value.fontSizeMm, 16, 2, 80);
  const layers = normalizeScaleBuildUp(value.layers);
  const geometry = normalizeScaleStudySettings(value.geometry);
  if (geometry.modelId === "maquette") geometry.surfaceMode = "conforming";
  const densityMode = value.densityMode === "adaptive" ? "adaptive" : "fixed";
  const reference =
    densityMode === "adaptive"
      ? normalizeDensityReference(value.densityReference, geometry)
      : undefined;
  if (reference) {
    const counts = adaptiveDensity(reference, geometry.modelScale);
    geometry.columns = counts.columns;
    geometry.rows = counts.rows;
  }
  const embeddedFont = customFont(value.customFont);
  const fontId =
    typeof value.fontId === "string" &&
    (isWorksheetBundledFontId(value.fontId) ||
      ["serif", "sans", "mono", "custom"].includes(value.fontId))
      ? (value.fontId as ScaleDesign["fontId"])
      : DEFAULT_SCALE_DESIGN.fontId;
  if (fontId === "custom" && !embeddedFont)
    throw new Error(
      "This design needs its custom font. Import the font with the design.",
    );
  const features =
    typeof value.fontFeatures === "string" ? value.fontFeatures.trim() : "";
  if (
    features.length > 300 ||
    (features && !/^[a-zA-Z0-9=,\s+-]+$/.test(features))
  )
    throw new Error(
      "Use a short list of OpenType feature tags, such as liga=1, swsh=1.",
    );
  return {
    schema: 1,
    densityMode,
    ...(reference ? { densityReference: reference } : {}),
    geometry: {
      ...geometry,
      supportOffsetInches: buildUpSupportOffsetInches(layers),
    },
    layers,
    buildMethod:
      value.buildMethod === "printed" || value.buildMethod === "hybrid"
        ? value.buildMethod
        : "wood",
    notes: typeof value.notes === "string" ? value.notes.slice(0, 4000) : "",
    text: value.text,
    fontId,
    calligraphyFaceId:
      typeof value.calligraphyFaceId === "string" &&
      /^[a-zA-Z0-9_-]{1,160}$/.test(value.calligraphyFaceId)
        ? value.calligraphyFaceId
        : "auto",
    ...(embeddedFont ? { customFont: embeddedFont } : {}),
    shapingEngine: value.shapingEngine === "harfbuzz" ? "harfbuzz" : "fontkit",
    fontFeatures: features,
    fontSizeMm,
    minFontSizeMm: bounded(
      value.minFontSizeMm,
      Math.min(3, fontSizeMm),
      2,
      fontSizeMm,
    ),
    marginMm: bounded(value.marginMm, 2, 0, 20),
    autoFit: typeof value.autoFit === "boolean" ? value.autoFit : true,
    showLettering:
      typeof value.showLettering === "boolean" ? value.showLettering : true,
    letteringQuality:
      value.letteringQuality === "balanced" ? "balanced" : "crisp",
    inkColor: color(value.inkColor, DEFAULT_SCALE_DESIGN.inkColor),
    // Schema-1 files predating wood-colored previews keep their former color.
    plateColor: color(value.plateColor, "#d9dcd8"),
  };
}
