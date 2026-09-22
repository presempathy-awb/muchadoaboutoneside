import {
  type FoilGeometry,
  type FoilMeshGeometry,
  generateFoilGeometry,
} from "../src/lib/foil-geometry";
import {
  DEFAULT_SCALE_SHAPE,
  fitScalePlateBounds,
  normalizeScaleShapeSettings,
  type ScaleShapeSettings,
  scalePlateOutline,
  scalePlateSafeRect,
} from "./scale-shape";
import {
  add,
  cross,
  dot,
  multiply,
  normalize,
  type Point2,
  ScaleSurface,
  type SurfaceBounds,
  type SurfacePatch,
  subtract,
} from "./scale-surface";

export interface ScaleStudySettings extends ScaleShapeSettings {
  modelId: "archival" | "maquette";
  /** Uniform physical size of the frame; stock thickness stays in real inches. */
  modelScale: number;
  /** Local rib semiaxes; centerline and physical stock thickness stay fixed. */
  bodyWidthScale: number;
  bodyDepthScale: number;
  /** Longitudinal density target; cover redistributes columns × rows cells. */
  columns: number;
  /** Course density target; cover selects physical aspect with the same budget. */
  rows: number;
  /** Empty space around each plate, as a fraction of its cell. */
  gap: number;
  /** Maximum plate relief, in source inches. Tight bends may require less. */
  relief: number;
  /** Total intermediate-layer allowance above the original ribs, in inches. */
  supportOffsetInches: number;
  surfaceMode: "conforming" | "planar";
  /** Amount of seeded outline, spacing, and height variation. */
  variation: number;
  seed: number;
}

export interface ScalePlate {
  id: string;
  surface: "body" | "jaw";
  row: number;
  column: number;
  /** Convex footprint in the plate's local 0-to-1 face coordinates. */
  outline: Point2[];
  positions: number[];
  normals: number[];
  indices: number[];
  /** Local face UVs; these remap lettering whenever the study is rebuilt. */
  uvs: number[];
  /** Untextured sidewalls on the complete tessellated face boundary. */
  edgePositions: number[];
  edgeIndices: number[];
  widthInches: number;
  heightInches: number;
  safeRect: { x: number; y: number; width: number; height: number };
  /** Includes seeded variation and any curvature safety reduction. */
  appliedReliefInches: number;
  /** UV footprint on the historical foil, for reproducible placement. */
  sourceBounds: SurfaceBounds;
}

export interface ScaleStudy {
  /** Faces retained visually but too distorted for a trustworthy lettering region. */
  unletterablePlateCount?: number;
  modelId: "archival" | "maquette";
  modelScale: number;
  bodyWidthScale?: number;
  bodyDepthScale?: number;
  bareSourceBounds?: { width: number; height: number; depth: number };
  /** Actual substrate mesh when a source adapter supplies one, in real inches. */
  sourceGeometry?: { positions: number[]; indices: number[] };
  plates: ScalePlate[];
  triangleCount: number;
  /** Plates whose curvature required relief below their seeded request. */
  adjustedReliefCount: number;
}

export const DEFAULT_SCALE_STUDY_SETTINGS: ScaleStudySettings = {
  modelId: "archival",
  modelScale: 1,
  bodyWidthScale: 1,
  bodyDepthScale: 1,
  columns: 100,
  rows: 5,
  gap: 0.012,
  relief: 1.05,
  ...DEFAULT_SCALE_SHAPE,
  supportOffsetInches: 1,
  surfaceMode: "conforming",
  variation: 0.35,
  seed: 1,
};

/** Close-set photo-reference density and silhouette; keeps size, model, and relief. */
export function applyDefaultScalePlateLayout(
  settings: ScaleStudySettings,
): ScaleStudySettings {
  return {
    ...settings,
    ...DEFAULT_SCALE_SHAPE,
    columns: DEFAULT_SCALE_STUDY_SETTINGS.columns,
    rows: DEFAULT_SCALE_STUDY_SETTINGS.rows,
    gap: DEFAULT_SCALE_STUDY_SETTINGS.gap,
    variation: DEFAULT_SCALE_STUDY_SETTINGS.variation,
  };
}

