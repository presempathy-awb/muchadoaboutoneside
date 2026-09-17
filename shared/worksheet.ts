export type WorksheetLineKind =
  | "baseline"
  | "xheight"
  | "ascender"
  | "descender"
  | "slant"
  | "grid";

export interface WorksheetSettings {
  paper: "letter" | "a4" | "a5" | "legal" | "custom";
  orientation: "landscape" | "portrait";
  customWidthMm: number;
  customHeightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  mode: "plain" | "copperplate" | "italic" | "grid";
  spacingMode: "count" | "fixed";
  lineCount: number;
  spacingMm: number;
  xHeightMm: number;
  ascenderRatio: number;
  descenderRatio: number;
  rowGapMm: number;
  slantEnabled: boolean;
  slantAngle: number;
  slantSpacingMm: number;
  guidesEnabled: boolean;
  lineColor: string;
  lineWidthPt: number;
  lineStyle: "solid" | "dashed" | "dotted";
  slantColor: string;
  slantWidthPt: number;
  textEnabled: boolean;
  fontId: "great-vibes" | "serif" | "sans" | "mono" | "custom";
  fontSizePt: number;
  textColor: string;
  textOpacity: number;
  textAlign: "left" | "center" | "right";
  textRepeat: boolean;
  letterSpacingMm: number;
  wordSpacingMm: number;
  writingScale: number;
  pageCount: number;
  calibrationMark: boolean;
  paperName: string;
  paperWeight: string;
  nib: string;
  holder: string;
  ink: string;
  notes: string;
}

export interface WorksheetLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: WorksheetLineKind;
  color: string;
  widthPt: number;
  dash: "solid" | "dashed" | "dotted";
}

export interface WorksheetLayout {
  widthMm: number;
  heightMm: number;
  contentX1Mm: number;
  contentY1Mm: number;
  contentX2Mm: number;
  contentY2Mm: number;
  baselineYsMm: number[];
  lines: WorksheetLine[];
}

export interface WorksheetEstimate {
  lines: string[];
  lineCount: number;
  pagesNeeded: number;
  rowsPerPage: number;
  overflow: boolean;
}

export const DEFAULT_WORKSHEET_SETTINGS: WorksheetSettings = {
  paper: "letter",
  orientation: "landscape",
  customWidthMm: 210,
  customHeightMm: 297,
  marginTopMm: 12.7,
  marginBottomMm: 12.7,
  marginLeftMm: 12.7,
  marginRightMm: 12.7,
  mode: "plain",
  spacingMode: "count",
  lineCount: 24,
  spacingMm: 8.3,
  xHeightMm: 5,
  ascenderRatio: 1.5,
  descenderRatio: 1.5,
  rowGapMm: 5,
  slantEnabled: false,
  slantAngle: 55,
  slantSpacingMm: 15,
  guidesEnabled: true,
  lineColor: "#999999",
  lineWidthPt: 0.5,
  lineStyle: "solid",
  slantColor: "#c3cac4",
  slantWidthPt: 0.25,
  textEnabled: false,
  fontId: "great-vibes",
  fontSizePt: 24,
  textColor: "#56715b",
  textOpacity: 0.65,
  textAlign: "left",
  textRepeat: false,
  letterSpacingMm: 0,
  wordSpacingMm: 0,
  writingScale: 1,
  pageCount: 1,
  calibrationMark: false,
  paperName: "",
  paperWeight: "",
  nib: "",
  holder: "",
  ink: "",
  notes: "",
};

const PAPER_DIMENSIONS = {
  letter: { widthMm: 215.9, heightMm: 279.4 },
  a4: { widthMm: 210, heightMm: 297 },
  a5: { widthMm: 148, heightMm: 210 },
  legal: { widthMm: 215.9, heightMm: 355.6 },
} as const;

const MAX_LAYOUT_LINES = 5_000;
const MAX_TEXT_LENGTH = 20_000;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const GRAPHEME_SEGMENTER = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

