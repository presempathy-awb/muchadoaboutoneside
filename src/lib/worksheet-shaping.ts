import type { Font as FontkitFont } from "@pdf-lib/fontkit";
import type { WorksheetSettings } from "../../shared/worksheet";

const MM_PER_POINT = 25.4 / 72;

export const MAX_SHAPING_TEXT_BYTES = 64 * 1024;
export const MAX_SHAPED_GLYPHS = 20_000;
export const MAX_GLYPH_PATH_CHARACTERS = 256 * 1024;
export const MAX_RUN_PATH_CHARACTERS = 2 * 1024 * 1024;

/**
 * Features that are useful for connected scripts and safe to expose as simple
 * on/off controls. A font must also advertise a tag before it is accepted.
 */
export const WORKSHEET_FEATURE_ALLOWLIST = Object.freeze([
  "calt",
  "clig",
  "dlig",
  "liga",
  "rlig",
  "salt",
  "swsh",
  "titl",
  "ss01",
  "ss02",
  "ss03",
  "ss04",
  "ss05",
  "ss06",
  "ss07",
  "ss08",
  "ss09",
  "ss10",
] as const);

export type WorksheetShapingEngine = "fontkit" | "harfbuzz";

export interface WorksheetInkBounds {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  width: number;
  height: number;
}

export interface WorksheetShapedGlyph {
  id: number;
  /** UTF-16 source index for HarfBuzz; a monotonic source index for Fontkit. */
  cluster: number;
  /** Final position from the run origin, in mm. */
  xMm: number;
  /** Offset above the baseline, in mm. */
  yMm: number;
  /** Final horizontal advance, including user spacing, in mm. */
  advanceMm: number;
  /** Unscaled SVG path in the font's coordinate system. */
  path?: string;
  /** Final bounds relative to the run origin and baseline, in mm. */
  inkBoundsMm: WorksheetInkBounds | null;
}

export interface WorksheetShapedRun {
  engine: WorksheetShapingEngine;
  text: string;
  sizePt: number;
  widthMm: number;
  inkBoundsMm: WorksheetInkBounds | null;
  glyphs: WorksheetShapedGlyph[];
  /** Multiply font-unit paths by this value to obtain millimetres. */
  pathScaleMm: number;
  writingScale: number;
}

export interface WorksheetShaper {
  readonly engine: WorksheetShapingEngine;
  shape(
    text: string,
    settings: WorksheetSettings,
    sizePt: number,
  ): WorksheetShapedRun;
  dispose(): void;
}

export interface WorksheetFontFeatureSetting {
  tag: string;
  enabled: boolean;
}

interface TypographySettings {
  fontFeatures?: string;
  letterSpacingMm: number;
  wordSpacingMm: number;
  writingScale: number;
}

interface RawGlyph {
  id: number;
  cluster: number;
  xAdvance: number;
  xOffset: number;
  yOffset: number;
  path?: string;
  bounds?: { minX: number; minY: number; maxX: number; maxY: number };
}

function assertShapingInput(text: string) {
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes > MAX_SHAPING_TEXT_BYTES) {
    throw new RangeError(
      `Example text is too large to shape safely (${bytes.toLocaleString()} bytes; maximum ${MAX_SHAPING_TEXT_BYTES.toLocaleString()}).`,
    );
  }
}

export function parseWorksheetFontFeatures(
  value: string | undefined,
  supportedFeatures: readonly string[],
): WorksheetFontFeatureSetting[] {
  if (!value?.trim()) return [];
  const supported = new Set(supportedFeatures);
  const allowed = new Set<string>(WORKSHEET_FEATURE_ALLOWLIST);
  const result: WorksheetFontFeatureSetting[] = [];
  for (const part of value.split(",")) {
    const [rawTag, rawValue] = part.trim().toLowerCase().split("=");
    const tag = rawTag ?? "";
    if (!/^[a-z0-9]{4}$/u.test(tag) || !allowed.has(tag)) {
      throw new Error(`“${part.trim()}” is not a supported OpenType feature.`);
    }
    if (rawValue !== undefined && rawValue !== "0" && rawValue !== "1") {
      throw new Error(
        `“${part.trim()}” is not a valid OpenType feature value.`,
      );
    }
    if (!supported.has(tag)) {
      throw new Error(
        `The selected font does not support the “${tag}” feature.`,
      );
    }
    if (!result.some((item) => item.tag === tag)) {
      result.push({ tag, enabled: rawValue !== "0" });
    }
  }
  return result;
}

