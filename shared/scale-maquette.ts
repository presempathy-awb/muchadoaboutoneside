import data from "./scale-maquette.json";
import { fitScalePlateBounds, scalePlateOutline } from "./scale-shape";
import {
  normalizeScaleStudySettings,
  type ScalePlate,
  type ScaleStudy,
  type ScaleStudySettings,
} from "./scale-study";
import {
  add,
  cross,
  dot,
  multiply,
  normalize,
  type Point2,
  ScaleSurface,
  type SurfacePatch,
  subtract,
  vectorAt,
} from "./scale-surface";

const MM_PER_INCH = 25.4;
const pointAt = (values: number[], index: number): Point2 => [
  values[index * 2] ?? 0,
  values[index * 2 + 1] ?? 0,
];
const cross2 = (a: Point2, b: Point2, c: Point2) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

function randomForChart(id: string, seed: number) {
  let state = seed >>> 0;
  for (const character of id)
    state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function chartPartitions(
  count: number,
  variation: number,
  random: () => number,
) {
  const sizes = Array.from(
    { length: count },
    () => 1 + (random() - 0.5) * variation,
  );
  const total = sizes.reduce((sum, size) => sum + size, 0);
  let cursor = 0;
  return [
    0,
    ...sizes.map((size, index) => {
      cursor += size / total;
      return index === count - 1 ? 1 : cursor;
    }),
  ];
}

function connectedFaces(
  indices: number[],
  accept: (face: number, seed: number) => boolean = () => true,
): number[][] {
  const edgeFaces = new Map<string, number[]>();
  const adjacency = Array.from(
    { length: indices.length / 3 },
    () => new Set<number>(),
  );
  for (let face = 0; face < indices.length / 3; face++) {
    for (let edge = 0; edge < 3; edge++) {
      const a = indices[face * 3 + edge] ?? 0;
      const b = indices[face * 3 + ((edge + 1) % 3)] ?? 0;
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      const prior = edgeFaces.get(key) ?? [];
      for (const other of prior) {
        adjacency[face]?.add(other);
        adjacency[other]?.add(face);
      }
      prior.push(face);
      edgeFaces.set(key, prior);
    }
  }
  const pending = new Set(adjacency.map((_, index) => index));
  const groups: number[][] = [];
  while (pending.size) {
    const seed = pending.values().next().value;
    if (seed === undefined) break;
    pending.delete(seed);
    const queue = [seed];
    for (let cursor = 0; cursor < queue.length; cursor++) {
      for (const next of adjacency[queue[cursor] ?? 0] ?? []) {
        if (pending.has(next) && accept(next, seed)) {
          pending.delete(next);
          queue.push(next);
        }
      }
    }
    groups.push(queue);
  }
  return groups;
}

/** Return true connected pieces, never one plate spanning disjoint UV islands. */
function components(patch: SurfacePatch): SurfacePatch[] {
  const pieces: SurfacePatch[] = [];
  for (const queue of connectedFaces(patch.indices)) {
    const ids = new Map<number, number>();
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const face = queue[cursor] ?? 0;
      for (let corner = 0; corner < 3; corner++) {
        const original = patch.indices[face * 3 + corner] ?? 0;
        let id = ids.get(original);
        if (id === undefined) {
          id = ids.size;
          ids.set(original, id);
          positions.push(...vectorAt(patch.positions, original));
          normals.push(...vectorAt(patch.normals, original));
          uvs.push(...pointAt(patch.uvs, original));
        }
        indices.push(id);
      }
    }
    const piece: SurfacePatch = {
      positions,
      normals,
      indices,
      uvs,
      edgePositions: [],
      edgeIndices: [],
      appliedReliefInches: patch.appliedReliefInches,
    };
    for (const [a, b] of boundary(piece)) {
      const start = piece.edgePositions.length / 3;
      const topA = vectorAt(positions, a);
      const topB = vectorAt(positions, b);
      piece.edgePositions.push(
        ...subtract(
          topA,
          multiply(vectorAt(normals, a), patch.appliedReliefInches),
        ),
        ...topA,
        ...subtract(
          topB,
          multiply(vectorAt(normals, b), patch.appliedReliefInches),
        ),
        ...topB,
      );
      if (patch.appliedReliefInches > 0)
        piece.edgeIndices.push(
          start,
          start + 2,
          start + 1,
          start + 2,
          start + 3,
          start + 1,
        );
    }
    pieces.push(piece);
  }
  return pieces;
}

function boundary(patch: SurfacePatch): Array<[number, number]> {
  const edges = new Map<string, [number, number]>();
  for (let offset = 0; offset < patch.indices.length; offset += 3) {
    for (let side = 0; side < 3; side++) {
      const a = patch.indices[offset + side] ?? 0;
      const b = patch.indices[offset + ((side + 1) % 3)] ?? 0;
      if (!edges.delete(`${b}:${a}`)) edges.set(`${a}:${b}`, [a, b]);
    }
  }
  return [...edges.values()];
}

