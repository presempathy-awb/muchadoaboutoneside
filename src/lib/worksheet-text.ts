import {
  getWorksheetLayout,
  normalizeWorksheetSettings,
  type WorksheetEstimate,
  type WorksheetLayout,
  wrapText,
} from "../../shared/worksheet";
import { specialWordPhrases } from "../../shared/worksheet-special-words";
import type { WorksheetFont } from "./worksheet-fonts";
import type { WorksheetShapedRun } from "./worksheet-shaping";
import type { WorksheetSnapshot } from "./worksheet-store";

export interface WorksheetTextPages {
  layout: WorksheetLayout;
  lines: string[];
  pages: string[][];
  placedPages: WorksheetPlacedText[][];
  estimate: WorksheetEstimate;
  warnings: string[];
}

export type WorksheetPracticeRole = "model" | "trace" | "blank";

export interface WorksheetPlacedText {
  text: string;
  role: WorksheetPracticeRole;
  opacity: number;
  xMm: number;
  baselineMm: number;
  run?: WorksheetShapedRun;
}

function assertNonnegativeTextSpacing(snapshot: WorksheetSnapshot) {
  if (
    snapshot.settings.letterSpacingMm < 0 ||
    snapshot.settings.wordSpacingMm < 0
  ) {
    throw new RangeError("Letter and word spacing cannot be negative.");
  }
}

export function worksheetTextPages(
  snapshot: WorksheetSnapshot,
  font: WorksheetFont,
): WorksheetTextPages {
  const settings = normalizeWorksheetSettings(snapshot.settings);
  assertNonnegativeTextSpacing({ ...snapshot, settings });
  const layout = getWorksheetLayout(settings);
  const availableWidth = layout.contentX2Mm - layout.contentX1Mm;
  const unsupported = snapshot.text
    .split(/\r\n?|\n/u)
    .every((paragraph) => font.hasGlyph(paragraph.trim().replace(/\s+/gu, " ")))
    ? undefined
    : Array.from(
        new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
          snapshot.text,
        ),
        ({ segment }) => segment,
      ).find(
        (grapheme) =>
          grapheme !== "\n" && grapheme !== "\r" && !font.hasGlyph(grapheme),
      );
  if (unsupported) {
    throw new Error(
      `The selected font cannot print “${unsupported}”. Choose another font or remove the unsupported character.`,
    );
  }
  // A paragraph repeatedly measures the same words and individual glyphs.
  // Keep the cache local to this model so edits never reuse stale font settings.
  const widths = new Map<string, number>();
  const measure = (text: string) => {
    const cached = widths.get(text);
    if (cached !== undefined) return cached;
    const width = font.measure(text, settings);
    widths.set(text, width);
    return width;
  };
  const lines = wrapText(
    snapshot.text,
    availableWidth,
    measure,
    specialWordPhrases(settings.specialWords),
  );
  const oversized = lines.find((line) => measure(line) > availableWidth + 1e-8);
  if (oversized) {
    throw new RangeError(
      `“${oversized}” is wider than the writing area at this font size. Reduce the font size or increase the page width.`,
    );
  }

  const rowsPerPage = layout.baselineYsMm.length;
  const patterned = settings.practicePattern === "model-trace-blank";
  const sourceRowsPerPage = patterned
    ? Math.floor(rowsPerPage / 3)
    : rowsPerPage;
  const pagesNeeded =
    lines.length === 0
      ? 0
      : sourceRowsPerPage === 0
        ? Number.POSITIVE_INFINITY
        : Math.ceil(lines.length / sourceRowsPerPage);
  const estimate: WorksheetEstimate = {
    lines,
    lineCount: lines.length,
    pagesNeeded,
    rowsPerPage,
    overflow: pagesNeeded > settings.pageCount,
  };
  const pages = Array.from({ length: settings.pageCount }, (_, pageIndex) => {
    if (lines.length === 0 || sourceRowsPerPage === 0) return [];
    let sourceLines: string[];
    if (settings.textRepeat && !estimate.overflow) {
      sourceLines = Array.from(
        { length: sourceRowsPerPage },
        (_, rowIndex) =>
          lines[(pageIndex * sourceRowsPerPage + rowIndex) % lines.length] ??
          "",
      );
    } else {
      sourceLines = lines.slice(
        pageIndex * sourceRowsPerPage,
        (pageIndex + 1) * sourceRowsPerPage,
      );
    }
    return patterned
      ? sourceLines.flatMap((line) => [line, line, ""])
      : sourceLines;
  });

  const placedPages = pages.map((page) =>
    page.map((text, rowIndex): WorksheetPlacedText => {
      const role: WorksheetPracticeRole = patterned
        ? rowIndex % 3 === 0
          ? "model"
          : rowIndex % 3 === 1
            ? "trace"
            : "blank"
        : "model";
      const baselineMm = layout.baselineYsMm[rowIndex] ?? 0;
      if (!text || role === "blank") {
        return {
          text: "",
          role,
          opacity: 0,
          xMm: layout.contentX1Mm,
          baselineMm,
        };
      }
      const run = font.shape(text, settings);
      const available = layout.contentX2Mm - layout.contentX1Mm;
      const xMm =
        layout.contentX1Mm +
        (settings.textAlign === "center"
          ? (available - run.widthMm) / 2
          : settings.textAlign === "right"
            ? available - run.widthMm
            : 0);
      return {
        text,
        role,
        opacity:
          role === "trace" ? settings.textOpacity * 0.25 : settings.textOpacity,
        xMm,
        baselineMm,
        run,
      };
    }),
  );
  const warnings = worksheetTextWarnings(layout, placedPages);
  return { layout, lines, pages, placedPages, estimate, warnings };
}

