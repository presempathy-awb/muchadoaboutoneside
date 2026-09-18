import { describe, expect, test } from "bun:test";
import { worksheetGlyphSpacing } from "./worksheet-shaping";

describe("worksheet cluster spacing", () => {
  test("distributes spacing across descending RTL clusters in visual order", () => {
    const clusters = [9, 8, 7, 7, 6, 5, 4, 3, 1, 0];
    const spacing = worksheetGlyphSpacing("سلام عليكم", clusters, {
      fontFeatures: "",
      letterSpacingMm: 1,
      wordSpacingMm: 2,
      writingScale: 1,
    });

    expect(spacing).toEqual([0, 1, 0, 1, 1, 1, 3, 1, 2, 1]);
    expect(spacing.reduce((total, value) => total + value, 0)).toBe(11);
  });

  test("places a ligature cluster's spacing on its final visual glyph", () => {
    expect(
      worksheetGlyphSpacing("abcd", [0, 1, 1, 3], {
        fontFeatures: "",
        letterSpacingMm: 1,
        wordSpacingMm: 0,
        writingScale: 1,
      }),
    ).toEqual([1, 0, 2, 0]);
  });

  test("distributes a maximum-size descending run in one logical pass", () => {
    const glyphCount = 19_000;
    const spacing = worksheetGlyphSpacing(
      "a".repeat(glyphCount),
      Array.from({ length: glyphCount }, (_, index) => glyphCount - index - 1),
      {
        fontFeatures: "",
        letterSpacingMm: 0.25,
        wordSpacingMm: 0,
        writingScale: 1,
      },
    );

    expect(spacing).toHaveLength(glyphCount);
    expect(spacing[0]).toBe(0);
    expect(spacing.at(-1)).toBe(0.25);
    expect(spacing.reduce((total, value) => total + value, 0)).toBe(
      (glyphCount - 1) * 0.25,
    );
  });
});
