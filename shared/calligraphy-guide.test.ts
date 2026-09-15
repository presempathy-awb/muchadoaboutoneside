import { expect, test } from "bun:test";
import {
  BODY_ROW_PITCH_EM,
  BODY_ROWS,
  CAPITALS,
  CHAPTERS,
  DIVISION_OF_LABOUR,
  ESSENTIALS,
  HARD_WORD_ROWS,
  HARD_WORDS,
  JAW_ROWS,
  MASTER_ROWS,
  MASTER_SHEETS,
  PAPER_TO_SMALL_SCALE,
  PUNCTUATION,
  REFERENCE_METRICS,
  ROW_PITCH_EM,
  SHEET,
  SHEET_WRITING_WIDTH_MM,
  SMALL_EDITION,
  STYLE_SAMPLE_ROWS,
  WORKING,
} from "./calligraphy-guide";
import { INSCRIPTION_LAYOUT, JAW_INSCRIPTION_LAYOUT, POEM_LINES } from "./poem";

test("master rows reproduce the poem exactly, in order, splitting only at word gaps", () => {
  const rebuilt = new Map<number, string[]>();
  for (const row of MASTER_ROWS) {
    expect(row.text).toBe(row.text.trim());
    expect(row.text).not.toContain("  ");
    rebuilt.set(row.line, [...(rebuilt.get(row.line) ?? []), row.text]);
  }
  expect(rebuilt.size).toBe(POEM_LINES.length);
  for (const [line, parts] of rebuilt) {
    expect(parts.join(" ")).toBe(POEM_LINES[line - 1] ?? "");
  }
  const ids = MASTER_ROWS.map((row) => row.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids[0]).toBe("R01");
  expect(ids.at(-1)).toBe("R17");
});

test("every row fits the sheet's writing width and every sheet fits the page", () => {
  for (const row of MASTER_ROWS) {
    expect(row.widthMm).toBeLessThan(SHEET_WRITING_WIDTH_MM - 4);
  }
  expect(MASTER_SHEETS.flat()).toEqual([...MASTER_ROWS]);
  for (const sheet of MASTER_SHEETS)
    expect(sheet.length).toBeLessThanOrEqual(SHEET.rowsPerSheet);
  const lastBaseline =
    SHEET.firstBaselineMm + (SHEET.rowsPerSheet - 1) * WORKING.rowPitchMm;
  expect(lastBaseline + WORKING.flourishFloorMm).toBeLessThan(
    SHEET.heightMm - SHEET.marginMm,
  );
  expect(SHEET.firstBaselineMm - WORKING.flourishCeilingMm).toBeGreaterThan(
    SHEET.marginMm + 12,
  );
});

test("guide lines follow copperplate proportions and rows cannot touch", () => {
  expect(WORKING.ascenderMm).toBeCloseTo(WORKING.xHeightMm * 1.5, 5);
  expect(WORKING.descenderMm).toBeCloseTo(WORKING.xHeightMm * 1.5, 5);
  expect(WORKING.xHeightMm / WORKING.emMm).toBeCloseTo(
    REFERENCE_METRICS.xHeight,
    1,
  );
  expect(WORKING.xHeightRangeMm[0]).toBeLessThanOrEqual(WORKING.xHeightMm);
  expect(WORKING.xHeightRangeMm[1]).toBeGreaterThanOrEqual(WORKING.xHeightMm);
  expect(WORKING.flourishCeilingMm + WORKING.flourishFloorMm).toBeLessThan(
    WORKING.rowPitchMm,
  );
  expect(ROW_PITCH_EM).toBe(
    JAW_INSCRIPTION_LAYOUT.rowSpacing / JAW_INSCRIPTION_LAYOUT.fontSize,
  );
  expect(BODY_ROW_PITCH_EM).toBe(
    INSCRIPTION_LAYOUT.rowSpacing / INSCRIPTION_LAYOUT.fontSize,
  );
  expect(BODY_ROWS).toBe(4);
  expect(JAW_ROWS).toBe(18);
});

test("the digital hairline floor survives the scale to the maquette", () => {
  expect(PAPER_TO_SMALL_SCALE).toBeCloseTo(SMALL_EDITION.emMm / WORKING.emMm);
  expect(WORKING.digitalHairlineMm * PAPER_TO_SMALL_SCALE).toBeCloseTo(
    SMALL_EDITION.minimumStrokeMm,
    2,
  );
  expect(WORKING.scanHairlineMm).toBeLessThan(WORKING.digitalHairlineMm);
  expect(REFERENCE_METRICS.lineWidthsEm).toHaveLength(POEM_LINES.length);
  const sum = REFERENCE_METRICS.lineWidthsEm.reduce((a, b) => a + b, 0);
  expect(REFERENCE_METRICS.loopWidthEm).toBeGreaterThan(sum);
  expect(REFERENCE_METRICS.loopWidthEm).toBeLessThan(sum + 17 * 0.5);
});

test("hard words, capitals, and punctuation are drawn from the poem", () => {
  const text = POEM_LINES.join(" ");
  for (const word of HARD_WORDS) expect(text).toContain(word);
  for (const row of HARD_WORD_ROWS)
    for (const word of row.split(" "))
      expect([...HARD_WORDS] as string[]).toContain(word);
  expect(CAPITALS).toEqual(["C", "D", "E", "F", "I", "L", "O", "S", "T"]);
  const counts = Object.fromEntries(PUNCTUATION.map((p) => [p.mark, p.count]));
  expect(counts["…"]).toBe(1);
  expect(counts["'"]).toBe(5);
  expect(counts["?"]).toBe(1);
  expect(text).not.toMatch(/[“”"—–()]/);
});

test("the brief keeps five essentials and leaves the rest to Jill", () => {
  expect(ESSENTIALS).toHaveLength(5);
  expect(DIVISION_OF_LABOUR.rows.length).toBeGreaterThanOrEqual(5);
  expect(STYLE_SAMPLE_ROWS).toHaveLength(3);
  const allText = JSON.stringify(CHAPTERS);
  expect(allText).toContain("copperplate");
  expect(allText).not.toContain("must be at least 1 mm wide");
});

test("chapters are complete and ordered", () => {
  expect(CHAPTERS.map((chapter) => chapter.id)).toEqual([
    "overview",
    "steps",
    "templates",
    "quick",
    "details",
  ]);
  expect(CHAPTERS.map((chapter) => chapter.index)).toEqual([
    "01",
    "02",
    "03",
    "04",
    "05",
  ]);
  const figures: string[] = CHAPTERS.flatMap((chapter) =>
    chapter.blocks.flatMap((block) =>
      block.kind === "figure" ? [block.figure] : [],
    ),
  );
  for (const required of [
    "loop",
    "proportions",
    "strokeGauge",
    "ribbonSmall",
    "ribbonWorking",
    "sheetBlank",
    "sheetFree",
    "sheetsMaster",
    "styleSample",
    "hardWords",
    "rowMap",
    "pipeline",
  ])
    expect(figures).toContain(required);
  const steps = CHAPTERS[1]?.blocks.find((block) => block.kind === "steps");
  expect(steps?.kind === "steps" && steps.steps.length).toBe(10);
  const essentials = CHAPTERS.filter((chapter) =>
    chapter.blocks.some((block) => block.kind === "essentials"),
  );
  expect(essentials.map((chapter) => chapter.id)).toEqual([
    "overview",
    "quick",
  ]);
});