/**
 * The pre-tessellation homepage draft: 120×4, 12% grout, not archival original
 * plates. Those drafts should open on the current close-set layout.
 */
export function usesRetiredHomepagePlateLayout(
  settings: ScaleStudySettings,
): boolean {
  return (
    settings.columns === 120 &&
    settings.rows === 4 &&
    Math.abs(settings.gap - 0.12) < 1e-9 &&
    settings.plateShape !== "legacy"
  );
}

const MIN_COLUMNS = 4;
const MAX_COLUMNS = 240;
const MIN_ROWS = 1;
const MAX_ROWS = 12;
const MAX_PLATES_PER_SURFACE = 600;
const V_GUTTER = 0.055;

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

/** Coerces persisted or user-provided values into the supported study range. */
export function normalizeScaleStudySettings(
  input: unknown,
): ScaleStudySettings {
  const candidate =
    typeof input === "object" && input !== null
      ? (input as Record<string, unknown>)
      : {};
  const columns = clamp(
    Math.round(
      finiteNumber(candidate.columns, DEFAULT_SCALE_STUDY_SETTINGS.columns),
    ),
    MIN_COLUMNS,
    MAX_COLUMNS,
  );
  const requestedRows = clamp(
    Math.round(finiteNumber(candidate.rows, DEFAULT_SCALE_STUDY_SETTINGS.rows)),
    candidate.plateFit === "cover" ? MIN_ROWS : 2,
    MAX_ROWS,
  );
  return {
    ...normalizeScaleShapeSettings(candidate),
    modelId: candidate.modelId === "maquette" ? "maquette" : "archival",
    modelScale: clamp(
      finiteNumber(
        candidate.modelScale,
        DEFAULT_SCALE_STUDY_SETTINGS.modelScale,
      ),
      0.02,
      30,
    ),
    bodyWidthScale: clamp(finiteNumber(candidate.bodyWidthScale, 1), 0.5, 2),
    bodyDepthScale: clamp(finiteNumber(candidate.bodyDepthScale, 1), 0.5, 2),
    columns,
    rows: Math.min(requestedRows, Math.floor(MAX_PLATES_PER_SURFACE / columns)),
    gap: clamp(
      finiteNumber(candidate.gap, DEFAULT_SCALE_STUDY_SETTINGS.gap),
      0,
      0.3,
    ),
    relief: clamp(finiteNumber(candidate.relief, 0.65), 0, 6),
    supportOffsetInches: clamp(
      finiteNumber(
        candidate.supportOffsetInches,
        DEFAULT_SCALE_STUDY_SETTINGS.supportOffsetInches,
      ),
      0,
      6,
    ),
    surfaceMode: candidate.surfaceMode === "planar" ? "planar" : "conforming",
    variation: clamp(
      finiteNumber(candidate.variation, DEFAULT_SCALE_STUDY_SETTINGS.variation),
      0,
      1,
    ),
    seed: clamp(
      Math.round(
        finiteNumber(candidate.seed, DEFAULT_SCALE_STUDY_SETTINGS.seed),
      ),
      0,
      0xffff_ffff,
    ),
  };
}

/** Keep the current object's field order when only some normalized values change. */
export function mergeScaleStudySettings(
  current: ScaleStudySettings,
  next: ScaleStudySettings,
): ScaleStudySettings {
  return (Object.keys(next) as (keyof ScaleStudySettings)[]).every((key) =>
    Object.is(current[key], next[key]),
  )
    ? current
    : { ...current, ...next };
}

let referenceGeometry:
  | { bare: FoilGeometry; unitAllowance: FoilGeometry }
  | undefined;

const radialReferenceCache = new Map<
  string,
  { bare: FoilGeometry; unitAllowance: FoilGeometry }
>();

