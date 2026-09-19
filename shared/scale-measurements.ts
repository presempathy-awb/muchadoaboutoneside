import { generateFoilGeometry } from "../src/lib/foil-geometry";
import sectionData from "./foil-sections.json";
import { scaledModelDimensions } from "./scale-models";
import type { ScaleStudy } from "./scale-study";

/** Radial build-up assumptions above the archived rib frames, not measurements. */
export interface ScaleBuildUp {
  supportInches: number;
  backingInches: number;
  adhesiveMm: number;
  metalMm: number;
  finishMm: number;
  overlapMm: number;
}

export const DEFAULT_SCALE_BUILD_UP: ScaleBuildUp = {
  supportInches: 1,
  backingInches: 0,
  adhesiveMm: 0,
  metalMm: 0.127,
  finishMm: 0,
  overlapMm: 0,
};

export const SCALE_BUILD_UP_FIELDS = [
  {
    key: "supportInches",
    label: "Additional wood / printed support",
    unit: "in",
    max: 3,
  },
  {
    key: "backingInches",
    label: "Backing / printed adapters",
    unit: "in",
    max: 2,
  },
  { key: "adhesiveMm", label: "Adhesive", unit: "mm", max: 6 },
  { key: "metalMm", label: "Metal", unit: "mm", max: 6 },
  { key: "finishMm", label: "Finish", unit: "mm", max: 6 },
  { key: "overlapMm", label: "Local overlap", unit: "mm", max: 6 },
] as const;

export function normalizeScaleBuildUp(input: unknown): ScaleBuildUp {
  const candidate =
    typeof input === "object" && input !== null
      ? (input as Record<string, unknown>)
      : {};
  const result = { ...DEFAULT_SCALE_BUILD_UP };
  for (const { key, max } of SCALE_BUILD_UP_FIELDS) {
    const value = candidate[key];
    result[key] =
      typeof value === "number" && Number.isFinite(value)
        ? Math.max(0, Math.min(max, value))
        : DEFAULT_SCALE_BUILD_UP[key];
  }
  return result;
}

/** Field maxima total less than 5.945 inches, inside the six-inch geometry limit. */
export function buildUpSupportOffsetInches(layers: ScaleBuildUp): number {
  const normalized = normalizeScaleBuildUp(layers);
  return SCALE_BUILD_UP_FIELDS.reduce(
    (sum, { key, unit }) => sum + normalized[key] / (unit === "mm" ? 25.4 : 1),
    0,
  );
}

export interface ScaleSourceSection {
  id: string;
  label: string;
  surface: "body" | "jaw";
  radiusUInches: number;
  radiusVInches: number;
}

interface SourceRing {
  center: number[];
  perimeter: number[][];
}

function ringSection(
  ring: SourceRing,
  surface: "body" | "jaw",
  index: number,
  label: string,
): ScaleSourceSection {
  const distance = (point: number[] | undefined) => {
    if (!point || ring.center.length !== 3 || point.length !== 3) {
      throw new Error("A source cross-section requires complete 3D ring data.");
    }
    return Math.hypot(
      ...point.map((value, axis) => value - (ring.center[axis] ?? 0)),
    );
  };
  return {
    id: `${surface}-${index}`,
    label,
    surface,
    radiusUInches: distance(ring.perimeter[0]),
    radiusVInches: distance(ring.perimeter[8]),
  };
}

export const SOURCE_SCALE_SECTIONS: ScaleSourceSection[] = [
  ...sectionData.sections.map((ring, index) =>
    ringSection(ring, "body", index, `Body rib ${index + 1}`),
  ),
  ...sectionData.upperHeadSections.map((ring, index) =>
    ringSection(
      ring,
      "body",
      sectionData.sections.length + index,
      `Upper head ${index + 1}`,
    ),
  ),
  ...sectionData.jawSections.map((ring, index) =>
    ringSection(ring, "jaw", index, `Lower jaw ${index + 1}`),
  ),
];

/** Full archived construction model, including the base; source inches, Y-up. */
export const ARCHIVAL_MODEL_DIMENSIONS = scaledModelDimensions("archival", 1);

export function normalizeScaleModelScale(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(30, Math.max(0.02, value))
    : 1;
}

/** Numerical integration of an ellipse, in the same units as its semiaxes. */
export function ellipsePerimeter(radiusU: number, radiusV: number): number {
  if (
    !Number.isFinite(radiusU) ||
    !Number.isFinite(radiusV) ||
    radiusU <= 0 ||
    radiusV <= 0
  ) {
    throw new RangeError("Ellipse radii must be positive finite numbers.");
  }
  const steps = 256;
  const step = Math.PI / 2 / steps;
  let integral = 0;
  for (let index = 0; index <= steps; index++) {
    const angle = index * step;
    const speed = Math.hypot(
      radiusU * Math.sin(angle),
      radiusV * Math.cos(angle),
    );
    const weight = index === 0 || index === steps ? 1 : index % 2 === 0 ? 2 : 4;
    integral += weight * speed;
  }
  return (4 * step * integral) / 3;
}

