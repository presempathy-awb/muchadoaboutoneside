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
  /** Number of plates around the body's reading loop; jaw density follows it. */
  columns: number;
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
  columns: 120,
  rows: 4,
  gap: 0.12,
  relief: 1.05,
  ...DEFAULT_SCALE_SHAPE,
  supportOffsetInches: 1,
  surfaceMode: "conforming",
  variation: 0.6,
  seed: 1,
};

const MIN_COLUMNS = 4;
const MAX_COLUMNS = 240;
const MIN_ROWS = 2;
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
    MIN_ROWS,
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

let referenceGeometry:
  | { bare: FoilGeometry; unitAllowance: FoilGeometry }
  | undefined;

function scaleReferenceGeometry() {
  referenceGeometry ??= {
    bare: generateFoilGeometry({ radiusOffsetInches: 0 }),
    unitAllowance: generateFoilGeometry({ radiusOffsetInches: 1 }),
  };
  return referenceGeometry;
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
  input: { modelScale?: number; supportOffsetInches?: number } = {},
): FoilGeometry {
  const { modelScale, supportOffsetInches } =
    normalizeScaleStudySettings(input);
  const { bare, unitAllowance } = scaleReferenceGeometry();
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
 * Invert a bounded local-metric CDF so seeded cells have comparable physical
 * width/height along a course. This changes no random draws or plate counts.
 * The positive floor applies only to a collapsed zero-height sample.
 */
export function physicalScaleCoursePartitions(
  surface: ScaleSurface,
  fractions: number[],
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
    const rows = partitions(settings.rows, settings.variation, random);
    for (let row = 0; row < settings.rows; row++) {
      const seededCourse = partitions(columns, settings.variation, random);
      const cellV0 = V_GUTTER + (rows[row] ?? 0) * (1 - 2 * V_GUTTER);
      const cellV1 = V_GUTTER + (rows[row + 1] ?? 1) * (1 - 2 * V_GUTTER);
      const course =
        settings.plateShape !== "legacy" && settings.plateAspect > 0
          ? physicalScaleCoursePartitions(surface, seededCourse, cellV0, cellV1)
          : seededCourse;
      for (let column = 0; column < columns; column++) {
        const cellU0 = course[column] ?? 0;
        const cellU1 = course[column + 1] ?? 1;
        const insetU =
          ((cellU1 - cellU0) *
            (settings.gap + settings.variation * random() * 0.06)) /
          2;
        const insetV =
          ((cellV1 - cellV0) *
            (settings.gap + settings.variation * random() * 0.06)) /
          2;
        let sourceBounds = {
          u0: cellU0 + insetU,
          u1: cellU1 - insetU,
          v0: cellV0 + insetV,
          v1: cellV1 - insetV,
        };
        if (settings.plateAspect > 0) {
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
  return {
    modelId: "archival",
    modelScale: settings.modelScale,
    plates,
    triangleCount: plates.reduce(
      (total, plate) =>
        total + plate.indices.length / 3 + plate.edgeIndices.length / 3,
      0,
    ),
    adjustedReliefCount,
  };
}