export function supportedWorksheetFontFeatures(
  advertised: readonly (string | number | symbol)[],
): string[] {
  const advertisedTags = new Set(advertised.map(String));
  return WORKSHEET_FEATURE_ALLOWLIST.filter((tag) => advertisedTags.has(tag));
}

function graphemeSpacing(text: string, settings: TypographySettings) {
  const segments = Array.from(
    new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
    ({ segment, index }) => ({ segment, index }),
  );
  return segments.map(({ segment, index }, segmentIndex) => ({
    startUtf16: index,
    spacingMm:
      (segmentIndex < segments.length - 1 ? settings.letterSpacingMm : 0) +
      (/\s/u.test(segment) ? settings.wordSpacingMm : 0),
  }));
}

/**
 * Assigns logical grapheme spacing to the final visual glyph for each cluster.
 * HarfBuzz emits descending clusters for RTL, so visual adjacency cannot be
 * inferred from the next array element.
 */
export function worksheetGlyphSpacing(
  text: string,
  clusters: readonly number[],
  settings: TypographySettings,
): number[] {
  const invalid = clusters.find(
    (cluster) =>
      !Number.isSafeInteger(cluster) || cluster < 0 || cluster > text.length,
  );
  if (invalid !== undefined) {
    throw new Error("The selected font returned an invalid text cluster.");
  }
  const logicalClusters = [...new Set(clusters)].sort(
    (left, right) => left - right,
  );
  const lastGlyphByCluster = new Map<number, number>();
  clusters.forEach((cluster, index) => {
    lastGlyphByCluster.set(cluster, index);
  });
  const spacingByCluster = new Map<number, number>();
  const graphemes = graphemeSpacing(text, settings);
  let graphemeIndex = 0;
  logicalClusters.forEach((cluster, index) => {
    const logicalEnd = logicalClusters[index + 1] ?? text.length;
    while (
      graphemeIndex < graphemes.length &&
      (graphemes[graphemeIndex]?.startUtf16 ?? Number.POSITIVE_INFINITY) <
        cluster
    ) {
      graphemeIndex += 1;
    }
    let clusterSpacing = 0;
    while (
      graphemeIndex < graphemes.length &&
      (graphemes[graphemeIndex]?.startUtf16 ?? Number.POSITIVE_INFINITY) <
        logicalEnd
    ) {
      clusterSpacing += graphemes[graphemeIndex]?.spacingMm ?? 0;
      graphemeIndex += 1;
    }
    spacingByCluster.set(cluster, clusterSpacing);
  });
  return clusters.map((cluster, index) =>
    lastGlyphByCluster.get(cluster) === index
      ? (spacingByCluster.get(cluster) ?? 0)
      : 0,
  );
}

function bounds(
  xMin: number,
  yMin: number,
  xMax: number,
  yMax: number,
): WorksheetInkBounds {
  return {
    xMin,
    yMin,
    xMax,
    yMax,
    width: Math.max(0, xMax - xMin),
    height: Math.max(0, yMax - yMin),
  };
}

function unionBounds(
  current: WorksheetInkBounds | null,
  next: WorksheetInkBounds | null,
): WorksheetInkBounds | null {
  if (!next) return current;
  if (!current) return next;
  return bounds(
    Math.min(current.xMin, next.xMin),
    Math.min(current.yMin, next.yMin),
    Math.max(current.xMax, next.xMax),
    Math.max(current.yMax, next.yMax),
  );
}

