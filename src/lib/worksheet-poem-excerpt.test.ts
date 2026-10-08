import { expect, test } from "bun:test";
import { DEFAULT_WORKSHEET_SETTINGS } from "../../shared/worksheet";
import type { WorksheetFont } from "./worksheet-fonts";
import { worksheetPoemExcerpt } from "./worksheet-poem-excerpt";
import type { WorksheetSnapshot } from "./worksheet-store";

const font: WorksheetFont = {
  id: "excerpt-test",
  family: "serif",
  engine: "fontkit",
  supportedFeatures: [],
  unitsPerEm: 1000,
  xHeightUnits: 500,
  resolveSizePt: () => 24,
  hasGlyph: () => true,
  measure: (text) => text.length,
  shape: (text, settings) => ({
    engine: "fontkit",
    text,
    sizePt: 24,
    widthMm: text.length,
    glyphs: [],
    pathScaleMm: 0.01,
    writingScale: settings.writingScale,
    inkBoundsMm: {
      xMin: 0,
      xMax: text.length,
      yMin: 0,
      yMax: 2,
      width: text.length,
      height: 2,
    },
  }),
};
const snapshot: WorksheetSnapshot = {
  version: 1,
  settings: { ...DEFAULT_WORKSHEET_SETTINGS, lineCount: 2 },
  text: "My existing words",
};

test("the default excerpt uses complete original lines that fit and does not mutate the draft", () => {
  expect(worksheetPoemExcerpt(snapshot, font)).toEqual({
    text: "Come, palindove, let edges twine,\nthy side is mine and mine is thine.",
    lineCount: 2,
    totalLines: 40,
  });
  expect(snapshot.text).toBe("My existing words");
  expect(snapshot.settings.textEnabled).toBe(false);
});

test("three-row practice consumes three rows for each poem line", () => {
  const result = worksheetPoemExcerpt(
    {
      ...snapshot,
      settings: {
        ...snapshot.settings,
        lineCount: 6,
        practicePattern: "model-trace-blank",
      },
    },
    font,
  );
  expect(result.lineCount).toBe(2);
  expect(result.text).toBe(
    "Come, palindove, let edges twine,\nthy side is mine and mine is thine.",
  );
});

test("physical clipping and font errors cannot be disguised as a fitting excerpt", () => {
  const clippedFont = {
    ...font,
    shape: (text: string, settings: WorksheetSnapshot["settings"]) => ({
      ...font.shape(text, settings),
      inkBoundsMm: {
        xMin: -100,
        xMax: 20,
        yMin: 0,
        yMax: 2,
        width: 120,
        height: 2,
      },
    }),
  };
  expect(() => worksheetPoemExcerpt(snapshot, clippedFont)).toThrow(
    "off the physical page",
  );
  expect(() =>
    worksheetPoemExcerpt(snapshot, { ...font, hasGlyph: () => false }),
  ).toThrow("cannot print");
});
