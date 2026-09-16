/**
 * Jill's hand-lettering brief: every number the templates, website pages, and
 * printable guide use. The website and the PDF render this same data.
 *
 * Revision 2 asks for Jill's own copperplate at its best. The brief keeps only
 * the requirements the digital adaptation cannot recover (exact words, labelled
 * rows, black on white, rows that do not touch, a good scan) and moves stroke
 * weight, size normalisation, and spacing to the post-scan adaptation step.
 *
 * The brief exists once per wording of the poem. buildCalligraphyGuide derives
 * the rows, sheets, hard words, punctuation, and chapter text from a
 * PoemVersion; the top-level constants are the canonical build.
 */
import {
  MAQUETTE,
  MAQUETTE_STRETCHES_MM,
  maquetteBudget,
  surfaceRows,
} from "./inscription-layout";
import {
  CANONICAL_POEM,
  INSCRIPTION_LAYOUT,
  JAW_INSCRIPTION_LAYOUT,
  POEM_TITLE,
  type PoemVersion,
  type PoemVersionId,
} from "./poem";
import { textWidthEm } from "./script-metrics";

/**
 * Great Vibes metrics measured in Chrome (canvas measureText at 100 px),
 * expressed as fractions of one em. The stand-in font only sets the em the
 * layouts expect; Jill's rows are normalised to it by x-height after the scan.
 */
export const SCRIPT_METRICS = {
  xHeight: 0.357,
  ascender: 0.62,
  capHeight: 0.81,
  descender: 0.32,
} as const;

interface VersionMetrics {
  /** Natural width of the complete poem loop (every line, double gaps). */
  loopWidthEm: number;
  /** Natural width of each poem line, in ems, in line order. */
  lineWidthsEm: readonly number[];
}

/** Natural widths of each wording in the substitute font, measured the same way. */
const VERSION_METRICS: Record<PoemVersionId, VersionMetrics> = {
  canonical: {
    loopWidthEm: 194.14,
    lineWidthsEm: [
      9.66, 9.42, 10.38, 10.73, 11.56, 10.46, 11.49, 9.22, 12.76, 10.26, 12.34,
      10.01, 11.63, 12.72, 13.33, 13.26, 9.41,
    ],
  },
  extended: {
    loopWidthEm: 430.54,
    lineWidthsEm: [
      9.58, 9.21, 9.87, 10.08, 11.56, 10.25, 12.72, 9.44, 11.41, 9.12, 11.68,
      11.88, 12.31, 9.47, 8.14, 9.78, 9.95, 10.24, 12.15, 10.26, 11.28, 10.01,
      10.23, 8.56, 11.63, 12.64, 10.61, 11.16, 11.38, 9.23, 10.04, 8.81, 9.2,
      9.44, 13.26, 10.24, 8.37, 10.9, 12.23, 8.86,
    ],
  },
};

/** The canonical wording's metrics under their original name. */
export const REFERENCE_METRICS = {
  ...SCRIPT_METRICS,
  ...VERSION_METRICS.canonical,
} as const;

/** Row pitch of the jaw master: 96 px rows at a 40 px em. */
export const ROW_PITCH_EM =
  JAW_INSCRIPTION_LAYOUT.rowSpacing / JAW_INSCRIPTION_LAYOUT.fontSize;
/** The large body master currently stacks its rows more tightly. */
export const BODY_ROW_PITCH_EM =
  INSCRIPTION_LAYOUT.rowSpacing / INSCRIPTION_LAYOUT.fontSize;
export const BODY_ROWS = INSCRIPTION_LAYOUT.rows;
export const JAW_ROWS = JAW_INSCRIPTION_LAYOUT.rows;

/** The first physical run: the 180 mm printed maquette. */
export const SMALL_EDITION = {
  emMm: MAQUETTE.emMm,
  circuitLengthMm: MAQUETTE.circuitLengthMm,
  poemRepetitions: MAQUETTE.poemRepetitions,
  horizontalScale: MAQUETTE.horizontalScale,
  ribbonHeightMm: 10,
  foilThicknessMm: 0.127,
  /** Marked lines below this are expected to vanish or blob on the foil. */
  minimumStrokeMm: 0.13,
} as const;

/**
 * Suggested working size on paper, in classic copperplate proportions
 * (x-height : ascender : descender = 2 : 3 : 3). Every template sheet is drawn
 * from these numbers. They are suggestions except the row pitch, which keeps
 * neighbouring rows from touching.
 */
export const WORKING = {
  xHeightMm: 7,
  /** Comfortable range; rows are normalised to one x-height afterwards. */
  xHeightRangeMm: [6, 10] as const,
  /** The layout em that a 7 mm x-height maps to (7 / 0.357). */
  emMm: 19.6,
  ascenderMm: 10.5,
  descenderMm: 10.5,
  flourishCeilingMm: 24,
  flourishFloorMm: 18,
  rowPitchMm: 56,
  slantDegrees: 55,
  /** Every hairline is thickened to at least this, at working scale, after the scan. */
  digitalHairlineMm: 1,
  /** A pen line thinner than this may not survive the scan itself. */
  scanHairlineMm: 0.15,
  wordGapMm: [5, 8] as const,
  lineGapMm: [10, 16] as const,
} as const;

export const PAPER_TO_SMALL_SCALE = SMALL_EDITION.emMm / WORKING.emMm;

/** US Letter, landscape. Prints on A4 at 100 % with 2 mm less side margin. */
export const SHEET = {
  widthMm: 279.4,
  heightMm: 215.9,
  marginMm: 15,
  labelColumnMm: 14,
  rowsPerSheet: 3,
  firstBaselineMm: 62,
  scaleBarMm: 100,
  slantSpacingMm: 20,
} as const;

export const SHEET_WRITING_WIDTH_MM =
  SHEET.widthMm - 2 * SHEET.marginMm - SHEET.labelColumnMm;

/** The stadium path of the loop figure, in millimetres. */
export const LOOP_FIGURE = {
  width: 240,
  height: 70,
  radius: 18,
  straight: 190,
} as const;

export const LOOP_FIGURE_PERIMETER =
  2 * LOOP_FIGURE.straight + 2 * Math.PI * LOOP_FIGURE.radius;

/** Where a poem line is written as two rows; text before the split ends row a. */
const ROW_SPLITS: Record<PoemVersionId, Readonly<Record<number, string>>> = {
  canonical: {
    9: "Take sides! they roar.",
    11: "Split it, then!",
    13: "Then who's our foe?",
    14: "Look edgewise:",
    15: "Onesided! End it!",
    16: "Tail dovetails head;",
  },
  extended: {
    7: "and down, and down,",
    12: "by pair. The part's the whole.",
    13: "One knight walks slantwise",
    19: "Take sides they roar.",
    25: "Then who's our foe?",
    26: "Look edgewise,",
    35: "Onesided. Hold.",
    39: "one side, one edge,",
  },
};

