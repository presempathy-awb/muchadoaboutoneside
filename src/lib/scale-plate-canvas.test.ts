import { expect, test } from "bun:test";
import { DEFAULT_SCALE_DESIGN } from "../../shared/scale-design";
import type { ScaleTextRange } from "../../shared/scale-lettering";
import type { ScalePlate } from "../../shared/scale-study";
import { drawScalePlate } from "./scale-plate-canvas";
import type { ScaleTypography } from "./scale-typography";

test("flat proofs and atlas drawing pass each line's source occurrence to the ink renderer", () => {
  const ranges = [
    { wordStart: 0, wordEnd: 1 },
    { wordStart: 1, wordEnd: 2 },
  ];
  const drawn: { text: string; range?: ScaleTextRange }[] = [];
  const typography: ScaleTypography = {
    family: "Reviewed ink",
    engine: "scan",
    supportedFeatures: [],
    hasGlyph: () => true,
    shape() {
      throw new Error("Raster ink has no font outlines");
    },
    measure: () => 10,
    measureLine: () => ({ widthMm: 10, heightMm: 5 }),
    draw(_context, text, _size, _x, _y, range) {
      drawn.push({ text, range });
    },
  };
  let saved = 0;
  const context = {
    save() {
      saved++;
    },
    restore() {
      saved--;
    },
    translate() {},
    scale() {},
    fillRect() {},
    beginPath() {},
    rect() {},
    clip() {},
    fillText() {
      throw new Error(
        "No synthetic fallback when scanned typography is supplied",
      );
    },
  } as unknown as CanvasRenderingContext2D;
  const plate = {
    widthInches: 2,
    heightInches: 1,
    safeRect: { x: 0, y: 0, width: 1, height: 1 },
  } as ScalePlate;
  drawScalePlate(
    context,
    plate,
    {
      plateId: "face",
      lines: ["echo", "echo"],
      fontSizeMm: 5,
      lineHeightsMm: [5, 5],
      lineRanges: ranges,
    },
    DEFAULT_SCALE_DESIGN,
    "unused",
    { x: 0, y: 0, width: 500, height: 250 },
    typography,
  );
  expect(drawn).toEqual([
    { text: "echo", range: ranges[0] },
    { text: "echo", range: ranges[1] },
  ]);
  expect(saved).toBe(0);
});
