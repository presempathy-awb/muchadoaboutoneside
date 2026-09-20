import { describe, expect, test } from "bun:test";
import {
  DEFAULT_SCALE_STUDY_SETTINGS,
  generateScaleStudy,
} from "../../shared/scale-study";
import {
  estimateScaleStudyBytes,
  ScaleStudyCache,
  scaleStudyCacheKey,
} from "./scale-study-cache";

const settings = { ...DEFAULT_SCALE_STUDY_SETTINGS, columns: 4, rows: 2 };
const study = generateScaleStudy(settings);

describe("bounded recent geometry cache", () => {
  test("uses every physical setting and ignores object property order", () => {
    const cache = new ScaleStudyCache();
    cache.set(settings, study);
    expect(cache.get({ ...settings })).toBe(study);
    const reordered = Object.fromEntries(
      Object.entries(settings).reverse(),
    ) as typeof settings;
    expect(scaleStudyCacheKey(reordered)).toBe(scaleStudyCacheKey(settings));
    for (const [key, value] of Object.entries(settings)) {
      const changed = {
        ...settings,
        [key]: typeof value === "number" ? value + 1 : `${value}-changed`,
      };
      expect(cache.get(changed)).toBeUndefined();
    }
    expect(cache.get({ ...settings, modelScale: Infinity })).toBeUndefined();
  });

  test("evicts the least recently used shape while retaining current hits", () => {
    const cache = new ScaleStudyCache(2);
    cache.set(settings, study);
    cache.set({ ...settings, seed: 2 }, study);
    expect(cache.get(settings)).toBe(study);
    cache.set({ ...settings, seed: 3 }, study);
    expect(cache.size).toBe(2);
    expect(cache.get({ ...settings, seed: 2 })).toBeUndefined();
    expect(cache.get(settings)).toBe(study);
  });

  test("builds distinct body shapes and reuses a revisited shape", () => {
    const cache = new ScaleStudyCache();
    const wider = { ...settings, bodyWidthScale: 1.25 };
    const deeper = { ...settings, bodyDepthScale: 1.25 };
    cache.set(settings, study);
    expect(cache.get(wider)).toBeUndefined();
    expect(cache.get(deeper)).toBeUndefined();
    const wideStudy = generateScaleStudy(wider);
    const deepStudy = generateScaleStudy(deeper);
    expect(wideStudy.bareSourceBounds).not.toEqual(study.bareSourceBounds);
    expect(deepStudy.bareSourceBounds).not.toEqual(study.bareSourceBounds);
    cache.set(wider, wideStudy);
    cache.set(deeper, deepStudy);
    expect(cache.size).toBe(3);
    expect(cache.get({ ...wider })).toBe(wideStudy);
    expect(cache.get({ ...deeper })).toBe(deepStudy);
    expect(cache.get({ ...settings })).toBe(study);
  });

  test("close-set archival body edits keep the immediately preceding study", () => {
    const cache = new ScaleStudyCache();
    const linked = {
      ...DEFAULT_SCALE_STUDY_SETTINGS,
      bodyWidthScale: 1.1,
      bodyDepthScale: 1.1,
    };
    const independent = {
      ...DEFAULT_SCALE_STUDY_SETTINGS,
      bodyWidthScale: 1.1,
      bodyDepthScale: 0.9,
    };
    const linkedStudy = generateScaleStudy(linked);
    const independentStudy = generateScaleStudy(independent);
    expect(estimateScaleStudyBytes(linkedStudy)).toBeGreaterThan(
      32 * 1024 * 1024,
    );
    cache.set(linked, linkedStudy);
    cache.set(independent, independentStudy);
    expect(cache.size).toBe(2);
    expect(cache.get(linked)).toBe(linkedStudy);
    expect(cache.get(independent)).toBe(independentStudy);
  }, 15000);

  test("bounds retained array memory and does not accumulate replaced entries", () => {
    const bytes = estimateScaleStudyBytes(study);
    const cache = new ScaleStudyCache(8, bytes);
    cache.set(settings, study);
    cache.set(settings, study);
    expect(cache.retainedBytes).toBe(bytes);
    cache.set({ ...settings, seed: 2 }, study);
    expect(cache.size).toBe(1);
    expect(cache.retainedBytes).toBe(bytes);
    expect(cache.get(settings)).toBeUndefined();
    const tiny = new ScaleStudyCache(4, bytes - 1);
    tiny.set(settings, study);
    expect(tiny.size).toBe(0);
    expect(tiny.retainedBytes).toBe(0);
  });
});