export interface MasterRow {
  id: string;
  line: number;
  /** "a", "b", … when a line is written as several rows. */
  part?: string;
  text: string;
  /** Estimated natural width at the working size, in mm. */
  widthMm: number;
}

/** A row must stay this far inside the writing width (the tests' margin). */
const ROW_LIMIT_MM = SHEET_WRITING_WIDTH_MM - 4;

/** The widest single word a row can carry; words cannot be split. */
export const WORD_LIMIT_EM =
  Math.floor((ROW_LIMIT_MM / WORKING.emMm) * 100) / 100;

/** Estimated width of the widest word, in ems of the substitute script. */
export function longestWordEm(lines: readonly string[]) {
  let widest = 0;
  for (const line of lines)
    for (const word of line.split(" "))
      widest = Math.max(widest, textWidthEm(word));
  return widest;
}

/**
 * Splits a line that will not fit one row at the gap nearest its middle,
 * preferring a gap after a punctuation mark; long tails split again.
 */
function autoSplit(text: string, widthMm: (part: string) => number): string[] {
  if (widthMm(text) < ROW_LIMIT_MM) return [text];
  const words = text.split(" ");
  if (words.length < 2) return [text];
  const middle = widthMm(text) / 2;
  let best = -1;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let index = 1; index < words.length; index++) {
    const head = words.slice(0, index).join(" ");
    const width = widthMm(head);
    if (width >= ROW_LIMIT_MM) break;
    const punctuated = /[,.;:!?…]$/.test(words[index - 1] ?? "");
    const score = Math.abs(width - middle) * (punctuated ? 0.6 : 1);
    if (score < bestScore) {
      bestScore = score;
      best = index;
    }
  }
  if (best < 0) best = 1;
  return [
    words.slice(0, best).join(" "),
    ...autoSplit(words.slice(best).join(" "), widthMm),
  ];
}

/** Measured widths for the fixed wordings; estimates for edited drafts. */
function metricsFor(version: PoemVersion): VersionMetrics {
  const measured = VERSION_METRICS[version.id];
  if (!version.draft && measured.lineWidthsEm.length === version.lines.length)
    return measured;
  return {
    loopWidthEm: version.loopWidthEm,
    lineWidthsEm: version.lines.map((line) => textWidthEm(line)),
  };
}

function buildMasterRows(
  version: PoemVersion,
  metrics: VersionMetrics,
): readonly MasterRow[] {
  const splits = version.draft ? {} : ROW_SPLITS[version.id];
  const estimateWidthMm = (line: number, text: string) => {
    const full = version.lines[line - 1] ?? "";
    const lineEm = metrics.lineWidthsEm[line - 1] ?? 0;
    return (
      Math.round(((lineEm * text.length) / full.length) * WORKING.emMm * 10) /
      10
    );
  };
  return version.lines.flatMap<MasterRow>((text, index) => {
    const line = index + 1;
    const number = String(line).padStart(2, "0");
    const split = splits[line];
    if (!split) {
      const parts = version.draft
        ? autoSplit(text, (part) => estimateWidthMm(line, part))
        : [text];
      if (parts.length === 1)
        return [
          {
            id: `R${number}`,
            line,
            text,
            widthMm: estimateWidthMm(line, text),
          },
        ];
      return parts.map((part, partIndex) => {
        const letter = String.fromCharCode(97 + partIndex);
        return {
          id: `R${number}${letter}`,
          line,
          part: letter,
          text: part,
          widthMm: estimateWidthMm(line, part),
        };
      });
    }
    if (!text.startsWith(`${split} `))
      throw new Error(`Row split does not match poem line ${line}`);
    const rest = text.slice(split.length + 1);
    return [
      {
        id: `R${number}a`,
        line,
        part: "a" as const,
        text: split,
        widthMm: estimateWidthMm(line, split),
      },
      {
        id: `R${number}b`,
        line,
        part: "b" as const,
        text: rest,
        widthMm: estimateWidthMm(line, rest),
      },
    ];
  });
}

/** Invented and compound words that are easy to misspell or split. */
const HARD_WORDS_BY_VERSION: Record<PoemVersionId, readonly string[]> = {
  canonical: [
    "palindove",
    "inkhands",
    "halfheight",
    "halfknight",
    "quarterknight",
    "knightling",
    "swordfeud",
    "inkprick's",
    "doublelong",
    "mirrorknave",
    "swordwave",
    "Onesided",
  ],
  extended: [
    "palindove",
    "inkhands",
    "halfheight",
    "halfknight",
    "quarterknight",
    "knightling",
    "infinight",
    "swordfeud",
    "inkprick's",
    "innfinite",
    "doublelong",
    "mirrorknave",
    "swordwave",
    "tigerstripes",
    "icering",
    "Onesided",
    "eightwise",
    "ouroborrows",
    "dovetails",
    "hourglass",
  ],
};

/** Practice rows that fit the sheet width at the working size (measured in Great Vibes). */
const HARD_WORD_ROWS_BY_VERSION: Record<PoemVersionId, readonly string[]> = {
  canonical: [
    "palindove inkhands halfheight halfknight",
    "quarterknight knightling swordfeud",
    "inkprick's doublelong swordwave",
    "mirrorknave Onesided",
  ],
  extended: [
    "palindove inkhands halfheight halfknight",
    "quarterknight knightling infinight",
    "swordfeud inkprick's innfinite",
    "doublelong mirrorknave swordwave",
    "tigerstripes icering Onesided eightwise",
    "ouroborrows dovetails hourglass",
  ],
};

/** Greedy practice rows for an edited draft's remaining hard words. */
function packHardWordRows(words: readonly string[]): string[] {
  const rows: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && textWidthEm(candidate) * WORKING.emMm >= ROW_LIMIT_MM) {
      rows.push(current);
      current = word;
    } else current = candidate;
  }
  if (current) rows.push(current);
  return rows;
}

/** Prompts for the style-sample sheet: what to write on each free row. */
export const STYLE_SAMPLE_ROWS = [
  "Lowercase a to z, joined as you naturally join them",
  "Capitals A to M with the flourishes you like best",
  "Capitals N to Z with the flourishes you like best",
] as const;

