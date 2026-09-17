import { describe, expect, test } from "bun:test";
import {
  DEFAULT_WORKSHEET_SETTINGS,
  estimateWorksheet,
  getWorksheetLayout,
  normalizeWorksheetSettings,
  wrapText,
} from "./worksheet";

describe("worksheet settings", () => {
  test("defaults to 24 horizontal guides on landscape Letter paper", () => {
    const settings = normalizeWorksheetSettings({});
    const layout = getWorksheetLayout(settings);

    expect(settings).toEqual(DEFAULT_WORKSHEET_SETTINGS);
    expect(layout.widthMm).toBe(279.4);
    expect(layout.heightMm).toBe(215.9);
    expect(layout.baselineYsMm).toHaveLength(24);
    expect(layout.baselineYsMm[0]).toBe(12.7);
    expect(layout.baselineYsMm.at(-1)).toBeCloseTo(203.2, 10);
    expect(layout.lines).toHaveLength(24);
    expect(layout.lines.every((line) => line.y1 === line.y2)).toBe(true);

    const gaps = layout.baselineYsMm
      .slice(1)
      .map((value, index) => value - (layout.baselineYsMm[index] ?? 0));
    expect(new Set(gaps.map((gap) => gap.toFixed(10))).size).toBe(1);
  });

  test("fills omitted fields and accepts a valid custom page", () => {
    const settings = normalizeWorksheetSettings({
      paper: "custom",
      customWidthMm: 100,
      customHeightMm: 200,
      orientation: "landscape",
      marginLeftMm: 5,
      marginRightMm: 6,
    });
    const layout = getWorksheetLayout(settings);

    expect(settings.lineCount).toBe(24);
    expect(layout.widthMm).toBe(200);
    expect(layout.heightMm).toBe(100);
    expect(layout.contentX1Mm).toBe(5);
    expect(layout.contentX2Mm).toBe(194);
  });

  test.each([
    ["landscape", 300, 100, 300, 100],
    ["landscape", 100, 300, 300, 100],
    ["portrait", 300, 100, 100, 300],
    ["portrait", 100, 300, 100, 300],
  ] as const)(
    "%s custom pages consistently orient %d × %d mm dimensions",
    (orientation, customWidthMm, customHeightMm, widthMm, heightMm) => {
      const settings = normalizeWorksheetSettings({
        paper: "custom",
        orientation,
        customWidthMm,
        customHeightMm,
      });
      const layout = getWorksheetLayout(settings);

      expect(layout.widthMm).toBe(widthMm);
      expect(layout.heightMm).toBe(heightMm);
    },
  );

  test.each([
    ["non-object input", null],
    ["unknown fields", { futureSetting: true }],
    ["invalid enum", { mode: "music" }],
    ["fractional count", { lineCount: 2.5 }],
    ["non-finite number", { spacingMm: Number.NaN }],
    ["negative measurement", { xHeightMm: -1 }],
    ["negative letter spacing", { letterSpacingMm: -0.01 }],
    ["negative word spacing", { wordSpacingMm: -0.01 }],
    ["invalid color", { lineColor: "gray" }],
    ["oversized metadata", { nib: "x".repeat(121) }],
    [
      "page too small for margins",
      {
        paper: "a5",
        orientation: "portrait",
        marginLeftMm: 100,
        marginRightMm: 50,
      },
    ],
  ])("rejects %s", (_label, value) => {
    expect(() => normalizeWorksheetSettings(value)).toThrow();
  });
});

