import { expect, test } from "bun:test";
import { SURFACE_SCALE } from "../../shared/inscription-layout";
import { INSCRIPTION_LAYOUT } from "../../shared/poem";
import type { ScaleTextRange } from "../../shared/scale-lettering";
import type { ScaleTypography } from "./scale-typography";
import {
  drawScannedFoilRows,
  planScannedFoilLayout,
} from "./scanned-foil-layout";

function typography(width: number, height: number): ScaleTypography {
  return {
    family: "Ink",
    engine: "scan",
    supportedFeatures: [],
    segments: [{ wordStart: 0, wordEnd: 2 }],
    hasGlyph: () => true,
    shape() {
      throw new Error("Never convert scans into font glyphs");
    },
    measure: (_text, size) => width * size,
    measureLine: (_text, size) => ({
      widthMm: width * size,
      heightMm: height * size,
    }),
    draw() {},
  };
}

test("continuous scan layout preserves measured ink proportions in physical chart units", () => {
  for (const surface of ["body", "jaw"] as const) {
    const plan = planScannedFoilLayout(
      surface,
      "two words",
      typography(200, 2),
    );
    expect(plan.loopWidthMm / plan.lineHeightMm).toBeCloseTo(100, 9);
    const chartWidth = plan.loopWidthMm * plan.pixelsPerMmX;
    const chartHeight = plan.lineHeightMm * plan.pixelsPerMmY;
    const physicalWidth =
      (chartWidth / INSCRIPTION_LAYOUT.width) *
      SURFACE_SCALE[surface].loopLengthMm;
    const physicalHeight =
      (chartHeight / INSCRIPTION_LAYOUT.height) *
      SURFACE_SCALE[surface].halfPerimeterMm.median;
    expect(physicalWidth / physicalHeight).toBeCloseTo(100, 9);
    expect(plan.leftMm).toBeGreaterThan(0);
    expect(plan.topMm).toBeGreaterThan(0);
    expect(
      plan.leftMm +
        plan.repetitions * plan.loopWidthMm +
        (plan.repetitions - 1) * plan.gapMm,
    ).toBeLessThan(SURFACE_SCALE[surface].loopLengthMm);
    expect(plan.topMm + plan.rows * plan.lineHeightMm).toBeLessThan(
      SURFACE_SCALE[surface].halfPerimeterMm.median,
    );
    expect(plan.range).toEqual({ wordStart: 0, wordEnd: 2 });
  }
});

test("every repeated loop draws the complete exact source occurrence range", () => {
  const face = typography(15, 1.2);
  const drawn: { text: string; size: number; range?: ScaleTextRange }[] = [];
  face.draw = (_context, text, size, _x, _y, range) => {
    drawn.push({ text, size, range });
  };
  const scales: number[][] = [];
  let saved = 0;
  const context = {
    save() {
      saved++;
    },
    restore() {
      saved--;
    },
    scale(x: number, y: number) {
      scales.push([x, y]);
    },
  } as unknown as CanvasRenderingContext2D;
  const plan = planScannedFoilLayout("body", "echo echo", face);
  drawScannedFoilRows(context, "body", "echo echo", face);
  expect(drawn).toHaveLength(plan.rows * plan.repetitions);
  expect(plan.repetitions).toBeGreaterThan(1);
  for (const item of drawn)
    expect(item).toEqual({
      text: "echo echo",
      size: plan.sizeMm,
      range: { wordStart: 0, wordEnd: 2 },
    });
  expect(scales).toEqual([[plan.pixelsPerMmX, plan.pixelsPerMmY]]);
  expect(saved).toBe(0);
});

test("small scans and many source regions keep repeated raster work bounded", () => {
  const face = typography(0.001, 0.001);
  face.segments = Array.from({ length: 2_000 }, (_, index) => ({
    wordStart: index,
    wordEnd: index + 1,
  }));
  const plan = planScannedFoilLayout("body", "tiny words", face);
  expect(
    plan.repetitions * plan.rows * face.segments.length,
  ).toBeLessThanOrEqual(20_000);
});