export interface ScaleMeasurementStage {
  id: string;
  label: string;
  addedRadialInches: number;
  totalRadialInches: number;
  widthInches: number;
  depthInches: number;
  girthInches: number;
  evidence: "source-derived" | "estimated";
}

/** Ellipse envelope estimates, not a circumference traced across stepped plates. */
export function scaleSectionMeasurements(
  sectionId: string,
  input: ScaleBuildUp,
  reliefInches: number,
  modelScale = 1,
  bodyWidthScale = 1,
  bodyDepthScale = 1,
): ScaleMeasurementStage[] {
  const section = SOURCE_SCALE_SECTIONS.find(
    (candidate) => candidate.id === sectionId,
  );
  if (!section) throw new RangeError("Unknown source cross-section.");
  const layers = normalizeScaleBuildUp(input);
  const scale = normalizeScaleModelScale(modelScale);
  const proportion = (value: number) =>
    Number.isFinite(value) ? Math.max(0.5, Math.min(2, value)) : 1;
  const widthScale = proportion(bodyWidthScale);
  const depthScale = proportion(bodyDepthScale);
  const stage = (
    id: string,
    label: string,
    addedRadialInches: number,
    totalRadialInches: number,
  ): ScaleMeasurementStage => {
    const radiusU =
      section.radiusUInches * scale * widthScale + totalRadialInches;
    const radiusV =
      section.radiusVInches * scale * depthScale + totalRadialInches;
    return {
      id,
      label,
      addedRadialInches,
      totalRadialInches,
      widthInches: radiusU * 2,
      depthInches: radiusV * 2,
      girthInches: ellipsePerimeter(radiusU, radiusV),
      evidence: id === "source" ? "source-derived" : "estimated",
    };
  };
  const stages = [stage("source", "Archival modeled section", 0, 0)];
  let total = 0;
  for (const { key, label, unit } of SCALE_BUILD_UP_FIELDS) {
    const added = layers[key] / (unit === "mm" ? 25.4 : 1);
    total += added;
    stages.push(stage(key, label, added, total));
  }
  const relief = Number.isFinite(reliefInches)
    ? Math.max(0, Math.min(6, reliefInches))
    : 0;
  stages.push(
    stage("relief", "Raised scale faces (maximum)", relief, total + relief),
  );
  return stages;
}

export interface ScaleBounds {
  width: number;
  height: number;
  depth: number;
}

/** Source Y-up AABB of the supplied vertices. No assumed shell or base added. */
export function positionBounds(
  positionSets: readonly (readonly number[])[],
): ScaleBounds | null {
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];
  let count = 0;
  for (const positions of positionSets) {
    if (positions.length % 3 !== 0) throw new Error("Incomplete 3D vertex.");
    for (let index = 0; index < positions.length; index += 3) {
      for (let axis = 0; axis < 3; axis++) {
        const value = positions[index + axis];
        if (value === undefined || !Number.isFinite(value)) {
          throw new Error("Bounds require finite 3D vertices.");
        }
        minimum[axis] = Math.min(minimum[axis] ?? Infinity, value);
        maximum[axis] = Math.max(maximum[axis] ?? -Infinity, value);
      }
      count++;
    }
  }
  if (!count) return null;
  return {
    width: (maximum[0] ?? 0) - (minimum[0] ?? 0),
    height: (maximum[1] ?? 0) - (minimum[1] ?? 0),
    depth: (maximum[2] ?? 0) - (minimum[2] ?? 0),
  };
}

let sourceSkinBounds: ScaleBounds | null = null;

export function scaleStudyBoundsComparison(study: ScaleStudy): {
  source: ScaleBounds | null;
  scales: ScaleBounds | null;
} {
  const scales = positionBounds(
    study.plates.flatMap((plate) => [plate.positions, plate.edgePositions]),
  );
  if (study.modelId === "maquette") {
    return {
      source: study.sourceGeometry
        ? positionBounds([study.sourceGeometry.positions])
        : null,
      scales,
    };
  }
  if (study.bareSourceBounds) {
    return { source: { ...study.bareSourceBounds }, scales };
  }
  if (!sourceSkinBounds) {
    const geometry = generateFoilGeometry({ radiusOffsetInches: 0 });
    sourceSkinBounds = positionBounds([
      geometry.positions,
      geometry.jawGeometry.positions,
    ]);
  }
  if (!sourceSkinBounds) throw new Error("Missing source skin geometry.");
  const modelScale = normalizeScaleModelScale(study.modelScale);
  return {
    source: {
      width: sourceSkinBounds.width * modelScale,
      height: sourceSkinBounds.height * modelScale,
      depth: sourceSkinBounds.depth * modelScale,
    },
    scales,
  };
}
