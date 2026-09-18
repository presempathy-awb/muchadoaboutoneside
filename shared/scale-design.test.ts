import { describe, expect, test } from "bun:test";
import { DEFAULT_SCALE_DESIGN, normalizeScaleDesign } from "./scale-design";

describe("portable scale study settings", () => {
  test("round trips a blank or custom study without altering wording", () => {
    for (const text of [
      "",
      "One side—\nthen another. <script>literal text</script>",
    ]) {
      const design = { ...DEFAULT_SCALE_DESIGN, text };
      expect(normalizeScaleDesign(JSON.parse(JSON.stringify(design)))).toEqual(
        design,
      );
    }
  });
  test("rejects unrelated and oversized imports", () => {
    for (const input of [
      null,
      [],
      {},
      { ...DEFAULT_SCALE_DESIGN, schema: 2 },
      { ...DEFAULT_SCALE_DESIGN, text: "x".repeat(20_001) },
    ]) {
      expect(() => normalizeScaleDesign(input)).toThrow();
    }
  });
  test("bounds work and excludes untrusted style and URL fields", () => {
    const parsed = normalizeScaleDesign({
      ...DEFAULT_SCALE_DESIGN,
      geometry: { columns: 1e8, rows: 1e8, relief: Infinity },
      fontSizeMm: 2,
      minFontSizeMm: 80,
      marginMm: -100,
      fontId: "https://example.test/font.ttf",
      inkColor: "url(https://example.test/)",
      script: "untrusted",
    });
    expect(
      parsed.geometry.columns * parsed.geometry.rows * 2,
    ).toBeLessThanOrEqual(1_200);
    expect(parsed.minFontSizeMm).toBe(2);
    expect(parsed.marginMm).toBe(0);
    expect(parsed.fontId).toBe("great-vibes");
    expect(parsed.inkColor).toBe(DEFAULT_SCALE_DESIGN.inkColor);
    expect(Object.hasOwn(parsed, "script")).toBe(false);
  });
  test("saved intermediate layers drive the same outward offset used by geometry", () => {
    const design = normalizeScaleDesign({
      ...DEFAULT_SCALE_DESIGN,
      layers: {
        supportInches: 1.5,
        backingInches: 0.25,
        adhesiveMm: 0.5,
        metalMm: 0.127,
        finishMm: 0.1,
        overlapMm: 0,
      },
      geometry: { ...DEFAULT_SCALE_DESIGN.geometry, supportOffsetInches: 99 },
    });
    expect(design.geometry.supportOffsetInches).toBeCloseTo(
      1.75 + 0.727 / 25.4,
      8,
    );
    expect(normalizeScaleDesign(JSON.parse(JSON.stringify(design)))).toEqual(
      design,
    );
  });
  test("preserves physical stock, wording and embedded fonts through resizing and reload", () => {
    const original = normalizeScaleDesign({
      ...DEFAULT_SCALE_DESIGN,
      fontId: "custom",
      customFont: {
        name: "A local font.ttf",
        dataUrl: "data:font/ttf;base64,AA==",
      },
      shapingEngine: "harfbuzz",
      fontFeatures: "liga=1, swsh=0",
      buildMethod: "hybrid",
      notes: "Wood ribs with printed adapters; verify joint fit.",
    });
    const resized = normalizeScaleDesign({
      ...original,
      geometry: { ...original.geometry, modelId: "maquette", modelScale: 2.5 },
    });
    expect(resized.layers).toEqual(original.layers);
    expect(resized.fontSizeMm).toBe(original.fontSizeMm);
    expect(resized.customFont).toEqual(original.customFont);
    expect(resized.geometry.modelId).toBe("maquette");
    expect(resized.geometry.modelScale).toBe(2.5);
    expect(normalizeScaleDesign(JSON.parse(JSON.stringify(resized)))).toEqual(
      resized,
    );
  });
  test("rejects missing, remotely referenced and oversized custom fonts before loading", () => {
    for (const customFont of [
      undefined,
      { name: "font", dataUrl: "https://example.test/font.ttf" },
      { name: "font", dataUrl: "data:text/html;base64,AA==" },
      {
        name: "font",
        dataUrl: `data:font/ttf;base64,${"A".repeat(3 * 1024 * 1024)}`,
      },
    ]) {
      expect(() =>
        normalizeScaleDesign({
          ...DEFAULT_SCALE_DESIGN,
          fontId: "custom",
          customFont,
        }),
      ).toThrow();
    }
  });
});
