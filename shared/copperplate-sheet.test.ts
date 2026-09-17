import { describe, expect, test } from "bun:test";
import {
  createSheetLayout,
  createSheetPdf,
  DEFAULT_SHEET_SETTINGS,
  PAPER_SIZES,
  type SheetSettings,
  sheetFilename,
} from "./copperplate-sheet";

const decoder = new TextDecoder();

function pdfText(settings: SheetSettings) {
  return decoder.decode(createSheetPdf(settings));
}

test("the default layout has 24 evenly spaced Letter landscape lines", () => {
  const layout = createSheetLayout(DEFAULT_SHEET_SETTINGS);

  expect(PAPER_SIZES.letter).toEqual({
    label: "US Letter",
    widthMm: 215.9,
    heightMm: 279.4,
  });
  expect(layout.widthMm).toBe(279.4);
  expect(layout.heightMm).toBe(215.9);
  expect(layout.x1Mm).toBe(12.7);
  expect(layout.x2Mm).toBeCloseTo(266.7, 10);
  expect(layout.lineYsMm).toHaveLength(24);
  expect(layout.lineYsMm[0]).toBe(12.7);
  expect(layout.lineYsMm.at(-1)).toBeCloseTo(203.2, 10);
  const gaps = layout.lineYsMm
    .slice(1)
    .map((lineY, index) => lineY - (layout.lineYsMm[index] ?? Number.NaN));
  for (const gap of gaps) {
    expect(gap).toBeCloseTo(layout.spacingMm, 10);
  }
});

test("A4 landscape dimensions and custom lines use the same geometry", () => {
  const settings: SheetSettings = {
    lineCount: 7,
    paper: "a4",
    orientation: "landscape",
    marginMm: 20,
    lineWidthPt: 1.25,
    darkness: 75,
  };
  const layout = createSheetLayout(settings);

  expect(layout.widthMm).toBe(297);
  expect(layout.heightMm).toBe(210);
  expect(layout.x1Mm).toBe(20);
  expect(layout.x2Mm).toBe(277);
  expect(layout.spacingMm).toBeCloseTo(170 / 6, 10);
  expect(layout.lineYsMm).toEqual([
    20,
    20 + 170 / 6,
    20 + (2 * 170) / 6,
    105,
    20 + (4 * 170) / 6,
    20 + (5 * 170) / 6,
    190,
  ]);
  expect(sheetFilename(settings)).toBe("copperplate-lines-7-a4-landscape.pdf");
});

describe("settings validation", () => {
  test.each([
    ["line count below range", { lineCount: 1 }],
    ["line count above range", { lineCount: 101 }],
    ["fractional line count", { lineCount: 2.5 }],
    ["non-finite line count", { lineCount: Number.NaN }],
    ["margin below range", { marginMm: 4.99 }],
    ["margin above range", { marginMm: 50.01 }],
    ["line width below range", { lineWidthPt: 0.09 }],
    ["line width above range", { lineWidthPt: 2.01 }],
    ["darkness below range", { darkness: 9.99 }],
    ["darkness above range", { darkness: 100.01 }],
    ["invalid paper", { paper: "legal" }],
    ["invalid orientation", { orientation: "upside-down" }],
  ])("rejects %s", (_label, override) => {
    const settings = {
      ...DEFAULT_SHEET_SETTINGS,
      ...override,
    } as SheetSettings;
    expect(() => createSheetLayout(settings)).toThrow();
    expect(() => createSheetPdf(settings)).toThrow();
    expect(() => sheetFilename(settings)).toThrow();
  });
});

test("the PDF xref, stream length, and startxref offsets are byte-accurate", () => {
  const bytes = createSheetPdf(DEFAULT_SHEET_SETTINGS);
  const pdf = decoder.decode(bytes);
  expect(pdf).toStartWith("%PDF-1.7\n");
  expect(pdf).toEndWith("%%EOF\n");
  expect(pdf).toContain("/ViewerPreferences << /PrintScaling /None >>");

  const startxref = Number(pdf.match(/startxref\n(\d+)\n/)?.[1]);
  expect(pdf.slice(startxref, startxref + 4)).toBe("xref");

  const xref = pdf.match(/xref\n0 5\n([\s\S]*?)trailer/)?.[1] ?? "";
  expect(xref).not.toBe("");
  const entries = xref.trimEnd().split("\n");
  expect(entries).toHaveLength(5);
  for (let objectNumber = 1; objectNumber <= 4; objectNumber += 1) {
    const offset = Number((entries[objectNumber] ?? "").slice(0, 10));
    expect(pdf.slice(offset)).toStartWith(`${objectNumber} 0 obj\n`);
  }

  const stream =
    pdf.match(/4 0 obj\n<< \/Length (\d+) >>\nstream\n([\s\S]*?)endstream/) ??
    [];
  expect(stream[2]).toBeDefined();
  expect(Number(stream[1])).toBe(
    new TextEncoder().encode(stream[2] ?? "").length,
  );
  expect(bytes.length).toBe(pdf.length);
});

test("the PDF draws only the configured horizontal, equally spaced rules", () => {
  const settings: SheetSettings = {
    lineCount: 5,
    paper: "a4",
    orientation: "landscape",
    marginMm: 10,
    lineWidthPt: 0.8,
    darkness: 65,
  };
  const pdf = pdfText(settings);
  expect(pdf).toContain("/MediaBox [0 0 841.8898 595.2756]");
  expect(pdf).toContain("0.3500 G");
  expect(pdf).toContain("0.8000 w");
  expect(pdf).not.toMatch(/\b(?:BT|Tj|TJ|re)\b/);

  const rules = [
    ...pdf.matchAll(/([\d.]+) ([\d.]+) m ([\d.]+) ([\d.]+) l/g),
  ].map((match) => match.slice(1).map(Number));
  expect(rules).toHaveLength(5);
  for (const [x1, y1, x2, y2] of rules) {
    expect(x1).toBeCloseTo((10 * 72) / 25.4, 4);
    expect(x2).toBeCloseTo((287 * 72) / 25.4, 4);
    expect(y1).toBe(y2);
  }
  const yCoordinates = rules.map((rule) => rule[1] ?? Number.NaN);
  const pdfGaps = yCoordinates
    .slice(1)
    .map((lineY, index) => (yCoordinates[index] ?? Number.NaN) - lineY);
  for (let index = 1; index < pdfGaps.length; index += 1) {
    expect(pdfGaps[index]).toBeCloseTo(pdfGaps[index - 1] ?? Number.NaN, 3);
  }
});
