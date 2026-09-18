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
      expect(atlas.width).toBeLessThanOrEqual(Math.min(2048, gpuLimit));
      expect(atlas.height).toBeLessThanOrEqual(Math.min(2048, gpuLimit));
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
