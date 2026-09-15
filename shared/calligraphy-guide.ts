/**
 * Jill's hand-lettering brief: every number the templates, website pages, and
 * printable guide use. The website and the PDF render this same data.
 */
import {
  INSCRIPTION_LAYOUT,
  JAW_INSCRIPTION_LAYOUT,
  POEM_LINES,
  POEM_TITLE,
} from "./poem";

/**
 * Great Vibes metrics measured in Chrome (canvas measureText at 100 px),
 * expressed as fractions of one em. The stand-in font sets the proportions
 * the layout expects; Jill's own hand replaces it at the same proportions.
 */
export const REFERENCE_METRICS = {
  xHeight: 0.357,
  ascender: 0.62,
  capHeight: 0.81,
  descender: 0.32,
  /** Natural width of the complete poem loop (17 lines, double gaps). */
  loopWidthEm: 194.14,
  /** Natural width of each poem line, in ems, same order as POEM_LINES. */
  lineWidthsEm: [
    9.66, 9.42, 10.38, 10.73, 11.56, 10.46, 11.49, 9.22, 12.76, 10.26, 12.34,
    10.01, 11.63, 12.72, 13.33, 13.26, 9.41,
  ],
} as const;

/** Row pitch of the jaw master and of the working sheets: 96 px rows at a 40 px em. */
export const ROW_PITCH_EM =
  JAW_INSCRIPTION_LAYOUT.rowSpacing / JAW_INSCRIPTION_LAYOUT.fontSize;
/** The large body master currently stacks its rows more tightly. */
export const BODY_ROW_PITCH_EM =
  INSCRIPTION_LAYOUT.rowSpacing / INSCRIPTION_LAYOUT.fontSize;
export const BODY_ROWS = INSCRIPTION_LAYOUT.rows;
export const JAW_ROWS = JAW_INSCRIPTION_LAYOUT.rows;

/** The first physical run: the 180 mm printed maquette. */
export const SMALL_EDITION = {
  emMm: 2.5,
  circuitLengthMm: 1028.1,
  poemRepetitions: 2,
  horizontalScale: 0.906,
  ribbonHeightMm: 10,
  foilThicknessMm: 0.127,
  /** Thin strokes below this are expected to vanish or blob when marked. */
  minimumStrokeMm: 0.13,
} as const;

/** Working size on paper. Every template sheet is drawn from these numbers. */
export const WORKING = {
  xHeightMm: 7,
  emMm: 19.6,
  ascenderMm: 12,
  capHeightMm: 16,
  descenderMm: 6,
  flourishCeilingMm: 22,
  flourishFloorMm: 16,
  rowPitchMm: 48,
  slantDegrees: 55,
  minimumThinStrokeMm: 1,
  thickStrokeMm: [2, 3] as const,
  wordGapMm: [5, 7] as const,
  lineGapMm: [10, 14] as const,
} as const;

export const PAPER_TO_SMALL_SCALE = SMALL_EDITION.emMm / WORKING.emMm;

/** US Letter, landscape. Prints on A4 at 100 % with 2 mm less side margin. */
export const SHEET = {
  widthMm: 279.4,
  heightMm: 215.9,
  marginMm: 15,
  labelColumnMm: 14,
  rowsPerSheet: 3,
  firstBaselineMm: 58,
  scaleBarMm: 100,
  slantSpacingMm: 20,
} as const;

export const SHEET_WRITING_WIDTH_MM =
  SHEET.widthMm - 2 * SHEET.marginMm - SHEET.labelColumnMm;

/** Where a poem line is written as two rows; text before the split ends row a. */
const ROW_SPLITS: Readonly<Record<number, string>> = {
  9: "Take sides! they roar.",
  11: "Split it, then!",
  13: "Then who's our foe?",
  14: "Look edgewise:",
  15: "Onesided! End it!",
  16: "Tail dovetails head;",
};

export interface MasterRow {
  id: string;
  line: number;
  part?: "a" | "b";
  text: string;
  /** Estimated natural width at the working size, in mm. */
  widthMm: number;
}