function graphemes(value: string) {
  return Array.from(
    GRAPHEME_SEGMENTER.segment(value),
    ({ segment }) => segment,
  );
}

type Validator = (value: unknown, name: string) => void;

function assertNumber(
  value: unknown,
  name: string,
  minimum: number,
  maximum: number,
): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new RangeError(`${name} must be between ${minimum} and ${maximum}.`);
  }
}

function assertInteger(
  value: unknown,
  name: string,
  minimum: number,
  maximum: number,
) {
  assertNumber(value, name, minimum, maximum);
  if (!Number.isInteger(value)) {
    throw new RangeError(`${name} must be a whole number.`);
  }
}

function oneOf<const T extends readonly string[]>(values: T): Validator {
  return (value, name) => {
    if (typeof value !== "string" || !values.includes(value)) {
      throw new TypeError(`${name} must be one of: ${values.join(", ")}.`);
    }
  };
}

function boundedNumber(minimum: number, maximum: number): Validator {
  return (value, name) => assertNumber(value, name, minimum, maximum);
}

function integer(minimum: number, maximum: number): Validator {
  return (value, name) => assertInteger(value, name, minimum, maximum);
}

function boolean(value: unknown, name: string) {
  if (typeof value !== "boolean") {
    throw new TypeError(`${name} must be true or false.`);
  }
}

function color(value: unknown, name: string) {
  if (typeof value !== "string" || !HEX_COLOR.test(value)) {
    throw new TypeError(
      `${name} must be a six-digit hex color such as #999999.`,
    );
  }
}

function boundedString(maximum: number): Validator {
  return (value, name) => {
    if (typeof value !== "string") {
      throw new TypeError(`${name} must be text.`);
    }
    if (value.length > maximum) {
      throw new RangeError(`${name} must be ${maximum} characters or fewer.`);
    }
  };
}

const VALIDATORS: { [K in keyof WorksheetSettings]: Validator } = {
  paper: oneOf(["letter", "a4", "a5", "legal", "custom"]),
  orientation: oneOf(["landscape", "portrait"]),
  customWidthMm: boundedNumber(50, 600),
  customHeightMm: boundedNumber(50, 600),
  marginTopMm: boundedNumber(0, 200),
  marginBottomMm: boundedNumber(0, 200),
  marginLeftMm: boundedNumber(0, 200),
  marginRightMm: boundedNumber(0, 200),
  mode: oneOf(["plain", "copperplate", "italic", "grid"]),
  spacingMode: oneOf(["count", "fixed"]),
  lineCount: integer(2, 100),
  spacingMm: boundedNumber(0.5, 100),
  xHeightMm: boundedNumber(0.5, 50),
  ascenderRatio: boundedNumber(0, 5),
  descenderRatio: boundedNumber(0, 5),
  rowGapMm: boundedNumber(0, 100),
  slantEnabled: boolean,
  slantAngle: boundedNumber(1, 89),
  slantSpacingMm: boundedNumber(1, 100),
  guidesEnabled: boolean,
  lineColor: color,
  lineWidthPt: boundedNumber(0.05, 10),
  lineStyle: oneOf(["solid", "dashed", "dotted"]),
  slantColor: color,
  slantWidthPt: boundedNumber(0.05, 10),
  textEnabled: boolean,
  fontId: oneOf(["great-vibes", "serif", "sans", "mono", "custom"]),
  fontSizePt: boundedNumber(4, 300),
  textColor: color,
  textOpacity: boundedNumber(0, 1),
  textAlign: oneOf(["left", "center", "right"]),
  textRepeat: boolean,
  letterSpacingMm: boundedNumber(0, 50),
  wordSpacingMm: boundedNumber(0, 100),
  writingScale: boundedNumber(0.1, 10),
  pageCount: integer(1, 20),
  calibrationMark: boolean,
  paperName: boundedString(120),
  paperWeight: boundedString(120),
  nib: boundedString(120),
  holder: boundedString(120),
  ink: boundedString(120),
  notes: boundedString(2_000),
};

