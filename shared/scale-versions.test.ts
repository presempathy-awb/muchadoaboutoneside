import { describe, expect, test } from "bun:test";
import {
  DEFAULT_SCALE_DESIGN,
  normalizeScaleDesign,
  setScaleDensityMode,
} from "./scale-design";
import { generateMaquetteScaleStudy } from "./scale-maquette";
import { buildUpSupportOffsetInches } from "./scale-measurements";
import { DEFAULT_SCALE_SHAPE, LEGACY_SCALE_SHAPE } from "./scale-shape";
import { generateScaleStudy } from "./scale-study";
import {
  applyScaleVersionPreset,
  matchingScaleVersionPreset,
  SCALE_VERSION_PRESETS,
} from "./scale-versions";

describe("viewable scale versions", () => {
  test("preserves eight construction versions and adds a photo-reference study", () => {
    expect(SCALE_VERSION_PRESETS).toHaveLength(9);
    expect(new Set(SCALE_VERSION_PRESETS.map(({ id }) => id)).size).toBe(9);
    for (const version of SCALE_VERSION_PRESETS.slice(0, 8)) {
      for (const [key, value] of Object.entries(LEGACY_SCALE_SHAPE))
        expect(version.geometry[key as keyof typeof LEGACY_SCALE_SHAPE]).toBe(
          value,
        );
    }
    for (const version of SCALE_VERSION_PRESETS.slice(0, 8))
      expect(version.geometry.gap).toBe(
        version.id === "maquette-240-flat" ? 0.08 : 0.12,
      );
    const archival = SCALE_VERSION_PRESETS.find(
      ({ id }) => id === "wood-archival",
    );
    expect(archival?.geometry.columns).toBe(120);
    expect(archival?.geometry.rows).toBe(4);
    expect(archival?.geometry.variation).toBe(0.6);
    expect(
      SCALE_VERSION_PRESETS.find(({ id }) => id === "wood-archival")?.geometry
        .relief,
    ).toBe(0.65);
    const photo = SCALE_VERSION_PRESETS.find(
      ({ id }) => id === "wood-photo-reference",
    );
    expect(photo?.geometry.columns).toBe(100);
    expect(photo?.geometry.gap).toBe(0.02);
    expect(photo?.geometry.variation).toBe(0.3);
    for (const [key, value] of Object.entries(DEFAULT_SCALE_SHAPE))
      expect(photo?.geometry[key as keyof typeof DEFAULT_SCALE_SHAPE]).toBe(
        value,
      );
  });
  for (const version of SCALE_VERSION_PRESETS) {
    test(`${version.id} produces finite usable geometry from its real source`, () => {
      const design = applyScaleVersionPreset(DEFAULT_SCALE_DESIGN, version.id);
      const study = (
        design.geometry.modelId === "maquette"
          ? generateMaquetteScaleStudy
          : generateScaleStudy
      )(design.geometry);
      expect(study.modelId).toBe(design.geometry.modelId);
      expect(study.modelScale).toBe(design.geometry.modelScale);
      expect(study.plates.length).toBeGreaterThan(0);
      expect(study.plates.length).toBeLessThanOrEqual(6000);
      expect(study.triangleCount).toBeLessThanOrEqual(
        study.modelId === "maquette" ? 100_000 : 200_000,
      );
      expect(
        study.plates.some(
          (plate) => plate.safeRect.width > 0 && plate.safeRect.height > 0,
        ),
      ).toBe(true);
      expect(design.geometry.supportOffsetInches).toBeCloseTo(
        buildUpSupportOffsetInches(version.layers),
        10,
      );
      expect(study.sourceGeometry !== undefined).toBe(true);
      expect(study.sourceGeometry?.positions.every(Number.isFinite)).toBe(true);
      for (const plate of study.plates) {
        expect(
          [
            ...plate.positions,
            ...plate.normals,
            ...plate.uvs,
            ...plate.edgePositions,
          ].every(Number.isFinite),
        ).toBe(true);
        expect(
          plate.indices.every(
            (index) =>
              Number.isInteger(index) &&
              index >= 0 &&
              index < plate.positions.length / 3,
          ),
        ).toBe(true);
        expect(plate.widthInches > 0 && plate.heightInches > 0).toBe(true);
        expect(
          plate.safeRect.x >= 0 &&
            plate.safeRect.y >= 0 &&
            plate.safeRect.width >= 0 &&
            plate.safeRect.height >= 0,
        ).toBe(true);
        expect(plate.safeRect.x + plate.safeRect.width).toBeLessThanOrEqual(
          1 + 1e-10,
        );
        expect(plate.safeRect.y + plate.safeRect.height).toBeLessThanOrEqual(
          1 + 1e-10,
        );
      }
    });
  }

  test("hopping replaces construction while preserving user text, font and notes", () => {
    const initial = setScaleDensityMode(
      normalizeScaleDesign({
        ...DEFAULT_SCALE_DESIGN,
        text: "The same words, in every version.\nAnd every font.",
        notes: "Fountain pen and vellum; printed adapters.",
        fontId: "custom",
        customFont: {
          name: "Personal.ttf",
          dataUrl: "data:font/ttf;base64,AA==",
        },
        fontFeatures: "liga=1",
        shapingEngine: "harfbuzz",
        inkColor: "#abcdef",
        plateColor: "#123456",
        fontSizeMm: 18,
        marginMm: 1.5,
      }),
      "adaptive",
    );
    let design = initial;
    for (const version of SCALE_VERSION_PRESETS) {
      design = applyScaleVersionPreset(design, version.id);
      expect(design.geometry).toEqual(version.geometry);
      expect(design.layers).toEqual(version.layers);
      expect(design.buildMethod).toBe(version.buildMethod);
      expect(design.densityMode).toBe("adaptive");
      expect(design.densityReference?.modelScale).toBe(
        version.geometry.modelScale,
      );
      expect(design.densityReference?.modelId).toBe(version.geometry.modelId);
      for (const key of [
        "text",
        "notes",
        "fontId",
        "customFont",
        "fontFeatures",
        "shapingEngine",
        "fontSizeMm",
        "minFontSizeMm",
        "marginMm",
        "inkColor",
        "plateColor",
        "showLettering",
        "autoFit",
      ] as const) {
        expect(design[key]).toEqual(initial[key]);
      }
      expect(matchingScaleVersionPreset(design)?.id).toBe(version.id);
      expect(normalizeScaleDesign(JSON.parse(JSON.stringify(design)))).toEqual(
        design,
      );
    }
    expect(() => applyScaleVersionPreset(initial, "unknown")).toThrow();
  });

  test("preset matching distinguishes edited construction from lettering edits", () => {
    const preset = SCALE_VERSION_PRESETS[0];
    if (!preset) throw new Error("Expected a version preset.");
    const initial = applyScaleVersionPreset(DEFAULT_SCALE_DESIGN, preset.id);
    expect(
      matchingScaleVersionPreset({ ...initial, text: "Different lettering" })
        ?.id,
    ).toBe(preset.id);
    expect(
      matchingScaleVersionPreset({
        ...initial,
        geometry: { ...initial.geometry, gap: 0.2 },
      }),
    ).toBeUndefined();
    expect(
      matchingScaleVersionPreset({
        ...initial,
        layers: { ...initial.layers, metalMm: 0.2 },
      }),
    ).toBeUndefined();
    expect(
      matchingScaleVersionPreset({ ...initial, buildMethod: "wood" }),
    ).toBeUndefined();
  });
});

test("all construction presets restore identity body proportions", () => {
  const edited = normalizeScaleDesign({
    ...DEFAULT_SCALE_DESIGN,
    geometry: {
      ...DEFAULT_SCALE_DESIGN.geometry,
      bodyWidthScale: 2,
      bodyDepthScale: 0.5,
    },
  });
  for (const version of SCALE_VERSION_PRESETS) {
    const restored = applyScaleVersionPreset(edited, version.id);
    expect(restored.geometry.bodyWidthScale).toBe(1);
    expect(restored.geometry.bodyDepthScale).toBe(1);
  }
});
