export const POEM_TITLE = "Much Ado About One Side";

export const INSCRIPTION_LAYOUT = {
  width: 8192,
  height: 2048,
  // The body is much longer than it is wide: compensate in UV space so
  // the complete poem keeps readable letter proportions on the surface.
  fontSize: 300,
  textWidth: 8000,
  left: 96,
  firstBaseline: 420,
  rowSpacing: 420,
  rows: 4,
} as const;

// The short jaw has its own surface proportions and marking artwork.
export const JAW_INSCRIPTION_LAYOUT = {
  width: 8192,
  height: 2048,
  fontSize: 40,
  textWidth: 8000,
  left: 96,
  firstBaseline: 165,
  rowSpacing: 96,
  rows: 18,
} as const;

export type PoemVersionId = "canonical" | "extended";

/**
 * One wording of the poem and every file that carries it. The canonical
 * version is the inscription the fabrication artwork was generated from; other
 * versions are previewed live in the browser until their own artwork exists.
 */
export interface PoemVersion {
  id: PoemVersionId;
  /** Short name shown in the version picker. */
  label: string;
  /** One sentence describing what distinguishes the version. */
  summary: string;
  title: string;
  stanzas: readonly (readonly string[])[];
  lines: readonly string[];
  /** The continuous reading ribbon: every line joined with a double gap. */
  loop: string;
  /** How the ending returns to the beginning, for the reading notes. */
  loopNote: string;
  /** The archival source text, relative to the repository root. */
  sourceFile: string;
  /** Public download of the source text. */
  textPath: string;
  /** Public editable UV layout study (SVG). */
  studyPath: string;
  /** Public poem sheet set in the substitute script (PDF). */
  scriptPdfPath: string;
  guidePdfPath: string;
  guideHtmlPath: string;
  guideVersion: string;
  /**
   * Natural width of the reading loop in ems of the substitute script:
   * measured in Chrome for fixed wordings, estimated from glyph advances for
   * drafts. The surface layouts scale from it.
   */
  loopWidthEm: number;
  /** Outlined laser masters and foil kits exist for this wording. */
  fabricationArtwork: boolean;
  /** Set on a wording edited in the browser; never a fixed version. */
  draft?: boolean;
}

export const POEM_STANZAS = [
  ["Come, palindove, let edges twine;", "thy side is mine, and mine is thine."],
  [
    "Draw, O coward! cries the knight.",
    "So inkhands draw him at halfheight.",
    "That halfknight draws a quarterknight,",
    "who draws a knightling, out of sight.",
    "This swordfeud, quoth one, is accursed:",
    "each little inkprick's like the first!",
    "Take sides! they roar. The turncoat sighs:",
    "I have but one. Do thou likewise.",
  ],
  [
    "Split it, then! Slit it lengthwise through:",
    "it comes round doublelong, not two.",
    "Then who's our foe? Thy mirrorknave.",
    "Look edgewise: that's thine own swordwave.",
  ],
  [
    "Onesided! End it! The strip shrugs: Fine.",
    "Tail dovetails head; mine's thine, thine's mine:",
    "come, palindove, let edges twine…",
  ],
] as const;

export const EXTENDED_POEM_STANZAS = [
  ["Come, palindove, let edges twine,", "thy side is mine and mine is thine."],
  [
    "Draw O coward cries the knight,",
    "so inkhands draw him at halfheight.",
    "That halfknight draws a quarterknight,",
    "who draws a knightling out of sight,",
    "and down, and down, past small, past small,",
    "the infinight, who draws them all.",
    "This swordfeud, quoth one, is accursed,",
    "each little inkprick's like the first.",
  ],
  [
    "The clerk sets knight by halfknight, pair",
    "by pair. The part's the whole. All's fair.",
    "One knight walks slantwise down the scroll",
    "and, one off each, escapes the roll.",
    "The innfinite is full, and yet",
    "there's room for one, if each will get",
    "along one door. And room for two.",
    "And all the endless halfknight crew.",
  ],
  [
    "Take sides they roar. The turncoat sighs",
    "I have but one. Do thou likewise.",
    "Split it then, slit it lengthwise through,",
    "it comes round doublelong, not two.",
    "Slit that again, two rings, and see,",
    "each wears the other, as do we.",
    "Then who's our foe? Thy mirrorknave.",
    "Look edgewise, that's thine own swordwave.",
  ],
  [
    "The herald cracks the seal and reads",
    "This writ no herald reads. He needs",
    "must stop. Read on, it lies. Read not,",
    "it's true. He eats it on the spot.",
  ],
  [
    "Meanwhile, in tigerstripes, a strip",
    "of moon spits up its sea, to whip",
    "an icering round the giant world,",
    "then rides inside the ring it hurled.",
  ],
  [
    "Onesided. Hold. The strip shrugs, Fine,",
    "and eightwise coils, a wyrm, to dine,",
    "and ouroborrows its own bait,",
    "tail dovetails head, an hourglass eight,",
    "one side, one edge, mine's thine, thine's mine,",
    "come, palindove, let edges twine",
  ],
] as const;

