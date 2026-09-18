import { describe, expect, test } from "bun:test";
import { MAX_SCAN_PIXELS } from "./calligraphy-scan";
import { planScanCrop, type ScanCropGeometry } from "./scan-crop-geometry";

const FULL = { left: 0, top: 0, right: 100, bottom: 100 };

function transform(plan: ScanCropGeometry, x: number, y: number) {
  const [a, b, c, d, e, f] = plan.transform;
  return [a * x + c * y + e, b * x + d * y + f];
}

describe("scan crop before analysis downsampling", () => {
  test("a small crop of a phone photograph retains native detail", () => {
    const full = planScanCrop(4000, 3000, 0, FULL);
    const selected = planScanCrop(4000, 3000, 0, {
      left: 25,
      top: 25,
      right: 75,
      bottom: 75,
    });
    expect(full.width).toBe(2309);
    expect(full.height).toBe(1732);
    expect(full.width * full.height).toBeLessThanOrEqual(MAX_SCAN_PIXELS);
    expect(selected).toMatchObject({
      width: 2000,
      height: 1500,
      scale: 1,
      crop: { x: 1000, y: 750, width: 2000, height: 1500 },
    });
    expect(selected.scale).toBeGreaterThan(full.scale);
    expect(transform(selected, 1000, 750)).toEqual([0, 0]);
    expect(transform(selected, 3000, 2250)).toEqual([2000, 1500]);
  });

  test("a full small image is neither resized nor translated", () => {
    const plan = planScanCrop(1000, 700, 0, FULL);
    expect(plan).toMatchObject({ width: 1000, height: 700, scale: 1 });
    expect(transform(plan, 0, 0)).toEqual([0, 0]);
    expect(transform(plan, 1000, 700)).toEqual([1000, 700]);
  });

  test("quarter turns use exact swapped bounds and rotate clockwise", () => {
    const right = planScanCrop(4000, 3000, 90, {
      left: 0,
      top: 0,
      right: 50,
      bottom: 50,
    });
    expect(right).toMatchObject({
      rotatedWidth: 3000,
      rotatedHeight: 4000,
      width: 1500,
      height: 2000,
      scale: 1,
    });
    expect(transform(right, 0, 3000)).toEqual([0, 0]);
    expect(transform(right, 2000, 1500)).toEqual([1500, 2000]);
    const left = planScanCrop(4000, 3000, -90, {
      left: 0,
      top: 0,
      right: 50,
      bottom: 50,
    });
    expect(transform(left, 4000, 0)).toEqual([0, 0]);
    expect(transform(left, 2000, 1500)).toEqual([1500, 2000]);
    const half = planScanCrop(100, 60, 180, FULL);
    expect(half.rotatedWidth).toBe(100);
    expect(half.rotatedHeight).toBe(60);
    expect(transform(half, 100, 60)).toEqual([0, 0]);
  });

  test("uses decoded EXIF dimensions, including portrait-oriented bitmaps", () => {
    const portrait = planScanCrop(3000, 4000, 90, FULL);
    expect(portrait.rotatedWidth).toBe(4000);
    expect(portrait.rotatedHeight).toBe(3000);
    expect(portrait.width / portrait.height).toBeCloseTo(4 / 3, 3);
  });

  test("arbitrary rotation keeps all corners inside a capped canvas with uniform scale", () => {
    for (const angle of [-137.5, -30, 33.3, 45, 179.9]) {
      const plan = planScanCrop(6000, 4000, angle, FULL);
      expect(plan.width * plan.height).toBeLessThanOrEqual(MAX_SCAN_PIXELS);
      expect(Math.max(plan.width, plan.height)).toBeLessThanOrEqual(4096);
      for (const [x, y] of [
        [0, 0],
        [6000, 0],
        [0, 4000],
        [6000, 4000],
      ]) {
        const [px = 0, py = 0] = transform(plan, x ?? 0, y ?? 0);
        expect(px).toBeGreaterThanOrEqual(-1e-9);
        expect(py).toBeGreaterThanOrEqual(-1e-9);
        expect(px).toBeLessThanOrEqual(plan.width + 1e-9);
        expect(py).toBeLessThanOrEqual(plan.height + 1e-9);
      }
      const [a, b, c, d] = plan.transform;
      expect(Math.hypot(a, b)).toBeCloseTo(plan.scale, 12);
      expect(Math.hypot(c, d)).toBeCloseTo(plan.scale, 12);
      expect(a * c + b * d).toBeCloseTo(0, 12);
    }
  });

  test("an arbitrary rotated crop maps its selected center to the canvas center", () => {
    const plan = planScanCrop(4000, 3000, 35, {
      left: 20,
      top: 30,
      right: 40,
      bottom: 60,
    });
    const x = plan.crop.x + plan.crop.width / 2 - plan.rotatedWidth / 2;
    const y = plan.crop.y + plan.crop.height / 2 - plan.rotatedHeight / 2;
    const angle = (35 * Math.PI) / 180;
    const sourceX = x * Math.cos(angle) + y * Math.sin(angle) + 2000;
    const sourceY = -x * Math.sin(angle) + y * Math.cos(angle) + 1500;
    const [px = 0, py = 0] = transform(plan, sourceX, sourceY);
    expect(px).toBeCloseTo(plan.width / 2, 9);
    expect(py).toBeCloseTo(plan.height / 2, 9);
    expect(plan.scale).toBe(1);
  });

  test("outward-rounded edge crops stay clamped and thin images obey the side cap", () => {
    const edge = planScanCrop(1001, 799, 0, {
      left: 99.99,
      top: 99.99,
      right: 100,
      bottom: 100,
    });
    expect(edge.crop).toEqual({ x: 1000, y: 798, width: 1, height: 1 });
    expect(edge.width).toBe(1);
    expect(edge.height).toBe(1);
    const thin = planScanCrop(12000, 1, 0, FULL);
    expect(thin.width).toBe(4096);
    expect(thin.height).toBe(1);
    expect(thin.scale).toBeLessThanOrEqual(1);
  });

  test("rejects invalid coordinates and unbounded dimensions before allocation", () => {
    for (const crop of [
      { ...FULL, left: -1 },
      { ...FULL, right: 101 },
      { ...FULL, top: Number.NaN },
      { ...FULL, bottom: Number.POSITIVE_INFINITY },
      { ...FULL, left: 50, right: 50 },
      { ...FULL, top: 90, bottom: 10 },
    ])
      expect(() => planScanCrop(100, 100, 0, crop)).toThrow("Crop edges");
    expect(() => planScanCrop(0, 100, 0, FULL)).toThrow("Decoded image");
    expect(() => planScanCrop(100.5, 100, 0, FULL)).toThrow("Decoded image");
    expect(() => planScanCrop(6001, 4000, 0, FULL)).toThrow("Decoded image");
    expect(() => planScanCrop(12001, 1, 0, FULL)).toThrow("Decoded image");
    for (const angle of [-181, 181, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => planScanCrop(100, 100, angle, FULL)).toThrow("Rotation");
  });
});
