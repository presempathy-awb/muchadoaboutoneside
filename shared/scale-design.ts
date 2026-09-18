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

export interface ScaleDesign {
  schema: 1;
  geometry: ScaleStudySettings;
  layers: ScaleBuildUp;
  buildMethod: "wood" | "printed" | "hybrid";
  notes: string;
  text: string;
  fontId: WorksheetSettings["fontId"];
  customFont?: { name: string; dataUrl: string };
  shapingEngine: "fontkit" | "harfbuzz";
  fontFeatures: string;
  fontSizeMm: number;
  minFontSizeMm: number;
  marginMm: number;
  autoFit: boolean;
  showLettering: boolean;
  inkColor: string;
  plateColor: string;
}

export const DEFAULT_SCALE_DESIGN: ScaleDesign = {
  schema: 1,
  geometry: {
    ...DEFAULT_SCALE_STUDY_SETTINGS,
    supportOffsetInches: buildUpSupportOffsetInches(DEFAULT_SCALE_BUILD_UP),
  },
  layers: DEFAULT_SCALE_BUILD_UP,
  buildMethod: "wood",
  notes: "",
  text: "",
  fontId: "great-vibes",
  shapingEngine: "fontkit",
  fontFeatures: "",
  fontSizeMm: 16,
  minFontSizeMm: 3,
  marginMm: 2,
  autoFit: true,
  showLettering: true,
  inkColor: "#17201c",
  plateColor: "#d9dcd8",
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
    inkColor: color(value.inkColor, DEFAULT_SCALE_DESIGN.inkColor),
    plateColor: color(value.plateColor, DEFAULT_SCALE_DESIGN.plateColor),
  };
}
