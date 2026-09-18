import { textWidthEm } from "./script-metrics";

const MILLIMETRES_PER_INCH = 25.4;
const LINE_HEIGHT_FACTOR = 1.4;
const MAX_TEXT_LENGTH = 20_000;
const AUTOFIT_ITERATIONS = 24;

/** Word occurrence indices in the complete transcript; end is exclusive. */
export interface ScaleTextRange {
  wordStart: number;
  wordEnd: number;
}

export interface ScaleLetteringPlate {
  id: string;
  surface: "body" | "jaw";
  widthInches: number;
  heightInches: number;
  safeRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export type ScaleLetteringMeasurer = (
  text: string,
  fontSizeMm: number,
  range?: ScaleTextRange,
) => number;

export interface ScaleLineMetrics {
  widthMm: number;
  /** Full ink height plus the intended leading, in physical millimetres. */
  heightMm: number;
}

export type ScaleLineMeasurer = (
  text: string,
  fontSizeMm: number,
  range?: ScaleTextRange,
) => ScaleLineMetrics;

export interface ScaleLetteringOptions {
  fontSizeMm: number;
  marginMm: number;
  measure?: ScaleLetteringMeasurer;
  measureLine?: ScaleLineMeasurer;
  /** Ordered, complete transcript coverage whose joined ink cannot be split. */
  segments?: readonly ScaleTextRange[];
}

export interface FitScaleLetteringOptions extends ScaleLetteringOptions {
  minFontSizeMm: number;
}

export interface ScaleLetteringPlacement {
  plateId: string;
  lines: string[];
  fontSizeMm: number;
  /** Per-line physical heights, measured with the exact rendering font. */
  lineHeightsMm?: number[];
  /** Source occurrence identity survives reflow, including repeated words. */
  lineRanges?: ScaleTextRange[];
}

export interface ScaleLetteringResult {
  placements: ScaleLetteringPlacement[];
  unplacedText: string;
  placedWordCount: number;
  totalWordCount: number;
}

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
}

function validateInputs(
  plates: readonly ScaleLetteringPlate[],
  text: string,
  options: ScaleLetteringOptions,
): void {
  if (text.length > MAX_TEXT_LENGTH)
    throw new RangeError(`text must be at most ${MAX_TEXT_LENGTH} characters`);

  assertFinite("fontSizeMm", options.fontSizeMm);
  if (options.fontSizeMm <= 0)
    throw new RangeError("fontSizeMm must be greater than zero");
  assertFinite("marginMm", options.marginMm);
  if (options.marginMm < 0)
    throw new RangeError("marginMm must be zero or greater");
  if (options.measure !== undefined && typeof options.measure !== "function")
    throw new TypeError("measure must be a function");
  if (
    options.measureLine !== undefined &&
    typeof options.measureLine !== "function"
  )
    throw new TypeError("measureLine must be a function");

  const ids = new Set<string>();
  for (const [index, plate] of plates.entries()) {
    const label = `plates[${index}]`;
    if (plate.id.length === 0)
      throw new RangeError(`${label}.id must not be empty`);
    if (ids.has(plate.id))
      throw new RangeError(`plate id must be unique: ${plate.id}`);
    ids.add(plate.id);
    if (plate.surface !== "body" && plate.surface !== "jaw")
      throw new RangeError(`${label}.surface must be body or jaw`);

    assertFinite(`${label}.widthInches`, plate.widthInches);
    assertFinite(`${label}.heightInches`, plate.heightInches);
    if (plate.widthInches <= 0 || plate.heightInches <= 0)
      throw new RangeError(`${label} dimensions must be greater than zero`);

    const { x, y, width, height } = plate.safeRect;
    for (const [key, value] of Object.entries({ x, y, width, height }))
      assertFinite(`${label}.safeRect.${key}`, value);
    if (
      x < 0 ||
      y < 0 ||
      width < 0 ||
      height < 0 ||
      x + width > 1 ||
      y + height > 1
    )
      throw new RangeError(
        `${label}.safeRect must be within normalized bounds`,
      );
  }
}

function measuredLine(
  text: string,
  fontSizeMm: number,
  options: ScaleLetteringOptions,
  range: ScaleTextRange,
): ScaleLineMetrics {
  const metrics = options.measureLine
    ? options.measureLine(text, fontSizeMm, range)
    : {
        widthMm: options.measure
          ? options.measure(text, fontSizeMm, range)
          : textWidthEm(text) * fontSizeMm,
        heightMm: fontSizeMm * LINE_HEIGHT_FACTOR,
      };
  if (!Number.isFinite(metrics.widthMm) || metrics.widthMm < 0)
    throw new RangeError("measure must return a finite, non-negative width");
  if (!Number.isFinite(metrics.heightMm) || metrics.heightMm <= 0)
    throw new RangeError("measureLine must return a finite, positive height");
  return metrics;
}

function segmentBoundaries(
  wordCount: number,
  segments: readonly ScaleTextRange[] | undefined,
): number[] {
  if (segments === undefined)
    return Array.from({ length: wordCount + 1 }, (_, index) => index);
  if (!Array.isArray(segments))
    throw new TypeError("segments must be an ordered array of word ranges");
  const boundaries = [0];
  for (const segment of segments) {
    if (
      !segment ||
      !Number.isInteger(segment.wordStart) ||
      !Number.isInteger(segment.wordEnd) ||
      segment.wordStart !== boundaries[boundaries.length - 1] ||
      segment.wordEnd <= segment.wordStart ||
      segment.wordEnd > wordCount
    )
      throw new RangeError(
        "segments must cover the transcript in order without gaps or overlaps",
      );
    boundaries.push(segment.wordEnd);
  }
  if (boundaries[boundaries.length - 1] !== wordCount)
    throw new RangeError("segments must cover every word in the transcript");
  return boundaries;
}