function outlineOf(patch: SurfacePatch): Point2[] {
  const edges = boundary(patch);
  const next = new Map(edges);
  const first = edges[0]?.[0];
  if (first === undefined) return [];
  const points: Point2[] = [];
  let vertex = first;
  do {
    points.push(pointAt(patch.uvs, vertex));
    const following = next.get(vertex);
    if (following === undefined) break;
    vertex = following;
  } while (vertex !== first && points.length <= edges.length);
  return points;
}

/** Every accepted grid cell is wholly inside one convex source triangle. */
export function maquetteWritingRect(
  patch: Pick<SurfacePatch, "uvs" | "indices">,
) {
  const triangles: Array<[Point2, Point2, Point2]> = [];
  let fallback = { x: 0.5, y: 0.5, width: 0, height: 0 };
  for (let offset = 0; offset < patch.indices.length; offset += 3) {
    const points = [0, 1, 2].map((corner) =>
      pointAt(patch.uvs, patch.indices[offset + corner] ?? 0),
    ) as [Point2, Point2, Point2];
    triangles.push(points);
    const center: Point2 = [
      points.reduce((sum, point) => sum + point[0], 0) / 3,
      points.reduce((sum, point) => sum + point[1], 0) / 3,
    ];
    let radius = 1;
    for (let edge = 0; edge < 3; edge++) {
      const a = points[edge];
      const b = points[(edge + 1) % 3];
      if (!a || !b) continue;
      radius = Math.min(
        radius,
        Math.abs(cross2(a, b, center)) /
          (Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1])),
      );
    }
    radius *= 0.99;
    if (4 * radius * radius > fallback.width * fallback.height)
      fallback = {
        x: center[0] - radius,
        y: center[1] - radius,
        width: radius * 2,
        height: radius * 2,
      };
  }
  const columns = 16;
  const rows = 12;
  const heights = Array.from({ length: columns }, () => 0);
  let best = fallback;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const corners: Point2[] = [
        [column / columns, row / rows],
        [(column + 1) / columns, row / rows],
        [(column + 1) / columns, (row + 1) / rows],
        [column / columns, (row + 1) / rows],
      ];
      const inside = triangles.some(([a, b, c]) =>
        corners.every(
          (point) =>
            cross2(a, b, point) <= 1e-12 &&
            cross2(b, c, point) <= 1e-12 &&
            cross2(c, a, point) <= 1e-12,
        ),
      );
      heights[column] = inside ? (heights[column] ?? 0) + 1 : 0;
      let minimum = heights[column] ?? 0;
      for (let start = column; start >= 0 && minimum > 0; start--) {
        minimum = Math.min(minimum, heights[start] ?? 0);
        const width = (column - start + 1) / columns;
        const height = minimum / rows;
        if (width * height > best.width * best.height)
          best = {
            x: start / columns,
            y: (row + 1 - minimum) / rows,
            width,
            height,
          };
      }
    }
  }
  // Clipping tolerances can leave microscopic UV slivers beyond an edge. Take
  // an intersection, never expand the proven writing region to fill the page.
  const x = Math.max(0, Math.min(1, best.x));
  const y = Math.max(0, Math.min(1, best.y));
  const right = Math.max(0, Math.min(1, best.x + best.width));
  const bottom = Math.max(0, Math.min(1, best.y + best.height));
  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
  };
}

function faceArea(positions: number[], indices: number[], face: number) {
  const a = vectorAt(positions, indices[face * 3] ?? 0);
  const b = vectorAt(positions, indices[face * 3 + 1] ?? 0);
  const c = vectorAt(positions, indices[face * 3 + 2] ?? 0);
  return cross(subtract(b, a), subtract(c, a));
}

function vertexNormals(positions: number[], indices: number[]) {
  const normals = new Float64Array(positions.length);
  for (let face = 0; face < indices.length / 3; face++) {
    const normal = normalize(faceArea(positions, indices, face));
    for (let corner = 0; corner < 3; corner++) {
      const id = indices[face * 3 + corner] ?? 0;
      normals.set(add(vectorAt(normals, id), normal), id * 3);
    }
  }
  for (let id = 0; id < normals.length / 3; id++)
    normals.set(normalize(vectorAt(normals, id)), id * 3);
  return normals;
}

