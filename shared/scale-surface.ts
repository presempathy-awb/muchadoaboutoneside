import type { FoilMeshGeometry } from "../src/lib/foil-geometry";

export type Point2 = [number, number];
export type Vector3 = [number, number, number];
export interface SurfaceBounds {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}
interface SurfaceTriangle {
  points: [Vector3, Vector3, Vector3];
  uvs: [Point2, Point2, Point2];
  normals: [Vector3, Vector3, Vector3];
  bounds: SurfaceBounds;
}
export interface SurfacePatch {
  positions: number[];
  normals: number[];
  indices: number[];
  uvs: number[];
  edgePositions: number[];
  edgeIndices: number[];
  appliedReliefInches: number;
}

export const add = (a: Vector3, b: Vector3): Vector3 => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2],
];
export const subtract = (a: Vector3, b: Vector3): Vector3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
export const multiply = (a: Vector3, n: number): Vector3 => [
  a[0] * n,
  a[1] * n,
  a[2] * n,
];
export const dot = (a: Vector3, b: Vector3) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vector3, b: Vector3): Vector3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export function normalize(a: Vector3): Vector3 {
  const length = Math.hypot(...a);
  return length > 1e-12 ? multiply(a, 1 / length) : [0, 1, 0];
}
export const vectorAt = (values: ArrayLike<number>, i: number): Vector3 => [
  values[i * 3] ?? 0,
  values[i * 3 + 1] ?? 0,
  values[i * 3 + 2] ?? 0,
];
const cross2 = (a: Point2, b: Point2, c: Point2) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const BIN_U = 64;
const BIN_V = 24;
const bin = (value: number, count: number) =>
  Math.max(0, Math.min(count - 1, Math.floor(value * count)));

