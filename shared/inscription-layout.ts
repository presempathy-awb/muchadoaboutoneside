/**
 * How any wording of the poem is laid out on the marked surfaces, and the
 * explicit limits that follow from the physical sculpture.
 *
 * The fixed layouts in poem.ts were tuned on the canonical wording. For any
 * other wording the font size scales so the glyph proportions on the surface
 * stay exactly the canonical ones, the rows re-fill the chart at the same
 * relative pitch, and a wording too short for one row repeats within the row.
 * Limits come from the marking floor (the smallest em the laser coupon tests)
 * at the thinnest section of each surface, and from the 180 mm maquette's
 * ribbon stretches between its blank gutters.
 */
import {
  INSCRIPTION_LAYOUT,
  JAW_INSCRIPTION_LAYOUT,
  type PoemVersion,
} from "./poem";
import { textWidthEm } from "./script-metrics";

/** The canonical loop width the fixed layouts were tuned on, in ems. */
export const CALIBRATION_LOOP_EM = 194.14;

/** The smallest em the project marks: the 180 mm maquette's coupon size. */
export const MARKING_FLOOR_EM_MM = 2.5;

/** The 180 mm maquette's reading ribbon, as its foil kit generates it. */
export const MAQUETTE = {
  circuitLengthMm: 1028.1,
  emMm: MARKING_FLOOR_EM_MM,
  horizontalScale: 0.906,
  /** Blank transition gutters along the circuit; lettering sits between them. */
  guttersMm: [
    [0, 40],
    [480, 520],
    [960, 1028.1],
  ],
  poemRepetitions: 2,
} as const;

/** Lettered stretches between the maquette's gutters, in mm. */
export const MAQUETTE_STRETCHES_MM: readonly number[] = MAQUETTE.guttersMm
  .slice(1)
  .map((gutter, index) => gutter[0] - (MAQUETTE.guttersMm[index]?.[1] ?? 0));

export type SurfaceId = "body" | "jaw";

/**
 * Physical scale of each UV chart, in mm, derived from the foil geometry
 * (generateFoilGeometry with FABRICATION_GEOMETRY_OPTIONS). U runs the full
 * reading circuit; V spans half the section perimeter, from one side meridian
 * over the front to the other. A test regenerates the geometry and checks
 * these numbers so they cannot drift from the model.
 */
export const SURFACE_SCALE: Record<
  SurfaceId,
  {
    loopLengthMm: number;
    halfPerimeterMm: { min: number; median: number; max: number };
  }
> = {
  body: {
    loopLengthMm: 28827.1,
    halfPerimeterMm: { min: 151.2, median: 676.3, max: 1114 },
  },
  jaw: {
    loopLengthMm: 1481.7,
    halfPerimeterMm: { min: 200.9, median: 390.9, max: 475.2 },
  },
};

export interface SurfaceLayout {
  width: number;
  height: number;
  fontSize: number;
  textWidth: number;
  left: number;
  firstBaseline: number;
  rowSpacing: number;
  rows: number;
}

export interface SurfaceRows {
  surface: SurfaceId;
  /** Same shape as the fixed layouts, so the generators take it unchanged. */
  layout: SurfaceLayout;
  /** Copies of the poem each row carries (more than one for short wordings). */
  repetitions: number;
  /** The text every row carries: the loop, repeated with double gaps. */
  rowText: string;
  loopWidthEm: number;
  rowWidthEm: number;
}

const BASE_LAYOUTS: Record<SurfaceId, SurfaceLayout> = {
  body: INSCRIPTION_LAYOUT,
  jaw: JAW_INSCRIPTION_LAYOUT,
};

const LOOP_GAP = "  ";
const round2 = (value: number) => Math.round(value * 100) / 100;

/** Rows of one surface for a wording of the given loop width. */
export function surfaceRows(
  surface: SurfaceId,
  version: Pick<PoemVersion, "loop" | "loopWidthEm">,
): SurfaceRows {
  const base = BASE_LAYOUTS[surface];
  const { loop, loopWidthEm } = version;
  if (!(loopWidthEm > 0) || loop.length === 0) {
    return {
      surface,
      layout: { ...base, rows: 0 },
      repetitions: 0,
      rowText: "",
      loopWidthEm: 0,
      rowWidthEm: 0,
    };
  }
  const bottomClearance =
    base.height - (base.firstBaseline + (base.rows - 1) * base.rowSpacing);
  // The largest font that still leaves room for one row.
  const maxFontSize =
    (base.height * base.fontSize) / (base.firstBaseline + bottomClearance);
  const fontFor = (rowEm: number) =>
    (base.fontSize * CALIBRATION_LOOP_EM) / rowEm;
  const gapEm = textWidthEm(LOOP_GAP);
  let repetitions = 1;
  let rowWidthEm = loopWidthEm;
  while (fontFor(rowWidthEm) > maxFontSize + 1e-9) {
    repetitions += 1;
    rowWidthEm = loopWidthEm * repetitions + gapEm * (repetitions - 1);
  }
  const fontSize = round2(fontFor(rowWidthEm));
  const scale = fontSize / base.fontSize;
  const firstBaseline = round2(base.firstBaseline * scale);
  const rowSpacing = round2(base.rowSpacing * scale);
  const rows = Math.max(
    1,
    Math.floor(
      (base.height - firstBaseline - bottomClearance * scale) / rowSpacing +
        1e-6,
    ) + 1,
  );
  return {
    surface,
    layout: {
      width: base.width,
      height: base.height,
      fontSize,
      textWidth: base.textWidth,
      left: base.left,
      firstBaseline,
      rowSpacing,
      rows,
    },
    repetitions,
    rowText: Array.from({ length: repetitions }, () => loop).join(LOOP_GAP),
    loopWidthEm,
    rowWidthEm: round2(rowWidthEm),
  };
}