/** Retain full stock thickness; a crease gets a real seam when it cannot offset. */
function supportedRegions(
  positions: number[],
  indices: number[],
  thickness: number,
): Array<{ positions: number[]; indices: number[] }> {
  const pending = [indices];
  const output: Array<{ positions: number[]; indices: number[] }> = [];
  while (pending.length) {
    const region = pending.pop();
    if (!region) break;
    const normals = vertexNormals(positions, region);
    const displaced = positions.map(
      (value, index) => value + (normals[index] ?? 0) * thickness,
    );
    const displacedNormals = vertexNormals(displaced, region);
    const rejected = new Set<number>();
    for (let face = 0; face < region.length / 3; face++) {
      const before = faceArea(positions, region, face);
      const after = faceArea(displaced, region, face);
      if (
        dot(before, after) <= dot(before, before) * 0.05 ||
        [0, 1, 2].some(
          (corner) =>
            dot(
              normalize(after),
              vectorAt(displacedNormals, region[face * 3 + corner] ?? 0),
            ) <= 0.025,
        )
      )
        rejected.add(face);
    }
    if (rejected.size === 0) {
      output.push({ positions: displaced, indices: region });
      continue;
    }
    // An individual planar triangle offsets exactly. Splitting only rejected
    // faces preserves the connected larger patches around boolean slivers.
    const retained: number[] = [];
    for (let face = 0; face < region.length / 3; face++) {
      const triangle = region.slice(face * 3, face * 3 + 3);
      if (rejected.has(face)) {
        const normal = normalize(faceArea(positions, triangle, 0));
        output.push({
          positions: positions.map(
            (value, index) => value + (normal[index % 3] ?? 0) * thickness,
          ),
          indices: triangle,
        });
      } else retained.push(...triangle);
    }
    for (const group of connectedFaces(retained))
      pending.push(
        group.flatMap((face) => retained.slice(face * 3, face * 3 + 3)),
      );
  }
  return output;
}

/** Conservative physical metric; reject materially stretched/sheared lettering. */
export function maquettePatchMetrics(
  patch: Pick<SurfacePatch, "positions" | "indices" | "uvs">,
) {
  let width = Number.POSITIVE_INFINITY;
  let height = Number.POSITIVE_INFINITY;
  let maxWidth = 0;
  let maxHeight = 0;
  let maxShear = 0;
  for (let offset = 0; offset < patch.indices.length; offset += 3) {
    const a = patch.indices[offset] ?? 0;
    const b = patch.indices[offset + 1] ?? 0;
    const c = patch.indices[offset + 2] ?? 0;
    const [au, av] = pointAt(patch.uvs, a);
    const [bu, bv] = pointAt(patch.uvs, b);
    const [cu, cv] = pointAt(patch.uvs, c);
    const determinant = (bu - au) * (cv - av) - (bv - av) * (cu - au);
    const ab = subtract(
      vectorAt(patch.positions, b),
      vectorAt(patch.positions, a),
    );
    const ac = subtract(
      vectorAt(patch.positions, c),
      vectorAt(patch.positions, a),
    );
    const du = multiply(
      subtract(multiply(ab, cv - av), multiply(ac, bv - av)),
      1 / determinant,
    );
    const dv = multiply(
      subtract(multiply(ac, bu - au), multiply(ab, cu - au)),
      1 / determinant,
    );
    const w = Math.hypot(...du);
    const h = Math.hypot(...dv);
    width = Math.min(width, w);
    height = Math.min(height, h);
    maxWidth = Math.max(maxWidth, w);
    maxHeight = Math.max(maxHeight, h);
    maxShear = Math.max(maxShear, Math.abs(dot(du, dv)) / (w * h));
  }
  return {
    widthInches: width,
    heightInches: height,
    suitableForLettering:
      Number.isFinite(width + height) &&
      width > 0 &&
      height > 0 &&
      maxWidth / width <= 1.05 &&
      maxHeight / height <= 1.05 &&
      maxShear <= 0.03,
  };
}

