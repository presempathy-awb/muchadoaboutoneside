import type { Point2, SurfaceBounds } from "./scale-surface";

export type ScalePlateShape = "legacy" | "clipped" | "rectangle" | "diamond";
export interface ScaleShapeSettings {
  plateShape: ScalePlateShape;
  /** Physical face width / height; zero preserves the original cell. */
  plateAspect: number;
  cornerCut: number;
  plateTaper: number;
}
export const DEFAULT_SCALE_SHAPE: ScaleShapeSettings = {
  plateShape: "clipped",
  plateAspect: 1.3,
  cornerCut: 0.12,
  plateTaper: 0.12,
};
export const LEGACY_SCALE_SHAPE: ScaleShapeSettings = {
  plateShape: "legacy",
  plateAspect: 0,
  cornerCut: 0.055,
  plateTaper: 0,
};
const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));
const finite = (n: unknown, fallback: number) =>
  typeof n === "number" && Number.isFinite(n) ? n : fallback;

/** Missing fields preserve studies saved before adjustable silhouettes existed. */
export function normalizeScaleShapeSettings(
  input: Record<string, unknown>,
): ScaleShapeSettings {
  const aspect = finite(input.plateAspect, 0);
  return {
    plateShape:
      input.plateShape === "clipped" ||
      input.plateShape === "rectangle" ||
      input.plateShape === "diamond"
        ? input.plateShape
        : "legacy",
    plateAspect: aspect === 0 ? 0 : clamp(aspect, 0.5, 2.5),
    cornerCut: clamp(
      finite(input.cornerCut, LEGACY_SCALE_SHAPE.cornerCut),
      0,
      0.3,
    ),
    plateTaper: clamp(finite(input.plateTaper, 0), -0.4, 0.4),
  };
}

/** Convex, center-containing footprints. Legacy consumes the original four RNG draws. */
export function scalePlateOutline(
  settings: ScaleShapeSettings & { variation?: number },
  random: () => number,
): Point2[] {
  const variation = clamp(settings.variation ?? 0, 0, 1);
  if (settings.plateShape === "legacy") {
    const bevel = () => 0.055 + variation * random() * 0.13;
    const lt = bevel(),
      rt = bevel(),
      rb = bevel(),
      lb = bevel();
    return [
      [lt, 0],
      [1 - rt, 0],
      [1, rt],
      [1, 1 - rb],
      [1 - rb, 1],
      [lb, 1],
      [0, 1 - lb],
      [0, lt],
    ];
  }
  if (settings.plateShape === "diamond")
    return [
      [0.5, 0],
      [1, 0.5],
      [0.5, 1],
      [0, 0.5],
    ];
  const taper = clamp(settings.plateTaper, -0.4, 0.4);
  const top = Math.max(0, taper),
    bottom = Math.max(0, -taper);
  const corners: Point2[] = [
    [top, 0],
    [1 - top, 0],
    [1 - bottom, 1],
    [bottom, 1],
  ];
  if (settings.plateShape === "rectangle" || settings.cornerCut === 0)
    return corners;
  const result: Point2[] = [];
  for (let i = 0; i < 4; i++) {
    const current = corners[i];
    const previous = corners[(i + 3) % 4];
    const next = corners[(i + 1) % 4];
    if (!current || !previous || !next)
      throw new Error("Incomplete scale corners.");
    // Cutting equal fractions along the incident edges cannot break convexity.
    const cut = clamp(
      settings.cornerCut * (1 + variation * (random() - 0.5)),
      0,
      0.3,
    );
    result.push(
      [
        current[0] + (previous[0] - current[0]) * cut,
        current[1] + (previous[1] - current[1]) * cut,
      ],
      [
        current[0] + (next[0] - current[0]) * cut,
        current[1] + (next[1] - current[1]) * cut,
      ],
    );
  }
  return result;
}

/** Largest centered square whose four corners satisfy every convex half-plane. */
export function scalePlateSafeRect(outline: Point2[]) {
  if (outline.length < 3) return { x: 0, y: 0, width: 0, height: 0 };
  const inside = (x: number, y: number) =>
    outline.every((a, i) => {
      const b = outline[(i + 1) % outline.length] ?? a;
      return (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) >= -1e-12;
    });
  let lo = 0,
    hi = 0.5;
  for (let i = 0; i < 40; i++) {
    const radius = (lo + hi) / 2;
    if (
      [-1, 1].every((x) =>
        [-1, 1].every((y) => inside(0.5 + x * radius, 0.5 + y * radius)),
      )
    )
      lo = radius;
    else hi = radius;
  }
  const radius = Math.max(0, lo - 1e-8);
  return {
    x: 0.5 - radius,
    y: 0.5 - radius,
    width: 2 * radius,
    height: 2 * radius,
  };
}

/** Fit physical width/height by shrinking inside its disjoint original cell. */
export function fitScalePlateBounds(
  bounds: SurfaceBounds,
  widthInches: number,
  heightInches: number,
  aspect: number,
): SurfaceBounds {
  if (!(aspect > 0) || !(widthInches > 0) || !(heightInches > 0)) return bounds;
  const widthFactor = Math.min(1, (aspect * heightInches) / widthInches);
  const heightFactor = Math.min(1, widthInches / (aspect * heightInches));
  const u = (bounds.u0 + bounds.u1) / 2,
    v = (bounds.v0 + bounds.v1) / 2;
  const du = ((bounds.u1 - bounds.u0) * widthFactor) / 2,
    dv = ((bounds.v1 - bounds.v0) * heightFactor) / 2;
  return {
    u0: Math.max(bounds.u0, u - du),
    u1: Math.min(bounds.u1, u + du),
    v0: Math.max(bounds.v0, v - dv),
    v1: Math.min(bounds.v1, v + dv),
  };
}