/** Derive the local radial basis from the unchanged historical mesh meridians. */
function deformReferenceMesh(
  mesh: FoilMeshGeometry,
  widthScale: number,
  depthScale: number,
): FoilMeshGeometry {
  const positions = mesh.positions.map((value, index) => {
    const vertex = Math.floor(index / 3);
    const row = Math.floor(vertex / mesh.verticesPerMeridian);
    const column = vertex % mesh.verticesPerMeridian;
    const axis = index % 3;
    const first = mesh.positions[column * 3 + axis] ?? 0;
    const last =
      mesh.positions[
        (mesh.meridianCount * mesh.verticesPerMeridian + column) * 3 + axis
      ] ?? 0;
    const middle =
      mesh.positions[
        (Math.floor(mesh.meridianCount / 2) * mesh.verticesPerMeridian +
          column) *
          3 +
          axis
      ] ?? 0;
    const center = (first + last) / 2;
    const angle = (row / mesh.meridianCount) * Math.PI;
    const across = Math.cos(angle);
    const depth = row === 0 || row === mesh.meridianCount ? 0 : Math.sin(angle);
    return (
      value +
      ((first - last) / 2) * (widthScale - 1) * across +
      (middle - center) * (depthScale - 1) * depth
    );
  });
  return { ...mesh, positions };
}

function scaleReferenceGeometry(bodyWidthScale = 1, bodyDepthScale = 1) {
  referenceGeometry ??= {
    bare: generateFoilGeometry({ radiusOffsetInches: 0 }),
    unitAllowance: generateFoilGeometry({ radiusOffsetInches: 1 }),
  };
  if (bodyWidthScale === 1 && bodyDepthScale === 1) return referenceGeometry;
  const key = `${bodyWidthScale}:${bodyDepthScale}`;
  const cached = radialReferenceCache.get(key);
  if (cached) return cached;
  const bare = {
    ...deformReferenceMesh(
      referenceGeometry.bare,
      bodyWidthScale,
      bodyDepthScale,
    ),
    jawGeometry: deformReferenceMesh(
      referenceGeometry.bare.jawGeometry,
      bodyWidthScale,
      bodyDepthScale,
    ),
  };
  // Keep the generator's exact one-inch allowance direction: real stock is not
  // multiplied by either radial dimension factor.
  function allowance(
    mesh: FoilMeshGeometry,
    original: FoilMeshGeometry,
    supported: FoilMeshGeometry,
  ) {
    return {
      ...mesh,
      positions: mesh.positions.map(
        (value, index) =>
          value +
          ((supported.positions[index] ?? 0) -
            (original.positions[index] ?? 0)),
      ),
    };
  }
  const generated = {
    bare,
    unitAllowance: {
      ...allowance(
        bare,
        referenceGeometry.bare,
        referenceGeometry.unitAllowance,
      ),
      jawGeometry: allowance(
        bare.jawGeometry,
        referenceGeometry.bare.jawGeometry,
        referenceGeometry.unitAllowance.jawGeometry,
      ),
    },
  };
  radialReferenceCache.set(key, generated);
  if (radialReferenceCache.size > 4) {
    const oldest = radialReferenceCache.keys().next().value;
    if (oldest !== undefined) radialReferenceCache.delete(oldest);
  }
  return generated;
}

/**
 * Scale the frame first, then add the physical layer allowance. The source
 * positions are linear in radiusOffsetInches, so the zero/one-inch difference
 * is its exact radial direction. This is equivalent to generating with
 * offset/scale then scaling positions, without exceeding the historical
 * generator's six-inch input limit for a small model and thick real stock.
 * This adapter remains the archival frame; it is not the distinct maquette.
 */
