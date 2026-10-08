import { expect, test } from "bun:test";
import { DEFAULT_WORKSHEET_SETTINGS } from "../../shared/worksheet";
import type { WorksheetFont } from "./worksheet-fonts";
import { worksheetPhotoSizing } from "./worksheet-photo-sizing";

const font = {
  hasGlyph: () => true,
  shape: () => ({ widthMm: 4, inkBoundsMm: { width: 3 } }),
} as unknown as WorksheetFont;
test("photo sizing matches physical x-height, baseline spacing and ink width", () => {
  expect(
    worksheetPhotoSizing(DEFAULT_WORKSHEET_SETTINGS, font, {
      xHeightMm: 5,
      lineSpacingMm: 12,
      letterWidthMm: 6,
      confidence: "medium",
      notes: "Measured rows",
    }),
  ).toEqual({
    mode: "plain",
    guidesEnabled: true,
    slantEnabled: false,
    spacingMode: "fixed",
    spacingMm: 12,
    xHeightMm: 5,
    fontSizeMode: "xheight",
    textXHeightMm: 5,
    writingScale: 2,
  });
  expect(DEFAULT_WORKSHEET_SETTINGS.writingScale).toBe(1);
  expect(() =>
    worksheetPhotoSizing(DEFAULT_WORKSHEET_SETTINGS, font, {
      xHeightMm: 5,
      lineSpacingMm: 12,
      letterWidthMm: 6,
      confidence: "low",
      notes: "Unclear",
    }),
  ).toThrow();
  expect(() =>
    worksheetPhotoSizing(DEFAULT_WORKSHEET_SETTINGS, font, {
      xHeightMm: 5,
      lineSpacingMm: 4,
      letterWidthMm: 6,
      confidence: "medium",
      notes: "Invalid spacing",
    }),
  ).toThrow();
});

test("photo sizing rejects a font without the reference glyph and impossible width matches", () => {
  const measurements = {
    xHeightMm: 5,
    lineSpacingMm: 12,
    letterWidthMm: 6,
    confidence: "medium" as const,
    notes: "Measured",
  };
  expect(() =>
    worksheetPhotoSizing(
      DEFAULT_WORKSHEET_SETTINGS,
      { ...font, hasGlyph: () => false },
      measurements,
    ),
  ).toThrow("cannot match");
  expect(() =>
    worksheetPhotoSizing(DEFAULT_WORKSHEET_SETTINGS, font, {
      ...measurements,
      letterWidthMm: 100,
    }),
  ).toThrow("cannot match");
  expect(() =>
    worksheetPhotoSizing(DEFAULT_WORKSHEET_SETTINGS, font, {
      ...measurements,
      letterWidthMm: 0.1,
    }),
  ).toThrow("cannot match");
});

test("a specially styled n does not change calibration of the main font", () => {
  const composite = {
    ...font,
    baseFont: font,
    shape: () => ({ widthMm: 12, inkBoundsMm: { width: 9 } }),
  } as unknown as WorksheetFont;
  expect(
    worksheetPhotoSizing(DEFAULT_WORKSHEET_SETTINGS, composite, {
      xHeightMm: 5,
      lineSpacingMm: 12,
      letterWidthMm: 6,
      confidence: "medium",
      notes: "Measured",
    }).writingScale,
  ).toBe(2);
});
