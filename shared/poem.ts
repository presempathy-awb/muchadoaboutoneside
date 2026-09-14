export const POEM_TITLE = "Much Ado About One Side";

export const INSCRIPTION_LAYOUT = {
  width: 8192,
  height: 2048,
  fontSize: 40,
  textWidth: 8000,
  left: 96,
  firstBaseline: 165,
  rowSpacing: 96,
  rows: 18,
} as const;

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