export function normalizeWorksheetSettings(input: unknown): WorksheetSettings {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Worksheet settings must be an object.");
  }

  const candidate = input as Record<string, unknown>;
  const knownFields = new Set(Object.keys(DEFAULT_WORKSHEET_SETTINGS));
  for (const field of Object.keys(candidate)) {
    if (!knownFields.has(field)) {
      throw new TypeError(`Unknown worksheet setting: ${field}.`);
    }
  }

  const settings = {
    ...DEFAULT_WORKSHEET_SETTINGS,
    ...candidate,
  } as WorksheetSettings;
  for (const field of Object.keys(
    DEFAULT_WORKSHEET_SETTINGS,
  ) as (keyof WorksheetSettings)[]) {
    VALIDATORS[field](settings[field], field);
  }

  const { widthMm, heightMm } = pageDimensions(settings);
  if (settings.marginLeftMm + settings.marginRightMm >= widthMm) {
    throw new RangeError(
      "Left and right margins must leave printable page width.",
    );
  }
  if (settings.marginTopMm + settings.marginBottomMm >= heightMm) {
    throw new RangeError(
      "Top and bottom margins must leave printable page height.",
    );
  }
  return settings;
}

function pageDimensions(settings: WorksheetSettings) {
  const paper =
    settings.paper === "custom"
      ? {
          widthMm: settings.customWidthMm,
          heightMm: settings.customHeightMm,
        }
      : PAPER_DIMENSIONS[settings.paper];
  const shortSideMm = Math.min(paper.widthMm, paper.heightMm);
  const longSideMm = Math.max(paper.widthMm, paper.heightMm);
  return settings.orientation === "portrait"
    ? { widthMm: shortSideMm, heightMm: longSideMm }
    : { widthMm: longSideMm, heightMm: shortSideMm };
}

function makeGuideLine(
  settings: WorksheetSettings,
  kind: WorksheetLineKind,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): WorksheetLine {
  const slant = kind === "slant";
  return {
    x1,
    y1,
    x2,
    y2,
    kind,
    color: slant ? settings.slantColor : settings.lineColor,
    widthPt: slant ? settings.slantWidthPt : settings.lineWidthPt,
    dash: slant ? "solid" : settings.lineStyle,
  };
}

function pushLine(lines: WorksheetLine[], line: WorksheetLine) {
  if (lines.length >= MAX_LAYOUT_LINES) {
    throw new RangeError(
      `These settings create more than ${MAX_LAYOUT_LINES.toLocaleString()} guide lines. Increase the spacing.`,
    );
  }
  lines.push(line);
}

function plainBaselines(
  settings: WorksheetSettings,
  top: number,
  bottom: number,
) {
  if (settings.spacingMode === "count") {
    const spacing = (bottom - top) / (settings.lineCount - 1);
    return Array.from(
      { length: settings.lineCount },
      (_, index) => top + index * spacing,
    );
  }

  const count = Math.floor((bottom - top) / settings.spacingMm) + 1;
  return Array.from(
    { length: count },
    (_, index) => top + index * settings.spacingMm,
  );
}

function richBaselines(
  settings: WorksheetSettings,
  top: number,
  bottom: number,
) {
  const aboveBaseline = settings.xHeightMm * (1 + settings.ascenderRatio);
  const belowBaseline = settings.xHeightMm * settings.descenderRatio;
  const rowPitch = aboveBaseline + belowBaseline + settings.rowGapMm;
  const available = bottom - top - aboveBaseline - belowBaseline;
  if (available < -1e-9) {
    throw new RangeError(
      "The writing proportions do not fit between the top and bottom margins.",
    );
  }
  const count = Math.floor(Math.max(0, available) / rowPitch) + 1;
  return Array.from(
    { length: count },
    (_, index) => top + aboveBaseline + index * rowPitch,
  );
}

