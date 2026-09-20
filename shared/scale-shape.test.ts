import { describe, expect, test } from "bun:test";
import {
  DEFAULT_SCALE_SHAPE,
  fitScalePlateBounds,
  LEGACY_SCALE_SHAPE,
  normalizeScaleShapeSettings,
  scalePlateOutline,
  scalePlateSafeRect,
} from "./scale-shape";
import type { Point2 } from "./scale-surface";

const cross = (a: Point2, b: Point2, c: Point2) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
describe("convex scale silhouettes", () => {
  test("missing saved settings retain legacy while malformed explicit controls are bounded", () => {
    expect(normalizeScaleShapeSettings({})).toEqual(LEGACY_SCALE_SHAPE);
    expect(
      normalizeScaleShapeSettings({ plateShape: { toString: () => "diamond" } })
        .plateShape,
    ).toBe("legacy");
    expect(
      normalizeScaleShapeSettings({
        plateShape: "unknown",
        plateAspect: NaN,
        cornerCut: Infinity,
        plateTaper: NaN,
      }),
    ).toEqual(LEGACY_SCALE_SHAPE);
    expect(
      normalizeScaleShapeSettings({
        plateShape: "diamond",
        plateAspect: 100,
        cornerCut: -1,
        plateTaper: -3,
      }),
    ).toEqual({
      plateShape: "diamond",
      plateFit: "inset",
      plateAspect: 2.5,
      cornerCut: 0,
      plateTaper: -0.4,
    });
    expect(
      normalizeScaleShapeSettings(
        DEFAULT_SCALE_SHAPE as unknown as Record<string, unknown>,
      ),
    ).toEqual(DEFAULT_SCALE_SHAPE);
  });
  test("all control extremes are convex and contain their safe lettering rectangle", () => {
    for (const plateShape of [
      "legacy",
      "clipped",
      "rectangle",
      "diamond",
    ] as const)
      for (const cornerCut of [0, 0.12, 0.3])
        for (const plateTaper of [-0.4, 0, 0.4])
          for (const variation of [0, 0.6, 1])
            for (const sample of [0, 0.5, 1]) {
              const outline = scalePlateOutline(
                {
                  ...DEFAULT_SCALE_SHAPE,
                  plateShape,
                  cornerCut,
                  plateTaper,
                  variation,
                },
                () => sample,
              );
              const rect = scalePlateSafeRect(outline);
              expect(rect.width).toBeGreaterThan(0);
              for (let i = 0; i < outline.length; i++) {
                expect(
                  cross(
                    required(outline[i]),
                    required(outline[(i + 1) % outline.length]),
                    required(outline[(i + 2) % outline.length]),
                  ),
                ).toBeGreaterThan(0);
                for (const point of [
                  [0.5, 0.5],
                  [rect.x, rect.y],
                  [rect.x + rect.width, rect.y],
                  [rect.x + rect.width, rect.y + rect.height],
                  [rect.x, rect.y + rect.height],
                ] as Point2[])
                  expect(
                    cross(
                      required(outline[i]),
                      required(outline[(i + 1) % outline.length]),
                      point,
                    ),
                  ).toBeGreaterThanOrEqual(-1e-10);
              }
            }
  });
  test("legacy outlines use the exact four original random corner draws", () => {
    const values = [0.1, 0.2, 0.3, 0.4];
    let index = 0;
    const outline = scalePlateOutline(
      { ...LEGACY_SCALE_SHAPE, variation: 0.6 },
      () => required(values[index++]),
    );
    const [lt, rt, rb, lb] = values.map((x) => 0.055 + 0.6 * x * 0.13);
    expect(index).toBe(4);
    expect(outline).toEqual([
      [required(lt), 0],
      [1 - required(rt), 0],
      [1, required(rt)],
      [1, 1 - required(rb)],
      [1 - required(rb), 1],
      [required(lb), 1],
      [0, 1 - required(lb)],
      [0, required(lt)],
    ]);
  });
  test("clipped wood plates keep an eight-sided outline", () => {
    expect(
      scalePlateOutline({ ...DEFAULT_SCALE_SHAPE, variation: 0 }, () => 0.5),
    ).toHaveLength(8);
  });
  test("physical aspect fitting only shrinks disjoint cells and retains their centers", () => {
    const bounds = { u0: 0.1, u1: 0.9, v0: 0.2, v1: 0.8 };
    expect(fitScalePlateBounds(bounds, 10, 2, 0)).toBe(bounds);
    for (const aspect of [0.5, 1.3, 2.5]) {
      const fit = fitScalePlateBounds(bounds, 10, 2, aspect);
      expect(fit.u0).toBeGreaterThanOrEqual(bounds.u0);
      expect(fit.u1).toBeLessThanOrEqual(bounds.u1);
      expect(fit.v0).toBeGreaterThanOrEqual(bounds.v0);
      expect(fit.v1).toBeLessThanOrEqual(bounds.v1);
      expect(
        (((fit.u1 - fit.u0) / 0.8) * 10) / (((fit.v1 - fit.v0) / 0.6) * 2),
      ).toBeCloseTo(aspect, 10);
    }
  });
});

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Missing test fixture value.");
  return value;
}
