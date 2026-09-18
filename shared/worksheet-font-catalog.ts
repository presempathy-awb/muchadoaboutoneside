export const WORKSHEET_FONT_CATALOG = [
  {
    id: "great-vibes",
    name: "Great Vibes",
    description:
      "A flowing connected script with flourished capitals and many OpenType alternates.",
    family: "Great Vibes",
    path: "/fonts/GreatVibes-Regular.ttf",
    sha256: "8d509802186f1b51572531ecf313e8098f9a5bfdfaca93f0c9b34467f9982d15",
    previewFamily: "WorksheetSample-great-vibes",
  },
  {
    id: "pinyon-script",
    name: "Pinyon Script",
    description:
      "A formal roundhand-inspired script with strong contrast and an extensive Latin character set.",
    family: "Pinyon Script",
    path: "/fonts/PinyonScript-Regular.ttf",
    sha256: "4aab130a6ed27f8b8117738c84a5602edf9300cdcc0651a9a65bf96f451ac29a",
    previewFamily: "WorksheetSample-pinyon-script",
  },
  {
    id: "imperial-script",
    name: "Imperial Script",
    description:
      "A formal script with fine connecting strokes and pronounced shaded forms.",
    family: "Imperial Script",
    path: "/fonts/ImperialScript-Regular.ttf",
    sha256: "fa040ae596cde82559c3bcf056ac216a94efa904b848382ab85740d38df4bab7",
    previewFamily: "WorksheetSample-imperial-script",
  },
  {
    id: "italianno",
    name: "Italianno",
    description:
      "A light, flowing script with discretionary ligatures and three stylistic sets.",
    family: "Italianno",
    path: "/fonts/Italianno-Regular.ttf",
    sha256: "f6ae96dea0da46c73370eb0575848ab0eda190315bdfda3f5b252bba3dc9173c",
    previewFamily: "WorksheetSample-italianno",
  },
  {
    id: "herr-von-muellerhoff",
    name: "Herr Von Muellerhoff",
    description:
      "A compact historical signature style from the Charles Bluemlein collection.",
    family: "Herr Von Muellerhoff",
    path: "/fonts/HerrVonMuellerhoff-Regular.ttf",
    sha256: "ba8ac10807a79462b7c8265b2eebb8419e5017fdc1a5828b1a071d9e8478772e",
    previewFamily: "WorksheetSample-herr-von-muellerhoff",
  },
  {
    id: "mrs-saint-delafield",
    name: "Mrs Saint Delafield",
    description:
      "A loose historical signature style from the Charles Bluemlein collection.",
    family: "Mrs Saint Delafield",
    path: "/fonts/MrsSaintDelafield-Regular.ttf",
    sha256: "67a7abc298ce9d368b2c00fcbff52ec54be948889b8a59032ae80ca3322e5b34",
    previewFamily: "WorksheetSample-mrs-saint-delafield",
  },
] as const;

export type WorksheetFontDefinition = (typeof WORKSHEET_FONT_CATALOG)[number];
export type WorksheetBundledFontId = WorksheetFontDefinition["id"];

export const WORKSHEET_FONT_BY_ID = Object.fromEntries(
  WORKSHEET_FONT_CATALOG.map((font) => [font.id, font]),
) as {
  readonly [Id in WorksheetBundledFontId]: Extract<
    WorksheetFontDefinition,
    { id: Id }
  >;
};

export function isWorksheetBundledFontId(
  value: string,
): value is WorksheetBundledFontId {
  return Object.hasOwn(WORKSHEET_FONT_BY_ID, value);
}

export function worksheetFontDefinition(
  id: WorksheetBundledFontId,
): WorksheetFontDefinition {
  return WORKSHEET_FONT_BY_ID[id];
}
