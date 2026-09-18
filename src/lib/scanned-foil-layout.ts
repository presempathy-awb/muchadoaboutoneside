import { scanWords } from "../../shared/calligraphy-scan";
import { SURFACE_SCALE, type SurfaceId } from "../../shared/inscription-layout";
import { INSCRIPTION_LAYOUT, JAW_INSCRIPTION_LAYOUT } from "../../shared/poem";
import type { ScaleTextRange } from "../../shared/scale-lettering";
import type { ScaleTypography } from "./scale-typography";

const MAX_REPETITIONS = 64;
const MAX_ROWS = 64;
const MAX_REGION_DRAWS = 20_000;
const LOOP_GAP_EM = 0.8;

export interface ScannedFoilLayout {
  range: ScaleTextRange;
  sizeMm: number;
  loopWidthMm: number;
  lineHeightMm: number;
  gapMm: number;
  repetitions: number;
  rows: number;
  leftMm: number;
  topMm: number;
  pixelsPerMmX: number;
  pixelsPerMmY: number;
}

/** Use actual ink metrics and physical chart dimensions, never script advances. */
export function planScannedFoilLayout(
  surface: SurfaceId,
  text: string,
  typography: ScaleTypography,
): ScannedFoilLayout {
  const chart =
    surface === "body" ? INSCRIPTION_LAYOUT : JAW_INSCRIPTION_LAYOUT;
  const physical = SURFACE_SCALE[surface];
  const pixelsPerMmX = chart.width / physical.loopLengthMm;
  // The conceptual skin varies in girth; this is its measured median calibration.
  const pixelsPerMmY = chart.height / physical.halfPerimeterMm.median;
  const marginX = chart.left / pixelsPerMmX;
  const marginY = 65 / pixelsPerMmY;
  const width = physical.loopLengthMm - 2 * marginX;
  const height = physical.halfPerimeterMm.median - 2 * marginY;
  const range = { wordStart: 0, wordEnd: scanWords(text).length };
  const metrics = typography.measureLine(text, 1, range);
  if (
    !Number.isFinite(metrics.widthMm) ||
    metrics.widthMm <= 0 ||
    !Number.isFinite(metrics.heightMm) ||
    metrics.heightMm <= 0
  )
    throw new Error(
      "The handwriting has no measurable ink for this inscription.",
    );
  const preferredSize = chart.fontSize / pixelsPerMmY;
  const regionsPerLoop = Math.max(1, typography.segments?.length ?? 1);
  const repetitions = Math.min(
    MAX_REPETITIONS,
    Math.max(1, Math.floor(MAX_REGION_DRAWS / regionsPerLoop)),
    Math.max(
      1,
      Math.floor(
        (width / preferredSize + LOOP_GAP_EM) / (metrics.widthMm + LOOP_GAP_EM),
      ),
    ),
  );
  const sizeMm = Math.min(
    preferredSize,
    700,
    width / (metrics.widthMm * repetitions + LOOP_GAP_EM * (repetitions - 1)),
    height / metrics.heightMm,
  );
  const loopWidthMm = metrics.widthMm * sizeMm;
  const lineHeightMm = metrics.heightMm * sizeMm;
  const gapMm = LOOP_GAP_EM * sizeMm;
  const rows = Math.max(
    1,
    Math.min(
      MAX_ROWS,
      Math.floor(height / lineHeightMm),
      Math.floor(MAX_REGION_DRAWS / regionsPerLoop / repetitions),
    ),
  );
  return {
    range,
    sizeMm,
    loopWidthMm,
    lineHeightMm,
    gapMm,
    repetitions,
    rows,
    leftMm:
      (physical.loopLengthMm -
        repetitions * loopWidthMm -
        (repetitions - 1) * gapMm) /
      2,
    topMm: (physical.halfPerimeterMm.median - rows * lineHeightMm) / 2,
    pixelsPerMmX,
    pixelsPerMmY,
  };
}

/** Repetition is deliberate; every circuit reuses the same ordered occurrences. */
export function drawScannedFoilRows(
  context: CanvasRenderingContext2D,
  surface: SurfaceId,
  text: string,
  typography: ScaleTypography,
) {
  const plan = planScannedFoilLayout(surface, text, typography);
  context.save();
  try {
    context.scale(plan.pixelsPerMmX, plan.pixelsPerMmY);
    for (let row = 0; row < plan.rows; row++) {
      for (let copy = 0; copy < plan.repetitions; copy++) {
        typography.draw(
          context,
          text,
          plan.sizeMm,
          plan.leftMm +
            copy * (plan.loopWidthMm + plan.gapMm) +
            plan.loopWidthMm / 2,
          plan.topMm + (row + 0.5) * plan.lineHeightMm,
          plan.range,
        );
      }
    }
  } finally {
    context.restore();
  }
}