function clippedSlantLines(
  settings: WorksheetSettings,
  left: number,
  top: number,
  right: number,
  bottom: number,
) {
  const radians = (settings.slantAngle * Math.PI) / 180;
  const inverseSlope = 1 / Math.tan(radians);
  // A slant is x + y / tan(angle) = c. Advancing c by slantSpacingMm
  // makes the guides that far apart where they cross a horizontal line.
  const minimumC = left + top * inverseSlope;
  const maximumC = right + bottom * inverseSlope;
  const firstC =
    Math.ceil(minimumC / settings.slantSpacingMm) * settings.slantSpacingMm;
  const result: WorksheetLine[] = [];

  for (let c = firstC; c <= maximumC + 1e-9; c += settings.slantSpacingMm) {
    const points: { x: number; y: number }[] = [];
    const add = (x: number, y: number) => {
      if (
        x < left - 1e-8 ||
        x > right + 1e-8 ||
        y < top - 1e-8 ||
        y > bottom + 1e-8
      ) {
        return;
      }
      const clipped = {
        x: Math.min(right, Math.max(left, x)),
        y: Math.min(bottom, Math.max(top, y)),
      };
      if (
        !points.some(
          (point) =>
            Math.hypot(point.x - clipped.x, point.y - clipped.y) < 1e-7,
        )
      ) {
        points.push(clipped);
      }
    };

    add(c - top * inverseSlope, top);
    add(c - bottom * inverseSlope, bottom);
    add(left, (c - left) / inverseSlope);
    add(right, (c - right) / inverseSlope);
    if (points.length >= 2) {
      const [first, second] = points;
      if (first && second) {
        result.push(
          makeGuideLine(
            settings,
            "slant",
            first.x,
            first.y,
            second.x,
            second.y,
          ),
        );
      }
    }
  }
  return result;
}

export function getWorksheetLayout(
  settings: WorksheetSettings,
): WorksheetLayout {
  const normalized = normalizeWorksheetSettings(settings);
  const { widthMm, heightMm } = pageDimensions(normalized);
  const left = normalized.marginLeftMm;
  const right = widthMm - normalized.marginRightMm;
  const top = normalized.marginTopMm;
  const bottom = heightMm - normalized.marginBottomMm;
  const rich =
    normalized.mode === "copperplate" || normalized.mode === "italic";
  const baselineYsMm = rich
    ? richBaselines(normalized, top, bottom)
    : plainBaselines(normalized, top, bottom);
  const lines: WorksheetLine[] = [];

  if (normalized.guidesEnabled) {
    if (rich) {
      for (const baseline of baselineYsMm) {
        pushLine(
          lines,
          makeGuideLine(
            normalized,
            "ascender",
            left,
            baseline - normalized.xHeightMm * (1 + normalized.ascenderRatio),
            right,
            baseline - normalized.xHeightMm * (1 + normalized.ascenderRatio),
          ),
        );
        pushLine(
          lines,
          makeGuideLine(
            normalized,
            "xheight",
            left,
            baseline - normalized.xHeightMm,
            right,
            baseline - normalized.xHeightMm,
          ),
        );
        pushLine(
          lines,
          makeGuideLine(
            normalized,
            "baseline",
            left,
            baseline,
            right,
            baseline,
          ),
        );
        pushLine(
          lines,
          makeGuideLine(
            normalized,
            "descender",
            left,
            baseline + normalized.xHeightMm * normalized.descenderRatio,
            right,
            baseline + normalized.xHeightMm * normalized.descenderRatio,
          ),
        );
      }
    } else {
      for (const baseline of baselineYsMm) {
        pushLine(
          lines,
          makeGuideLine(
            normalized,
            "baseline",
            left,
            baseline,
            right,
            baseline,
          ),
        );
      }
    }

    if (normalized.mode === "grid") {
      const gridPitchMm =
        normalized.spacingMode === "count"
          ? (baselineYsMm[1] ?? top + normalized.spacingMm) -
            (baselineYsMm[0] ?? top)
          : normalized.spacingMm;
      const columns = Math.floor((right - left) / gridPitchMm) + 1;
      for (let index = 0; index < columns; index += 1) {
        const x = left + index * gridPitchMm;
        pushLine(lines, makeGuideLine(normalized, "grid", x, top, x, bottom));
      }
    }
  }

  if (normalized.slantEnabled) {
    for (const line of clippedSlantLines(
      normalized,
      left,
      top,
      right,
      bottom,
    )) {
      pushLine(lines, line);
    }
  }

  return {
    widthMm,
    heightMm,
    contentX1Mm: left,
    contentY1Mm: top,
    contentX2Mm: right,
    contentY2Mm: bottom,
    baselineYsMm,
    lines,
  };
}

