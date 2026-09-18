import { expect, test } from "bun:test";
import type { ScaleLetteringResult } from "../../shared/scale-lettering";
import { generateScaleStudy, type ScaleStudy } from "../../shared/scale-study";
import {
  planScaleAtlases,
  SCALE_ATLAS_MAX_COUNT,
  SCALE_ATLAS_MAX_PIXELS,
} from "./scale-atlas";

// Atlas packing is independent of surface generation and its body/jaw split.
const fixtureStudy = generateScaleStudy({
  columns: 24,
  rows: 2,
  surfaceMode: "planar",
});
function atlasStudy(count: number): ScaleStudy {
  const plate = fixtureStudy.plates[0];
  if (!plate) throw new Error("Expected a generated fixture plate");
  return {
    ...fixtureStudy,
    plates: Array.from({ length: count }, (_, index) => ({
      ...plate,
      id: `atlas-fixture-${index}`,
      widthInches: 10 + (index % 31),
      heightInches: 1 + (index % 5) / 2,
    })),
  };
}

function allLettered(
  study: ScaleStudy,
  fontSizeMm: number,
): ScaleLetteringResult {
  return {
    placements: study.plates.map((plate) => ({
      plateId: plate.id,
      lines: ["Words"],
      fontSizeMm,
    })),
    unplacedText: "",
    placedWordCount: study.plates.length,
    totalWordCount: study.plates.length,
  };
}

test("long physical faces receive rectangular texels with readable lettering", () => {
  const study = atlasStudy(1);
  study.plates = study.plates.slice(0, 1).map((plate) => ({
    ...plate,
    widthInches: 40,
    heightInches: 2,
  }));
  const plan = planScaleAtlases(study, allLettered(study, 16), true);
  expect(plan.minPixelsPerEm).toBeGreaterThanOrEqual(24);
  expect(plan.readable).toBe(true);
  const slot = plan.atlases[0]?.slots[0];
  expect(slot).toBeDefined();
  if (!slot) return;
  expect(slot.width / slot.height).toBeCloseTo(20, 0);
  expect(slot.width).toBeGreaterThan(1500);
});

test("atlas slots stay padded, bounded and non-overlapping at maximum plate count", () => {
  const study = atlasStudy(1200);
  const lettering = allLettered(study, 3);
  for (const gpuLimit of [512, 2048, 4096]) {
    const plan = planScaleAtlases(study, lettering, true, gpuLimit);
    expect(plan.atlases.length).toBeLessThanOrEqual(SCALE_ATLAS_MAX_COUNT);
    expect(plan.totalPixels).toBeLessThanOrEqual(SCALE_ATLAS_MAX_PIXELS);
    expect(plan.atlases.flatMap((atlas) => atlas.slots).length).toBe(
      study.plates.length,
    );
    const ids = new Set<string>();
    for (const atlas of plan.atlases) {
      expect(atlas.width).toBeLessThanOrEqual(Math.min(4096, gpuLimit));
      expect(atlas.height).toBeLessThanOrEqual(Math.min(4096, gpuLimit));
      for (const [index, slot] of atlas.slots.entries()) {
        expect(ids.has(slot.plateId)).toBe(false);
        ids.add(slot.plateId);
        expect(slot.x).toBeGreaterThanOrEqual(4);
        expect(slot.y).toBeGreaterThanOrEqual(4);
        expect(slot.x + slot.width + 4).toBeLessThanOrEqual(atlas.width);
        expect(slot.y + slot.height + 4).toBeLessThanOrEqual(atlas.height);
        for (const other of atlas.slots.slice(index + 1)) {
          expect(
            slot.x + slot.width + 8 <= other.x ||
              other.x + other.width + 8 <= slot.x ||
              slot.y + slot.height + 8 <= other.y ||
              other.y + other.height + 8 <= slot.y,
          ).toBe(true);
        }
      }
    }
    expect(plan).toEqual(planScaleAtlases(study, lettering, true, gpuLimit));
  }
});

test("crisp increases real ink resolution with 4096 pages and no physical lettering changes", () => {
  const study = atlasStudy(1);
  const plate = study.plates[0];
  if (!plate) throw new Error("Expected a fixture plate");
  plate.widthInches = 40;
  plate.heightInches = 2;
  const lettering = allLettered(study, 16);
  const unchanged = JSON.stringify({ study, lettering });
  const balanced = planScaleAtlases(study, lettering, true, 4096, {
    quality: "balanced",
    inkHeightEm: 0.391,
  });
  const crisp = planScaleAtlases(study, lettering, true, 4096, {
    quality: "crisp",
    inkHeightEm: 0.391,
  });
  expect(balanced.targetPixelsPerEm).toBe(24);
  expect(crisp.targetPixelsPerEm).toBe(64);
  expect(balanced.minPixelsPerEm).toBeGreaterThanOrEqual(24);
  expect(crisp.minPixelsPerEm).toBeGreaterThanOrEqual(64);
  expect(crisp.qualityLimited).toBe(false);
  expect(crisp.atlases.some((atlas) => atlas.width === 4096)).toBe(true);
  expect(crisp.minInkHeightPixels).toBeCloseTo(
    (crisp.minVerticalPixelsPerEm ?? 0) * 0.391,
    10,
  );
  expect(crisp.minInkHeightPixels).toBeGreaterThan(25);
  expect(balanced.minInkHeightPixels).toBeLessThan(10);
  expect(JSON.stringify({ study, lettering })).toBe(unchanged);
  expect(planScaleAtlases(study, lettering, true, 4096).targetPixelsPerEm).toBe(
    64,
  );
});

