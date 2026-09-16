import { describe, expect, test } from "bun:test";
import {
  BODY_ROW_PITCH_EM,
  BODY_ROWS,
  buildCalligraphyGuide,
  CANONICAL_GUIDE,
  CAPITALS,
  CHAPTERS,
  DIVISION_OF_LABOUR,
  ESSENTIALS,
  guideForVersion,
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
import {
  INSCRIPTION_LAYOUT,
  JAW_INSCRIPTION_LAYOUT,
  POEM_LINES,
  POEM_VERSIONS,
  poemVersionById,
} from "./poem";
import { applyDraft, draftSource } from "./poem-drafts";
import { textWidthEm } from "./script-metrics";

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

test("the canonical build backs the top-level exports", () => {
  expect(CANONICAL_GUIDE.masterRows).toBe(MASTER_ROWS);
  expect(CANONICAL_GUIDE.chapters).toBe(CHAPTERS);
  expect(CANONICAL_GUIDE.punctuation).toBe(PUNCTUATION);
  expect(CANONICAL_GUIDE.hasEllipsis).toBe(true);
  expect(CANONICAL_GUIDE.splitLines).toBe(6);
  expect(CANONICAL_GUIDE.spareRows).toBe(1);
  expect(CANONICAL_GUIDE.poemRepetitions).toBe(SMALL_EDITION.poemRepetitions);
  // The estimate other wordings use agrees with the canonical artwork's count.
  expect(
    Math.floor(
      SMALL_EDITION.circuitLengthMm /
        (REFERENCE_METRICS.loopWidthEm *
          SMALL_EDITION.emMm *
          SMALL_EDITION.horizontalScale),
    ),
  ).toBe(SMALL_EDITION.poemRepetitions);
  expect(guideForVersion(poemVersionById("canonical"))).toBe(CANONICAL_GUIDE);
});

describe("every wording of the poem builds a complete brief", () => {
  for (const version of POEM_VERSIONS) {
    const guide = buildCalligraphyGuide(version);
    test(`${version.id}: master rows reproduce the poem, splitting only at word gaps`, () => {
      const rebuilt = new Map<number, string[]>();
      for (const row of guide.masterRows) {
        expect(row.text).toBe(row.text.trim());
        expect(row.text).not.toContain("  ");
        expect(row.widthMm).toBeLessThan(SHEET_WRITING_WIDTH_MM - 4);
        rebuilt.set(row.line, [...(rebuilt.get(row.line) ?? []), row.text]);
      }
      expect(rebuilt.size).toBe(version.lines.length);
      for (const [line, parts] of rebuilt)
        expect(parts.join(" ")).toBe(version.lines[line - 1] ?? "");
      const ids = guide.masterRows.map((row) => row.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids[0]).toBe("R01");
      expect(ids.at(-1)).toBe(
        `R${String(version.lines.length).padStart(2, "0")}`,
      );
      expect(guide.masterSheets.flat()).toEqual([...guide.masterRows]);
      for (const sheet of guide.masterSheets)
        expect(sheet.length).toBeLessThanOrEqual(SHEET.rowsPerSheet);
      expect(guide.spareRows).toBeLessThan(SHEET.rowsPerSheet);
    });
    test(`${version.id}: metrics, hard words, and punctuation follow the poem`, () => {
      const text = version.lines.join(" ");
      expect(guide.lineWidthsEm).toHaveLength(version.lines.length);
      const sum = guide.lineWidthsEm.reduce((a, b) => a + b, 0);
      expect(guide.loopWidthEm).toBeGreaterThan(sum);
      expect(guide.loopWidthEm).toBeLessThan(sum + version.lines.length * 0.5);
      for (const word of guide.hardWords) expect(text).toContain(word);
      for (const row of guide.hardWordRows)
        for (const word of row.split(" "))
          expect([...guide.hardWords]).toContain(word);
      expect(new Set(guide.hardWordRows.join(" ").split(" ")).size).toBe(
        guide.hardWords.length,
      );
      for (const word of guide.compoundWords) expect(word).toMatch(/^[a-z]+$/);
      for (const item of guide.punctuation) {
        expect(item.count).toBeGreaterThan(0);
        expect(text.split(item.mark).length - 1).toBe(item.count);
      }
      for (const word of guide.apostropheWords) expect(text).toContain(word);
      expect(guide.hasEllipsis).toBe(text.includes("…"));
      expect(text).not.toMatch(/[“”"—–()]/);
      expect(guide.firstWord).toBe(version.lines[0]?.split(" ")[0] ?? "");
      expect(version.lines.at(-1)?.endsWith(guide.lastWord)).toBe(true);
    });
    test(`${version.id}: chapters are complete, ordered, and count their rows`, () => {
      expect(guide.chapters.map((chapter) => chapter.id)).toEqual(
        CHAPTERS.map((chapter) => chapter.id),
      );
      expect(guide.chapterById("quick")?.index).toBe("04");
      const allText = JSON.stringify(guide.chapters);
      expect(allText).toContain(`${guide.masterRows.length} rows`);
      expect(allText).toContain(`${guide.masterRows.length} approved rows`);
      expect(allText).toContain(guide.capitals.join(", "));
      expect(allText).toContain("copperplate");
      expect(allText).not.toContain("must be at least 1 mm wide");
      expect(guide.pdfPath).toBe(version.guidePdfPath);
      expect(guide.htmlPath).toBe(version.guideHtmlPath);
      expect(guide.guideVersion).toBe(version.guideVersion);
    });
  }
});

test("the extended wording gets its own rows, sheets, hard words, and notes", () => {
  const guide = guideForVersion(poemVersionById("extended"));
  expect(guide.version.lines).toHaveLength(40);
  expect(guide.masterRows).toHaveLength(48);
  expect(guide.masterSheets).toHaveLength(16);
  expect(guide.splitLines).toBe(8);
  expect(guide.spareRows).toBe(0);
  expect(
    guide.masterRows.filter((row) => row.part === "a").map((row) => row.line),
  ).toEqual([7, 12, 13, 19, 25, 26, 35, 39]);
  expect(guide.masterRows.map((row) => row.id)).toContain("R35b");
  expect(guide.hasEllipsis).toBe(false);
  expect(guide.punctuation.map((item) => item.mark)).toEqual([
    ",",
    "?",
    ".",
    "'",
  ]);
  expect(guide.apostropheWords).toHaveLength(9);
  expect(guide.capitals).toEqual([
    "A",
    "C",
    "D",
    "F",
    "H",
    "I",
    "L",
    "M",
    "O",
    "R",
    "S",
    "T",
  ]);
  expect(guide.hardWords).toContain("ouroborrows");
  expect(guide.hardWords).toContain("innfinite");
  expect(guide.hardWordRows).toHaveLength(6);
  // The maquette's ribbon stretches were tuned to the canonical loop.
  expect(guide.poemRepetitions).toBe(0);
  expect(guide.maquetteFits).toBe(false);
  expect(guide.bodyRows).toBe(9);
  expect(guide.jawRows).toBe(43);
  expect(JSON.stringify(guide.chapters)).toContain("does not fit");
  expect(guide.loopFigureEm).toBeLessThan(SMALL_EDITION.emMm * 0.8);
  expect(guide.sheetTitle).toBe("Much Ado About One Side (extended)");
  expect(guide.subtitle).toContain("(extended version)");
  const text = JSON.stringify(guide.chapters);
  expect(text).toContain("Eight long lines are written as two rows");
  expect(text).toContain("the nine apostrophes, and the lowercase “come”");
  expect(text).not.toContain("ellipsis, ");
  expect(text).toContain("There is no ellipsis");
  expect(text).toContain("The last line “come, palindove, let edges twine”");
  expect(text).toContain("No marking artwork yet");
  expect(text).toContain("does not fit: a 440 mm stretch");
  expect(text).toContain("9 rows around the body");
  expect(text).toContain("43-row inscription");
  expect(text).toContain("no complete repetition");
  expect(text).toContain("blank sheets are included for that");
  expect(text).toContain("about 431 ems");
});

test("an edited draft gets estimated widths, automatic row splits, and its own cache entry", () => {
  const base = poemVersionById("extended");
  const longLine =
    "and down, and down, and down, and down, past small, past small, past small, past small, past small";
  const drafted = applyDraft(
    base,
    `${draftSource(base)}\n\n${longLine}\nOnesided still, but ouroborrows no longer`,
  );
  expect(drafted.draft).toBe(true);
  const guide = guideForVersion(drafted);
  expect(guide).not.toBe(guideForVersion(base));
  expect(guide).toBe(guideForVersion(drafted));
  expect(guide.masterRows.map((row) => row.line).at(-1)).toBe(
    drafted.lines.length,
  );
  for (const row of guide.masterRows)
    expect(row.widthMm).toBeLessThan(SHEET_WRITING_WIDTH_MM - 4);
  const longRows = guide.masterRows.filter(
    (row) => row.line === drafted.lines.length - 1,
  );
  expect(longRows.length).toBeGreaterThanOrEqual(3);
  expect(longRows.map((row) => row.part)).toEqual(
    longRows.map((_, index) => String.fromCharCode(97 + index)),
  );
  expect(longRows.map((row) => row.text).join(" ")).toBe(longLine);
  expect(guide.hardWords).toContain("ouroborrows");
  for (const row of guide.hardWordRows)
    expect(textWidthEm(row) * WORKING.emMm).toBeLessThan(
      SHEET_WRITING_WIDTH_MM - 4,
    );
  expect(guide.bodyRows).toBeGreaterThanOrEqual(9);
  expect(guide.pdfPath).toBe(base.guidePdfPath);
  const shorter = applyDraft(base, "Come, palindove, let edges twine,");
  expect(guideForVersion(shorter)).not.toBe(guide);
  expect(guideForVersion(shorter).masterRows).toHaveLength(1);
});