export function wrapText(
  text: string,
  widthMm: number,
  measure: (line: string) => number,
): string[] {
  if (typeof text !== "string") {
    throw new TypeError("Worksheet text must be text.");
  }
  if (text.length > MAX_TEXT_LENGTH) {
    throw new RangeError(
      `Worksheet text must be ${MAX_TEXT_LENGTH.toLocaleString()} characters or fewer.`,
    );
  }
  if (!Number.isFinite(widthMm) || widthMm <= 0 || widthMm > 600) {
    throw new RangeError(
      "Text width must be greater than 0 and no more than 600 mm.",
    );
  }
  if (typeof measure !== "function") {
    throw new TypeError("A text measurement function is required.");
  }
  if (text === "") {
    return [];
  }

  const measured = (value: string) => {
    const width = measure(value);
    if (!Number.isFinite(width) || width < 0) {
      throw new RangeError(
        "The text measurement function must return a finite, non-negative width.",
      );
    }
    return width;
  };
  const splitLongWord = (word: string) => {
    const characters = graphemes(word);
    const pieces: string[] = [];
    let current = "";
    for (const grapheme of characters) {
      const candidate = current + grapheme;
      if (current !== "" && measured(candidate) > widthMm) {
        pieces.push(current);
        current = grapheme;
      } else {
        current = candidate;
      }
    }
    if (current !== "") {
      pieces.push(current);
    }
    return pieces;
  };

  const wrapped: string[] = [];
  for (const paragraph of text
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .split("\n")) {
    if (paragraph.trim() === "") {
      wrapped.push("");
      continue;
    }

    const words = paragraph.trim().split(/\s+/u);
    let current = "";
    for (const word of words) {
      const pieces = measured(word) <= widthMm ? [word] : splitLongWord(word);
      for (const piece of pieces) {
        const candidate = current === "" ? piece : `${current} ${piece}`;
        if (current !== "" && measured(candidate) > widthMm) {
          wrapped.push(current);
          current = piece;
        } else {
          current = candidate;
        }
      }
    }
    if (current !== "") {
      wrapped.push(current);
    }
  }
  return wrapped;
}

export function estimateWorksheet(
  text: string,
  layout: WorksheetLayout,
  measure: (line: string) => number,
  settings: WorksheetSettings,
): WorksheetEstimate {
  const normalized = normalizeWorksheetSettings(settings);
  const rowsPerPage = layout.baselineYsMm.length;
  const measured = (line: string) => {
    const base = measure(line) * normalized.writingScale;
    const characters = graphemes(line);
    const spaces = characters.filter((character) =>
      /\s/u.test(character),
    ).length;
    return (
      base +
      Math.max(0, characters.length - 1) * normalized.letterSpacingMm +
      spaces * normalized.wordSpacingMm
    );
  };
  const lines = wrapText(
    text,
    layout.contentX2Mm - layout.contentX1Mm,
    measured,
  );
  const lineCount = lines.length;
  const pagesNeeded =
    lineCount === 0
      ? 0
      : rowsPerPage === 0
        ? Infinity
        : Math.ceil(lineCount / rowsPerPage);
  return {
    lines,
    lineCount,
    pagesNeeded,
    rowsPerPage,
    overflow: pagesNeeded > normalized.pageCount,
  };
}
