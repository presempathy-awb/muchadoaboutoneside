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