export function generateScaledScaleGeometry(
  input: {
    modelScale?: number;
    supportOffsetInches?: number;
    bodyWidthScale?: number;
    bodyDepthScale?: number;
  } = {},
): FoilGeometry {
  const { modelScale, supportOffsetInches, bodyWidthScale, bodyDepthScale } =
    normalizeScaleStudySettings(input);
  const { bare, unitAllowance } = scaleReferenceGeometry(
    bodyWidthScale,
    bodyDepthScale,
  );
  function scaledMesh(
    mesh: FoilMeshGeometry,
    allowance: FoilMeshGeometry,
  ): FoilMeshGeometry {
    const positions = mesh.positions.map(
      (value, index) =>
        value * modelScale +
        ((allowance.positions[index] ?? value) - value) * supportOffsetInches,
    );
    const uvs: number[] = [];
    let readingLoopLengthInches = 0;
    for (let row = 0; row <= mesh.meridianCount; row++) {
      const start = row * mesh.verticesPerMeridian;
      const distances = [0];
      let length = 0;
      for (let column = 1; column < mesh.verticesPerMeridian; column++) {
        const previous = (start + column - 1) * 3;
        const current = (start + column) * 3;
        length += Math.hypot(
          (positions[current] ?? 0) - (positions[previous] ?? 0),
          (positions[current + 1] ?? 0) - (positions[previous + 1] ?? 0),
          (positions[current + 2] ?? 0) - (positions[previous + 2] ?? 0),
        );
        distances.push(length);
      }
      if (row === Math.floor(mesh.meridianCount / 2))
        readingLoopLengthInches = length;
      for (const distance of distances)
        uvs.push(distance / length, row / mesh.meridianCount);
    }
    return {
      ...mesh,
      positions,
      uvs,
      indices: [...mesh.indices],
      seamNotes: [...mesh.seamNotes],
      readingLoopLengthInches,
    };
  }
  return {
    ...scaledMesh(bare, unitAllowance),
    jawGeometry: scaledMesh(bare.jawGeometry, unitAllowance.jawGeometry),
  };
}