/** Physical em of a font size on a surface at a given half-perimeter. */
export function surfaceEmMm(
  surface: SurfaceId,
  fontSize: number,
  halfPerimeterMm: number,
) {
  return (fontSize / BASE_LAYOUTS[surface].height) * halfPerimeterMm;
}

/**
 * The widest loop whose letters stay at or above the marking floor at the
 * thinnest section of the surface, with the calibrated proportions.
 */
export function surfaceLimitEm(surface: SurfaceId) {
  const base = BASE_LAYOUTS[surface];
  const floorFontSize =
    (MARKING_FLOOR_EM_MM * base.height) /
    SURFACE_SCALE[surface].halfPerimeterMm.min;
  return round2((CALIBRATION_LOOP_EM * base.fontSize) / floorFontSize);
}

export interface SurfaceBudget extends SurfaceRows {
  /** Letter em at the thinnest and the median section of the surface, in mm. */
  emMmMin: number;
  emMmMedian: number;
  limitEm: number;
  /** Letters stay at or above the marking floor everywhere on the surface. */
  fits: boolean;
}

export interface MaquetteBudget {
  /** Length of one lettered stretch between gutters, in mm. */
  stretchMm: number;
  /** The widest loop one stretch holds at the marking floor, in ems. */
  capacityEm: number;
  /** Em that would fit the whole loop into one stretch, in mm. */
  emMmToFit: number;
  /** Complete copies the kit's ribbon carries: one per stretch when it fits. */
  repetitions: number;
  fits: boolean;
}

export interface InscriptionBudget {
  loopWidthEm: number;
  body: SurfaceBudget;
  jaw: SurfaceBudget;
  maquette: MaquetteBudget;
  /** The strictest large-sculpture limit; the editor stops entry past it. */
  hardLimitEm: number;
  /** Which surface sets the hard limit. */
  hardLimitSurface: SurfaceId;
  fits: boolean;
}

function surfaceBudget(
  surface: SurfaceId,
  version: Pick<PoemVersion, "loop" | "loopWidthEm">,
): SurfaceBudget {
  const rows = surfaceRows(surface, version);
  const scale = SURFACE_SCALE[surface];
  const emMmMin = round2(
    surfaceEmMm(surface, rows.layout.fontSize, scale.halfPerimeterMm.min),
  );
  const emMmMedian = round2(
    surfaceEmMm(surface, rows.layout.fontSize, scale.halfPerimeterMm.median),
  );
  const limitEm = surfaceLimitEm(surface);
  return {
    ...rows,
    emMmMin,
    emMmMedian,
    limitEm,
    fits: rows.loopWidthEm <= limitEm + 1e-9,
  };
}

export function maquetteBudget(loopWidthEm: number): MaquetteBudget {
  const stretchMm = Math.min(...MAQUETTE_STRETCHES_MM);
  const capacityEm = round2(
    stretchMm / (MAQUETTE.emMm * MAQUETTE.horizontalScale),
  );
  const fits = loopWidthEm > 0 && loopWidthEm <= capacityEm + 1e-9;
  return {
    stretchMm,
    capacityEm,
    emMmToFit:
      loopWidthEm > 0
        ? round2(stretchMm / (loopWidthEm * MAQUETTE.horizontalScale))
        : 0,
    repetitions: fits ? MAQUETTE_STRETCHES_MM.length : 0,
    fits,
  };
}

/** Every surface's rows, sizes, and limits for a wording. */
export function inscriptionBudget(
  version: Pick<PoemVersion, "loop" | "loopWidthEm">,
): InscriptionBudget {
  const body = surfaceBudget("body", version);
  const jaw = surfaceBudget("jaw", version);
  const hardLimitSurface: SurfaceId =
    jaw.limitEm <= body.limitEm ? "jaw" : "body";
  return {
    loopWidthEm: version.loopWidthEm,
    body,
    jaw,
    maquette: maquetteBudget(version.loopWidthEm),
    hardLimitEm: Math.min(body.limitEm, jaw.limitEm),
    hardLimitSurface,
    fits: body.fits && jaw.fits,
  };
}
