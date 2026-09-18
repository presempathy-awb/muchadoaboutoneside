import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ScaleReferenceComparison } from "../src/components/scale-reference-comparison";
import { scaleStudyBoundsComparison } from "./scale-measurements";
import { scalePlateProportions } from "./scale-proportions";
import { LEGACY_SCALE_SHAPE } from "./scale-shape";
import {
  DEFAULT_SCALE_STUDY_SETTINGS,
  generateScaleStudy,
} from "./scale-study";

test("plate ratios use physical spans and applied relief independently of display units", () => {
  const study = generateScaleStudy({
    ...DEFAULT_SCALE_STUDY_SETTINGS,
    columns: 12,
    rows: 2,
  });
  const plate = study.plates[0];
  if (!plate) throw new Error("Missing test plate");
  plate.uvs = [0, 0, 1, 0, 1, 1, 0, 1];
  study.plates = [
    { ...plate, widthInches: 4, heightInches: 2, appliedReliefInches: 0.2 },
    { ...plate, widthInches: 6, heightInches: 2, appliedReliefInches: 0.4 },
    { ...plate, widthInches: 0, heightInches: 1, appliedReliefInches: 1 },
  ];
  expect(scalePlateProportions(study)).toEqual({
    count: 2,
    medianAspect: 2.5,
    medianShortEdgeInches: 2,
    medianReliefRatio: 0.15000000000000002,
    middleAspectRange: [2.25, 2.75],
  });
  study.plates = [
    {
      ...plate,
      widthInches: 4,
      heightInches: 2,
      appliedReliefInches: 0.2,
      uvs: [0.25, 0.4, 0.75, 0.4, 0.75, 0.6, 0.25, 0.6],
    },
  ];
  const clipped = scalePlateProportions(study);
  expect(clipped?.medianAspect).toBeCloseTo(5);
  expect(clipped?.medianShortEdgeInches).toBeCloseTo(0.4);
  expect(clipped?.medianReliefRatio).toBeCloseTo(0.5);
  study.plates = [];
  expect(scalePlateProportions(study)).toBeNull();
});

test("reference shape brings the typical archival face closer to the short photo-like rectangle", () => {
  const legacy = generateScaleStudy({
    ...DEFAULT_SCALE_STUDY_SETTINGS,
    ...LEGACY_SCALE_SHAPE,
    relief: 0.65,
  });
  const current = generateScaleStudy(DEFAULT_SCALE_STUDY_SETTINGS);
  const before = scalePlateProportions(legacy);
  const after = scalePlateProportions(current);
  if (!before || !after) throw new Error("Missing generated proportions");
  expect(Math.abs(after.medianAspect - 1.3)).toBeLessThan(
    Math.abs(before.medianAspect - 1.3),
  );
  expect(after.medianAspect).toBeGreaterThanOrEqual(1.1);
  expect(after.medianAspect).toBeLessThanOrEqual(1.7);
  expect(after.medianReliefRatio).toBeGreaterThan(before.medianReliefRatio);
  expect(scaleStudyBoundsComparison(current).source).toEqual(
    scaleStudyBoundsComparison(legacy).source,
  );
});

test("photo comparison shows body bounds instead of the archival square base", () => {
  const study = generateScaleStudy(DEFAULT_SCALE_STUDY_SETTINGS);
  const markup = renderToStaticMarkup(
    createElement(ScaleReferenceComparison, { study, pending: true }),
  );
  expect(markup).toContain("Bare body + jaw, excluding base");
  expect(markup).toContain("32.68 D in");
  expect(markup).not.toContain("171 D in");
  expect(markup).toContain("previous completed shape");
  expect(markup).toContain("not a measured construction ratio");
  expect(markup).toContain("iani-sculpture-video-reference-01.png");
});