function randomGenerator(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Unequal, shared partitions form disjoint courses with staggered seams. */
function partitions(
  count: number,
  variation: number,
  random: () => number,
): number[] {
  const widths = Array.from(
    { length: count },
    () => 1 + (random() - 0.5) * variation * 1.15,
  );
  const total = widths.reduce((sum, width) => sum + width, 0);
  let cursor = 0;
  return [
    0,
    ...widths.map((width, index) => {
      cursor += width / total;
      return index === widths.length - 1 ? 1 : cursor;
    }),
  ];
}

/**
 * Keep the visible front meridian (v = 0.5) inside a course, not on grout.
 * Equal even-row splits otherwise put a gap down the middle of the body.
 */
export function shiftScalePartitionsToCover(
  edges: number[],
  center = 0.5,
): number[] {
  const count = edges.length - 1;
  if (count <= 1) return edges;
  const moved = edges.slice();
  let index = -1;
  for (let i = 0; i < count; i++) {
    const start = moved[i] ?? 0;
    const end = moved[i + 1] ?? 1;
    if (start < center && center < end) {
      index = i;
      break;
    }
  }
  if (index < 0) {
    const at = moved.findIndex(
      (value, i) => i > 0 && i < count && Math.abs(value - center) <= 1e-12,
    );
    if (at < 1) return moved;
    const left = moved[at - 1] ?? 0;
    const right = moved[at + 1] ?? 1;
    moved[at] = center + Math.min(center - left, right - center) * 0.4;
    index = at - 1;
  }
  const start = moved[index] ?? 0;
  const end = moved[index + 1] ?? 1;
  const margin = (end - start) * 0.25;
  if (center - start >= margin && end - center >= margin) return moved;
  const width = end - start;
  const origin = Math.max(0, Math.min(1 - width, center - width / 2));
  if (index > 0) moved[index] = origin;
  if (index + 1 < count) moved[index + 1] = origin + width;
  return moved;
}

/** Brick-bond offset so neighbouring courses do not share a longitudinal seam. */
export function staggerScaleCoursePartitions(
  course: number[],
  row: number,
): number[] {
  if (row % 2 === 0 || course.length < 3) return course;
  const widths = Array.from(
    { length: course.length - 1 },
    (_, i) => (course[i + 1] ?? 1) - (course[i] ?? 0),
  ).sort((a, b) => a - b);
  const delta = (widths[Math.floor(widths.length / 2)] ?? 0) / 2;
  if (!(delta > 1e-9)) return course;
  const interior = course
    .slice(1, -1)
    .map((u) => {
      const shifted = u + delta;
      return shifted < 1 ? shifted : shifted - 1;
    })
    .sort((a, b) => a - b);
  return [0, ...interior, 1];
}

/**
 * Invert a bounded local-metric CDF so seeded cells have comparable physical
 * width/height along a course. This changes no random draws or plate counts.
 * The positive floor applies only to a collapsed zero-height sample.
 */
function physicalScaleCourseMetric(
  surface: ScaleSurface,
  v0: number,
  v1: number,
): number[] {
  const bins = 128;
  const middleV = (v0 + v1) / 2;
  const prefix = [0];
  for (let bin = 0; bin < bins; bin++) {
    const u = (bin + 0.5) / bins;
    const height = surface.arcLength([u, v0], [u, v1], 0);
    const width = surface.arcLength(
      [bin / bins, middleV],
      [(bin + 1) / bins, middleV],
      0,
    );
    if (
      !Number.isFinite(height) ||
      !Number.isFinite(width) ||
      height < 0 ||
      width < 0
    )
      throw new RangeError(
        "Scale course contains invalid physical dimensions.",
      );
    const previous = prefix[bin] ?? 0;
    const weight = width / (height === 0 ? 1e-8 : height);
    const next = previous + weight;
    if (!Number.isFinite(next))
      throw new RangeError("Scale course exceeds finite physical dimensions.");
    prefix.push(next);
  }
  const total = prefix[bins] ?? 0;
  if (!(total > 0))
    throw new RangeError("Scale course has no positive physical length.");
  return prefix;
}

export function physicalScaleCoursePartitions(
  surface: ScaleSurface,
  fractions: number[],
  v0: number,
  v1: number,
  cachedMetric?: number[],
): number[] {
  const prefix = cachedMetric ?? physicalScaleCourseMetric(surface, v0, v1);
  const bins = prefix.length - 1;
  const total = prefix[bins] ?? 0;
  return fractions.map((fraction, index) => {
    if (index === 0) return 0;
    if (index === fractions.length - 1) return 1;
    const target = fraction * total;
    let lower = 0,
      upper = bins;
    while (lower + 1 < upper) {
      const middle = (lower + upper) >> 1;
      if ((prefix[middle] ?? 0) <= target) lower = middle;
      else upper = middle;
    }
    const start = prefix[lower] ?? 0;
    const end = prefix[lower + 1] ?? total;
    if (!(end > start))
      throw new RangeError(
        "Scale course cannot invert a collapsed physical interval.",
      );
    return (lower + (target - start) / (end - start)) / bins;
  });
}

/** Exact bounded budget with physical aspect approximated by course density. */
function coverCourseLayout(
  surface: ScaleSurface,
  budget: number,
  requestedRows: number,
  aspect: number,
) {
  const maxRows = Math.min(MAX_ROWS, Math.floor(budget / MIN_COLUMNS));
  const minRows = Math.max(1, Math.ceil(budget / MAX_COLUMNS));
  const metrics = new Map<number, number[]>();
  const prefixes = new Map<number, number[][]>();
  const weights = (count: number) => {
    let result = metrics.get(count);
    if (!result) {
      const coursePrefixes: number[][] = [];
      result = Array.from({ length: count }, (_, i) => {
        const prefix = physicalScaleCourseMetric(
          surface,
          0.005 + (i / count) * 0.99,
          0.005 + ((i + 1) / count) * 0.99,
        );
        coursePrefixes.push(prefix);
        return prefix[prefix.length - 1] ?? 0;
      });
      metrics.set(count, result);
      prefixes.set(count, coursePrefixes);
    }
    return result;
  };
  const initial = clamp(requestedRows, minRows, maxRows);
  const initialTotal = weights(initial).reduce((a, b) => a + b, 0);
  const targetAspect = aspect > 0 ? aspect : initialTotal / budget;
  const estimated = Math.sqrt(
    (budget * targetAspect) / (initialTotal / (initial * initial)),
  );
  const candidates = new Set([
    initial,
    clamp(Math.floor(estimated), minRows, maxRows),
    clamp(Math.ceil(estimated), minRows, maxRows),
  ]);
  for (const candidate of [...candidates]) {
    if (candidate % 2 === 0) {
      candidates.add(clamp(candidate - 1, minRows, maxRows));
      candidates.add(clamp(candidate + 1, minRows, maxRows));
    }
  }
  let rows = initial,
    best = Infinity;
  for (const candidate of candidates) {
    const total = weights(candidate).reduce((a, b) => a + b, 0);
    const error = Math.abs(Math.log(total / budget / targetAspect));
    if (
      error < best - 1e-10 ||
      (Math.abs(error - best) <= 1e-10 &&
        Math.abs(candidate - requestedRows) < Math.abs(rows - requestedRows))
    ) {
      best = error;
      rows = candidate;
    }
  }
  if (rows % 2 === 0) {
    let oddRows = rows;
    let oddError = Infinity;
    for (const odd of [rows - 1, rows + 1]) {
      if (odd < minRows || odd > maxRows) continue;
      const total = weights(odd).reduce((a, b) => a + b, 0);
      const error = Math.abs(Math.log(total / budget / targetAspect));
      if (
        error < oddError - 1e-10 ||
        (Math.abs(error - oddError) <= 1e-10 &&
          Math.abs(odd - requestedRows) < Math.abs(oddRows - requestedRows))
      ) {
        oddRows = odd;
        oddError = error;
      }
    }
    if (oddRows !== rows && oddError <= best + 0.08) rows = oddRows;
  }
  const q = weights(rows);
  // Capped proportional water filling, then largest remainders. Every course
  // receives at least four cells and no course exceeds the original limit.
  const counts = Array.from({ length: rows }, () => MIN_COLUMNS);
  let remaining = budget - rows * MIN_COLUMNS;
  while (remaining > 0) {
    const eligible = counts
      .map((n, i) => (n < MAX_COLUMNS ? i : -1))
      .filter((i) => i >= 0);
    if (!eligible.length)
      throw new RangeError("Cover budget exceeds course capacity.");
    const total = eligible.reduce((sum, i) => sum + (q[i] ?? 0), 0);
    const allocations = eligible.map((i) => ({
      i,
      exact: (remaining * (q[i] ?? 0)) / total,
    }));
    let assigned = 0;
    for (const { i, exact } of allocations) {
      const add = Math.min(MAX_COLUMNS - (counts[i] ?? 0), Math.floor(exact));
      counts[i] = (counts[i] ?? 0) + add;
      assigned += add;
    }
    remaining -= assigned;
    allocations.sort((a, b) => (b.exact % 1) - (a.exact % 1) || a.i - b.i);
    for (const { i } of allocations) {
      if (!remaining) break;
      if ((counts[i] ?? 0) < MAX_COLUMNS) {
        counts[i] = (counts[i] ?? 0) + 1;
        remaining--;
      }
    }
  }
  return { rows, counts, prefixes: prefixes.get(rows) };
}

function planarPatch(
  surface: ScaleSurface,
  bounds: SurfaceBounds,
  outline: Point2[],
  relief: number,
): SurfacePatch & { widthInches: number; heightInches: number } {
  const middleU = (bounds.u0 + bounds.u1) / 2;
  const middleV = (bounds.v0 + bounds.v1) / 2;
  const { position: center, normal } = surface.sample(middleU, middleV);
  const along = subtract(
    surface.sample(bounds.u1, middleV).position,
    surface.sample(bounds.u0, middleV).position,
  );
  const tangent = subtract(along, multiply(normal, dot(along, normal)));
  const widthInches = Math.max(0.01, Math.hypot(...tangent));
  const heightInches = Math.max(
    0.01,
    Math.hypot(
      ...subtract(
        surface.sample(middleU, bounds.v1).position,
        surface.sample(middleU, bounds.v0).position,
      ),
    ),
  );
  const uAxis = normalize(tangent);
  const vAxis = normalize(cross(uAxis, normal));
  const base: number[] = [];
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  for (const [u, v] of [[0.5, 0.5], ...outline] as Point2[]) {
    const point = add(
      center,
      add(
        multiply(uAxis, (u - 0.5) * widthInches),
        multiply(vAxis, (v - 0.5) * heightInches),
      ),
    );
    base.push(...point);
    positions.push(...add(point, multiply(normal, relief)));
    normals.push(...normal);
    uvs.push(u, v);
  }
  const indices: number[] = [];
  const edgePositions: number[] = [];
  const edgeIndices: number[] = [];
  for (let side = 0; side < outline.length; side++) {
    const current = side + 1;
    const next = ((side + 1) % outline.length) + 1;
    indices.push(0, next, current);
    if (relief > 0) {
      const start = edgePositions.length / 3;
      edgePositions.push(
        ...base.slice(current * 3, current * 3 + 3),
        ...positions.slice(current * 3, current * 3 + 3),
        ...base.slice(next * 3, next * 3 + 3),
        ...positions.slice(next * 3, next * 3 + 3),
      );
      edgeIndices.push(
        start,
        start + 1,
        start + 2,
        start + 2,
        start + 1,
        start + 3,
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
    appliedReliefInches: relief,
    widthInches,
    heightInches,
  };
}

/**
 * Clips each convex scale footprint against the source surface tessellation.
 * The curved study preserves coherent UV topology; planar blocks are optional.
 * This is the archival model adapter; dispatch the actual maquette separately.
 * Source dimensions are inches. Global crossing clearance is not certified.
 */
export function generateScaleStudy(input: unknown = {}): ScaleStudy {
  const settings = normalizeScaleStudySettings(input);
  const geometry = generateScaledScaleGeometry(settings);
  const { unitAllowance: countReference } = scaleReferenceGeometry();
  const random = randomGenerator(settings.seed);
  const plates: ScalePlate[] = [];
  let adjustedReliefCount = 0;
  for (const [name, mesh] of [
    ["body", geometry],
    ["jaw", geometry.jawGeometry],
  ] as const) {
    const surface = new ScaleSurface(mesh);
    const columns =
      name === "body"
        ? settings.columns
        : clamp(
            Math.round(
              (settings.columns *
                countReference.jawGeometry.readingLoopLengthInches) /
                countReference.readingLoopLengthInches,
            ),
            MIN_COLUMNS,
            settings.columns,
          );
    const cover = settings.plateFit === "cover";
    const layout = cover
      ? coverCourseLayout(
          surface,
          columns * settings.rows,
          settings.rows,
          settings.plateAspect,
        )
      : null;
    const rowCount = layout?.rows ?? settings.rows;
    const rows = shiftScalePartitionsToCover(
      partitions(rowCount, cover ? 0 : settings.variation, random),
    );
    const gutter = cover ? 0.005 : V_GUTTER;
    for (let row = 0; row < rowCount; row++) {
      const courseColumns = layout?.counts[row] ?? columns;
      const seededCourse = partitions(
        courseColumns,
        settings.variation,
        random,
      );
      const cellV0 = gutter + (rows[row] ?? 0) * (1 - 2 * gutter);
      const cellV1 = gutter + (rows[row + 1] ?? 1) * (1 - 2 * gutter);
      const mappedCourse =
        cover || (settings.plateShape !== "legacy" && settings.plateAspect > 0)
          ? physicalScaleCoursePartitions(
              surface,
              seededCourse,
              cellV0,
              cellV1,
              layout?.prefixes?.[row],
            )
          : seededCourse;
      const course = staggerScaleCoursePartitions(mappedCourse, row);
      for (let column = 0; column < courseColumns; column++) {
        const cellU0 = course[column] ?? 0;
        const cellU1 = course[column + 1] ?? 1;
        const insetU =
          ((cellU1 - cellU0) *
            (settings.gap +
              settings.variation * random() * (cover ? 0.01 : 0.06))) /
          2;
        const insetV =
          ((cellV1 - cellV0) *
            (settings.gap +
              settings.variation * random() * (cover ? 0.01 : 0.06))) /
          2;
        let sourceBounds = {
          u0: cellU0 + insetU,
          u1: cellU1 - insetU,
          v0: cellV0 + insetV,
          v1: cellV1 - insetV,
        };
        if (!cover && settings.plateAspect > 0) {
          const u = (sourceBounds.u0 + sourceBounds.u1) / 2;
          const v = (sourceBounds.v0 + sourceBounds.v1) / 2;
          sourceBounds = fitScalePlateBounds(
            sourceBounds,
            surface.arcLength([sourceBounds.u0, v], [sourceBounds.u1, v], 0),
            surface.arcLength([u, sourceBounds.v0], [u, sourceBounds.v1], 0),
            settings.plateAspect,
          );
        }
        const outline = scalePlateOutline(settings, random);
        const requestedRelief =
          settings.relief * (1 - settings.variation * random() * 0.45);
        const patch =
          settings.surfaceMode === "conforming"
            ? surface.conformingPatch(sourceBounds, outline, requestedRelief)
            : planarPatch(surface, sourceBounds, outline, requestedRelief);
        if (patch.appliedReliefInches < requestedRelief - 1e-8)
          adjustedReliefCount++;
        const middleU = (sourceBounds.u0 + sourceBounds.u1) / 2;
        const middleV = (sourceBounds.v0 + sourceBounds.v1) / 2;
        const widthInches =
          "widthInches" in patch
            ? (patch.widthInches as number)
            : surface.arcLength(
                [sourceBounds.u0, middleV],
                [sourceBounds.u1, middleV],
                patch.appliedReliefInches,
              );
        const heightInches =
          "heightInches" in patch
            ? (patch.heightInches as number)
            : surface.arcLength(
                [middleU, sourceBounds.v0],
                [middleU, sourceBounds.v1],
                patch.appliedReliefInches,
              );
        plates.push({
          id: `${name}-${row}-${column}`,
          surface: name,
          row,
          column,
          outline,
          ...patch,
          widthInches,
          heightInches,
          sourceBounds,
          safeRect:
            settings.plateShape === "legacy"
              ? { x: 0.2, y: 0.2, width: 0.6, height: 0.6 }
              : scalePlateSafeRect(outline),
        });
      }
    }
  }
  const source = archivalBareSource(settings);
  return {
    modelId: "archival",
    modelScale: settings.modelScale,
    bodyWidthScale: settings.bodyWidthScale,
    bodyDepthScale: settings.bodyDepthScale,
    bareSourceBounds: source.bounds,
    sourceGeometry: source.geometry,
    plates,
    triangleCount: plates.reduce(
      (total, plate) =>
        total + plate.indices.length / 3 + plate.edgeIndices.length / 3,
      0,
    ),
    adjustedReliefCount,
  };
}

function archivalBareSource(settings: ScaleStudySettings) {
  const bare = scaleReferenceGeometry(
    settings.bodyWidthScale,
    settings.bodyDepthScale,
  ).bare;
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];
  const positions: number[] = [];
  const indices: number[] = [];
  for (const mesh of [bare, bare.jawGeometry]) {
    const vertexOffset = positions.length / 3;
    for (const index of mesh.indices) indices.push(index + vertexOffset);
    for (let index = 0; index < mesh.positions.length; index++) {
      const axis = index % 3;
      const value = (mesh.positions[index] ?? 0) * settings.modelScale;
      positions.push(value);
      minimum[axis] = Math.min(minimum[axis] ?? Infinity, value);
      maximum[axis] = Math.max(maximum[axis] ?? -Infinity, value);
    }
  }
  return {
    geometry: { positions, indices },
    bounds: {
      width: (maximum[0] ?? 0) - (minimum[0] ?? 0),
      height: (maximum[1] ?? 0) - (minimum[1] ?? 0),
      depth: (maximum[2] ?? 0) - (minimum[2] ?? 0),
    },
  };
}
