/**
 * Advance widths of the substitute script (Great Vibes) in ems, measured in
 * Chrome with canvas measureText at 100 px. The font joins letters with
 * contextual alternates, so a summed width is an estimate: within 0.7 % of a
 * measured line for the canonical wording and 2.1 % for the extended one.
 * The budgets that gate the editor apply a safety margin on top of this.
 */
export const GLYPH_ADVANCES_EM: Readonly<Record<string, number>> = {
  "0": 0.458,
  "1": 0.303,
  "2": 0.392,
  "3": 0.387,
  "4": 0.406,
  "5": 0.372,
  "6": 0.395,
  "7": 0.347,
  "8": 0.384,
  "9": 0.402,
  " ": 0.171,
  "!": 0.312,
  '"': 0.206,
  "#": 0.801,
  $: 0.452,
  "%": 0.624,
  "&amp;": 0.61,
  "'": 0.106,
  "(": 0.532,
  ")": 0.512,
  "*": 0.553,
  "+": 0.343,
  ",": 0.215,
  "-": 0.404,
  ".": 0.205,
  "/": 0.501,
  ":": 0.295,
  ";": 0.296,
  "&lt;": 0.235,
  "=": 0.378,
  "&gt;": 0.253,
  "?": 0.405,
  "@": 1.028,
  A: 0.716,
  B: 1.047,
  C: 0.714,
  D: 1.05,
  E: 0.819,
  F: 1.053,
  G: 0.702,
  H: 1.395,
  I: 0.917,
  J: 0.972,
  K: 1.203,
  L: 0.716,
  M: 1.336,
  N: 1.044,
  O: 0.73,
  P: 0.925,
  Q: 0.756,
  R: 1.028,
  S: 0.926,
  T: 0.933,
  U: 0.947,
  V: 0.98,
  W: 1.351,
  X: 0.791,
  Y: 0.963,
  Z: 0.681,
  "[": 0.411,
  "\\": 0.831,
  "]": 0.451,
  "^": 0.321,
  _: 0.729,
  "`": 0.183,
  a: 0.358,
  b: 0.327,
  c: 0.263,
  d: 0.372,
  e: 0.256,
  f: 0.194,
  g: 0.396,
  h: 0.336,
  i: 0.176,
  j: 0.178,
  k: 0.36,
  l: 0.213,
  m: 0.509,
  n: 0.338,
  o: 0.338,
  p: 0.336,
  q: 0.347,
  r: 0.259,
  s: 0.267,
  t: 0.201,
  u: 0.356,
  v: 0.309,
  w: 0.495,
  x: 0.334,
  y: 0.381,
  z: 0.343,
  "{": 0.549,
  "|": 0.463,
  "}": 0.508,
  "~": 0.373,
  "\u2026": 0.556,
  "\u2019": 0.252,
  "\u2018": 0.171,
  "\u201c": 0.29,
  "\u201d": 0.372,
  "\u2013": 0.517,
  "\u2014": 0.803,
  "\u00e0": 0.358,
  "\u00e9": 0.256,
  "\u00e8": 0.256,
  "\u00ea": 0.256,
  "\u00ed": 0.176,
  "\u00f3": 0.338,
  "\u00fa": 0.356,
  "\u00f1": 0.338,
  "\u00e7": 0.263,
};

const values = Object.values(GLYPH_ADVANCES_EM);
/** Used for characters the table does not cover. */
export const AVERAGE_GLYPH_EM =
  Math.round(
    (values.reduce((sum, value) => sum + value, 0) / values.length) * 1000,
  ) / 1000;

/** Estimated natural width of a string in ems of the substitute script. */
export function textWidthEm(text: string): number {
  let width = 0;
  for (const character of text)
    width += GLYPH_ADVANCES_EM[character] ?? AVERAGE_GLYPH_EM;
  return Math.round(width * 1000) / 1000;
}

/** Estimated width of the reading loop: every line joined with a double gap. */
export function loopWidthEm(lines: readonly string[]): number {
  return textWidthEm(lines.join("  "));
}