describe("worksheet geometry", () => {
  test("fixed spacing starts at the top margin and stays inside the bottom margin", () => {
    const settings = normalizeWorksheetSettings({
      paper: "custom",
      customWidthMm: 100,
      customHeightMm: 100,
      orientation: "portrait",
      marginTopMm: 10,
      marginBottomMm: 11,
      spacingMode: "fixed",
      spacingMm: 20,
    });
    const layout = getWorksheetLayout(settings);

    expect(layout.baselineYsMm).toEqual([10, 30, 50, 70]);
    expect(layout.baselineYsMm.at(-1)).toBeLessThanOrEqual(89);
  });

  test("copperplate and italic rows honor x-height, ratios, and row gap", () => {
    for (const mode of ["copperplate", "italic"] as const) {
      const settings = normalizeWorksheetSettings({
        mode,
        paper: "custom",
        customWidthMm: 200,
        customHeightMm: 100,
        orientation: "landscape",
        marginTopMm: 10,
        marginBottomMm: 10,
        xHeightMm: 4,
        ascenderRatio: 1.25,
        descenderRatio: 1.5,
        rowGapMm: 3,
        lineCount: 99,
      });
      const layout = getWorksheetLayout(settings);

      expect(layout.baselineYsMm[0]).toBe(19);
      expect(
        (layout.baselineYsMm[1] ?? 0) - (layout.baselineYsMm[0] ?? 0),
      ).toBe(18);
      expect(layout.baselineYsMm).not.toHaveLength(99);
      expect(
        layout.lines.slice(0, 4).map((line) => [line.kind, line.y1]),
      ).toEqual([
        ["ascender", 10],
        ["xheight", 15],
        ["baseline", 19],
        ["descender", 25],
      ]);
      expect(layout.lines.every((line) => line.y1 >= 10 && line.y2 <= 90)).toBe(
        true,
      );
    }
  });

  test("rejects rich proportions that cannot fit the usable region", () => {
    const settings = normalizeWorksheetSettings({
      paper: "custom",
      customWidthMm: 100,
      customHeightMm: 50,
      orientation: "landscape",
      marginTopMm: 20,
      marginBottomMm: 20,
      mode: "copperplate",
      xHeightMm: 5,
    });
    expect(() => getWorksheetLayout(settings)).toThrow(/do not fit/);
  });

  test("grid mode adds evenly spaced vertical guides", () => {
    const settings = normalizeWorksheetSettings({
      mode: "grid",
      paper: "custom",
      customWidthMm: 100,
      customHeightMm: 100,
      orientation: "portrait",
      marginLeftMm: 10,
      marginRightMm: 10,
      spacingMode: "fixed",
      spacingMm: 20,
      lineCount: 3,
    });
    const grid = getWorksheetLayout(settings).lines.filter(
      (line) => line.kind === "grid",
    );
    expect(grid.map((line) => line.x1)).toEqual([10, 30, 50, 70, 90]);
    expect(grid.every((line) => line.x1 === line.x2)).toBe(true);
  });

  test("count-mode grid columns use the actual horizontal guide pitch", () => {
    const settings = normalizeWorksheetSettings({
      mode: "grid",
      paper: "custom",
      customWidthMm: 100,
      customHeightMm: 100,
      orientation: "portrait",
      marginTopMm: 10,
      marginBottomMm: 10,
      marginLeftMm: 10,
      marginRightMm: 10,
      spacingMode: "count",
      lineCount: 5,
      spacingMm: 7,
    });
    const layout = getWorksheetLayout(settings);
    const horizontalPitch =
      (layout.baselineYsMm[1] ?? 0) - (layout.baselineYsMm[0] ?? 0);
    const gridXs = layout.lines
      .filter((line) => line.kind === "grid")
      .map((line) => line.x1);

    expect(horizontalPitch).toBe(20);
    expect(gridXs).toEqual([10, 30, 50, 70, 90]);
  });

  test("slant guides are clipped to every content edge and use the requested angle", () => {
    const settings = normalizeWorksheetSettings({
      paper: "custom",
      customWidthMm: 100,
      customHeightMm: 100,
      orientation: "portrait",
      marginTopMm: 10,
      marginBottomMm: 10,
      marginLeftMm: 10,
      marginRightMm: 10,
      guidesEnabled: false,
      slantEnabled: true,
      slantAngle: 55,
      slantSpacingMm: 15,
    });
    const layout = getWorksheetLayout(settings);

    expect(layout.lines.length).toBeGreaterThan(0);
    for (const line of layout.lines) {
      expect(line.kind).toBe("slant");
      for (const coordinate of [line.x1, line.x2, line.y1, line.y2]) {
        expect(Number.isFinite(coordinate)).toBe(true);
      }
      expect(line.x1).toBeGreaterThanOrEqual(10);
      expect(line.x1).toBeLessThanOrEqual(90);
      expect(line.x2).toBeGreaterThanOrEqual(10);
      expect(line.x2).toBeLessThanOrEqual(90);
      expect(line.y1).toBeGreaterThanOrEqual(10);
      expect(line.y1).toBeLessThanOrEqual(90);
      expect(line.y2).toBeGreaterThanOrEqual(10);
      expect(line.y2).toBeLessThanOrEqual(90);
      const angle =
        (Math.atan2(Math.abs(line.y2 - line.y1), Math.abs(line.x2 - line.x1)) *
          180) /
        Math.PI;
      expect(angle).toBeCloseTo(55, 10);
      const endpointsOnEdge = [line.x1, line.x2, line.y1, line.y2].filter(
        (value) => Math.abs(value - 10) < 1e-8 || Math.abs(value - 90) < 1e-8,
      );
      expect(endpointsOnEdge.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("worksheet text wrapping and estimates", () => {
  const measureCharacters = (value: string) => Array.from(value).length;

  test("wraps words greedily while preserving explicit and blank lines", () => {
    expect(wrapText("one two three\n\nfour", 7, measureCharacters)).toEqual([
      "one two",
      "three",
      "",
      "four",
    ]);
  });

  test("splits long tokens without breaking Unicode surrogate pairs", () => {
    expect(wrapText("😀😀😀 abcdef", 2, measureCharacters)).toEqual([
      "😀😀",
      "😀",
      "ab",
      "cd",
      "ef",
    ]);
    const family = "👩‍👩‍👧‍👦";
    expect(wrapText(`${family}${family}`, 1, () => 2)).toEqual([
      family,
      family,
    ]);
  });

  test("caps input length and rejects broken measurement functions", () => {
    expect(() => wrapText("x".repeat(20_001), 10, measureCharacters)).toThrow();
    expect(() => wrapText("text", 10, () => Number.NaN)).toThrow();
  });

  test("estimates required pages from the available worksheet rows", () => {
    const settings = normalizeWorksheetSettings({ lineCount: 2, pageCount: 2 });
    const layout = getWorksheetLayout(settings);
    const estimate = estimateWorksheet(
      "one two three four five",
      { ...layout, contentX2Mm: layout.contentX1Mm + 5 },
      measureCharacters,
      settings,
    );

    expect(estimate.lines).toEqual(["one", "two", "three", "four", "five"]);
    expect(estimate.lineCount).toBe(5);
    expect(estimate.rowsPerPage).toBe(2);
    expect(estimate.pagesNeeded).toBe(3);
    expect(estimate.overflow).toBe(true);
    expect(
      estimateWorksheet("", layout, measureCharacters, settings),
    ).toMatchObject({ lineCount: 0, pagesNeeded: 0, overflow: false });
  });
});
