import type { ScaleDesign } from "../../shared/scale-design";
import type {
  ScaleLineMetrics,
  ScaleTextRange,
} from "../../shared/scale-lettering";
import {
  DEFAULT_WORKSHEET_SETTINGS,
  type WorksheetSettings,
} from "../../shared/worksheet";
import { loadWorksheetFont } from "./worksheet-fonts";
import type {
  WorksheetInkBounds,
  WorksheetShapedRun,
  WorksheetShapingEngine,
} from "./worksheet-shaping";

const POINTS_PER_MM = 72 / 25.4;
const LEADING_EM = 0.2;
const MAX_METRICS = 1_024;
const MAX_METRICS_KEY_BYTES = 1024 * 1024;
const MAX_PATHS = 256;
const MAX_PATH_CHARACTERS = 512 * 1024;

export type ScaleTypographyRequest = Pick<
  ScaleDesign,
  "fontId" | "customFont" | "shapingEngine" | "fontFeatures"
>;

export interface ScaleTypography {
  /** Complete CSS family expression, including any necessary quoting. */
  family: string;
  engine: WorksheetShapingEngine | "scan";
  supportedFeatures: readonly string[];
  /** Complete source ranges that must remain whole during reflow. */
  segments?: readonly ScaleTextRange[];
  hasGlyph(text: string): boolean;
  /** Font outlines only; raster scan implementations reject this operation. */
  shape(text: string, sizeMm: number): WorksheetShapedRun;
  measure(text: string, sizeMm: number, range?: ScaleTextRange): number;
  measureLine(
    text: string,
    sizeMm: number,
    range?: ScaleTextRange,
  ): ScaleLineMetrics;
  /** Draws the exact measured ink centered at a physical-mm point. */
  draw(
    context: CanvasRenderingContext2D,
    text: string,
    sizeMm: number,
    centerXmm: number,
    centerYmm: number,
    range?: ScaleTextRange,
  ): void;
  /** Releases optional decoded raster resources after all previews release them. */
  dispose?(): void;
}

function checkedSize(sizeMm: number) {
  if (!Number.isFinite(sizeMm) || sizeMm <= 0 || sizeMm > 700) {
    throw new RangeError(
      "Font size must be greater than zero and at most 700 mm.",
    );
  }
}

function scaledBounds(bounds: WorksheetInkBounds | null, scale: number) {
  if (!bounds) return null;
  return {
    xMin: bounds.xMin * scale,
    xMax: bounds.xMax * scale,
    yMin: bounds.yMin * scale,
    yMax: bounds.yMax * scale,
    width: bounds.width * scale,
    height: bounds.height * scale,
  };
}

function metricsFor(run: WorksheetShapedRun, sizeMm: number): ScaleLineMetrics {
  return {
    // Include negative bearings, final flourishes, and whitespace advances.
    widthMm:
      Math.max(run.widthMm, run.inkBoundsMm?.xMax ?? 0) -
      Math.min(0, run.inkBoundsMm?.xMin ?? 0),
    heightMm:
      Math.max(sizeMm * 0.8, run.inkBoundsMm?.height ?? 0) +
      sizeMm * LEADING_EM,
  };
}

/**
 * Uses the existing integrity-checked, bounded font loader. Embedded fonts are
 * shaped once at one millimetre and scaled mathematically during autofit; their
 * rendered paths and measurement therefore share the same ligatures/bearings.
 * System fonts instead use the actual browser canvas face for both operations.
 */
