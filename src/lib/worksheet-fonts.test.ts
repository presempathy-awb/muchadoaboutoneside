import { describe, expect, test } from "bun:test";
import { DEFAULT_WORKSHEET_SETTINGS } from "../../shared/worksheet";
import { loadWorksheetFont } from "./worksheet-fonts";
import type { WorksheetSnapshot } from "./worksheet-store";

function snapshot(
  fontId: WorksheetSnapshot["settings"]["fontId"],
): WorksheetSnapshot {
  return {
    version: 1,
    settings: { ...DEFAULT_WORKSHEET_SETTINGS, fontId },
    text: "Copperplate",
  };
}

describe("worksheet fonts", () => {
  test("uses cached standard adapters and measures spacing in millimetres", async () => {
    const source = snapshot("sans");
    const first = await loadWorksheetFont(source);
    const second = await loadWorksheetFont(source);
    expect(second).toBe(first);
    expect(first.family).toBe("Arial, Helvetica, sans-serif");

    const base = first.measure("A B", source.settings);
    const spaced = first.measure("A B", {
      ...source.settings,
      letterSpacingMm: 1,
      wordSpacingMm: 2,
    });
    expect(spaced - base).toBeCloseTo(4, 8);

    const wide = first.measure("Copperplate", {
      ...source.settings,
      writingScale: 2,
    });
    expect(wide).toBeCloseTo(
      first.measure("Copperplate", source.settings) * 2,
      8,
    );
  });

  test("explains that a custom font omitted from an imported PDF must be reselected", async () => {
    await expect(loadWorksheetFont(snapshot("custom"))).rejects.toThrow(
      "Reselect the TTF or OTF font",
    );
  });
});