/** Actual 180mm print mesh, with connected unfold charts; lazy-load this module. */
export function generateMaquetteScaleStudy(
  input: ScaleStudySettings,
): ScaleStudy {
  // The exact print adapter is conforming; the UI disables archival planar mode.
  const settings = normalizeScaleStudySettings({
    ...input,
    modelId: "maquette",
    surfaceMode: "conforming",
  });
  const factor = settings.modelScale / MM_PER_INCH;
  const positions = data.positionsMm.map((value) => value * factor);
  const area = data.charts.reduce(
    (sum, chart) => sum + chart.widthMm * chart.heightMm,
    0,
  );
  const desired = settings.columns * settings.rows;
  const plates: ScalePlate[] = [];
  let adjustedReliefCount = 0;
  let unletterablePlateCount = 0;
  let triangleCount = 0;
  for (const chart of data.charts) {
    const portion = Math.max(
      1,
      (desired * chart.widthMm * chart.heightMm) / area,
    );
    const aspect =
      (chart.widthMm / chart.heightMm) *
      (settings.columns / settings.rows / 30);
    const nx = Math.max(
      1,
      Math.min(24, Math.ceil(portion), Math.round(Math.sqrt(portion * aspect))),
    );
    const ny = Math.max(1, Math.min(12, Math.round(portion / nx)));
    const random = randomForChart(chart.id, settings.seed);
    const courseU = chartPartitions(nx, settings.variation, random);
    const courseV = chartPartitions(ny, settings.variation, random);
    const chartPositions = chart.vertices.flatMap((id) =>
      vectorAt(positions, id),
    );
    const faceNormals = Array.from(
      { length: chart.indices.length / 3 },
      (_, face) => {
        const a = vectorAt(chartPositions, chart.indices[face * 3] ?? 0);
        const b = vectorAt(chartPositions, chart.indices[face * 3 + 1] ?? 0);
        const c = vectorAt(chartPositions, chart.indices[face * 3 + 2] ?? 0);
        return normalize(cross(subtract(b, a), subtract(c, a)));
      },
    );
    // A <=40-degree normal cone guarantees every averaged vertex normal is
    // outward to all its faces. Sharp boolean/base corners receive real seams.
    const regions = connectedFaces(
      chart.indices,
      (face, seed) =>
        dot(faceNormals[face] ?? [0, 1, 0], faceNormals[seed] ?? [0, 1, 0]) >=
        Math.cos((40 * Math.PI) / 180),
    );
    const supported = regions.flatMap((region) =>
      supportedRegions(
        chartPositions,
        region.flatMap((face) => chart.indices.slice(face * 3, face * 3 + 3)),
        settings.supportOffsetInches,
      ),
    );
    for (const [regionIndex, region] of supported.entries()) {
      const surface = new ScaleSurface({
        positions: region.positions,
        indices: region.indices,
        uvs: chart.uvs,
        readingLoopLengthInches: chart.widthMm * factor,
        seamNotes: [],
        meridianCount: -1,
        verticesPerMeridian: 0,
      });
      for (let row = 0; row < ny; row++) {
        for (let column = 0; column < nx; column++) {
          const inset = settings.gap / 2;
          const u0 = courseU[column] ?? 0;
          const u1 = courseU[column + 1] ?? 1;
          const v0 = courseV[row] ?? 0;
          const v1 = courseV[row + 1] ?? 1;
          let bounds = {
            u0: u0 + (u1 - u0) * inset,
            u1: u1 - (u1 - u0) * inset,
            v0: v0 + (v1 - v0) * inset,
            v1: v1 - (v1 - v0) * inset,
          };
          if (settings.plateAspect > 0) {
            // Chart UVs use its physical planar axes; a region may not cover
            // the cell center, so measuring with surface.sample is invalid.
            bounds = fitScalePlateBounds(
              bounds,
              (bounds.u1 - bounds.u0) * chart.widthMm * factor,
              (bounds.v1 - bounds.v0) * chart.heightMm * factor,
              settings.plateAspect,
            );
          }
          const outline: Point2[] =
            settings.plateShape === "legacy"
              ? [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                  [0, 1],
                ]
              : scalePlateOutline(settings, random);
          const requestedRelief =
            settings.relief * (1 - settings.variation * random() * 0.45);
          let patch: SurfacePatch;
          try {
            patch = surface.conformingPatch(bounds, outline, requestedRelief);
          } catch (error) {
            if (
              error instanceof Error &&
              error.message === "Scale footprint produced no surface triangles."
            )
              continue;
            throw error;
          }
          for (const [pieceIndex, piece] of components(patch).entries()) {
            if (piece.appliedReliefInches < requestedRelief - 1e-8)
              adjustedReliefCount++;
            const metrics = maquettePatchMetrics(piece);
            const safeRect = metrics.suitableForLettering
              ? maquetteWritingRect(piece)
              : { x: 0, y: 0, width: 0, height: 0 };
            if (!metrics.suitableForLettering) unletterablePlateCount++;
            plates.push({
              id: `maquette-${chart.id}-${regionIndex}-${row}-${column}-${pieceIndex}`,
              surface: "body",
              row,
              column,
              outline: outlineOf(piece),
              ...piece,
              widthInches: metrics.widthInches,
              heightInches: metrics.heightInches,
              safeRect,
              sourceBounds: bounds,
            });
            triangleCount +=
              (piece.indices.length + piece.edgeIndices.length) / 3;
            if (plates.length > 6000 || triangleCount > 100000)
              throw new RangeError(
                "This print study exceeds the interactive geometry budget. Reduce plate density or layer thickness, or increase the model size.",
              );
          }
        }
      }
    }
  }
  return {
    modelId: "maquette",
    modelScale: settings.modelScale,
    sourceGeometry: { positions, indices: [...data.indices] },
    plates,
    triangleCount,
    adjustedReliefCount,
    unletterablePlateCount,
  };
}