function finishRun(
  engine: WorksheetShapingEngine,
  text: string,
  settings: TypographySettings,
  sizePt: number,
  unitsPerEm: number,
  rawGlyphs: RawGlyph[],
): WorksheetShapedRun {
  if (rawGlyphs.length > MAX_SHAPED_GLYPHS) {
    throw new RangeError(
      `The selected font produced too many glyphs (${rawGlyphs.length.toLocaleString()}; maximum ${MAX_SHAPED_GLYPHS.toLocaleString()}).`,
    );
  }
  if (settings.letterSpacingMm < 0 || settings.wordSpacingMm < 0) {
    throw new RangeError("Letter and word spacing cannot be negative.");
  }
  const pathScaleMm = (sizePt * MM_PER_POINT) / unitsPerEm;
  const writingScale = settings.writingScale;
  const glyphSpacing = worksheetGlyphSpacing(
    text,
    rawGlyphs.map(({ cluster }) => cluster),
    settings,
  );
  let penXUnits = 0;
  let extraSpacingMm = 0;
  let pathCharacters = 0;
  let runBounds: WorksheetInkBounds | null = null;
  const glyphs = rawGlyphs.map((raw, index): WorksheetShapedGlyph => {
    const numericMetrics = [
      raw.id,
      raw.cluster,
      raw.xAdvance,
      raw.xOffset,
      raw.yOffset,
      ...(raw.bounds
        ? [raw.bounds.minX, raw.bounds.minY, raw.bounds.maxX, raw.bounds.maxY]
        : []),
    ];
    if (
      numericMetrics.some((metric) => !Number.isFinite(metric)) ||
      numericMetrics.some((metric) => Math.abs(metric) > unitsPerEm * 1_000)
    ) {
      throw new Error("The selected font returned unsafe glyph metrics.");
    }
    if (raw.path) {
      pathCharacters += raw.path.length;
      if (
        raw.path.length > MAX_GLYPH_PATH_CHARACTERS ||
        pathCharacters > MAX_RUN_PATH_CHARACTERS
      ) {
        throw new RangeError(
          "The selected font produced an outline that is too complex to render safely.",
        );
      }
    }
    if (raw.id === 0) {
      const unsupported = Array.from(
        new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
          text,
        ),
      ).find(
        ({ index: graphemeStart, segment }) =>
          raw.cluster >= graphemeStart &&
          raw.cluster < graphemeStart + segment.length,
      )?.segment;
      throw new Error(
        `The selected font cannot print “${unsupported ?? "this character"}”. Choose another font or remove the unsupported character.`,
      );
    }
    const xMm =
      (penXUnits + raw.xOffset) * pathScaleMm * writingScale + extraSpacingMm;
    const yMm = raw.yOffset * pathScaleMm;
    const spacingAfterMm = glyphSpacing[index] ?? 0;
    const advanceMm =
      raw.xAdvance * pathScaleMm * writingScale + spacingAfterMm;
    const inkBoundsMm = raw.bounds
      ? bounds(
          xMm + raw.bounds.minX * pathScaleMm * writingScale,
          yMm + raw.bounds.minY * pathScaleMm,
          xMm + raw.bounds.maxX * pathScaleMm * writingScale,
          yMm + raw.bounds.maxY * pathScaleMm,
        )
      : null;
    runBounds = unionBounds(runBounds, inkBoundsMm);
    penXUnits += raw.xAdvance;
    extraSpacingMm += spacingAfterMm;
    return {
      id: raw.id,
      cluster: raw.cluster,
      xMm,
      yMm,
      advanceMm,
      path: raw.path,
      inkBoundsMm,
    };
  });
  const widthMm = Math.max(
    0,
    penXUnits * pathScaleMm * writingScale + extraSpacingMm,
  );
  return {
    engine,
    text,
    sizePt,
    widthMm,
    inkBoundsMm: runBounds,
    glyphs,
    pathScaleMm,
    writingScale,
  };
}