test("both quality modes respect memory and GPU limits and report actual fallback density", () => {
  const study = atlasStudy(1200);
  const lettering = allLettered(study, 3);
  for (const gpuLimit of [512, 2048, 4096, 8192]) {
    const balanced = planScaleAtlases(study, lettering, true, gpuLimit, {
      quality: "balanced",
    });
    const crisp = planScaleAtlases(study, lettering, true, gpuLimit, {
      quality: "crisp",
      inkHeightEm: 0.391,
    });
    expect(crisp.minPixelsPerEm ?? 0).toBeGreaterThanOrEqual(
      balanced.minPixelsPerEm ?? 0,
    );
    expect(crisp.qualityLimited).toBe(true);
    expect(crisp.minPixelsPerEm).toBeLessThan(crisp.targetPixelsPerEm);
    for (const plan of [balanced, crisp]) {
      const pixels = plan.atlases.reduce(
        (sum, atlas) => sum + atlas.width * atlas.height,
        0,
      );
      expect(plan.totalPixels).toBe(pixels);
      expect(pixels * 4).toBeLessThanOrEqual(64 * 1024 * 1024);
      expect(
        plan.atlases.every(
          (atlas) =>
            atlas.width <= Math.min(gpuLimit, 4096) &&
            atlas.height <= Math.min(gpuLimit, 4096),
        ),
      ).toBe(true);
      const densities = plan.atlases.flatMap((atlas) =>
        atlas.slots.map((slot) => {
          const plate = study.plates.find(
            (candidate) => candidate.id === slot.plateId,
          );
          if (!plate) throw new Error("Expected the planned plate");
          return [
            slot.width / ((plate.widthInches * 25.4) / 3),
            slot.height / ((plate.heightInches * 25.4) / 3),
          ] as const;
        }),
      );
      expect(plan.minPixelsPerEm).toBeCloseTo(
        Math.min(...densities.flat()),
        10,
      );
      expect(plan.minVerticalPixelsPerEm).toBeCloseTo(
        Math.min(...densities.map((density) => density[1])),
        10,
      );
    }
  }
});

test("measured ink reporting is optional and rejects invented or invalid heights", () => {
  const study = atlasStudy(1);
  const lettering = allLettered(study, 16);
  expect(
    planScaleAtlases(study, lettering, true).minInkHeightPixels,
  ).toBeNull();
  const hidden = planScaleAtlases(study, lettering, false, 4096, {
    inkHeightEm: 0.4,
  });
  expect(hidden.minInkHeightPixels).toBeNull();
  expect(hidden.minVerticalPixelsPerEm).toBeNull();
  expect(hidden.qualityLimited).toBe(false);
  for (const inkHeightEm of [0, -1, NaN, Infinity]) {
    expect(() =>
      planScaleAtlases(study, lettering, true, 4096, { inkHeightEm }),
    ).toThrow("Measured ink height");
  }
});

test("the readable threshold is attempted before reducing quality below 12 pixels per em", () => {
  const study = atlasStudy(342);
  study.plates = study.plates.map((plate) => ({
    ...plate,
    widthInches: 40,
    heightInches: 2,
  }));
  expect(study.plates.length).toBe(342);
  const plan = planScaleAtlases(study, allLettered(study, 16), true);
  expect(plan.readable).toBe(true);
  expect(plan.minPixelsPerEm).toBeGreaterThanOrEqual(12);
  expect(plan.totalPixels).toBeLessThanOrEqual(SCALE_ATLAS_MAX_PIXELS);
});

test("plain or hidden faces consume no texture budget and quality limitations are explicit", () => {
  const study = atlasStudy(8);
  const lettering = allLettered(study, 2);
  const hidden = planScaleAtlases(study, lettering, false);
  expect(hidden.atlases).toEqual([]);
  expect(hidden.totalPixels).toBe(0);
  expect(hidden.minPixelsPerEm).toBeNull();
  expect(hidden.plainPlateIds.length).toBe(study.plates.length);
  for (const placement of lettering.placements.slice(1)) placement.lines = [];
  const first = study.plates[0];
  if (!first) throw new Error("Expected a generated plate");
  first.widthInches = 1000;
  first.heightInches = 2;
  const limited = planScaleAtlases(study, lettering, true);
  expect(limited.atlases.flatMap((atlas) => atlas.slots).length).toBe(1);
  expect(limited.plainPlateIds.length).toBe(study.plates.length - 1);
  expect(limited.minPixelsPerEm).toBeLessThan(12);
  expect(limited.readable).toBe(false);
});
