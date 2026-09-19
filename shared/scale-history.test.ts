import { describe, expect, test } from "bun:test";
import {
  DEFAULT_SCALE_DESIGN,
  normalizeScaleDesign,
  resizeScaleDesign,
  setScaleDensityMode,
} from "./scale-design";
import {
  applyScaleShapeVersion,
  captureScaleShapeVersion,
  MAX_SCALE_SHAPE_HISTORY,
  parseScaleShapeHistory,
  rememberScaleShapeVersion,
  type ScaleShapeVersion,
} from "./scale-history";

import { DEFAULT_SCALE_SHAPE, LEGACY_SCALE_SHAPE } from "./scale-shape";

describe("recent working scale shapes", () => {
  test("history distinguishes outline controls and restores them without replacing the poem", () => {
    const original = captureScaleShapeVersion(
      DEFAULT_SCALE_DESIGN,
      "Photo plates",
      1,
    );
    const changed = normalizeScaleDesign({
      ...DEFAULT_SCALE_DESIGN,
      geometry: {
        ...DEFAULT_SCALE_DESIGN.geometry,
        plateShape: "diamond",
        plateFit: "inset",
        plateAspect: 0.8,
        cornerCut: 0.25,
        plateTaper: -0.2,
        bodyWidthScale: 1.6,
        bodyDepthScale: 0.7,
      },
      text: "Keep my poem.",
      fontId: "serif",
    });
    const tuned = captureScaleShapeVersion(changed, "Tuned", 2);
    expect(tuned.id).not.toBe(original.id);
    const history = parseScaleShapeHistory(JSON.stringify([original, tuned]));
    expect(history).toEqual([original, tuned]);
    const savedTuned = history[1];
    if (!savedTuned) throw new Error("Expected tuned body history");
    const restoredTuned = applyScaleShapeVersion(
      DEFAULT_SCALE_DESIGN,
      savedTuned,
    );
    expect(restoredTuned.geometry.plateFit).toBe("inset");
    expect(original.shape.geometry.plateFit).toBe("cover");
    expect(restoredTuned.geometry.bodyWidthScale).toBe(1.6);
    expect(restoredTuned.geometry.bodyDepthScale).toBe(0.7);
    const first = history[0];
    if (!first) throw new Error("Expected the original shape");
    const restored = applyScaleShapeVersion(changed, first);
    expect(restored.geometry).toEqual(original.shape.geometry);
    expect(restored.text).toBe(changed.text);
    expect(restored.fontId).toBe(changed.fontId);
  });

  test("old history entries migrate to legacy outlines without changing construction", () => {
    const saved = captureScaleShapeVersion(
      DEFAULT_SCALE_DESIGN,
      "Earlier shape",
      1,
    );
    const geometry: Record<string, unknown> = {
      ...saved.shape.geometry,
      relief: 0.65,
    };
    for (const key of Object.keys(DEFAULT_SCALE_SHAPE)) delete geometry[key];
    const parsed = parseScaleShapeHistory(
      JSON.stringify([{ ...saved, shape: { ...saved.shape, geometry } }]),
    );
    expect(parsed).toHaveLength(1);
    const first = parsed[0];
    if (!first) throw new Error("Expected the migrated shape");
    const restored = applyScaleShapeVersion(DEFAULT_SCALE_DESIGN, first);
    for (const [key, value] of Object.entries(LEGACY_SCALE_SHAPE))
      expect(restored.geometry[key as keyof typeof LEGACY_SCALE_SHAPE]).toBe(
        value,
      );
    expect(restored.geometry.relief).toBe(0.65);
    expect(restored.layers).toEqual(saved.shape.layers);
  });

  test("restores adaptive anchors and clears them when returning to fixed counts", () => {
    const fixed = captureScaleShapeVersion(DEFAULT_SCALE_DESIGN, "Fixed", 1);
    const adaptive = setScaleDensityMode(DEFAULT_SCALE_DESIGN, "adaptive");
    const resized = resizeScaleDesign(adaptive, 0.5);
    const saved = captureScaleShapeVersion(resized, "Adaptive", 2);
    const reopened = applyScaleShapeVersion(DEFAULT_SCALE_DESIGN, saved);
    expect(reopened.geometry).toEqual(resized.geometry);
    expect(reopened.densityReference).toEqual(adaptive.densityReference);
    expect(resizeScaleDesign(reopened, 1).geometry.columns).toBe(
      adaptive.geometry.columns,
    );
    const back = applyScaleShapeVersion(reopened, fixed);
    expect(back.densityMode).toBe("fixed");
    expect(back.densityReference).toBeUndefined();
  });

  test("hopping restores shape but preserves the current writing and font", () => {
    const original = captureScaleShapeVersion(
      DEFAULT_SCALE_DESIGN,
      "Original",
      1,
    );
    const current = normalizeScaleDesign({
      ...DEFAULT_SCALE_DESIGN,
      geometry: { ...DEFAULT_SCALE_DESIGN.geometry, modelScale: 2 },
      text: "Keep this wording.",
      fontId: "custom",
      customFont: { name: "Local.ttf", dataUrl: "data:font/ttf;base64,AA==" },
      notes: "Keep my joint measurements.",
      inkColor: "#123456",
      fontSizeMm: 9,
    });
    const restored = applyScaleShapeVersion(current, original);
    expect(restored.geometry).toEqual(DEFAULT_SCALE_DESIGN.geometry);
    for (const key of [
      "text",
      "fontId",
      "customFont",
      "notes",
      "inkColor",
      "fontSizeMm",
    ] as const)
      expect(restored[key]).toEqual(current[key]);
    expect(JSON.stringify(original)).not.toContain("data:font");
  });

  test("keeps bounded stable navigation without duplicate versions", () => {
    let history: ScaleShapeVersion[] = [];
    for (let seed = 1; seed <= 12; seed++) {
      history = rememberScaleShapeVersion(
        history,
        captureScaleShapeVersion(
          {
            ...DEFAULT_SCALE_DESIGN,
            geometry: { ...DEFAULT_SCALE_DESIGN.geometry, seed },
          },
          `Shape ${seed}`,
          seed,
        ),
      );
    }
    expect(history).toHaveLength(MAX_SCALE_SHAPE_HISTORY);
    expect(history[0]?.label).toBe("Shape 5");
    const first = history[0];
    if (!first) throw new Error("Expected a retained shape");
    const revisited = { ...first, label: "Reopened", createdAt: 20 };
    expect(rememberScaleShapeVersion(history, revisited)).toBe(history);
    expect(parseScaleShapeHistory(JSON.stringify(history))).toEqual(history);
  });

  test("normalizes untrusted storage and never imports remote font or script fields", () => {
    const saved = captureScaleShapeVersion(DEFAULT_SCALE_DESIGN, "Working", 1);
    const parsed = parseScaleShapeHistory(
      JSON.stringify([
        {
          ...saved,
          id: "forged identity",
          shape: {
            ...saved.shape,
            text: "Replace the poem",
            fontId: "custom",
            customFont: { name: "URL", dataUrl: "https://example.test/font" },
            script: "bad",
          },
        },
      ]),
    );
    expect(parsed).toEqual([saved]);
    for (const input of [
      null,
      "{",
      "{}",
      "x".repeat(65537),
      JSON.stringify(Array(9).fill(saved)),
    ])
      expect(parseScaleShapeHistory(input)).toEqual([]);
  });
});