export const ALPHABET_ROWS = [
  "abcdefghijklm",
  "nopqrstuvwxyz",
  "ABCDEFGHIJKLM",
  "NOPQRSTUVWXYZ",
] as const;

export interface PunctuationCount {
  mark: string;
  name: string;
  count: number;
}

const PUNCTUATION_MARKS = [
  [",", "comma"],
  [";", "semicolon"],
  [":", "colon"],
  ["!", "exclamation mark"],
  ["?", "question mark"],
  [".", "full stop"],
  ["'", "apostrophe"],
  ["…", "ellipsis (one character, three dots)"],
] as const;

export const GUIDE_TITLE = "Hand-lettering the inscription";

/** The requirements the adaptation step cannot recover. Everything else is preference. */
export const ESSENTIALS = [
  {
    title: "The exact words",
    text: "Every letter and punctuation mark as printed on the exact-text page, one labelled row at a time, compound words unbroken.",
  },
  {
    title: "Black on white",
    text: "Dark black ink on smooth, bright white paper. Any pen you love, as long as its thinnest line is a solid line and not a scratch.",
  },
  {
    title: "One row per label",
    text: "Each row ID gets exactly one finished row. Never split a word between rows; if a row runs long, stop at a word gap and continue on the next row as part b.",
  },
  {
    title: "Rows that stay apart",
    text: "Flourish as freely as you like inside a row, but keep rows from touching each other. The sheets leave 56 mm between baselines for that.",
  },
  {
    title: "A good scan",
    text: "Flatbed, 1200 dpi if the scanner allows and 600 dpi otherwise, greyscale, no automatic enhancement, with the row labels and the 100 mm bar in frame.",
  },
] as const;

/** What Jill does and what the digital adaptation does afterwards. */
export const DIVISION_OF_LABOUR = {
  head: ["You", "After the scan"],
  rows: [
    [
      "Write in your own copperplate: hairline upstrokes, shaded downstrokes, your loops and flourishes.",
      "Every hairline is thickened to a floor the laser can mark; your shades and shapes stay as written.",
    ],
    [
      "Write at the size that is comfortable, anywhere from 6 to 10 mm x-height, the same on every row.",
      "Rows are measured from their guide lines and normalised to one common x-height.",
    ],
    [
      "Use your natural slant. The sheets carry a 55° guide because that is the copperplate standard; a few degrees either way is fine.",
      "Nothing is done to slant. It is part of your hand.",
    ],
    [
      "Space words as you usually do and end each row after its final punctuation.",
      "Word gaps are evened, the double gap between poem lines is inserted, and the rows are joined into one continuous ribbon.",
    ],
    [
      "Let flourishes run as long as the row allows, within the dotted ceiling and floor.",
      "A flourish that would collide with a neighbouring row on the sculpture is trimmed slightly or the rows are re-spaced; you see it on the proof.",
    ],
    [
      "Rewrite a row you dislike rather than patching it.",
      "Small repairs (a broken hairline, a blot, a stray dot) are cleaned up digitally, with your originals as the reference; no letter is ever invented.",
    ],
  ],
} as const;

export type FigureId =
  | "loop"
  | "proportions"
  | "strokeGauge"
  | "ribbonSmall"
  | "ribbonWorking"
  | "sheetBlank"
  | "sheetFree"
  | "sheetsMaster"
  | "styleSample"
  | "hardWords"
  | "rowMap"
  | "pipeline";

export type GuideBlock =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "ul"; items: readonly string[] }
  | { kind: "ol"; items: readonly string[] }
  | {
      kind: "table";
      head: readonly string[];
      rows: readonly (readonly string[])[];
      caption?: string;
    }
  | { kind: "note"; title: string; text: string; tone?: "warn" | "tip" }
  | { kind: "figure"; figure: FigureId; caption: string }
  | {
      kind: "steps";
      steps: readonly { title: string; body: string; check: string }[];
    }
  | { kind: "poem" }
  | { kind: "punctuation" }
  | { kind: "essentials" }
  | { kind: "checklist"; items: readonly string[] };

export interface GuideChapter {
  id: "overview" | "steps" | "templates" | "quick" | "details";
  index: string;
  title: string;
  kicker: string;
  summary: string;
  blocks: readonly GuideBlock[];
}

const mm = (value: number) => `${value} mm`;
const small = (paperMm: number) =>
  `${(paperMm * PAPER_TO_SMALL_SCALE).toFixed(2)} mm`;

export const SIZE_TABLE = {
  head: ["Guide line", "On your paper (suggested)", "On the 180 mm maquette"],
  rows: [
    [
      "x-height (body of a, o, n)",
      `${mm(WORKING.xHeightMm)} · ${WORKING.xHeightRangeMm[0]}–${WORKING.xHeightRangeMm[1]} mm is fine`,
      small(WORKING.xHeightMm),
    ],
    [
      "Ascender line (1.5 × x-height)",
      mm(WORKING.ascenderMm),
      small(WORKING.ascenderMm),
    ],
    [
      "Descender line (1.5 × x-height)",
      mm(WORKING.descenderMm),
      small(WORKING.descenderMm),
    ],
    [
      "Capitals",
      "To the ascender line; flourishes may rise to the dotted ceiling",
      "—",
    ],
    [
      "Flourish ceiling (above baseline)",
      mm(WORKING.flourishCeilingMm),
      small(WORKING.flourishCeilingMm),
    ],
    [
      "Flourish floor (below baseline)",
      mm(WORKING.flourishFloorMm),
      small(WORKING.flourishFloorMm),
    ],
    ["Baseline to baseline", mm(WORKING.rowPitchMm), small(WORKING.rowPitchMm)],
    ["Slant guide", `${WORKING.slantDegrees}° from the baseline`, "unchanged"],
    [
      "Gap between words",
      `${WORKING.wordGapMm[0]}–${WORKING.wordGapMm[1]} mm, or your usual`,
      `${small(WORKING.wordGapMm[0])}–${small(WORKING.wordGapMm[1])}`,
    ],
    [
      "Thinnest line after adaptation",
      `${mm(WORKING.digitalHairlineMm)} equivalent (we add this)`,
      mm(SMALL_EDITION.minimumStrokeMm),
    ],
  ],
} as const;

