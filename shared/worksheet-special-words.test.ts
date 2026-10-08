import { expect, test } from "bun:test";
import { normalizeWorksheetSettings, wrapText } from "./worksheet";
import {
  specialWordParts,
  specialWordPhrases,
} from "./worksheet-special-words";

test("special lettering matches whole, case-sensitive names and keeps graphemes intact", () => {
  const parts = specialWordParts("Ann, Anna and Ann Marie meet e\u0301lan.", [
    "Ann",
    "Ann Marie",
    "e",
  ]);
  expect(parts.filter((part) => part.special).map((part) => part.text)).toEqual(
    ["Ann", "Ann Marie"],
  );
  expect(parts.map((part) => part.text).join("")).toBe(
    "Ann, Anna and Ann Marie meet e\u0301lan.",
  );
  expect(
    specialWordParts("ann Ann-Marie Ann's", ["Ann"]).some(
      (part) => part.special,
    ),
  ).toBe(false);
});

test("special lettering validates bounded literal phrases and survives settings normalization", () => {
  const settings = normalizeWorksheetSettings({
    specialWords: "Ann Marie\nLove (always)",
    specialFontId: "pinyon-script",
    specialSizePercent: 140,
  });
  expect(specialWordPhrases(settings.specialWords)).toEqual([
    "Ann Marie",
    "Love (always)",
  ]);
  expect(normalizeWorksheetSettings(settings)).toEqual(settings);
  expect(() => normalizeWorksheetSettings({ specialSizePercent: 0 })).toThrow();
  expect(() =>
    normalizeWorksheetSettings({ specialFontId: "https://evil/font.ttf" }),
  ).toThrow();
  expect(() =>
    normalizeWorksheetSettings({
      specialWords: Array.from({ length: 9 }, (_, i) => `Name${i}`).join("\n"),
    }),
  ).toThrow();
  expect(() => specialWordPhrases("a".repeat(81))).toThrow();
});

test("wrapping keeps a styled name and its punctuation together and reports an oversized name", () => {
  expect(
    wrapText("Dear Ann Marie, welcome home", 12, (line) => line.length, [
      "Ann Marie",
    ]),
  ).toEqual(["Dear", "Ann Marie,", "welcome home"]);
  expect(() =>
    wrapText("Ann Marie", 5, (line) => line.length, ["Ann Marie"]),
  ).toThrow("special words");
});

test("a shorter whole name still matches when a longer phrase has a different final word", () => {
  expect(
    specialWordParts("Ann Marielle", ["Ann Marie", "Ann"])
      .filter((part) => part.special)
      .map((part) => part.text),
  ).toEqual(["Ann"]);
  expect(
    specialWordParts("Love (always).", ["Love (always)"])
      .filter((part) => part.special)
      .map((part) => part.text),
  ).toEqual(["Love (always)"]);
});

test("special lettering refuses emergency word splitting that could turn Annabel into a styled Ann", () => {
  expect(() =>
    wrapText(
      "Annabel",
      2,
      (text) =>
        specialWordParts(text, ["Ann"]).reduce(
          (total, part) => total + part.text.length * (part.special ? 0.5 : 1),
          0,
        ),
      ["Ann"],
    ),
  ).toThrow("word");
});
