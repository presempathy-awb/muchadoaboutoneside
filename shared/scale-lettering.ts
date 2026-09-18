import { textWidthEm } from "./script-metrics";

const MILLIMETRES_PER_INCH = 25.4;
const LINE_HEIGHT_FACTOR = 1.4;
const MAX_TEXT_LENGTH = 20_000;
const AUTOFIT_ITERATIONS = 24;

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
) => number;

export interface ScaleLineMetrics {
  widthMm: number;
  /** Full ink height plus the intended leading, in physical millimetres. */
  heightMm: number;
}

export type ScaleLineMeasurer = (
  text: string,
  fontSizeMm: number,
) => ScaleLineMetrics;

export interface ScaleLetteringOptions {
  fontSizeMm: number;
  marginMm: number;
  measure?: ScaleLetteringMeasurer;
  measureLine?: ScaleLineMeasurer;
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
): ScaleLineMetrics {
  const metrics = options.measureLine
    ? options.measureLine(text, fontSizeMm)
    : {
        widthMm: options.measure
          ? options.measure(text, fontSizeMm)
          : textWidthEm(text) * fontSizeMm,
        heightMm: fontSizeMm * LINE_HEIGHT_FACTOR,
      };
  if (!Number.isFinite(metrics.widthMm) || metrics.widthMm < 0)
    throw new RangeError("measure must return a finite, non-negative width");
  if (!Number.isFinite(metrics.heightMm) || metrics.heightMm <= 0)
    throw new RangeError("measureLine must return a finite, positive height");
  return metrics;
}

/**
 * Finds the longest word prefix that fits one line. Exponential probing keeps
 * narrow lines cheap; binary refinement avoids measuring every growing prefix
 * on unusually wide faces.
 */
function fittingLineEnd(
  words: readonly string[],
  start: number,
  maxWidthMm: number,
  maxHeightMm: number,
  fontSizeMm: number,
  options: ScaleLetteringOptions,
): number {
  const fits = (end: number) => {
    const metrics = measuredLine(
      words.slice(start, end).join(" "),
      fontSizeMm,
      options,
    );
    return metrics.widthMm <= maxWidthMm && metrics.heightMm <= maxHeightMm;
  };

  if (!fits(start + 1)) return start;

  let low = start + 1;
  let step = 1;
  let high = words.length;
  while (low < words.length) {
    const candidate = Math.min(words.length, low + step);
    if (!fits(candidate)) {
      high = candidate;
      break;
    }
    low = candidate;
    step *= 2;
  }
  if (low === words.length) return low;

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
  let wordIndex = 0;

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
    let usedHeightMm = 0;

    while (usedHeightMm < maxHeightMm && wordIndex < words.length) {
      const end = fittingLineEnd(
        words,
        wordIndex,
        maxWidthMm,
        maxHeightMm - usedHeightMm,
        options.fontSizeMm,
        options,
      );
      if (end === wordIndex) break;
      const line = words.slice(wordIndex, end).join(" ");
      const { heightMm } = measuredLine(line, options.fontSizeMm, options);
      lines.push(line);
      lineHeightsMm.push(heightMm);
      usedHeightMm += heightMm;
      wordIndex = end;
    }

    return {
      plateId: plate.id,
      lines,
      lineHeightsMm,
      fontSizeMm: options.fontSizeMm,
    };
  });

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