export const MATERIALS = {
  head: ["Item", "Your usual, or", "Also fine", "Avoid"],
  rows: [
    [
      "Nib and holder",
      "Whatever you write copperplate with now. Common choices: Nikko G or Zebra G for a firm, forgiving point; Leonardt Principal EF or Hunt 101 for finer hairlines and deeper shades. An oblique holder with the flange set for your nib.",
      "A straight holder if that is your habit; a pointed brush pen if you sometimes letter that way.",
      "A change of nib for this job. Familiar tools give the most beautiful, most consistent rows.",
    ],
    [
      "Ink",
      "Dense black: Moon Palace or Kuretake sumi, McCaffery's Penman's black, Ziller Soot Black, Higgins Eternal.",
      "A drop of gum arabic in sumi if hairlines skip; distilled water to thin if it drags.",
      "Walnut, sepia, iron gall, blue-black, coloured or metallic inks, gel or ballpoint pens: they scan grey or shiny and lose the hairlines.",
    ],
    [
      "Paper",
      "Rhodia or Clairefontaine Triomphe 90 g pads, the usual copperplate papers: smooth, no feathering, thin enough to see guide lines through.",
      "HP Premium Choice 32 lb or Clairefontaine 120 g if you print the sheets straight onto the writing paper; Strathmore 400 smooth Bristol with a light pad.",
      "Textured, cotton, cream, or toned paper, and thin copier paper that feathers.",
    ],
    [
      "Guide lines",
      "Print the master sheets on plain paper and lay your writing paper over them on a light pad or a bright window, taped with low-tack tape.",
      "Print the sheets directly onto laser-safe writing paper. Or rule your own baselines in pencil and copy the row IDs into the margin.",
      "Ink guide lines on the master; pencil lines are fine if erased gently after the ink is dry.",
    ],
    [
      "Prep and tools",
      "Nib prepared as you usually do, ink in a dinky dip or small jar, water, tissue, scrap of the same paper, 2H pencil, soft eraser, low-tack tape.",
      "A slant card cut from a template, a light pad.",
      "Correction fluid or white gouache on a master row: rewrite the row instead.",
    ],
    [
      "Capture",
      "Flatbed scan at 1200 dpi greyscale, no auto-enhance or sharpening, TIFF or PNG, whole sheet in frame.",
      "600 dpi if 1200 is unavailable; a phone photo in even daylight, straight on, whole sheet in frame, only as a stopgap.",
      "JPEG at low quality, cropped scans that lose the labels or bar, skewed or shadowed photos.",
    ],
  ],
} as const;

const NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
] as const;

const numberWord = (value: number) => NUMBER_WORDS[value] ?? String(value);
const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);
const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;
const joinAnd = (items: readonly string[]) =>
  items.length <= 1
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/** Everything the templates, pages, and printable derive from one wording. */
export interface CalligraphyGuide {
  version: PoemVersion;
  /** The poem title as sheets print it; the canonical wording keeps the bare title. */
  sheetTitle: string;
  subtitle: string;
  guideVersion: string;
  pdfPath: string;
  htmlPath: string;
  lineWidthsEm: readonly number[];
  loopWidthEm: number;
  /** Em size of the substitute font on the loop figure's stadium path. */
  loopFigureEm: number;
  masterRows: readonly MasterRow[];
  masterSheets: readonly (readonly MasterRow[])[];
  /** Poem lines written as two rows (a and b). */
  splitLines: number;
  /** Unused ruled rows on the last master sheet. */
  spareRows: number;
  hardWords: readonly string[];
  hardWordRows: readonly string[];
  /** Rows the large study lays around the body and jaw for this wording. */
  bodyRows: number;
  jawRows: number;
  /** The wording fits one lettered stretch of the maquette's ribbon at the marking em. */
  maquetteFits: boolean;
  /** Hard words with no capital or apostrophe: the invented compounds. */
  compoundWords: readonly string[];
  capitals: readonly string[];
  /** Marks that occur in the poem, with their counts. */
  punctuation: readonly PunctuationCount[];
  apostropheWords: readonly string[];
  hasEllipsis: boolean;
  /** The opening word and the closing word of the ribbon, punctuation included. */
  firstWord: string;
  lastWord: string;
  /** Complete poems along the maquette's closed ribbon. */
  poemRepetitions: number;
  chapters: readonly GuideChapter[];
  chapterById(id: string): GuideChapter | undefined;
}

