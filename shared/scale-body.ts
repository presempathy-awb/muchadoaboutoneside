import sections from "./foil-sections.json";

type Point = [number, number, number];
const point = (values: number[]): Point => [
  values[0] ?? 0,
  values[1] ?? 0,
  values[2] ?? 0,
];
const subtract = (a: Point, b: Point): Point => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: Point): Point => {
  const length = Math.hypot(...a);
  return a.map((value) => value / length) as Point;
};
const interpolate = (a: Point, b: Point, t: number): Point =>
  a.map((value, i) => value + ((b[i] ?? 0) - value) * t) as Point;
function frame(source: { center: number[]; perimeter: number[][] }) {
  const center = point(source.center);
  return {
    center,
    u: unit(subtract(point(source.perimeter[0] ?? []), center)),
    v: unit(subtract(point(source.perimeter[8] ?? []), center)),
  };
}
// Head hardware must never choose the nearby tail at the sculpture crossing.
const chains = [
  [...sections.sections.slice(-2), ...sections.upperHeadSections],
  sections.jawSections,
].map((chain) => chain.map(frame));

/** Source-inch hardware position; local rib radii change while the head path stays fixed. */
export function deformArchivalHardwarePosition(
  position: Point,
  widthScale: number,
  depthScale: number,
): Point {
  if (widthScale === 1 && depthScale === 1) return [...position];
  let best: { center: Point; u: Point; v: Point } | undefined;
  let minimum = Infinity;
  for (const chain of chains) {
    for (let index = 0; index < chain.length - 1; index++) {
      const first = chain[index];
      const next = chain[index + 1];
      if (!first || !next) continue;
      const direction = subtract(next.center, first.center);
      const denominator = dot(direction, direction);
      const t =
        denominator > 0
          ? Math.max(
              0,
              Math.min(
                1,
                dot(subtract(position, first.center), direction) / denominator,
              ),
            )
          : 0;
      const center = interpolate(first.center, next.center, t);
      const delta = subtract(position, center);
      const distance = dot(delta, delta);
      if (distance >= minimum) continue;
      const u = unit(interpolate(first.u, next.u, t));
      const provisionalV = interpolate(first.v, next.v, t);
      const projection = dot(provisionalV, u);
      const v = unit(
        provisionalV.map(
          (value, axis) => value - projection * (u[axis] ?? 0),
        ) as Point,
      );
      best = { center, u, v };
      minimum = distance;
    }
  }
  if (!best) return [...position];
  const delta = subtract(position, best.center);
  const du = dot(delta, best.u) * (widthScale - 1);
  const dv = dot(delta, best.v) * (depthScale - 1);
  return position.map(
    (value, axis) =>
      value + du * (best.u[axis] ?? 0) + dv * (best.v[axis] ?? 0),
  ) as Point;
}