export async function loadScaleTypography(
  request: ScaleTypographyRequest,
  systemContext?: CanvasRenderingContext2D,
): Promise<ScaleTypography> {
  const settings: WorksheetSettings = {
    ...DEFAULT_WORKSHEET_SETTINGS,
    fontId: request.fontId,
    shapingEngine: request.shapingEngine,
    fontFeatures: request.fontFeatures,
    fontSizeMode: "points",
    fontSizePt: POINTS_PER_MM,
    writingScale: 1,
    letterSpacingMm: 0,
    wordSpacingMm: 0,
  };
  const font = await loadWorksheetFont({
    version: 1,
    settings,
    text: "",
    customFont: request.customFont,
  });
  // Validate feature choices even while the wording is still blank.
  font.shape(" ", settings);
  const systemFont = ["serif", "sans", "mono"].includes(request.fontId);
  const canvasContext = systemFont
    ? (systemContext ??
      (typeof document === "undefined"
        ? undefined
        : document.createElement("canvas").getContext("2d")))
    : undefined;
  if (systemFont && !canvasContext) {
    throw new Error(
      "System font measurement needs a browser canvas. Choose an embedded calligraphy or uploaded font.",
    );
  }

  const metricsCache = new Map<string, ScaleLineMetrics>();
  let metricKeyBytes = 0;
  const pathCache = new Map<string, Path2D>();
  let pathCharacters = 0;

  const assertGlyphs = (text: string) => {
    if (text.length > 20_000)
      throw new RangeError("Text must contain at most 20,000 characters.");
    if (!font.hasGlyph(text)) {
      const missing = Array.from(text).find(
        (character) => !font.hasGlyph(character),
      );
      throw new Error(
        `The selected font cannot print “${missing ?? "this character"}”. Choose another font or remove the unsupported character.`,
      );
    }
  };

  const baseRun = (text: string) => {
    assertGlyphs(text);
    return font.shape(text, settings);
  };

  const shape = (text: string, sizeMm: number): WorksheetShapedRun => {
    checkedSize(sizeMm);
    if (canvasContext) {
      assertGlyphs(text);
      canvasContext.save();
      try {
        canvasContext.font = `${sizeMm}px ${font.family}`;
        canvasContext.textAlign = "left";
        canvasContext.textBaseline = "alphabetic";
        const measured = canvasContext.measureText(text);
        const values = [
          measured.width,
          measured.actualBoundingBoxLeft,
          measured.actualBoundingBoxRight,
          measured.actualBoundingBoxAscent,
          measured.actualBoundingBoxDescent,
        ];
        if (values.some((value) => !Number.isFinite(value))) {
          throw new Error(
            "This browser cannot measure the selected system font accurately. Choose an embedded calligraphy or uploaded font.",
          );
        }
        const inkBoundsMm = text.trim()
          ? {
              xMin: -measured.actualBoundingBoxLeft,
              xMax: measured.actualBoundingBoxRight,
              yMin: -measured.actualBoundingBoxDescent,
              yMax: measured.actualBoundingBoxAscent,
              width:
                measured.actualBoundingBoxLeft +
                measured.actualBoundingBoxRight,
              height:
                measured.actualBoundingBoxAscent +
                measured.actualBoundingBoxDescent,
            }
          : null;
        return {
          engine: font.engine,
          text,
          sizePt: sizeMm * POINTS_PER_MM,
          widthMm: measured.width,
          inkBoundsMm,
          glyphs: [],
          pathScaleMm: 0,
          writingScale: 1,
        };
      } finally {
        canvasContext.restore();
      }
    }
    const run = baseRun(text);
    if (sizeMm === 1) return run;
    return {
      ...run,
      sizePt: sizeMm * POINTS_PER_MM,
      widthMm: run.widthMm * sizeMm,
      inkBoundsMm: scaledBounds(run.inkBoundsMm, sizeMm),
      pathScaleMm: run.pathScaleMm * sizeMm,
      glyphs: run.glyphs.map((glyph) => ({
        ...glyph,
        xMm: glyph.xMm * sizeMm,
        yMm: glyph.yMm * sizeMm,
        advanceMm: glyph.advanceMm * sizeMm,
        inkBoundsMm: scaledBounds(glyph.inkBoundsMm, sizeMm),
      })),
    };
  };

  const measureLine = (text: string, sizeMm: number): ScaleLineMetrics => {
    checkedSize(sizeMm);
    const key = canvasContext ? `${sizeMm}\u0000${text}` : text;
    let metrics = metricsCache.get(key);
    if (!metrics) {
      metrics = metricsFor(
        shape(text, canvasContext ? sizeMm : 1),
        canvasContext ? sizeMm : 1,
      );
      const keyBytes = key.length * 2;
      while (
        metricsCache.size &&
        (metricsCache.size >= MAX_METRICS ||
          metricKeyBytes + keyBytes > MAX_METRICS_KEY_BYTES)
      ) {
        const oldest = metricsCache.keys().next().value;
        if (oldest === undefined) break;
        metricsCache.delete(oldest);
        metricKeyBytes -= oldest.length * 2;
      }
      if (keyBytes <= MAX_METRICS_KEY_BYTES) {
        metricsCache.set(key, metrics);
        metricKeyBytes += keyBytes;
      }
    }
    return canvasContext
      ? { ...metrics }
      : {
          widthMm: metrics.widthMm * sizeMm,
          heightMm: metrics.heightMm * sizeMm,
        };
  };

  const pathFor = (svg: string) => {
    let path = pathCache.get(svg);
    if (path) return path;
    if (typeof Path2D === "undefined")
      throw new Error(
        "This browser cannot draw font outlines. Update the browser to render this font.",
      );
    path = new Path2D(svg);
    while (
      pathCache.size &&
      (pathCache.size >= MAX_PATHS ||
        pathCharacters + svg.length > MAX_PATH_CHARACTERS)
    ) {
      const oldest = pathCache.keys().next().value;
      if (oldest === undefined) break;
      pathCache.delete(oldest);
      pathCharacters -= oldest.length;
    }
    if (svg.length <= MAX_PATH_CHARACTERS) {
      pathCache.set(svg, path);
      pathCharacters += svg.length;
    }
    return path;
  };

  return {
    family: font.family,
    engine: font.engine,
    supportedFeatures: font.supportedFeatures,
    hasGlyph: font.hasGlyph,
    shape,
    measure: (text, sizeMm) => measureLine(text, sizeMm).widthMm,
    measureLine,
    draw(context, text, sizeMm, centerXmm, centerYmm) {
      const run = shape(text, sizeMm);
      const ink = run.inkBoundsMm;
      if (!ink) return;
      const x = centerXmm - (ink.xMin + ink.xMax) / 2;
      const y = centerYmm + (ink.yMin + ink.yMax) / 2;
      context.save();
      try {
        if (canvasContext) {
          context.font = `${sizeMm}px ${font.family}`;
          context.textAlign = "left";
          context.textBaseline = "alphabetic";
          context.fillText(text, x, y);
        } else {
          for (const glyph of run.glyphs) {
            if (!glyph.path) continue;
            context.save();
            try {
              context.translate(x + glyph.xMm, y - glyph.yMm);
              context.scale(run.pathScaleMm, -run.pathScaleMm);
              context.fill(pathFor(glyph.path));
            } finally {
              context.restore();
            }
          }
        }
      } finally {
        context.restore();
      }
    },
  };
}