function buildChapters(
  guide: Omit<CalligraphyGuide, "chapters" | "chapterById">,
): readonly GuideChapter[] {
  const { version } = guide;
  const lines = version.lines;
  const firstLine = lines[0] ?? "";
  const lastLine = lines[lines.length - 1] ?? "";
  const lastLineOpener = (lastLine.split(" ")[0] ?? "").replace(
    /[^A-Za-z']+$/,
    "",
  );
  const lastWordClean = guide.lastWord.replace(/[^A-Za-z']+$/, "");
  const apostrophes = version.loop.split("'").length - 1;
  const ellipses = version.loop.split("…").length - 1;
  const notes = [
    `the invented compound words (${guide.compoundWords.join(", ")})`,
    `the ${numberWord(apostrophes)} apostrophe${apostrophes === 1 ? "" : "s"}`,
  ];
  if (guide.hasEllipsis)
    notes.push(
      `the ${ellipses === 1 ? "single" : numberWord(ellipses)} ellips${ellipses === 1 ? "is" : "es"}`,
    );
  if (/^[a-z]/.test(lastLine))
    notes.push(`the lowercase “${lastLineOpener}” that opens the last line`);
  const spareNote =
    guide.spareRows === 1
      ? "a spare row is ruled on the last sheet, and blank sheets are included"
      : guide.spareRows > 1
        ? `${numberWord(guide.spareRows)} spare rows are ruled on the last sheet, and blank sheets are included`
        : "blank sheets are included for that";
  const loopEnding = guide.hasEllipsis
    ? `The final ellipsis after “${guide.lastWord}”`
    : `The last line “${lastLine}”`;
  const loopSize =
    guide.loopFigureEm >= 0.8 * SMALL_EDITION.emMm
      ? "Shown in the substitute font at about maquette size."
      : "Shown in the substitute font, reduced to fit the page; the em size is printed beneath the figure.";
  const joinNote = guide.hasEllipsis
    ? `The final ellipsis runs into the first word. Give the three dots a normal ending and let the first “${firstLine.charAt(0)}” carry whatever lead-in flourish you like; the join will read as a loop either way.`
    : `The last line runs into the first word. Give “${lastWordClean}” a normal ending and let the first “${firstLine.charAt(0)}” carry whatever lead-in flourish you like; the join will read as a loop either way.`;
  const ellipsisNote = guide.hasEllipsis
    ? "The only ellipsis is the last character of the poem."
    : "There is no ellipsis: the last line ends without punctuation and runs straight into the first.";
  const repetitions = guide.maquetteFits
    ? `${numberWord(guide.poemRepetitions)} repetition${guide.poemRepetitions === 1 ? "" : "s"}`
    : "no complete repetition (this wording does not fit a lettered stretch at the marking em)";
  const artworkNotes: GuideBlock[] = version.fabricationArtwork
    ? []
    : [
        {
          kind: "note",
          title: "No marking artwork yet for this wording",
          tone: "warn",
          text: `The outlined marking masters and foil kits were generated from the canonical wording. The ${version.label.toLowerCase()} wording is previewed live on the website; its sizes on the maquette are estimated from the canonical layout and will be re-derived when its artwork is generated.`,
        },
      ];

  return [
    {
      id: "overview",
      index: "01",
      title: "Overview",
      kicker: "What we are asking for",
      summary:
        "The poem, written once in your own copperplate at its most beautiful. We scan it, adapt it for the laser, and wrap it around the sculpture.",
      blocks: [
        {
          kind: "p",
          text: `The sculpture is a figure-eight snake wrapped in aluminum foil. The poem “${POEM_TITLE}” is laser-marked onto that foil as one continuous ribbon of script that runs along the body, around the nose, back along the other side, around the tail, and straight into its own first word. The website currently shows the poem in a substitute font. Your hand replaces it.`,
        },
        {
          kind: "p",
          text: "This is not a job of writing to a specification. Write the poem the way you would write it for someone you love: pointed pen, hairlines and shades, your loops, your capitals, your flourishes. What we need from the sheets is only what a computer cannot recover afterwards, and there are five such things.",
        },
        { kind: "essentials" },
        { kind: "h", text: "What happens after you hand the sheets over" },
        {
          kind: "p",
          text: "Your rows are scanned and traced into vector outlines. Copperplate hairlines are far thinner than a laser can mark on foil, so every hairline is thickened to a floor the machine can hold, while your shaded strokes keep their weight and shape. Rows are normalised to one x-height, joined into the ribbon with even word gaps, and scaled to each edition. Small repairs are made digitally, with your originals beside the screen, and nothing is invented. You approve a proof before any foil is marked.",
        },
        { kind: "table", ...DIVISION_OF_LABOUR, caption: "Who does what" },
        {
          kind: "figure",
          figure: "loop",
          caption: `The ribbon has no end. ${loopEnding} runs straight into the opening “${guide.firstWord}”. ${loopSize}`,
        },
        { kind: "h", text: "Where the lettering goes" },
        {
          kind: "table",
          head: ["Edition", "Size of the lettering", "How the poem repeats"],
          rows: [
            [
              "180 mm printed maquette (first physical run)",
              `${SMALL_EDITION.emMm} mm em, x-height about ${small(WORKING.xHeightMm)}`,
              guide.maquetteFits
                ? `${plural(guide.poemRepetitions, "complete repetition")} along one ${Math.round(SMALL_EDITION.circuitLengthMm)} mm ribbon around the body`
                : `does not fit: a ${Math.round(MAQUETTE_STRETCHES_MM[0] ?? 0)} mm stretch between the ribbon's gutters holds about ${Math.round(maquetteBudget(guide.loopWidthEm).capacityEm)} em at the ${SMALL_EDITION.emMm} mm marking em and this wording is ${Math.round(guide.loopWidthEm)} em, so the maquette kit stays canonical`,
            ],
            [
              "Full-size sculpture (conceptual study)",
              "Set after fit tests; the same outlines scale up",
              `${guide.bodyRows} rows around the body, each one complete poem on a closed reading path; the jaw carries its own ${guide.jawRows}-row inscription`,
            ],
          ],
        },
        ...artworkNotes,
        {
          kind: "note",
          title: "Your hand, not the font",
          tone: "tip",
          text: "Great Vibes was chosen as a placeholder because its slant and flourished capitals came closest to your sample. It appears in this guide only where a size comparison needs it. Nothing about it is a target.",
        },
        { kind: "h", text: "The poem, exactly" },
        { kind: "poem" },
      ],
    },
    {
      id: "steps",
      index: "02",
      title: "Step by step",
      kicker: "From blank sheet to approved master",
      summary:
        "Ten steps. Most of the time is your usual warm-up and writing; the rest is checking words and getting a clean scan.",
      blocks: [
        {
          kind: "steps",
          steps: [
            {
              title: "Read the poem aloud from the exact-text page",
              body: `Note ${notes.slice(0, -1).join(", ")}, and ${notes[notes.length - 1]}. The wording is checked letter by letter against the source text.`,
              check:
                "You can find every mark on the punctuation inventory without looking twice.",
            },
            {
              title: "Set up as you always do",
              body: "Your nib, holder, black ink, and the paper you trust. Print the master sheets at 100 % and use them under your paper on a light pad, or print them straight onto the writing paper. The materials table has suggestions only if you want them.",
              check: `The ${SHEET.scaleBarMm} mm bar on a printed sheet measures ${SHEET.scaleBarMm} mm, within 1 mm.`,
            },
            {
              title: "Warm up on the style-sample sheet",
              body: "A row of joined lowercase and two rows of capitals with your favourite flourishes, at the size you will use for the poem. This sheet is also a reference for the adaptation: if a letter ever needs repair, it is matched to your own alphabet.",
              check: `The rows are written at one consistent size you can keep for ${guide.masterRows.length} rows.`,
            },
            {
              title: "Practise the hard words",
              body: `The hard-words sheet lists the compound words. Write each as one word with no gap and no hyphen. The poem's capitals are ${guide.capitals.join(", ")}; try the flourishes you intend for each.`,
              check:
                "Every flourish stays between the dotted ceiling and floor lines.",
            },
            {
              title: "Write the master rows in order",
              body: `Each master sheet shows three rows, each with its row ID and its words printed in small type above the guide lines. Write the row on the baseline below its words. If a row runs long, stop at a word gap and continue on the next row, labelling both with the same ID plus a and b (${spareNote}).`,
              check:
                "Every row begins at the left rule, ends before the right margin, and matches its printed words.",
            },
            {
              title: "Let every sheet dry fully",
              body: "Sumi and pigment inks are touch dry in minutes and safe to handle in an hour. Do not stack sheets or erase before then.",
              check:
                "A clean tissue pressed on the darkest shade picks up nothing.",
            },
            {
              title: "Review the words, not the beauty",
              body: "Check each row against the exact-text page with a finger under every word: spelling, capitals, punctuation, nothing added. Beauty you already judged as you wrote; if a row displeases you, that is a rewrite, not a repair.",
              check: "Each row has a pencil tick in its label box.",
            },
            {
              title: "Rewrite, do not patch",
              body: "For a wrong letter, a blot, or a row you simply do not like, write the whole row again on a blank sheet with the same ID. Put a single pencil X through the rejected row and keep it; it is still useful reference.",
              check: "Exactly one un-crossed row exists for each row ID.",
            },
            {
              title: "Scan every sheet",
              body: "Flatbed at 1200 dpi if the scanner allows, otherwise 600 dpi. Greyscale, no auto-contrast or sharpening, TIFF or PNG, one file per sheet named by sheet number. Keep the whole sheet in the scan, including the row labels and the 100 mm bar. If a scanner is impossible, photograph in even daylight, straight on, whole sheet in frame, and keep the originals safe for a proper scan later.",
              check: `The scanned bar measures ${SHEET.scaleBarMm} mm when the file is opened at its stated resolution.`,
            },
            {
              title: "Approve the proof",
              body: "Andrew sends back the adapted ribbon at 1:1 and 4:1 alongside a maquette-size print, with notes on anything that was thickened, re-spaced, or repaired. Mark what you want changed. Nothing is laser-marked before you approve, and the first laser job is a small test coupon, not the full skin.",
              check: "You have written “approved” and the date on the proof.",
            },
          ],
        },
        {
          kind: "note",
          title: "Keep the originals",
          text: "Please keep the paper sheets flat and unsigned until the proof is approved. A signature or note can be added afterwards on a separate sheet if you would like it recorded with the archive.",
        },
      ],
    },
    {
      id: "templates",
      index: "03",
      title: "Templates",
      kicker: "Print these at 100 %",
      summary:
        "Copperplate guide sheets with each row's words printed above its lines, a style-sample sheet, a hard-words sheet, blank sheets, and a plain baseline sheet if you prefer fewer lines.",
      blocks: [
        {
          kind: "p",
          text: `Every sheet is US Letter, landscape, with a ${SHEET.scaleBarMm} mm check bar in the header. On the copperplate sheets the solid lines are the baseline and x-height; dashes mark the ascender and descender lines at 1.5 × x-height; dotted lines are the flourish ceiling and floor; faint diagonals show the ${WORKING.slantDegrees}° slant every ${SHEET.slantSpacingMm} mm. The plain sheet keeps only the baseline and a faint x-height.`,
        },
        {
          kind: "figure",
          figure: "rowMap",
          caption: `The ${guide.masterRows.length} rows in poem order, ${numberWord(SHEET.rowsPerSheet)} per sheet. ${capitalize(numberWord(guide.splitLines))} long lines are written as two rows (a and b) and rejoined digitally.`,
        },
        {
          kind: "figure",
          figure: "sheetsMaster",
          caption:
            "Master sheets: each row's ID and words are printed in small type above its guide lines. Write the row on the baseline beneath.",
        },
        {
          kind: "figure",
          figure: "sheetBlank",
          caption:
            "Blank copperplate sheet for rewrites and part-b rows. Write the row ID in the left box.",
        },
        {
          kind: "figure",
          figure: "sheetFree",
          caption:
            "Plain sheet: baseline and a faint x-height only, for anyone who prefers to work without slant and loop lines.",
        },
        {
          kind: "figure",
          figure: "styleSample",
          caption:
            "Style-sample sheet: your joined lowercase and your flourished capitals, in your own hand, at the size you will use.",
        },
        {
          kind: "figure",
          figure: "hardWords",
          caption:
            "Hard-words sheet: the compound words printed above free rows for practice.",
        },
      ],
    },
    {
      id: "quick",
      index: "04",
      title: "The easy parts",
      kicker: "One-page quick reference",
      summary:
        "If you only read one page, read this one. The five essentials, the suggested sizes, the row checklist, and what to send back.",
      blocks: [
        { kind: "essentials" },
        {
          kind: "table",
          ...SIZE_TABLE,
          caption: "Guide lines on the sheets (suggested sizes)",
        },
        { kind: "h", text: "Row checklist" },
        {
          kind: "checklist",
          items: [
            "Wording matches the exact-text page, letter for letter",
            "Capitals only where the poem has them",
            "Punctuation present and correct",
            "Compound words written as one word",
            "No stroke touches the row above or below",
            "Row ID written in the label box",
          ],
        },
        { kind: "h", text: "What to send" },
        {
          kind: "ol",
          items: [
            `${guide.masterRows.length} approved rows across the sheets, plus the style-sample sheet, scanned as described, one file per sheet.`,
            "A line about the nib, ink, and paper you used, so the archive records the materials.",
            "Any notes on rows you were unsure about, or flourishes you would like kept exactly as written.",
          ],
        },
        {
          kind: "note",
          title: "Everything else is yours to decide",
          tone: "tip",
          text: "Size within the suggested range, slant, stroke contrast, the scale of your loops, how you join letters, where you lift the pen: none of it needs to match this guide. Write your best copperplate and let the adaptation meet you there.",
        },
      ],
    },
    {
      id: "details",
      index: "05",
      title: "In depth",
      kicker: "Why the sheets look the way they do",
      summary:
        "Proportions, spacing and joins, flourish room, what the laser can hold and how the adaptation gets your hairlines there, materials in detail, the scan-to-foil pipeline, and troubleshooting.",
      blocks: [
        { kind: "h", text: "Proportions" },
        {
          kind: "figure",
          figure: "proportions",
          caption:
            "The guide-line set on every copperplate sheet, with the substitute font's “palindove” placed on it for scale only.",
        },
        {
          kind: "p",
          text: `The sheets use the classic copperplate ratio of 2 : 3 : 3, so at a ${WORKING.xHeightMm} mm x-height the ascender and descender lines sit ${WORKING.ascenderMm} mm from the baseline. Capitals reach the ascender line and their flourishes may rise to the dotted ceiling ${WORKING.flourishCeilingMm} mm above the baseline; descender loops and lower flourishes may reach the floor ${WORKING.flourishFloorMm} mm below. If your own proportions differ, keep yours: rows are normalised by x-height after the scan, and the ascender and descender lines are there to keep rows consistent with each other, not to change your letters.`,
        },
        {
          kind: "p",
          text: `Baselines are ${WORKING.rowPitchMm} mm apart, which leaves a clear gap between one row's floor and the next row's ceiling. On the sculpture the jaw master spaces rows ${ROW_PITCH_EM} ems apart and the maquette's ribbon band is ${SMALL_EDITION.ribbonHeightMm} mm tall for a ${SMALL_EDITION.emMm} mm em, both roomy enough for the dotted limits. The large body master currently stacks ${guide.bodyRows} rows only ${BODY_ROW_PITCH_EM} ems apart; before that run Andrew re-spaces the body rows to the real extent of your capitals and descenders, so do not tighten your hand for it.`,
        },
        { kind: "h", text: "Spacing, joins, and slant" },
        {
          kind: "ul",
          items: [
            "Join letters as you normally do and lift where you normally lift. The adaptation keeps your joins; it never redraws them.",
            `Words are separated by your usual gap, about ${WORKING.wordGapMm[0]}–${WORKING.wordGapMm[1]} mm at this size. The gap between poem lines on the ribbon is doubled (${WORKING.lineGapMm[0]}–${WORKING.lineGapMm[1]} mm); Andrew adds that when the rows are joined, so end each row after its final punctuation with no special gap.`,
            `The slant guide is ${WORKING.slantDegrees}° from the baseline, the copperplate standard. Use your own angle and keep it steady; it is not adjusted afterwards.`,
            "The ribbon is one continuous line, so the tail of each row meets the head of the next at a word gap. Exit strokes may trail and an entry flourish may lead in; neither needs to be shorter than you would normally make it.",
            joinNote,
          ],
        },
        { kind: "h", text: "Capitals and flourishes" },
        {
          kind: "p",
          text: `The poem uses these capitals: ${guide.capitals.join(", ")}. Each begins a line or a sentence except the lowercase “${lastLineOpener}” that starts the last line, which is deliberate: the poem loops, so its last line is a continuation. Flourished capitals are wanted. Keep a flourish clear of the letters of other words so it stays readable at ${SMALL_EDITION.emMm} mm, and keep it inside the dotted lines; a flourish that crosses the ceiling or floor is the one thing the adaptation may have to trim, and you would see that on the proof.`,
        },
        { kind: "h", text: "Hairlines, shades, and the laser" },
        {
          kind: "p",
          text: `The foil is ${SMALL_EDITION.foilThicknessMm} mm AlumaMark aluminum. A CO₂ laser darkens its coating rather than cutting it, and the marked line cannot be narrower than the beam's focused spot, roughly 0.1–0.2 mm. Your master is scaled by ${PAPER_TO_SMALL_SCALE.toFixed(3)} to reach the maquette's ${SMALL_EDITION.emMm} mm em, so a copperplate hairline of 0.1 mm on paper would become 0.013 mm on the foil and vanish. That is why the adaptation thickens every hairline to at least ${WORKING.digitalHairlineMm} mm at working scale, ${SMALL_EDITION.minimumStrokeMm} mm on the foil, before scaling. Shaded downstrokes are already well above that floor and keep their exact width. The result reads as a slightly bolder copperplate, with your contrast softened but your forms intact.`,
        },
        {
          kind: "figure",
          figure: "strokeGauge",
          caption:
            "For reference only: the thinnest line the adaptation leaves is the 1 mm bar; a scanner still needs your pen's hairline to be a solid line of about 0.15 mm or more.",
        },
        {
          kind: "figure",
          figure: "ribbonSmall",
          caption: `The substitute font at maquette size (${SMALL_EDITION.emMm} mm em), actual size when printed at 100 %: this is how small the ribbon is on the 180 mm form.`,
        },
        { kind: "h", text: "What the adaptation does, and does not do" },
        {
          kind: "ul",
          items: [
            "Does: trace the scans into closed vector outlines at hairline resolution; thicken hairlines to the floor above; normalise rows to one x-height; even out word gaps; join the rows into the ribbon; trim or re-space a flourish that would collide on the sculpture; repair a broken hairline or remove a blot using your own strokes as the pattern.",
            "May, with your agreement on the proof: unify a letter that varies noticeably between rows by choosing one of your own versions; adjust the overall weight for a specific edition.",
            "Does not: invent letters, change joins, alter slant, redraw flourishes, or substitute anything from a font. Where a repair is impossible from your strokes, the row comes back to you to rewrite.",
          ],
        },
        { kind: "h", text: "Materials in detail" },
        { kind: "table", ...MATERIALS },
        {
          kind: "p",
          text: "Dense black on smooth bright white scans as a clean two-tone image, which is what vector tracing needs, and 1200 dpi keeps a 0.1 mm hairline about five pixels wide so it traces as a line rather than a chain of dots. Glossy inks reflect the scanner lamp and speckle the shades; textured paper adds noise along every edge; cream paper lowers contrast. Rhodia and Clairefontaine stay flat on the scanner glass.",
        },
        { kind: "h", text: "From scan to foil" },
        {
          kind: "figure",
          figure: "pipeline",
          caption: "What happens to the sheets after they are scanned.",
        },
        {
          kind: "ol",
          items: [
            "Each scan is checked against its 100 mm bar and straightened using the printed baselines.",
            "The image is thresholded to pure black and white and traced into closed vector outlines.",
            `Hairlines are thickened to ${WORKING.digitalHairlineMm} mm at working scale; shades are left as written.`,
            `Each row is measured from its baseline and x-height lines and normalised to the ${WORKING.emMm} mm em, so rows written on different days still match.`,
            "Rows are joined in poem order with even word gaps inside a line and a double gap between lines, producing one continuous ribbon.",
            `The ribbon's length is compared with the current layout (about ${Math.round(guide.loopWidthEm)} ems for one poem). Differences are absorbed by word gaps and a small uniform scale; a copperplate hand is usually wider than the placeholder, and that is expected.`,
            `The ribbon replaces the font outlines in the generators for both editions: ${repetitions} around the maquette's ${Math.round(SMALL_EDITION.circuitLengthMm)} mm body circuit, and one poem per row on the large study.`,
            "You receive a proof. After approval, denhac staff mark a small test coupon with your lettering at 2.5, 4, 6, 8, 10 and 14 mm em sizes on the actual foil, and we look at it together before any full sheet is marked.",
          ],
        },
        { kind: "h", text: "Troubleshooting" },
        {
          kind: "table",
          head: ["Problem", "Likely cause", "Fix"],
          rows: [
            [
              "Hairlines skip or break",
              "Nib not fully prepared, ink too thick, or paper too absorbent",
              "Re-prepare the nib, add a drop of gum arabic or water to the ink, or move to Rhodia or Clairefontaine.",
            ],
            [
              "Edges feather or bleed",
              "Absorbent or textured paper, or a very wet line",
              "Switch to smooth pad paper; let a wet shade dry before the next row.",
            ],
            [
              "Ink pools or blots at joins",
              "Pausing with the nib on the paper, or too much ink on the nib",
              "Lift between words; wipe the nib more often.",
            ],
            [
              "x-height drifts along the row",
              "Long rows, or the guide sheet slipping",
              "Tape the guide sheet and paper together; write in shorter bursts; rewrite the row if it drifts more than a millimetre.",
            ],
            [
              "Slant wanders",
              "Paper rotated on the light pad",
              "Square the paper to the guide sheet's slant lines before each row.",
            ],
            [
              "Row runs out of room",
              "A wide hand or generous flourishes",
              "Stop at a word gap and continue on the next row as part b; never squeeze the last word.",
            ],
            [
              "Two rows touch",
              "A tall flourish or a deep loop",
              "Rewrite the lower or upper row; or write the poem with an extra blank row between rows if your loops need it.",
            ],
            [
              "Scan looks grey or speckled",
              "Auto-enhance, glossy ink, or low resolution",
              "Rescan at 1200 dpi greyscale with all automatic corrections off.",
            ],
          ],
        },
        { kind: "h", text: "Punctuation inventory" },
        { kind: "punctuation" },
        {
          kind: "p",
          text: `The apostrophes belong to ${joinAnd(guide.apostropheWords)}. ${ellipsisNote} There are no quotation marks, dashes, or parentheses anywhere.`,
        },
        { kind: "h", text: "The placeholder the site shows today" },
        {
          kind: "figure",
          figure: "ribbonWorking",
          caption:
            "Rows R01 to R03 in the substitute font at the working size, on the copperplate sheet lines. A size comparison only; your rows replace this.",
        },
      ],
    },
  ];
}

/** Derives the complete brief for one wording of the poem. */
export function buildCalligraphyGuide(version: PoemVersion): CalligraphyGuide {
  const metrics = metricsFor(version);
  const canonical = version.id === CANONICAL_POEM.id && !version.draft;
  const maquette = maquetteBudget(version.loopWidthEm);
  const lines = version.lines;
  const text = lines.join(" ");
  const masterRows = buildMasterRows(version, metrics);
  const masterSheets: readonly (readonly MasterRow[])[] = Array.from(
    { length: Math.ceil(masterRows.length / SHEET.rowsPerSheet) },
    (_, sheet) =>
      masterRows.slice(
        sheet * SHEET.rowsPerSheet,
        (sheet + 1) * SHEET.rowsPerSheet,
      ),
  );
  const hardWords = version.draft
    ? HARD_WORDS_BY_VERSION[version.id].filter((word) =>
        version.lines.join(" ").includes(word),
      )
    : HARD_WORDS_BY_VERSION[version.id];
  const firstLine = lines[0] ?? "";
  const lastLine = lines[lines.length - 1] ?? "";
  const lastWords = lastLine.split(" ");
  const loopFigureEm = LOOP_FIGURE_PERIMETER / metrics.loopWidthEm;
  const partial: Omit<CalligraphyGuide, "chapters" | "chapterById"> = {
    version,
    sheetTitle: canonical
      ? POEM_TITLE
      : `${POEM_TITLE} (${version.label.toLowerCase()})`,
    subtitle: canonical
      ? `A brief for Jill: writing the master for ${POEM_TITLE} in your own copperplate`
      : `A brief for Jill: writing the master for ${POEM_TITLE} (${version.label.toLowerCase()} version) in your own copperplate`,
    guideVersion: version.guideVersion,
    pdfPath: version.guidePdfPath,
    htmlPath: version.guideHtmlPath,
    lineWidthsEm: metrics.lineWidthsEm,
    loopWidthEm: metrics.loopWidthEm,
    loopFigureEm,
    masterRows,
    masterSheets,
    splitLines: masterRows.filter((row) => row.part === "a").length,
    spareRows: masterSheets.length * SHEET.rowsPerSheet - masterRows.length,
    hardWords,
    hardWordRows: version.draft
      ? packHardWordRows(hardWords)
      : HARD_WORD_ROWS_BY_VERSION[version.id],
    bodyRows: surfaceRows("body", version).layout.rows,
    jawRows: surfaceRows("jaw", version).layout.rows,
    maquetteFits: maquette.fits,
    compoundWords: hardWords.filter((word) => /^[a-z]+$/.test(word)),
    capitals: Array.from(
      new Set(lines.flatMap((line) => line.match(/\b[A-Z]/g) ?? [])),
    ).sort(),
    punctuation: PUNCTUATION_MARKS.map(([mark, name]) => ({
      mark,
      name,
      count: text.split(mark).length - 1,
    })).filter((item) => item.count > 0),
    apostropheWords: Array.from(
      new Set(text.match(/[A-Za-z]+'[A-Za-z]+/g) ?? []),
    ),
    hasEllipsis: text.includes("…"),
    firstWord: firstLine.split(" ")[0] ?? "",
    lastWord: lastWords[lastWords.length - 1] ?? "",
    // Complete copies the maquette's ribbon carries: one per lettered stretch.
    poemRepetitions: maquette.repetitions,
  };
  const chapters = buildChapters(partial);
  return {
    ...partial,
    chapters,
    chapterById: (id) => chapters.find((chapter) => chapter.id === id),
  };
}

const guides = new Map<string, { loop: string; guide: CalligraphyGuide }>();

/** The brief for a wording, built once per fixed version or draft text. */
export function guideForVersion(version: PoemVersion): CalligraphyGuide {
  const key = version.draft ? `${version.id}:draft` : version.id;
  const cached = guides.get(key);
  if (cached && cached.loop === version.loop) return cached.guide;
  const guide = buildCalligraphyGuide(version);
  guides.set(key, { loop: version.loop, guide });
  return guide;
}

export const CANONICAL_GUIDE = guideForVersion(CANONICAL_POEM);

// The canonical wording keeps its original names for the pages and tests.
export const MASTER_ROWS = CANONICAL_GUIDE.masterRows;
export const MASTER_SHEETS = CANONICAL_GUIDE.masterSheets;
export const HARD_WORDS = CANONICAL_GUIDE.hardWords;
export const HARD_WORD_ROWS = CANONICAL_GUIDE.hardWordRows;
export const CAPITALS = CANONICAL_GUIDE.capitals;
export const PUNCTUATION = CANONICAL_GUIDE.punctuation;
export const GUIDE_SUBTITLE = CANONICAL_GUIDE.subtitle;
export const GUIDE_VERSION = CANONICAL_GUIDE.guideVersion;
export const GUIDE_PDF_PATH = CANONICAL_GUIDE.pdfPath;
export const GUIDE_HTML_PATH = CANONICAL_GUIDE.htmlPath;
export const CHAPTERS = CANONICAL_GUIDE.chapters;

export function chapterById(id: string) {
  return CANONICAL_GUIDE.chapterById(id);
}