/** Translate a shaped line's ink bounds into physical page coordinates. */
export function worksheetPlacedBounds(
  row: WorksheetPlacedText,
): { xMin: number; xMax: number; yMin: number; yMax: number } | undefined {
  const bounds = row.run?.inkBoundsMm;
  if (!bounds) return undefined;
  return {
    xMin: row.xMm + bounds.xMin,
    xMax: row.xMm + bounds.xMax,
    yMin: row.baselineMm - bounds.yMax,
    yMax: row.baselineMm - bounds.yMin,
  };
}

function worksheetTextWarnings(
  layout: WorksheetLayout,
  pages: WorksheetPlacedText[][],
): string[] {
  let outsideWritingArea = false;
  let overlappingRows = false;
  for (const page of pages) {
    const occupied = page.flatMap((row) => {
      const bounds = worksheetPlacedBounds(row);
      return bounds ? [{ row, bounds }] : [];
    });
    outsideWritingArea ||= occupied.some(
      ({ bounds }) =>
        bounds.xMin < layout.contentX1Mm - 1e-8 ||
        bounds.xMax > layout.contentX2Mm + 1e-8 ||
        bounds.yMin < layout.contentY1Mm - 1e-8 ||
        bounds.yMax > layout.contentY2Mm + 1e-8,
    );
    const verticallySorted = occupied.toSorted(
      (left, right) => left.bounds.yMin - right.bounds.yMin,
    );
    for (
      let left = 0;
      left < verticallySorted.length && !overlappingRows;
      left += 1
    ) {
      const a = verticallySorted[left];
      if (!a) continue;
      for (let right = left + 1; right < verticallySorted.length; right += 1) {
        const b = verticallySorted[right];
        if (!b || a.row.baselineMm === b.row.baselineMm) continue;
        if (b.bounds.yMin >= a.bounds.yMax - 1e-8) break;
        if (
          a.bounds.xMin < b.bounds.xMax - 1e-8 &&
          a.bounds.xMax > b.bounds.xMin + 1e-8 &&
          a.bounds.yMin < b.bounds.yMax - 1e-8 &&
          a.bounds.yMax > b.bounds.yMin + 1e-8
        ) {
          overlappingRows = true;
          break;
        }
      }
    }
  }
  const warnings: string[] = [];
  if (outsideWritingArea) {
    warnings.push(
      "Some flourishes extend beyond the writing area, but they remain on the physical page.",
    );
  }
  if (overlappingRows) {
    warnings.push(
      "Some example strokes overlap another occupied practice row. Increase row spacing or reduce the text size.",
    );
  }
  return warnings;
}

function ensureTextFitsPhysicalPage(model: WorksheetTextPages) {
  const clipped = model.placedPages.some((page) =>
    page.some((row) => {
      const bounds = worksheetPlacedBounds(row);
      return (
        bounds !== undefined &&
        (bounds.xMin < -1e-8 ||
          bounds.xMax > model.layout.widthMm + 1e-8 ||
          bounds.yMin < -1e-8 ||
          bounds.yMax > model.layout.heightMm + 1e-8)
      );
    }),
  );
  if (clipped) {
    throw new RangeError(
      "The example text extends off the physical page. Increase the margins, reduce the text size, or choose a less expansive alternate.",
    );
  }
}

/** Throws when the current text model would be clipped or truncated on export. */
export function validateWorksheetTextFit(
  snapshot: WorksheetSnapshot,
  model: WorksheetTextPages,
): void {
  assertNonnegativeTextSpacing(snapshot);
  if (!snapshot.settings.textEnabled || snapshot.text === "") return;
  if (model.estimate.overflow) {
    if (!Number.isFinite(model.estimate.pagesNeeded)) {
      throw new RangeError(
        "The model/trace/blank pattern requires at least three writing rows on each page. Increase the row count or switch to continuous text.",
      );
    }
    throw new RangeError(
      `The example text needs ${model.estimate.pagesNeeded} pages, but the worksheet is set to ${snapshot.settings.pageCount}. Add pages, shorten the text, or reduce its size before printing.`,
    );
  }
  ensureTextFitsPhysicalPage(model);
}
