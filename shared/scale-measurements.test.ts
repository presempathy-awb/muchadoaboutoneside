import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ScaleBuildUpPanel } from "../src/components/scale-build-up";
import sectionData from "./foil-sections.json";
import {
  ARCHIVAL_MODEL_DIMENSIONS,
  buildUpSupportOffsetInches,
  DEFAULT_SCALE_BUILD_UP,
  ellipsePerimeter,
  normalizeScaleBuildUp,
  normalizeScaleModelScale,
  positionBounds,
  SCALE_BUILD_UP_FIELDS,
  SOURCE_SCALE_SECTIONS,
  scaleSectionMeasurements,
  scaleStudyBoundsComparison,
} from "./scale-measurements";
import {
  DEFAULT_SCALE_STUDY_SETTINGS,
  generateScaleStudy,
  type ScaleStudy,
} from "./scale-study";

const noLayers = {
  supportInches: 0,
  backingInches: 0,
  adhesiveMm: 0,
  metalMm: 0,
  finishMm: 0,
  overlapMm: 0,
};

describe("scale build-up estimates", () => {
  test("defaults retain the historical allowance without declaring it measured", () => {
    expect(normalizeScaleBuildUp(null)).toEqual(DEFAULT_SCALE_BUILD_UP);
    expect(buildUpSupportOffsetInches(DEFAULT_SCALE_BUILD_UP)).toBeCloseTo(
      1.005,
      10,
    );
    expect(normalizeScaleBuildUp({ supportInches: 0, metalMm: 0 })).toEqual(
      noLayers,
    );
  });

  test("malformed and excessive saved layers remain finite and within geometry bounds", () => {
    const normalized = normalizeScaleBuildUp({
      supportInches: -2,
      backingInches: Infinity,
      adhesiveMm: Number.NaN,
      metalMm: "6",
      finishMm: 1e9,
      overlapMm: 12,
    });
    expect(normalized).toEqual({
      ...noLayers,
      metalMm: 0.127,
      finishMm: 6,
      overlapMm: 6,
    });
    const maximum = normalizeScaleBuildUp(
      Object.fromEntries(SCALE_BUILD_UP_FIELDS.map(({ key }) => [key, 1e9])),
    );
    expect(buildUpSupportOffsetInches(maximum)).toBeCloseTo(5 + 24 / 25.4, 10);
    expect(buildUpSupportOffsetInches(maximum)).toBeLessThan(6);
  });

  test("ellipse integration agrees with a circle and retains asymmetric axes", () => {
    expect(ellipsePerimeter(5, 5)).toBeCloseTo(10 * Math.PI, 10);
    expect(ellipsePerimeter(5, 2)).toBeCloseTo(23.013112595664843, 8);
    expect(ellipsePerimeter(2, 5)).toBeCloseTo(ellipsePerimeter(5, 2), 10);
    expect(() => ellipsePerimeter(-1, 5)).toThrow();
    expect(() => ellipsePerimeter(1, Infinity)).toThrow();
  });

  test("all 41 modeled sections preserve source semiaxes, including the separate jaw", () => {
    expect(SOURCE_SCALE_SECTIONS).toHaveLength(41);
    expect(
      SOURCE_SCALE_SECTIONS.filter((section) => section.surface === "jaw"),
    ).toHaveLength(3);
    const jaw = sectionData.jawSections[0];
    const normalized = SOURCE_SCALE_SECTIONS.find(
      (section) => section.id === "jaw-0",
    );
    if (!jaw || !normalized) throw new Error("Expected archived jaw section.");
    expect(normalized.radiusUInches).toBeCloseTo(
      Math.hypot(
        ...(jaw.perimeter[0] ?? []).map(
          (value, axis) => value - (jaw.center[axis] ?? 0),
        ),
      ),
      10,
    );
    expect(normalized.radiusVInches).toBeCloseTo(
      Math.hypot(
        ...(jaw.perimeter[8] ?? []).map(
          (value, axis) => value - (jaw.center[axis] ?? 0),
        ),
      ),
      10,
    );
    expect(normalized.radiusUInches).not.toBeCloseTo(
      normalized.radiusVInches,
      1,
    );
  });

  test("both sides grow and every intermediate thickness is accounted for once", () => {
    const layers = {
      supportInches: 1,
      backingInches: 0.5,
      adhesiveMm: 1,
      metalMm: 2,
      finishMm: 0.5,
      overlapMm: 2,
    };
    const stages = scaleSectionMeasurements("body-0", layers, 0.75);
    const baseline = stages[0];
    const final = stages.at(-1);
    if (!baseline || !final) throw new Error("Expected measurement stages.");
    const added = 1.5 + 5.5 / 25.4 + 0.75;
    expect(final.totalRadialInches).toBeCloseTo(added, 10);
    expect(final.widthInches - baseline.widthInches).toBeCloseTo(2 * added, 10);
    expect(final.depthInches - baseline.depthInches).toBeCloseTo(2 * added, 10);
    // Body ring 0 is circular to the precision exported by the archival GLB.
    expect(final.girthInches - baseline.girthInches).toBeCloseTo(
      2 * Math.PI * added,
      6,
    );
    for (let index = 1; index < stages.length; index++) {
      const current = stages[index];
      const previous = stages[index - 1];
      if (!current || !previous) throw new Error("Expected sequential stage.");
      expect(
        current.totalRadialInches - previous.totalRadialInches,
      ).toBeCloseTo(current.addedRadialInches, 10);
      expect(current.evidence).toBe("estimated");
    }
    expect(baseline.evidence).toBe("source-derived");
    expect(final.label).toContain("maximum");
  });

  test("zero layers and relief leave every modeled section unchanged", () => {
    for (const section of SOURCE_SCALE_SECTIONS) {
      const stages = scaleSectionMeasurements(section.id, noLayers, 0);
      const baseline = stages[0];
      for (const stage of stages) {
        expect(stage.widthInches).toBe(baseline?.widthInches ?? 0);
        expect(stage.depthInches).toBe(baseline?.depthInches ?? 0);
        expect(stage.girthInches).toBe(baseline?.girthInches ?? 0);
      }
    }
    expect(() => scaleSectionMeasurements("missing", noLayers, 0)).toThrow();
  });

  test("six-inch scale relief is kept as a maximum envelope rather than silently truncated", () => {
    const stages = scaleSectionMeasurements("body-5", noLayers, 6);
    expect(stages.at(-1)?.addedRadialInches).toBe(6);
    expect(stages.at(-1)?.totalRadialInches).toBe(6);
    expect(
      scaleSectionMeasurements("body-5", noLayers, Infinity).at(-1)
        ?.totalRadialInches,
    ).toBe(0);
    expect(
      scaleSectionMeasurements("body-5", noLayers, 100).at(-1)
        ?.totalRadialInches,
    ).toBe(6);
  });

  test("thin aluminum converts mm to inches without mixing local and whole-model dimensions", () => {
    const stages = scaleSectionMeasurements(
      "jaw-1",
      { ...noLayers, metalMm: 0.127 },
      0,
    );
    const first = stages[0];
    const final = stages.at(-1);
    if (!first || !final) throw new Error("Expected measurements.");
    expect(final.widthInches - first.widthInches).toBeCloseTo(0.01, 10);
    expect(ARCHIVAL_MODEL_DIMENSIONS).toEqual({
      width: 171,
      height: 206.3,
      depth: 171,
    });
  });

  test("body proportions change the bare section before fixed physical layers", () => {
    const layers = { ...noLayers, supportInches: 0.2, metalMm: 0.127 };
    const sourceSection = SOURCE_SCALE_SECTIONS[0];
    if (!sourceSection) throw new Error("Expected source section.");
    for (const [width, depth] of [
      [0.5, 2],
      [1.6, 0.7],
      [2, 0.5],
    ]) {
      const stages = scaleSectionMeasurements(
        "body-0",
        layers,
        0.25,
        0.35,
        width,
        depth,
      );
      const source = stages[0];
      const outer = stages.at(-1);
      if (!source || !outer) throw new Error("Expected stages.");
      expect(source.widthInches).toBeCloseTo(
        sourceSection.radiusUInches * 0.35 * (width ?? 1) * 2,
        10,
      );
      expect(source.depthInches).toBeCloseTo(
        sourceSection.radiusVInches * 0.35 * (depth ?? 1) * 2,
        10,
      );
      expect(outer.widthInches - source.widthInches).toBeCloseTo(0.91, 10);
      expect(outer.depthInches - source.depthInches).toBeCloseTo(0.91, 10);
      expect(outer.girthInches).toBeGreaterThan(source.girthInches);
    }
  });

  test("archival bounds use the actual deformed bare source supplied by the study", () => {
    const study: ScaleStudy = {
      modelId: "archival",
      modelScale: 0.35,
      bodyWidthScale: 1.8,
      bodyDepthScale: 0.7,
      bareSourceBounds: { width: 48, height: 69, depth: 11 },
      plates: [],
      triangleCount: 0,
      adjustedReliefCount: 0,
    };
    expect(scaleStudyBoundsComparison(study)).toEqual({
      source: { width: 48, height: 69, depth: 11 },
      scales: null,
    });
    expect(
      scaleStudyBoundsComparison({
        ...study,
        bareSourceBounds: { width: 51, height: 70, depth: 12 },
      }).source,
    ).toEqual({ width: 51, height: 70, depth: 12 });
  });

  test("resizing the source preserves physical layer and scale-face thickness", () => {
    const layers = { ...noLayers, supportInches: 0.2, metalMm: 0.127 };
    let previousWidth = 0;
    for (const scale of [0.02, 0.35, 1, 3, 30]) {
      const stages = scaleSectionMeasurements("body-0", layers, 0.25, scale);
      const source = stages[0];
      const final = stages.at(-1);
      if (!source || !final)
        throw new Error("Expected scaled measurement stages.");
      const sourceSection = SOURCE_SCALE_SECTIONS[0];
      if (!sourceSection) throw new Error("Expected source section.");
      expect(source.widthInches).toBeCloseTo(
        sourceSection.radiusUInches * 2 * scale,
        10,
      );
      expect(source.widthInches).toBeGreaterThan(previousWidth);
      expect(final.widthInches - source.widthInches).toBeCloseTo(2 * 0.455, 10);
      expect(final.depthInches - source.depthInches).toBeCloseTo(2 * 0.455, 10);
      expect(final.girthInches - source.girthInches).toBeCloseTo(
        2 * Math.PI * 0.455,
        6,
      );
      expect(
        stages.find((stage) => stage.id === "metalMm")?.addedRadialInches,
      ).toBeCloseTo(0.005, 10);
      previousWidth = source.widthInches;
    }
    expect(normalizeScaleModelScale(Number.NaN)).toBe(1);
    expect(normalizeScaleModelScale(-1)).toBe(0.02);
    expect(normalizeScaleModelScale(100)).toBe(30);
  });

  test("world bounds measure actual supplied vertices with source Y-up ordering", () => {
    expect(
      positionBounds([
        [1, -2, 3, 4, 6, 12],
        [-2, 1, -3],
      ]),
    ).toEqual({ width: 6, height: 8, depth: 15 });
    expect(positionBounds([])).toBeNull();
    expect(positionBounds([[]])).toBeNull();
    expect(() => positionBounds([[1, 2]])).toThrow();
    expect(() => positionBounds([[1, 2, Number.NaN]])).toThrow();
  });

  test("cladding bounds include raised top faces and sidewalls without adding the base", () => {
    const study = generateScaleStudy(DEFAULT_SCALE_STUDY_SETTINGS);
    const comparison = scaleStudyBoundsComparison(study);
    expect(comparison.scales).toEqual(
      positionBounds(
        study.plates.flatMap((plate) => [plate.positions, plate.edgePositions]),
      ),
    );
    expect(comparison.source?.depth).toBeLessThan(
      ARCHIVAL_MODEL_DIMENSIONS.depth,
    );
    expect(comparison.scales?.depth).toBeLessThan(
      ARCHIVAL_MODEL_DIMENSIONS.depth,
    );
    const empty = scaleStudyBoundsComparison({ ...study, plates: [] });
    expect(empty.scales).toBeNull();
    // Returned values cannot corrupt the memoized source bounds.
    if (!comparison.source) throw new Error("Expected source skin bounds.");
    comparison.source.width = -1;
    expect(scaleStudyBoundsComparison(study).source?.width).toBeGreaterThan(0);
  });

  test("archival bounds scale the source once and maquette bounds come only from its actual mesh", () => {
    const emptyArchival: ScaleStudy = {
      modelId: "archival",
      modelScale: 1,
      plates: [],
      triangleCount: 0,
      adjustedReliefCount: 0,
    };
    const original = scaleStudyBoundsComparison(emptyArchival).source;
    const resized = scaleStudyBoundsComparison({
      ...emptyArchival,
      modelScale: 0.35,
    }).source;
    if (!original || !resized) throw new Error("Expected archival baseline.");
    expect(resized.width).toBeCloseTo(original.width * 0.35, 10);
    expect(resized.height).toBeCloseTo(original.height * 0.35, 10);
    const maquette: ScaleStudy = {
      ...emptyArchival,
      modelId: "maquette",
      modelScale: 10,
      sourceGeometry: { positions: [0, 0, 0, 3, 5, 2], indices: [] },
    };
    // The loaded source has already been resized: never multiply it twice.
    expect(scaleStudyBoundsComparison(maquette).source).toEqual({
      width: 3,
      height: 5,
      depth: 2,
    });
    expect(
      scaleStudyBoundsComparison({ ...maquette, sourceGeometry: undefined })
        .source,
    ).toBeNull();
  });

  test("initial page can display allowance estimates without inventing generated dimensions", () => {
    const markup = renderToStaticMarkup(
      createElement(ScaleBuildUpPanel, {
        layers: DEFAULT_SCALE_BUILD_UP,
        onChange: () => {},
        study: null,
        reliefInches: 6,
        pending: true,
      }),
    );
    expect(markup).toContain("Scale dimensions pending");
    expect(markup).toContain("Model dimensions pending");
    expect(markup).toContain("unmeasured");
    expect(markup).toContain("Archival modeled section");
    expect(markup).toContain("including base");
    expect(markup).not.toContain("as-built measurement");
  });

  test("the maquette UI does not substitute archival rib sections or stale bounds", () => {
    const markup = renderToStaticMarkup(
      createElement(ScaleBuildUpPanel, {
        modelId: "maquette",
        modelScale: 10,
        layers: noLayers,
        onChange: () => {},
        study: {
          modelId: "archival",
          modelScale: 1,
          plates: [],
          triangleCount: 0,
          adjustedReliefCount: 0,
        },
        reliefInches: 0.1,
        pending: true,
      }),
    );
    expect(markup).not.toContain("Compare at this source section");
    expect(markup).not.toContain("<ellipse");
    expect(markup).toContain("Original solid print maquette");
    expect(markup).toContain("Model dimensions pending");
    expect(markup).toContain("archival ellipse and girth table do not apply");
  });
});