/**
 * Finds the longest word prefix that fits one line. Exponential probing keeps
 * narrow lines cheap; binary refinement avoids measuring every growing prefix
 * on unusually wide faces.
 */
function fittingLineEnd(
  words: readonly string[],
  boundaries: readonly number[],
  start: number,
  maxWidthMm: number,
  maxHeightMm: number,
  fontSizeMm: number,
  options: ScaleLetteringOptions,
): number {
  const fits = (end: number) => {
    const range = {
      wordStart: boundaries[start] ?? 0,
      wordEnd: boundaries[end] ?? words.length,
    };
    const metrics = measuredLine(
      words.slice(range.wordStart, range.wordEnd).join(" "),
      fontSizeMm,
      options,
      range,
    );
    return metrics.widthMm <= maxWidthMm && metrics.heightMm <= maxHeightMm;
  };

  if (!fits(start + 1)) return start;

  let low = start + 1;
  let step = 1;
  const segmentCount = boundaries.length - 1;
  let high = segmentCount;
  while (low < segmentCount) {
    const candidate = Math.min(segmentCount, low + step);
    if (!fits(candidate)) {
      high = candidate;
      break;
    }
    low = candidate;
    step *= 2;
  }
  if (low === segmentCount) return low;

  while (high - low > 1) {
    const middle = low + Math.floor((high - low) / 2);
    if (fits(middle)) low = middle;
    else high = middle;
  }
  return low;
}

/** Allocate complete words across plates in the order supplied by the caller. */
export function allocateScaleLettering(
  plates: readonly ScaleLetteringPlate[],
  text: string,
  options: ScaleLetteringOptions,
): ScaleLetteringResult {
  validateInputs(plates, text, options);
  const words = text.match(/\S+/gu) ?? [];
  const boundaries = segmentBoundaries(words.length, options.segments);
  let segmentIndex = 0;

  const placements = plates.map((plate): ScaleLetteringPlacement => {
    const maxWidthMm = Math.max(
      0,
      plate.widthInches * MILLIMETRES_PER_INCH * plate.safeRect.width -
        2 * options.marginMm,
    );
    const maxHeightMm = Math.max(
      0,
      plate.heightInches * MILLIMETRES_PER_INCH * plate.safeRect.height -
        2 * options.marginMm,
    );
    const lines: string[] = [];
    const lineHeightsMm: number[] = [];
    const lineRanges: ScaleTextRange[] = [];
    let usedHeightMm = 0;

    while (usedHeightMm < maxHeightMm && segmentIndex < boundaries.length - 1) {
      const end = fittingLineEnd(
        words,
        boundaries,
        segmentIndex,
        maxWidthMm,
        maxHeightMm - usedHeightMm,
        options.fontSizeMm,
        options,
      );
      if (end === segmentIndex) break;
      const range = {
        wordStart: boundaries[segmentIndex] ?? 0,
        wordEnd: boundaries[end] ?? words.length,
      };
      const line = words.slice(range.wordStart, range.wordEnd).join(" ");
      const { heightMm } = measuredLine(
        line,
        options.fontSizeMm,
        options,
        range,
      );
      lines.push(line);
      lineHeightsMm.push(heightMm);
      lineRanges.push(range);
      usedHeightMm += heightMm;
      segmentIndex = end;
    }

    return {
      plateId: plate.id,
      lines,
      lineHeightsMm,
      lineRanges,
      fontSizeMm: options.fontSizeMm,
    };
  });

  const wordIndex = boundaries[segmentIndex] ?? 0;
  return {
    placements,
    unplacedText: words.slice(wordIndex).join(" "),
    placedWordCount: wordIndex,
    totalWordCount: words.length,
  };
}

/** Find the largest bounded font size that places the complete wording. */
export function fitScaleLettering(
  plates: readonly ScaleLetteringPlate[],
  text: string,
  options: FitScaleLetteringOptions,
): ScaleLetteringResult {
  assertFinite("minFontSizeMm", options.minFontSizeMm);
  if (options.minFontSizeMm <= 0)
    throw new RangeError("minFontSizeMm must be greater than zero");
  if (options.minFontSizeMm > options.fontSizeMm)
    throw new RangeError("minFontSizeMm must not exceed fontSizeMm");

  const requested = allocateScaleLettering(plates, text, options);
  if (requested.placedWordCount === requested.totalWordCount) return requested;

  let best = allocateScaleLettering(plates, text, {
    ...options,
    fontSizeMm: options.minFontSizeMm,
  });
  if (best.placedWordCount !== best.totalWordCount) return best;

  let low = options.minFontSizeMm;
  let high = options.fontSizeMm;
  for (let iteration = 0; iteration < AUTOFIT_ITERATIONS; iteration += 1) {
    const candidateSize = (low + high) / 2;
    const candidate = allocateScaleLettering(plates, text, {
      ...options,
      fontSizeMm: candidateSize,
    });
    if (candidate.placedWordCount === candidate.totalWordCount) {
      low = candidateSize;
      best = candidate;
    } else {
      high = candidateSize;
    }
  }
  return best;
}
