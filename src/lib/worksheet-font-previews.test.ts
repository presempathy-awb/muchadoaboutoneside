import { describe, expect, test } from "bun:test";
import { loadWorksheetFontPreview } from "./worksheet-font-previews";

describe("worksheet font previews", () => {
  test("does not fetch browser-only preview assets during server rendering", async () => {
    expect(await loadWorksheetFontPreview("pinyon-script")).toBe(
      "Pinyon Script",
    );
  });
});