function defineVersion(
  version: Omit<PoemVersion, "lines" | "loop" | "title">,
): PoemVersion {
  const lines = version.stanzas.flat();
  return { ...version, title: POEM_TITLE, lines, loop: lines.join("  ") };
}

export const DEFAULT_POEM_VERSION_ID: PoemVersionId = "canonical";

export const POEM_VERSIONS: readonly PoemVersion[] = [
  defineVersion({
    id: "canonical",
    label: "Canonical",
    summary:
      "Seventeen lines, the wording the marking masters and foil kits were generated from.",
    stanzas: POEM_STANZAS,
    loopNote:
      "The layout places the final ellipsis beside the opening “Come,” so the inscription has no fixed end.",
    sourceFile: "source/poem/much-ado-about-one-side.txt",
    textPath: "/editions/much-ado-about-one-side.txt",
    studyPath: "/editions/endless-inscription-study.svg",
    scriptPdfPath: "/editions/much-ado-about-one-side-script.pdf",
    guidePdfPath: "/guide/calligraphy-guide.pdf",
    guideHtmlPath: "/guide/calligraphy-guide.html",
    guideVersion: "revision 2 · 2026-09-14",
    loopWidthEm: 194.14,
    fabricationArtwork: true,
  }),
  defineVersion({
    id: "extended",
    label: "Extended",
    summary:
      "Forty lines: the clerk’s innfinite, the herald’s writ, the tigerstriped moon, and the wyrm’s hourglass eight.",
    stanzas: EXTENDED_POEM_STANZAS,
    loopNote:
      "The last line repeats the first, so the layout runs “twine” straight back into “Come,” and the inscription has no fixed end.",
    sourceFile: "source/poem/much-ado-about-one-side-extended.txt",
    textPath: "/editions/much-ado-about-one-side-extended.txt",
    studyPath: "/editions/endless-inscription-study-extended.svg",
    scriptPdfPath: "/editions/much-ado-about-one-side-extended-script.pdf",
    guidePdfPath: "/guide/calligraphy-guide-extended.pdf",
    guideHtmlPath: "/guide/calligraphy-guide-extended.html",
    guideVersion: "revision 2 · 2026-09-15 · extended poem",
    loopWidthEm: 430.54,
    fabricationArtwork: false,
  }),
];

export function isPoemVersionId(value: unknown): value is PoemVersionId {
  return POEM_VERSIONS.some((version) => version.id === value);
}

/** Falls back to the canonical version for unknown ids. */
export function poemVersionById(id: string | null | undefined): PoemVersion {
  return (
    POEM_VERSIONS.find((version) => version.id === id) ??
    (POEM_VERSIONS.find(
      (version) => version.id === DEFAULT_POEM_VERSION_ID,
    ) as PoemVersion)
  );
}

export const CANONICAL_POEM = poemVersionById(DEFAULT_POEM_VERSION_ID);

// The canonical wording keeps its original names for the generators and tests.
export const POEM_LINES = POEM_STANZAS.flat();
export const POEM_LOOP = POEM_LINES.join("  ");

export function escapeXml(value: string): string {
  return value.replace(
    /[<>&"']/g,
    (character) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[character] ?? character,
  );
}