export function createFontkitShaper(
  font: FontkitFont,
  supportedFeatures: readonly string[],
): WorksheetShaper {
  let disposed = false;
  return {
    engine: "fontkit",
    shape(text, settings, sizePt) {
      if (disposed) throw new Error("This font shaper has been disposed.");
      assertShapingInput(text);
      const unsupported = Array.from(
        new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
          text,
        ),
        ({ segment }) => segment,
      ).find((grapheme) =>
        Array.from(grapheme).some((character) => {
          const codePoint = character.codePointAt(0);
          return (
            codePoint === undefined || !font.hasGlyphForCodePoint(codePoint)
          );
        }),
      );
      if (unsupported) {
        throw new Error(
          `The selected font cannot print “${unsupported}”. Choose another font or remove the unsupported character.`,
        );
      }
      const selectedFeatures = parseWorksheetFontFeatures(
        (settings as WorksheetSettings & { fontFeatures?: string })
          .fontFeatures,
        supportedFeatures,
      );
      const run = font.layout(
        text,
        Object.fromEntries(
          selectedFeatures.map(({ tag, enabled }) => [tag, enabled]),
        ),
      );
      const sourceLengths = run.glyphs.map(
        (glyph) => String.fromCodePoint(...glyph.codePoints).length,
      );
      let sourceCursor = run.direction === "rtl" ? text.length : 0;
      const fontkitClusters: Array<number | undefined> = sourceLengths.map(
        (sourceLength) => {
          if (sourceLength === 0) return undefined;
          const cluster =
            run.direction === "rtl"
              ? sourceCursor - sourceLength
              : sourceCursor;
          sourceCursor +=
            run.direction === "rtl" ? -sourceLength : sourceLength;
          return cluster;
        },
      );
      if (sourceCursor !== (run.direction === "rtl" ? 0 : text.length)) {
        throw new Error(
          "The selected font returned incomplete source mapping for this text.",
        );
      }
      if (run.direction === "rtl") {
        let nextCluster: number | undefined;
        for (let index = fontkitClusters.length - 1; index >= 0; index -= 1) {
          if (fontkitClusters[index] === undefined) {
            fontkitClusters[index] = nextCluster;
          } else {
            nextCluster = fontkitClusters[index];
          }
        }
      } else {
        let previousCluster: number | undefined;
        for (let index = 0; index < fontkitClusters.length; index += 1) {
          if (fontkitClusters[index] === undefined) {
            fontkitClusters[index] = previousCluster;
          } else {
            previousCluster = fontkitClusters[index];
          }
        }
      }
      return finishRun(
        "fontkit",
        text,
        settings,
        sizePt,
        font.unitsPerEm,
        run.glyphs.map((glyph, index) => {
          const position = run.positions[index];
          if (!position) {
            throw new Error(
              "The selected font returned incomplete glyph positions.",
            );
          }
          const currentCluster = fontkitClusters[index];
          if (currentCluster === undefined) {
            throw new Error(
              "The selected font returned an unmapped glyph for this text.",
            );
          }
          const path = glyph.path.toSVG();
          return {
            id: glyph.id,
            cluster: currentCluster,
            xAdvance: position.xAdvance,
            xOffset: position.xOffset,
            yOffset: position.yOffset,
            path,
            bounds: path
              ? {
                  minX: glyph.bbox.minX,
                  minY: glyph.bbox.minY,
                  maxX: glyph.bbox.maxX,
                  maxY: glyph.bbox.maxY,
                }
              : undefined,
          };
        }),
      );
    },
    dispose() {
      disposed = true;
    },
  };
}

type HarfBuzzModule = typeof import("harfbuzzjs");

export async function createHarfBuzzShaper(
  bytes: Uint8Array<ArrayBuffer>,
  supportedFeatures: readonly string[],
): Promise<WorksheetShaper> {
  const hb = await import("harfbuzzjs");
  // HarfBuzz v1 objects are reclaimed through FinalizationRegistry. Keeping the
  // font graph inside this closure makes explicit cache disposal release every
  // strong reference at once; each per-shape Buffer is short-lived.
  let blob: InstanceType<HarfBuzzModule["Blob"]> | undefined = new hb.Blob(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  let face: InstanceType<HarfBuzzModule["Face"]> | undefined = new hb.Face(
    blob,
  );
  let font: InstanceType<HarfBuzzModule["Font"]> | undefined = new hb.Font(
    face,
  );
  const unitsPerEm = face.upem;
  font.setScale(unitsPerEm, unitsPerEm);
  return {
    engine: "harfbuzz",
    shape(text, settings, sizePt) {
      if (!font) throw new Error("This font shaper has been disposed.");
      assertShapingInput(text);
      const selectedFeatures = parseWorksheetFontFeatures(
        (settings as WorksheetSettings & { fontFeatures?: string })
          .fontFeatures,
        supportedFeatures,
      );
      const buffer = new hb.Buffer();
      buffer.addText(text);
      buffer.guessSegmentProperties();
      hb.shape(
        font,
        buffer,
        selectedFeatures.map(
          ({ tag, enabled }) => new hb.Feature(tag, enabled ? 1 : 0),
        ),
      );
      const infos = buffer.getGlyphInfos();
      const positions = buffer.getGlyphPositions();
      return finishRun(
        "harfbuzz",
        text,
        settings,
        sizePt,
        unitsPerEm,
        infos.map((info, index) => {
          const position = positions[index];
          if (!position) {
            throw new Error("HarfBuzz returned incomplete glyph positions.");
          }
          const extents = font?.glyphExtents(info.codepoint);
          return {
            id: info.codepoint,
            cluster: info.cluster,
            xAdvance: position.xAdvance,
            xOffset: position.xOffset,
            yOffset: position.yOffset,
            path: font?.glyphToPath(info.codepoint),
            bounds: extents
              ? {
                  minX: extents.xBearing,
                  minY: extents.yBearing + extents.height,
                  maxX: extents.xBearing + extents.width,
                  maxY: extents.yBearing,
                }
              : undefined,
          };
        }),
      );
    },
    dispose() {
      font = undefined;
      face = undefined;
      blob = undefined;
    },
  };
}
