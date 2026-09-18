import { describe, expect, test } from "bun:test";
import {
  isWorksheetBundledFontId,
  WORKSHEET_FONT_BY_ID,
  WORKSHEET_FONT_CATALOG,
  worksheetFontDefinition,
} from "./worksheet-font-catalog";

describe("worksheet font catalog", () => {
  test("keeps unique IDs, paths, and preview families", () => {
    expect(WORKSHEET_FONT_CATALOG).toHaveLength(6);
    for (const field of ["id", "path", "previewFamily"] as const) {
      expect(
        new Set(WORKSHEET_FONT_CATALOG.map((font) => font[field])).size,
      ).toBe(WORKSHEET_FONT_CATALOG.length);
    }
  });

  test("provides safe ID lookup", () => {
    expect(isWorksheetBundledFontId("pinyon-script")).toBe(true);
    expect(isWorksheetBundledFontId("custom")).toBe(false);
    expect(worksheetFontDefinition("great-vibes")).toBe(
      WORKSHEET_FONT_BY_ID["great-vibes"],
    );
  });
});