function estimateWidthMm(line: number, text: string) {
  const full = POEM_LINES[line - 1] ?? "";
  const lineEm = REFERENCE_METRICS.lineWidthsEm[line - 1] ?? 0;
  return (
    Math.round(((lineEm * text.length) / full.length) * WORKING.emMm * 10) / 10
  );
}

export const MASTER_ROWS: readonly MasterRow[] = (
  POEM_LINES as readonly string[]
).flatMap<MasterRow>((text, index) => {
  const line = index + 1;
  const number = String(line).padStart(2, "0");
  const split = ROW_SPLITS[line];
  if (!split) {
    return [
      { id: `R${number}`, line, text, widthMm: estimateWidthMm(line, text) },
    ];
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

export const MASTER_SHEETS: readonly (readonly MasterRow[])[] = Array.from(
  { length: Math.ceil(MASTER_ROWS.length / SHEET.rowsPerSheet) },
  (_, sheet) =>
    MASTER_ROWS.slice(
      sheet * SHEET.rowsPerSheet,
      (sheet + 1) * SHEET.rowsPerSheet,
    ),
);

/** Invented and compound words that are easy to misspell or split. */
export const HARD_WORDS = [
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
] as const;

/** Practice rows that fit the sheet width at the working size. */
export const HARD_WORD_ROWS = [
  "palindove inkhands halfheight halfknight",
  "quarterknight knightling swordfeud",
  "inkprick's doublelong swordwave",
  "mirrorknave Onesided",
] as const;

export const ALPHABET_ROWS = [
  "abcdefghijklm nopqrstuvwxyz",
  "ABCDEFGHI",
  "JKLMNOPQR",
  "STUVWXYZ",
] as const;

export const CAPITALS = Array.from(
  new Set(
    POEM_LINES.flatMap((line) =>
      (line.match(/\b[A-Z]/g) ?? []).map((letter) => letter),
    ),
  ),
).sort();

export interface PunctuationCount {
  mark: string;
  name: string;
  count: number;
}

export const PUNCTUATION: readonly PunctuationCount[] = (
  [
    [",", "comma"],
    [";", "semicolon"],
    [":", "colon"],
    ["!", "exclamation mark"],
    ["?", "question mark"],
    [".", "full stop"],
    ["'", "apostrophe"],
    ["…", "ellipsis (one character, three dots)"],
  ] as const
).map(([mark, name]) => ({
  mark,
  name,
  count: POEM_LINES.join(" ").split(mark).length - 1,
}));

export const GUIDE_TITLE = "Hand-lettering the inscription";
export const GUIDE_SUBTITLE = `A brief for Jill: writing the master for ${POEM_TITLE}`;
export const GUIDE_VERSION = "2026-09-14";
export const GUIDE_PDF_PATH = "/guide/calligraphy-guide.pdf";
export const GUIDE_HTML_PATH = "/guide/calligraphy-guide.html";

export type FigureId =
  | "loop"
  | "proportions"
  | "strokeGauge"
  | "ribbonSmall"
  | "ribbonWorking"
  | "sheetBlank"
  | "sheetsGhost"
  | "alphabet"
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
  head: ["Element", "On your paper", "On the 180 mm maquette", "In ems"],
  rows: [
    [
      "x-height (body of a, o, n)",
      mm(WORKING.xHeightMm),
      small(WORKING.xHeightMm),
      "0.36",
    ],
    ["Em (row size)", mm(WORKING.emMm), mm(SMALL_EDITION.emMm), "1.00"],
    [
      "Ascender (h, l, d, k)",
      mm(WORKING.ascenderMm),
      small(WORKING.ascenderMm),
      "0.62",
    ],
    [
      "Capital height",
      mm(WORKING.capHeightMm),
      small(WORKING.capHeightMm),
      "0.81",
    ],
    [
      "Descender (p, g, y, f)",
      mm(WORKING.descenderMm),
      small(WORKING.descenderMm),
      "0.32",
    ],
    [
      "Flourish ceiling (above baseline)",
      mm(WORKING.flourishCeilingMm),
      small(WORKING.flourishCeilingMm),
      "1.12",
    ],
    [
      "Flourish floor (below baseline)",
      mm(WORKING.flourishFloorMm),
      small(WORKING.flourishFloorMm),
      "0.80",
    ],
    [
      "Row pitch",
      mm(WORKING.rowPitchMm),
      small(WORKING.rowPitchMm),
      String(ROW_PITCH_EM),
    ],
    [
      "Thinnest stroke, minimum",
      mm(WORKING.minimumThinStrokeMm),
      small(WORKING.minimumThinStrokeMm),
      "0.05",
    ],
    [
      "Thick strokes",
      `${WORKING.thickStrokeMm[0]}–${WORKING.thickStrokeMm[1]} mm`,
      `${small(WORKING.thickStrokeMm[0])}–${small(WORKING.thickStrokeMm[1])}`,
      "0.10–0.15",
    ],
    [
      "Gap between words",
      `${WORKING.wordGapMm[0]}–${WORKING.wordGapMm[1]} mm`,
      `${small(WORKING.wordGapMm[0])}–${small(WORKING.wordGapMm[1])}`,
      "0.25–0.35",
    ],
    [
      "Slant from the baseline",
      `${WORKING.slantDegrees}°`,
      `${WORKING.slantDegrees}°`,
      "—",
    ],
  ],
} as const;

export const MATERIALS = {
  head: ["Item", "Use this", "Also fine", "Avoid"],
  rows: [
    [
      "Pen",
      "Pointed brush pen with a black pigment cartridge: Pentel Pocket Brush (GFKP3) or Kuretake No. 13. Keep the lightest strokes at 1 mm or more.",
      "A 1.0 mm round-tip pigment marker (Sakura Pigma Graphic 1, Staedtler pigment liner 1.0) for a monoline master.",
      "Pointed dip nibs and broad-edge pens on their own: their hairlines are 0.1–0.4 mm and vanish at maquette size unless we thicken them digitally (see In depth).",
    ],
    [
      "Ink",
      "The pen's own black pigment cartridge.",
      "For dip pens: Moon Palace or Kuretake sumi, Higgins Black Magic, Dr. Ph. Martin's Black Star matte.",
      "Blue-black, grey, walnut, iron-gall, gel pens with sheen, metallic or glossy inks, ballpoint, pencil.",
    ],
    [
      "Paper",
      "Smooth, bright white, 120–270 g/m²: HP Premium Choice 32 lb, Clairefontaine 120 g, or Strathmore 400 smooth Bristol.",
      "Rhodia or Clairefontaine 90 g pads for brush pens; marker layout paper for practice.",
      "Textured or cotton watercolour paper, cream or toned stock, lined notebook paper, thin copier paper.",
    ],
    [
      "Guidelines",
      "Print the template sheets at 100 % straight onto the writing paper.",
      "Print on plain paper and place it under Bristol on a light pad or window, taped with low-tack tape.",
      "Freehand guessing at x-height; guidelines drawn in ink.",
    ],
    [
      "Tools",
      "Steel ruler with millimetres, 2H pencil, plastic eraser, low-tack (washi) tape, scrap of the same paper for pen tests, tissue.",
      "Light pad, T-square, a 55° slant card cut from the template.",
      "Correction fluid or white gouache patches on the master rows.",
    ],
    [
      "Capture",
      "Flatbed scan at 600 dpi, greyscale, no auto-enhance, saved as TIFF or PNG.",
      "A phone photo in daylight, straight on, whole sheet in frame including the 100 mm bar, if a scanner is impossible.",
      "JPEG at low quality, cropped scans that lose the row labels or scale bar, skewed or shadowed photos.",
    ],
  ],
} as const;

export const CHAPTERS: readonly GuideChapter[] = [
  {
    id: "overview",
    index: "01",
    title: "Overview",
    kicker: "What we are asking for",
    summary:
      "One poem, written once by hand in a slanted script, becomes the endless inscription on both foil editions of the sculpture.",
    blocks: [
      {
        kind: "p",
        text: `The sculpture is a figure-eight snake wrapped in aluminum foil. The poem “${POEM_TITLE}” is laser-marked onto that foil as one continuous ribbon of script that runs along the body, around the nose, back along the other side, around the tail, and straight into its own first word. The website currently shows the poem in a substitute font called Great Vibes. Your hand-lettering replaces it.`,
      },
      {
        kind: "p",
        text: "We do not need you to letter the sculpture or the foil. We need a master: the complete poem written on paper at a comfortable size, with consistent guidelines, so it can be scanned, traced into vector outlines, and scaled to each edition. The master is written once and reused everywhere.",
      },
      {
        kind: "figure",
        figure: "loop",
        caption:
          "The ribbon has no end. The final ellipsis after “twine…” runs straight into the opening “Come,”.",
      },
      { kind: "h", text: "Where the lettering goes" },
      {
        kind: "table",
        head: ["Edition", "Size of the lettering", "How the poem repeats"],
        rows: [
          [
            "180 mm printed maquette (first physical run)",
            `${SMALL_EDITION.emMm} mm em, x-height about ${small(WORKING.xHeightMm)}`,
            `${SMALL_EDITION.poemRepetitions} complete repetitions along one ${Math.round(SMALL_EDITION.circuitLengthMm)} mm ribbon around the body`,
          ],
          [
            "Full-size sculpture (conceptual study)",
            "Set after fit tests; the same outlines scale up",
            `${BODY_ROWS} rows around the body, each one complete poem on a closed reading path; the jaw carries its own ${JAW_ROWS}-row inscription`,
          ],
        ],
      },
      {
        kind: "p",
        text: "Because the same outlines serve both editions, the master is drawn at one working size and every number in this guide is given in millimetres on your paper. The tables also show what each size becomes on the small maquette, which is the tightest case.",
      },
      { kind: "h", text: "The deliverable in one sentence" },
      {
        kind: "p",
        text: `${MASTER_ROWS.length} labelled rows of black script on white paper, one poem line (or half line) per row, ${WORKING.xHeightMm} mm x-height, ${WORKING.slantDegrees}° slant, no stroke thinner than ${WORKING.minimumThinStrokeMm} mm, scanned at 600 dpi.`,
      },
      {
        kind: "note",
        title: "Your hand, not the font",
        tone: "tip",
        text: "Great Vibes was chosen because its slanted script and flourished capitals resembled your sample. Treat the rendered reference sheets as a size and proportion guide only. Your letterforms, joins, and flourishes are what we want.",
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
      "Twelve steps, each with a check you can do before moving on. Most of the time goes into warming up and writing; the rest is checking.",
    blocks: [
      {
        kind: "steps",
        steps: [
          {
            title: "Read the poem aloud from the exact-text sheet",
            body: "Use the “The poem, exactly” page. Note the invented compound words (palindove, inkhands, halfheight, halfknight, quarterknight, knightling, swordfeud, doublelong, mirrorknave, swordwave), the apostrophes, and the single lowercase start of the last line. The wording is checked letter by letter against the source text.",
            check:
              "You can name every punctuation mark on the inventory table without looking.",
          },
          {
            title: "Gather materials",
            body: "One pen (brush pen recommended), its black pigment cartridge, smooth bright-white paper, ruler, 2H pencil, eraser, low-tack tape, and a scrap of the same paper for pen tests. The materials table lists specific products and what to avoid.",
            check:
              "Test-write “palindove” on the scrap; the ink dries matte black with no feathering.",
          },
          {
            title: "Print the template sheets at 100 %",
            body: "Print the eight ghosted sheets and at least ten blank ruled sheets. In the print dialog choose “Actual size” or 100 %, landscape, no “fit to page”. Print on the writing paper itself if the printer accepts it; otherwise print on plain paper and use it under your paper on a light pad.",
            check: `Measure the bar in each sheet's header: it must be ${SHEET.scaleBarMm} mm, within 1 mm.`,
          },
          {
            title: "Warm up on the alphabet sheet",
            body: `Write the lowercase alphabet twice and the capitals once at the working size, joined as you would in running text. Aim the body of a, o, n at the ${WORKING.xHeightMm} mm x-height, ascenders to the ${WORKING.ascenderMm} mm line, descenders to the ${WORKING.descenderMm} mm line.`,
            check:
              "Ten consecutive letters sit on the baseline and touch the x-height line without drifting.",
          },
          {
            title: "Set your stroke weights",
            body: `Write “Come, palindove,” at working size. Lay the printed stroke gauge beside the thinnest hairline: it must be at least ${WORKING.minimumThinStrokeMm} mm wide. Thick strokes should be ${WORKING.thickStrokeMm[0]}–${WORKING.thickStrokeMm[1]} mm. If your hairlines are thinner, increase the minimum pressure or switch to the 1.0 mm marker for the master.`,
            check: `No stroke in the test line is narrower than the ${WORKING.minimumThinStrokeMm} mm gauge bar.`,
          },
          {
            title: "Practise the hard words",
            body: "Use the hard-words sheet. Write each compound word as one word with no gap and no hyphen. Then practise the capitals that appear in the poem (C, D, E, F, I, L, O, S, T, shown darker on the alphabet sheet) with the flourish you intend to use for each, staying inside the dotted flourish lines.",
            check:
              "Every flourish stays between the dotted ceiling and floor lines; nothing crosses into the next row.",
          },
          {
            title: "Write the master rows in order",
            body: `Use blank ruled sheets. One row per labelled row ID (R01 to R17, with a/b halves), in poem order, writing the row ID in pencil in the left label box. Keep one steady word gap of about ${WORKING.wordGapMm[0]}–${WORKING.wordGapMm[1]} mm. Never split a word across rows. If a row runs long, stop at a word gap, write the rest on the next row, and label both with the same ID plus a and b.`,
            check:
              "Each row starts at the left rule and ends before the right margin; the text matches the exact-text sheet.",
          },
          {
            title: "Let every sheet dry fully",
            body: "Brush-pen pigment is touch dry in a minute; sumi needs an hour. Do not stack sheets or erase before then.",
            check:
              "A clean tissue pressed on the darkest stroke picks up nothing.",
          },
          {
            title: "Review with the checklist",
            body: "Go row by row with the quick-reference checklist: wording, capitals, punctuation, x-height, slant, joins, stroke minimum, flourish zones, nothing touching the row above or below.",
            check: "Every row has a pencil tick in its label box.",
          },
          {
            title: "Rewrite, do not patch",
            body: "If a row has a wrong letter, a blob, a stroke that touches another row, or a hairline under 1 mm, rewrite the whole row on a fresh ruled sheet with the same ID. Put a single pencil X through the rejected row. Do not use correction fluid on a master row; a clean rewrite scans cleaner than a repair.",
            check: "Exactly one un-crossed row exists for each row ID.",
          },
          {
            title: "Scan or photograph every sheet",
            body: "Flatbed at 600 dpi, greyscale, no auto-contrast or sharpening, saved as TIFF or PNG named by sheet (for example jill-sheet-03.tif). Keep the whole sheet in the scan, including the row labels and the 100 mm bar, so scale and identity are recorded. If you must photograph: daylight, straight on, the whole sheet in frame, no shadows.",
            check: `The scanned bar measures ${SHEET.scaleBarMm} mm when the file is opened at 600 dpi.`,
          },
          {
            title: "Approve the proof",
            body: "Andrew traces the scans into outlines, joins the rows into the continuous ribbon, and sends back a proof at 1:1 and at 4:1 alongside a maquette-size print. Mark anything you want changed. Nothing is laser-marked before you approve the proof, and the first laser job is a small test coupon, not the full skin.",
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
    title: "Templates and reference render",
    kicker: "Print these at 100 %",
    summary:
      "Ruled sheets at the working size, ghosted reference rows rendered in the stand-in font, the alphabet, the hard words, and a true-size preview of the ribbon.",
    blocks: [
      {
        kind: "p",
        text: `Every sheet is US Letter, landscape, with a ${SHEET.scaleBarMm} mm check bar in the header. Solid lines are baseline and x-height; long dashes are ascender and capital height; short dashes mark the descender line; dotted lines are the flourish ceiling and floor. Light diagonal lines show the ${WORKING.slantDegrees}° slant every ${SHEET.slantSpacingMm} mm.`,
      },
      {
        kind: "figure",
        figure: "rowMap",
        caption: `The ${MASTER_ROWS.length} rows in poem order, three per sheet. Six long lines are written as two rows (a and b) and rejoined digitally.`,
      },
      {
        kind: "figure",
        figure: "ribbonWorking",
        caption:
          "Reference render of rows R01 to R03 at the working size, in the stand-in font. This is the size and weight to aim for, not the letterforms.",
      },
      {
        kind: "figure",
        figure: "ribbonSmall",
        caption: `The same lettering at maquette size (${SMALL_EDITION.emMm} mm em), actual size when printed at 100 %. This is why hairlines matter.`,
      },
      {
        kind: "figure",
        figure: "sheetBlank",
        caption:
          "Blank ruled sheet for the master rows. Print as many as you need; write the row ID in the left box.",
      },
      {
        kind: "figure",
        figure: "alphabet",
        caption:
          "Alphabet warm-up sheet: the stand-in font rendered faintly at working size. Write over it or beside it in your own hand.",
      },
      {
        kind: "figure",
        figure: "hardWords",
        caption:
          "Hard words and the poem's capitals, ghosted at working size for practice.",
      },
      {
        kind: "figure",
        figure: "sheetsGhost",
        caption:
          "Ghosted reference sheets: every master row rendered faintly in the stand-in font with its row ID. Use them for size and spacing; write the final master on blank sheets.",
      },
    ],
  },
  {
    id: "quick",
    index: "04",
    title: "The easy parts",
    kicker: "One-page quick reference",
    summary:
      "If you only read one page, read this one. Sizes, the stroke rule, the checklist, and what to send back.",
    blocks: [
      { kind: "table", ...SIZE_TABLE, caption: "Sizes at the working scale" },
      {
        kind: "figure",
        figure: "strokeGauge",
        caption:
          "Stroke gauge. Hold a written hairline against the bars: it must be at least as wide as the 1 mm bar.",
      },
      { kind: "h", text: "Do" },
      {
        kind: "ul",
        items: [
          "Write in your own slanted, joined script with flourished capitals.",
          `Keep the x-height on the ${WORKING.xHeightMm} mm line and the slant near ${WORKING.slantDegrees}°.`,
          "Keep the thinnest stroke at 1 mm or wider.",
          "Keep flourishes inside the dotted lines.",
          "Write compound words as single words: palindove, inkhands, halfknight.",
          "Copy punctuation exactly, including the final ellipsis.",
          "Label every row; rewrite rather than patch.",
        ],
      },
      { kind: "h", text: "Don't" },
      {
        kind: "ul",
        items: [
          "Don't add words, hyphens, or extra capitals.",
          "Don't split a word across two rows.",
          "Don't let any stroke touch the row above or below.",
          "Don't use coloured, glossy, or metallic ink.",
          "Don't crop the row labels or the 100 mm bar out of the scans.",
        ],
      },
      { kind: "h", text: "Row checklist" },
      {
        kind: "checklist",
        items: [
          "Wording matches the exact-text sheet, letter for letter",
          "Capitals only where the poem has them",
          "Punctuation present and correct",
          "Bodies of letters sit on the baseline and reach the x-height line",
          "Slant consistent along the row",
          "Thinnest stroke at least 1 mm",
          "Flourishes stay inside the dotted lines",
          "Row ID written in the label box",
        ],
      },
      { kind: "h", text: "What to send" },
      {
        kind: "ol",
        items: [
          `${MASTER_ROWS.length} approved rows across the sheets, scanned at 600 dpi as TIFF or PNG, one file per sheet, with the full sheet in frame.`,
          "One photo of the pen you used and the paper's packaging, so the archive records the materials.",
          "Any notes on rows you were unsure about.",
        ],
      },
    ],
  },
  {
    id: "details",
    index: "05",
    title: "In depth",
    kicker: "Why the numbers are what they are",
    summary:
      "Proportions, spacing and joins, flourish zones, what the laser can and cannot mark, materials in detail, how the scan becomes foil, and what to do when things go wrong.",
    blocks: [
      { kind: "h", text: "Proportions" },
      {
        kind: "figure",
        figure: "proportions",
        caption:
          "The guideline set on every sheet, with the stand-in font's “palindove” placed on it for scale.",
      },
      {
        kind: "p",
        text: `The layout is built around the em, the nominal row size. The stand-in font has an x-height of 0.36 em, ascenders at 0.62 em, capitals at 0.81 em, and descenders to 0.32 em. At the working size that gives a ${WORKING.xHeightMm} mm x-height, ${WORKING.ascenderMm} mm ascenders, ${WORKING.capHeightMm} mm capitals and ${WORKING.descenderMm} mm descenders. Your natural proportions may differ a little; what matters is that they stay the same on every row, because rows are scaled to a common x-height when they are joined.`,
      },
      {
        kind: "p",
        text: `The working sheets and the jaw master space rows ${ROW_PITCH_EM} ems apart, which is ${WORKING.rowPitchMm} mm at the working size. The dotted flourish lines mark the space a letter may use without touching a neighbouring row: up to ${WORKING.flourishCeilingMm} mm above the baseline and ${WORKING.flourishFloorMm} mm below. The maquette's ribbon band is ${SMALL_EDITION.ribbonHeightMm} mm tall for a ${SMALL_EDITION.emMm} mm em, so the same limits apply there. The large body master currently stacks ${BODY_ROWS} rows only ${BODY_ROW_PITCH_EM} ems apart; before that run Andrew re-spaces the body rows to the real extent of your capitals and descenders, so do not tighten your hand for it.`,
      },
      { kind: "h", text: "Spacing, joins, and slant" },
      {
        kind: "ul",
        items: [
          `Letters within a word join in the usual running-script way; keep the spacing between joined letters even and fairly tight, roughly the width of a lowercase n between stems.`,
          `Words are separated by one steady gap of ${WORKING.wordGapMm[0]}–${WORKING.wordGapMm[1]} mm, about one x-height. The gap between poem lines on the ribbon is doubled (${WORKING.lineGapMm[0]}–${WORKING.lineGapMm[1]} mm); Andrew adds that when the rows are joined, so end each row after the final punctuation with no special gap.`,
          `Slant is ${WORKING.slantDegrees}° from the baseline, the classic copperplate angle, drawn faintly on every sheet. If your natural slant is a few degrees different, use yours and keep it constant.`,
          "The ribbon is one continuous line, so the tail of each row must be able to meet the head of the next at a word gap. Exit strokes may trail a little; an entry flourish on a capital may lead in a little; neither should be longer than one word gap.",
          "The final ellipsis runs into the first word. Give the three dots a normal ending and let the first “C” carry whatever lead-in flourish you like; the join will read as a loop either way.",
        ],
      },
      { kind: "h", text: "Capitals and flourishes" },
      {
        kind: "p",
        text: `The poem uses these capitals: ${CAPITALS.join(", ")}. Each begins a line or a sentence except the lowercase “come” that starts the last line, which is deliberate: the poem loops, so its last line is a continuation. Flourished capitals are welcome. Keep flourishes clear of the words before and after them, and never above the ceiling or below the floor line. A flourish that crosses another letter becomes an unreadable blob at ${SMALL_EDITION.emMm} mm.`,
      },
      { kind: "h", text: "Why the 1 mm stroke rule" },
      {
        kind: "p",
        text: `The foil is ${SMALL_EDITION.foilThicknessMm} mm AlumaMark aluminum. A CO₂ laser darkens its coating rather than cutting it, and the marked line cannot be narrower than the beam's focused spot, roughly 0.1–0.2 mm. Your master is scaled by ${PAPER_TO_SMALL_SCALE.toFixed(3)} to reach the maquette's ${SMALL_EDITION.emMm} mm em, so a ${WORKING.minimumThinStrokeMm} mm stroke on paper becomes ${SMALL_EDITION.minimumStrokeMm} mm on the foil, right at the limit of what survives. Anything thinner drops out or fills in. Thick strokes of ${WORKING.thickStrokeMm[0]}–${WORKING.thickStrokeMm[1]} mm keep the script's contrast without closing up the counters of e, a, and o.`,
      },
      {
        kind: "note",
        title: "If you prefer a pointed dip pen",
        tone: "warn",
        text: "Copperplate hairlines from a Nikko G or Zebra G nib are 0.1–0.2 mm on paper and would vanish. If that is the hand you want, write it anyway and say so: Andrew will thicken every outline uniformly by about 0.4 mm on the paper scale before scaling. The hairlines then survive, but the contrast softens and the letters gain a little weight. A brush pen avoids that step entirely.",
      },
      { kind: "h", text: "Materials in detail" },
      { kind: "table", ...MATERIALS },
      {
        kind: "p",
        text: "Matte black on smooth bright white scans as a clean two-tone image, which is what vector tracing needs. Glossy inks reflect the scanner lamp and produce grey speckles inside strokes; textured paper adds noise along every edge; cream paper lowers contrast. Bristol or a heavy laser paper also stays flat on the scanner glass.",
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
          "The image is thresholded to pure black and white and traced into closed vector outlines, the same kind of outlines the current stand-in font produces.",
          `Each row is measured from its baseline and x-height lines and normalised to the ${WORKING.emMm} mm em, so rows written on different days still match.`,
          "Rows are joined in poem order with one word gap inside a line and a double gap between lines, producing one continuous ribbon.",
          `The ribbon's length is compared with the stand-in layout (about ${Math.round(REFERENCE_METRICS.loopWidthEm)} ems for one poem). Up to about 15 % difference is absorbed by adjusting word gaps and a small uniform scale; outside that we talk before changing anything.`,
          `The ribbon replaces the font outlines in the generators for both editions: two repetitions around the maquette's ${Math.round(SMALL_EDITION.circuitLengthMm)} mm body circuit, and one poem per row on the large study.`,
          "You receive a proof. After approval, denhac staff mark a small test coupon with your lettering at 2.5, 4, 6, 8, 10 and 14 mm em sizes on the actual foil, and we look at it together before any full sheet is marked.",
        ],
      },
      { kind: "h", text: "Troubleshooting" },
      {
        kind: "table",
        head: ["Problem", "Likely cause", "Fix"],
        rows: [
          [
            "Edges feather or bleed",
            "Absorbent or textured paper, or a wet dip-pen line",
            "Switch to smooth Bristol or 120 g laser paper; let the pen's own cartridge ink do the work.",
          ],
          [
            "Hairlines under 1 mm",
            "Too little pressure on the up-strokes",
            "Slow down on up-strokes and keep the brush tip slightly loaded; or use the 1.0 mm marker for the master.",
          ],
          [
            "Counters of e, a, o fill in",
            "Thick strokes over 3 mm at this size",
            "Ease the pressure on down-strokes; the gauge's 3 mm bar is the ceiling.",
          ],
          [
            "x-height drifts along the row",
            "Writing without looking at the line, or fatigue",
            "Write in shorter bursts; check the height every three words; rewrite the row if it drifts more than 1 mm.",
          ],
          [
            "Slant wanders",
            "Paper rotated, or guidelines too faint",
            "Tape the sheet square to the table; darken the slant lines with pencil if needed.",
          ],
          [
            "Row runs out of room",
            "Wide hand or generous word gaps",
            "Stop at a word gap and continue on the next row as part b; never squeeze the last word.",
          ],
          [
            "Ink pooling at joins",
            "Pausing with the tip on the paper",
            "Lift between words; keep the pen moving through joins.",
          ],
          [
            "Scan looks grey or speckled",
            "Auto-enhance, glossy ink, or low resolution",
            "Rescan at 600 dpi greyscale with all automatic corrections off.",
          ],
        ],
      },
      { kind: "h", text: "Punctuation inventory" },
      { kind: "punctuation" },
      {
        kind: "p",
        text: "The apostrophes belong to inkprick's, who's, that's, mine's and thine's. The only ellipsis is the last character of the poem. There are no quotation marks, dashes, or parentheses anywhere.",
      },
    ],
  },
];

export function chapterById(id: string) {
  return CHAPTERS.find((chapter) => chapter.id === id);
}
