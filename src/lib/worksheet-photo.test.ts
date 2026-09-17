import { describe, expect, test } from "bun:test";
import {
  approximateFontSizePt,
  calibrationMmPerPixel,
  clampFinite,
  dataUrlByteLength,
  fitImageDimensions,
  measurementMm,
  pointDistance,
} from "./worksheet-photo";

describe("worksheet photo measurements", () => {
  test("calibrates a known physical length and measures x-height", () => {
    const first = { x: 10, y: 20 };
    const second = { x: 310, y: 420 };
    expect(pointDistance(first, second)).toBe(500);

    const scale = calibrationMmPerPixel(first, second, 100);
    expect(scale).toBe(0.2);
    expect(measurementMm({ x: 20, y: 10 }, { x: 20, y: 35 }, scale ?? 0)).toBe(
      5,
    );
    expect(approximateFontSizePt(5)).toBeCloseTo(28.346, 3);
  });

  test("rejects zero, negative, and non-finite measurements", () => {
    const point = { x: 2, y: 3 };
    expect(calibrationMmPerPixel(point, point, 10)).toBeUndefined();
    expect(
      calibrationMmPerPixel(point, { x: 3, y: 3 }, Number.NaN),
    ).toBeUndefined();
    expect(
      calibrationMmPerPixel(point, { x: Number.POSITIVE_INFINITY, y: 3 }, 10),
    ).toBeUndefined();
    expect(measurementMm(point, { x: 3, y: 3 }, 0)).toBeUndefined();
    expect(approximateFontSizePt(Number.POSITIVE_INFINITY)).toBeUndefined();
  });

  test("fits large images without enlarging small ones", () => {
    expect(fitImageDimensions(4000, 2000)).toEqual({
      width: 1800,
      height: 900,
    });
    expect(fitImageDimensions(800, 1200)).toEqual({ width: 800, height: 1200 });
    expect(() => fitImageDimensions(0, 1200)).toThrow();
    expect(() => fitImageDimensions(Number.POSITIVE_INFINITY, 1200)).toThrow();
  });

  test("clamps finite settings and computes base64 payload size", () => {
    expect(clampFinite(12, 0, 10)).toBe(10);
    expect(clampFinite(Number.NaN, 2, 4)).toBe(2);
    const dataUrl = "data:image/png;base64,YWJjZA==";
    expect(dataUrlByteLength(dataUrl)).toBe(dataUrl.length);
  });
});