/** Clip without changing winding: source triangles are clockwise in UV. */
function clipToOutline(triangle: Point2[], outline: Point2[]): Point2[] {
  let polygon = triangle;
  for (let edge = 0; edge < outline.length && polygon.length; edge++) {
    const a = outline[edge];
    const b = outline[(edge + 1) % outline.length];
    if (!a || !b) continue;
    const clipped: Point2[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i];
      const q = polygon[(i + 1) % polygon.length];
      if (!p || !q) continue;
      const pDistance = cross2(a, b, p);
      const qDistance = cross2(a, b, q);
      if (pDistance >= -1e-14) clipped.push(p);
      if (pDistance < -1e-14 !== qDistance < -1e-14) {
        const t = pDistance / (pDistance - qDistance);
        clipped.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
    polygon = clipped;
  }
  return polygon;
}

function barycentric(point: Point2, triangle: SurfaceTriangle): Vector3 {
  const [a, b, c] = triangle.uvs;
  const determinant = cross2(a, b, c);
  const first = cross2(point, b, c) / determinant;
  const second = cross2(point, c, a) / determinant;
  return [first, second, 1 - first - second];
}

function interpolate(
  values: [Vector3, Vector3, Vector3],
  weights: Vector3,
): Vector3 {
  return add(
    add(multiply(values[0], weights[0]), multiply(values[1], weights[1])),
    multiply(values[2], weights[2]),
  );
}

/** A fixed UV index keeps clipping proportional to the covered surface area. */
export class ScaleSurface {
  private readonly triangles: SurfaceTriangle[] = [];
  private readonly bins: number[][] = Array.from(
    { length: BIN_U * BIN_V },
    () => [],
  );

  constructor(readonly mesh: FoilMeshGeometry) {
    // Equal face weights avoid large long triangles overwhelming cap normals.
    const normals = new Float64Array(mesh.positions.length);
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const a = mesh.indices[i] ?? 0;
      const b = mesh.indices[i + 1] ?? 0;
      const c = mesh.indices[i + 2] ?? 0;
      const normal = normalize(
        cross(
          subtract(vectorAt(mesh.positions, b), vectorAt(mesh.positions, a)),
          subtract(vectorAt(mesh.positions, c), vectorAt(mesh.positions, a)),
        ),
      );
      for (const vertex of [a, b, c]) {
        for (let axis = 0; axis < 3; axis++)
          normals[vertex * 3 + axis] =
            (normals[vertex * 3 + axis] ?? 0) + (normal[axis] ?? 0);
      }
    }
    // U=0 and U=1 are the same geometric seam, with separate texture vertices.
    for (
      let row = 0;
      mesh.verticesPerMeridian > 0 && row <= mesh.meridianCount;
      row++
    ) {
      const first = row * mesh.verticesPerMeridian;
      const last = first + mesh.verticesPerMeridian - 1;
      const normal = add(vectorAt(normals, first), vectorAt(normals, last));
      for (let axis = 0; axis < 3; axis++) {
        normals[first * 3 + axis] = normal[axis] ?? 0;
        normals[last * 3 + axis] = normal[axis] ?? 0;
      }
    }
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const ids = [
        mesh.indices[i] ?? 0,
        mesh.indices[i + 1] ?? 0,
        mesh.indices[i + 2] ?? 0,
      ] as const;
      const uvs = ids.map(
        (id) => [mesh.uvs[id * 2] ?? 0, mesh.uvs[id * 2 + 1] ?? 0] as Point2,
      ) as SurfaceTriangle["uvs"];
      if (cross2(...uvs) >= -1e-16) continue;
      const triangle: SurfaceTriangle = {
        points: ids.map((id) =>
          vectorAt(mesh.positions, id),
        ) as SurfaceTriangle["points"],
        uvs,
        normals: ids.map((id) =>
          normalize(vectorAt(normals, id)),
        ) as SurfaceTriangle["normals"],
        bounds: {
          u0: Math.min(...uvs.map(([u]) => u)),
          u1: Math.max(...uvs.map(([u]) => u)),
          v0: Math.min(...uvs.map(([, v]) => v)),
          v1: Math.max(...uvs.map(([, v]) => v)),
        },
      };
      const id = this.triangles.push(triangle) - 1;
      for (
        let v = bin(triangle.bounds.v0, BIN_V);
        v <= bin(triangle.bounds.v1, BIN_V);
        v++
      ) {
        for (
          let u = bin(triangle.bounds.u0, BIN_U);
          u <= bin(triangle.bounds.u1, BIN_U);
          u++
        )
          this.bins[v * BIN_U + u]?.push(id);
      }
    }
  }

  private candidates(bounds: SurfaceBounds): number[] {
    const found = new Set<number>();
    for (let v = bin(bounds.v0, BIN_V); v <= bin(bounds.v1, BIN_V); v++) {
      for (let u = bin(bounds.u0, BIN_U); u <= bin(bounds.u1, BIN_U); u++) {
        for (const id of this.bins[v * BIN_U + u] ?? []) found.add(id);
      }
    }
    return [...found];
  }

  sample(
    u: number,
    v: number,
    relief = 0,
  ): { position: Vector3; normal: Vector3 } {
    for (const id of this.bins[bin(v, BIN_V) * BIN_U + bin(u, BIN_U)] ?? []) {
      const triangle = this.triangles[id];
      if (!triangle) continue;
      const weights = barycentric([u, v], triangle);
      if (weights.every((weight) => weight >= -1e-9)) {
        const normal = normalize(interpolate(triangle.normals, weights));
        return {
          position: add(
            interpolate(triangle.points, weights),
            multiply(normal, relief),
          ),
          normal,
        };
      }
    }
    throw new Error("Scale sample is outside the nonsingular foil surface.");
  }

  arcLength(start: Point2, end: Point2, relief: number): number {
    const steps = Math.max(
      12,
      Math.ceil(
        Math.abs(end[0] - start[0]) * this.mesh.verticesPerMeridian * 3,
      ),
      Math.ceil(Math.abs(end[1] - start[1]) * this.mesh.meridianCount * 3),
    );
    let previous = this.sample(...start, relief).position;
    let length = 0;
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      const point = this.sample(
        start[0] + (end[0] - start[0]) * t,
        start[1] + (end[1] - start[1]) * t,
        relief,
      ).position;
      length += Math.hypot(...subtract(point, previous));
      previous = point;
    }
    return length;
  }

  conformingPatch(
    bounds: SurfaceBounds,
    outline: Point2[],
    requestedRelief: number,
  ): SurfacePatch {
    const globalOutline = outline.map(
      ([u, v]) =>
        [
          bounds.u0 + u * (bounds.u1 - bounds.u0),
          bounds.v0 + v * (bounds.v1 - bounds.v0),
        ] as Point2,
    );
    const base: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const vertices = new Map<string, number>();
    const vertex = (point: Point2, triangle: SurfaceTriangle) => {
      const u = Math.max(
        0,
        Math.min(1, (point[0] - bounds.u0) / (bounds.u1 - bounds.u0)),
      );
      const v = Math.max(
        0,
        Math.min(1, (point[1] - bounds.v0) / (bounds.v1 - bounds.v0)),
      );
      const key = `${Math.round(u * 1e9)}:${Math.round(v * 1e9)}`;
      const existing = vertices.get(key);
      if (existing !== undefined) return existing;
      const id = base.length / 3;
      const weights = barycentric(point, triangle);
      base.push(...interpolate(triangle.points, weights));
      normals.push(...normalize(interpolate(triangle.normals, weights)));
      uvs.push(u, v);
      vertices.set(key, id);
      return id;
    };
    for (const id of this.candidates(bounds)) {
      const triangle = this.triangles[id];
      if (
        !triangle ||
        triangle.bounds.u0 > bounds.u1 ||
        triangle.bounds.u1 < bounds.u0 ||
        triangle.bounds.v0 > bounds.v1 ||
        triangle.bounds.v1 < bounds.v0
      )
        continue;
      const polygon = clipToOutline(triangle.uvs, globalOutline);
      for (let i = 1; i < polygon.length - 1; i++) {
        const a = polygon[0];
        const b = polygon[i];
        const c = polygon[i + 1];
        if (!a || !b || !c || cross2(a, b, c) >= -1e-15) continue;
        const ia = vertex(a, triangle);
        const ib = vertex(b, triangle);
        const ic = vertex(c, triangle);
        if (ia !== ib && ib !== ic && ic !== ia) indices.push(ia, ib, ic);
      }
    }
    if (!indices.length)
      throw new Error("Scale footprint produced no surface triangles.");

    const displaced = (relief: number) =>
      base.map((value, index) => value + (normals[index] ?? 0) * relief);
    const safe = (positions: number[]) => {
      for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i] ?? 0;
        const b = indices[i + 1] ?? 0;
        const c = indices[i + 2] ?? 0;
        const originalArea = cross(
          subtract(vectorAt(base, b), vectorAt(base, a)),
          subtract(vectorAt(base, c), vectorAt(base, a)),
        );
        const area = cross(
          subtract(vectorAt(positions, b), vectorAt(positions, a)),
          subtract(vectorAt(positions, c), vectorAt(positions, a)),
        );
        if (dot(area, originalArea) <= dot(originalArea, originalArea) * 0.05)
          return false;
        const length = Math.hypot(...area);
        for (const corner of [a, b, c])
          if (dot(area, vectorAt(normals, corner)) <= length * 0.025)
            return false;
      }
      return true;
    };
    let appliedReliefInches = requestedRelief;
    let positions = displaced(appliedReliefInches);
    // One scalar per whole plate preserves its connected topology. Never flip
    // individual triangles to disguise an inverted or folded displacement.
    for (
      let attempt = 0;
      appliedReliefInches > 0 && !safe(positions);
      attempt++
    ) {
      appliedReliefInches = attempt < 12 ? appliedReliefInches / 2 : 0;
      positions = displaced(appliedReliefInches);
    }
    if (!safe(positions)) {
      throw new RangeError(
        "The layer allowance folds this surface at the selected model size. Reduce the intermediate-layer thickness or enlarge the model.",
      );
    }

    // Internal directed edges cancel. The remaining edges are the ACTUAL
    // clipped perimeter, including all source-tessellation intersections.
    const boundary = new Map<string, [number, number]>();
    for (let i = 0; i < indices.length; i += 3) {
      for (let side = 0; side < 3; side++) {
        const a = indices[i + side] ?? 0;
        const b = indices[i + ((side + 1) % 3)] ?? 0;
        const reverse = `${b}:${a}`;
        if (boundary.has(reverse)) boundary.delete(reverse);
        else boundary.set(`${a}:${b}`, [a, b]);
      }
    }
    const edgePositions: number[] = [];
    const edgeIndices: number[] = [];
    if (appliedReliefInches > 0) {
      for (const [a, b] of boundary.values()) {
        const start = edgePositions.length / 3;
        edgePositions.push(
          ...vectorAt(base, a),
          ...vectorAt(positions, a),
          ...vectorAt(base, b),
          ...vectorAt(positions, b),
        );
        edgeIndices.push(
          start,
          start + 2,
          start + 1,
          start + 2,
          start + 3,
          start + 1,
        );
      }
    }
    return {
      positions,
      normals,
      indices,
      uvs,
      edgePositions,
      edgeIndices,
      appliedReliefInches,
    };
  }
}
