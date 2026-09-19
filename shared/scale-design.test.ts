import { describe, expect, test } from "bun:test";
import {
  DEFAULT_SCALE_DESIGN,
  normalizeScaleDesign,
  resizeScaleDesign,
  scaleDensityStatus,
  setScaleDensityMode,
  updateScaleDensity,
} from "./scale-design";

import { DEFAULT_SCALE_SHAPE, LEGACY_SCALE_SHAPE } from "./scale-shape";

function oldGeometry() {
  const geometry: Record<string, unknown> = {
    ...DEFAULT_SCALE_DESIGN.geometry,
    relief: 0.65,
  };
  for (const key of Object.keys(DEFAULT_SCALE_SHAPE)) delete geometry[key];
  return geometry;
}

describe("portable scale study settings", () => {
  test("old schema-1 imports retain their shape, stock, blank wording and saved font", () => {
    const legacy: Record<string, unknown> = {
      ...DEFAULT_SCALE_DESIGN,
      geometry: oldGeometry(),
      fontId: "custom",
      customFont: { name: "Saved.ttf", dataUrl: "data:font/ttf;base64,AA==" },
      text: "",
    };
    delete legacy.plateColor;
    const loaded = normalizeScaleDesign(JSON.parse(JSON.stringify(legacy)));
    for (const [key, value] of Object.entries(LEGACY_SCALE_SHAPE))
      expect(loaded.geometry[key as keyof typeof LEGACY_SCALE_SHAPE]).toBe(
        value,
      );
    expect(loaded.geometry.relief).toBe(0.65);
    expect(loaded.layers).toEqual(DEFAULT_SCALE_DESIGN.layers);
    expect(loaded.text).toBe("");
    expect(loaded.customFont).toEqual({
      name: "Saved.ttf",
      dataUrl: "data:font/ttf;base64,AA==",
    });
    expect(loaded.plateColor).toBe("#d9dcd8");
    expect(DEFAULT_SCALE_DESIGN.plateColor).toBe("#b7946c");
  });

  test("every tuned outline round trips through portable JSON and resizing", () => {
    for (const plateShape of [
      "clipped",
      "rectangle",
      "diamond",
      "legacy",
    ] as const) {
      const design = normalizeScaleDesign({
        ...DEFAULT_SCALE_DESIGN,
        geometry: {
          ...DEFAULT_SCALE_DESIGN.geometry,
          plateShape,
          plateAspect: 1.75,
          cornerCut: 0.24,
          plateTaper: -0.3,
        },
        text: "Exact words stay.",
        calligraphyFaceId: "scan-saved-original",
        plateColor: "#abcdef",
      });
      const restored = normalizeScaleDesign(
        JSON.parse(JSON.stringify(resizeScaleDesign(design, 2))),
      );
      for (const key of Object.keys(
        DEFAULT_SCALE_SHAPE,
      ) as (keyof typeof DEFAULT_SCALE_SHAPE)[])
        expect(restored.geometry[key]).toBe(design.geometry[key]);
      expect(restored.text).toBe(design.text);
      expect(restored.calligraphyFaceId).toBe(design.calligraphyFaceId);
      expect(restored.plateColor).toBe(design.plateColor);
      expect(restored.layers).toEqual(design.layers);
    }
  });

  test("preview quality defaults old designs to crisp and preserves balanced through resize and reload", () => {
    const { letteringQuality: _quality, ...legacy } = DEFAULT_SCALE_DESIGN;
    for (const letteringQuality of [undefined, null, "unknown", {}, 64]) {
      expect(
        normalizeScaleDesign({ ...legacy, letteringQuality }).letteringQuality,
      ).toBe("crisp");
    }
    const balanced = normalizeScaleDesign({
      ...legacy,
      letteringQuality: "balanced",
    });
    const resized = normalizeScaleDesign(
      JSON.parse(JSON.stringify(resizeScaleDesign(balanced, 2))),
    );
    expect(resized.letteringQuality).toBe("balanced");
    expect(resized.fontSizeMm).toBe(balanced.fontSizeMm);
    expect(resized.minFontSizeMm).toBe(balanced.minFontSizeMm);
    expect(resized.text).toBe(balanced.text);
  });

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

describe("physical scale density", () => {
  test("old schema-1 designs remain fixed density with no stale anchor", () => {
    const { densityMode: _mode, ...legacy } = DEFAULT_SCALE_DESIGN;
    const loaded = normalizeScaleDesign(legacy);
    expect(loaded.densityMode).toBe("fixed");
    expect(loaded.densityReference).toBeUndefined();
    const resized = resizeScaleDesign(loaded, 2);
    expect(resized.geometry.columns).toBe(legacy.geometry.columns);
    expect(resized.geometry.rows).toBe(legacy.geometry.rows);
    expect(resized.layers).toEqual(legacy.layers);
    expect(resized.fontSizeMm).toBe(legacy.fontSizeMm);
  });

  test("resizing uses a stable anchor through rounding, caps and reloads", () => {
    const initial = setScaleDensityMode(
      updateScaleDensity(DEFAULT_SCALE_DESIGN, { columns: 31, rows: 3 }),
      "adaptive",
    );
    let resized = initial;
    for (const scale of [1.17, 1.43, 2.23, 30, 0.02, 0.731, 1.011, 1]) {
      resized = normalizeScaleDesign(
        JSON.parse(JSON.stringify(resizeScaleDesign(resized, scale))),
      );
      expect(resized.densityReference).toEqual(initial.densityReference);
      expect(
        resized.geometry.columns * resized.geometry.rows,
      ).toBeLessThanOrEqual(600);
      expect(resized.layers).toEqual(initial.layers);
      expect(resized.fontSizeMm).toBe(initial.fontSizeMm);
      expect(resized).toEqual(resizeScaleDesign(initial, scale));
    }
    expect(resized).toEqual(initial);
    const doubled = resizeScaleDesign(initial, 2);
    expect(doubled.geometry.columns).toBe(62);
    expect(doubled.geometry.rows).toBe(6);
    expect(scaleDensityStatus(doubled).limited).toBe(false);
    expect(scaleDensityStatus(resizeScaleDesign(initial, 30)).limited).toBe(
      true,
    );
    expect(scaleDensityStatus(resizeScaleDesign(initial, 0.02)).limited).toBe(
      true,
    );
  });

  test("manual density changes and mode changes anchor to the current size", () => {
    const initial = setScaleDensityMode(DEFAULT_SCALE_DESIGN, "adaptive");
    const changed = updateScaleDensity(resizeScaleDesign(initial, 2), {
      columns: 30,
      rows: 3,
    });
    expect(changed.densityReference).toEqual({
      modelId: "archival",
      modelScale: 2,
      columns: 30,
      rows: 3,
    });
    expect(resizeScaleDesign(changed, 4).geometry.columns).toBe(60);
    const fixed = setScaleDensityMode(changed, "fixed");
    expect(fixed.densityReference).toBeUndefined();
    expect(resizeScaleDesign(fixed, 4).geometry.columns).toBe(30);
    expect(setScaleDensityMode(changed, "adaptive")).toEqual(changed);
  });

  test("normalization validates untrusted anchors and reanchors a source change", () => {
    const initial = setScaleDensityMode(DEFAULT_SCALE_DESIGN, "adaptive");
    const changed = normalizeScaleDesign({
      ...initial,
      geometry: {
        ...initial.geometry,
        modelId: "maquette",
        modelScale: 2,
        columns: 24,
        rows: 2,
      },
    });
    expect(changed.densityReference).toEqual({
      modelId: "maquette",
      modelScale: 2,
      columns: 24,
      rows: 2,
    });
    for (const densityReference of [
      null,
      [],
      {},
      { ...initial.densityReference, columns: Infinity },
    ]) {
      const loaded = normalizeScaleDesign({ ...initial, densityReference });
      expect(loaded.densityReference).toEqual(initial.densityReference);
      expect(loaded.geometry).toEqual(initial.geometry);
    }
    const hostile = normalizeScaleDesign({
      ...initial,
      densityReference: {
        modelId: "archival",
        modelScale: 0,
        columns: 1e100,
        rows: 1e100,
      },
    });
    expect(hostile.densityReference?.modelScale).toBe(0.02);
    expect(
      hostile.geometry.columns * hostile.geometry.rows,
    ).toBeLessThanOrEqual(600);
    for (const scale of [NaN, Infinity, -1, 0]) {
      expect(() => resizeScaleDesign(initial, scale)).toThrow();
    }
  });
});

describe("body proportions persistence and density", () => {
  test("old geometry and adaptive anchors import as identity proportions", () => {
    const geometry = { ...DEFAULT_SCALE_DESIGN.geometry } as Record<
      string,
      unknown
    >;
    delete geometry.bodyWidthScale;
    delete geometry.bodyDepthScale;
    const imported = normalizeScaleDesign({
      ...DEFAULT_SCALE_DESIGN,
      geometry,
      densityMode: "adaptive",
      densityReference: {
        modelId: "archival",
        modelScale: 1,
        columns: 31,
        rows: 3,
      },
    });
    expect(imported.geometry.bodyWidthScale).toBe(1);
    expect(imported.geometry.bodyDepthScale).toBe(1);
    expect(imported.geometry.columns).toBe(31);
    expect(imported.geometry.rows).toBe(3);
  });

  test("body edits round trip and change adaptive girth targets without column drift", () => {
    const initial = setScaleDensityMode(
      normalizeScaleDesign({
        ...DEFAULT_SCALE_DESIGN,
        geometry: { ...DEFAULT_SCALE_DESIGN.geometry, columns: 31, rows: 3 },
      }),
      "adaptive",
    );
    const changed = normalizeScaleDesign({
      ...initial,
      geometry: { ...initial.geometry, bodyWidthScale: 2, bodyDepthScale: 2 },
    });
    expect(changed.geometry.columns).toBe(31);
    expect(changed.geometry.rows).toBe(6);
    expect(scaleDensityStatus(changed).requestedRows).toBe(6);
    expect(normalizeScaleDesign(JSON.parse(JSON.stringify(changed)))).toEqual(
      changed,
    );
    let cycled = changed;
    for (const factor of [0.5, 1.7, 2, 1]) {
      cycled = normalizeScaleDesign({
        ...cycled,
        geometry: {
          ...cycled.geometry,
          bodyWidthScale: factor,
          bodyDepthScale: factor,
        },
      });
    }
    expect(cycled).toEqual(initial);
    const widthOnly = normalizeScaleDesign({
      ...initial,
      geometry: { ...initial.geometry, bodyWidthScale: 2 },
    });
    expect(widthOnly.geometry.rows).toBeGreaterThan(initial.geometry.rows);
    expect(widthOnly.geometry.rows).toBeLessThan(changed.geometry.rows);
  });

  test("adaptive anchors retain edited proportions through size changes", () => {
    const initial = setScaleDensityMode(
      normalizeScaleDesign({
        ...DEFAULT_SCALE_DESIGN,
        geometry: {
          ...DEFAULT_SCALE_DESIGN.geometry,
          columns: 20,
          rows: 3,
          bodyWidthScale: 1.4,
          bodyDepthScale: 0.8,
        },
      }),
      "adaptive",
    );
    expect(initial.densityReference?.bodyWidthScale).toBe(1.4);
    expect(initial.densityReference?.bodyDepthScale).toBe(0.8);
    const doubled = resizeScaleDesign(initial, 2);
    expect(doubled.geometry.columns).toBe(40);
    expect(doubled.geometry.rows).toBe(6);
    expect(
      resizeScaleDesign(
        normalizeScaleDesign(JSON.parse(JSON.stringify(doubled))),
        1,
      ),
    ).toEqual(initial);
  });
});

test("cover and inset studies round trip without silently changing old tuned geometry", () => {
  for (const plateFit of ["cover", "inset"] as const) {
    const original = normalizeScaleDesign({
      ...DEFAULT_SCALE_DESIGN,
      geometry: {
        ...DEFAULT_SCALE_DESIGN.geometry,
        plateFit,
        gap: 0.19,
        variation: 0.71,
        bodyWidthScale: 1.6,
        bodyDepthScale: 0.9,
        relief: 0.82,
      },
      text: "Keep exact lettering.",
      fontId: "serif",
      fontSizeMm: 18,
    });
    expect(normalizeScaleDesign(JSON.parse(JSON.stringify(original)))).toEqual(
      original,
    );
    expect(resizeScaleDesign(original, 2).geometry.plateFit).toBe(plateFit);
    const oldGeometry = { ...original.geometry } as Record<string, unknown>;
    delete oldGeometry.plateFit;
    const restored = normalizeScaleDesign({
      ...original,
      geometry: oldGeometry,
    });
    expect(restored.geometry).toEqual({
      ...original.geometry,
      plateFit: "inset",
    });
    expect(restored.text).toBe(original.text);
    expect(restored.fontSizeMm).toBe(18);
    expect(restored.layers).toEqual(original.layers);
  }
});
