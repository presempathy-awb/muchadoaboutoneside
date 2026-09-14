import sectionData from "../../shared/foil-sections.json";

type Vector = [number, number, number];

interface SourceSection {
  center: number[];
  perimeter: number[][];
}

interface Section {
  center: Vector;
  radiusU: number;
  radiusV: number;
  axisU: Vector;
  axisV: Vector;
}

export interface FoilGeometryOptions {
  subdivisionsPerSpan?: number;
  meridianCount?: number;
  capSteps?: number;
  radiusOffsetInches?: number;
}

export interface FoilMeshGeometry {
  positions: number[];
  indices: number[];
  uvs: number[];
  readingLoopLengthInches: number;
  seamNotes: string[];
  meridianCount: number;
  verticesPerMeridian: number;
}

export interface FoilGeometry extends FoilMeshGeometry {
  jawGeometry: FoilMeshGeometry;
}

const SEAM_NOTES = [
  "Each reading circuit follows the front toward the nose, crosses the end cap, returns along the back and crosses the tail cap. No nose-to-tail bridge is added.",
  "The capped skin is orientable, not a Möbius surface. The two side meridians contain UV singularities; reserve unlettered or flourish gutters near v = 0 and v = 1.",
  "This is a visual foil study derived from the exported rib frames. The radius allowance can overlap at the sculpture crossing; collision clearance and flat fabrication panels are not certified.",
];

function vector(values: number[]): Vector {
  return [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0];
}

function subtract(a: Vector, b: Vector): Vector {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot(a: Vector, b: Vector): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vector, b: Vector): Vector {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize(value: Vector): Vector {
  const length = Math.hypot(...value);
  return [value[0] / length, value[1] / length, value[2] / length];
}

function interpolate(a: Vector, b: Vector, amount: number): Vector {
  return [
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
    a[2] + (b[2] - a[2]) * amount,
  ];
}

function sourceSection(source: SourceSection): Section {
  const center = vector(source.center);
  const first = source.perimeter[0];
  const quarter = source.perimeter[8];
  if (!first || !quarter || source.perimeter.length !== 32) {
    throw new Error("A source foil section requires its 32-point perimeter.");
  }
  // Head and jaw rings are ellipses. Quarter-turn samples retain both actual
  // semiaxes; averaging their radii would cut through the wider source ribs.
  const radialU = subtract(vector(first), center);
  const radialV = subtract(vector(quarter), center);
  return {
    center,
    radiusU: Math.hypot(...radialU),
    radiusV: Math.hypot(...radialV),
    axisU: normalize(radialU),
    axisV: normalize(radialV),
  };
}

function sampleSections(sections: Section[], subdivisions: number): Section[] {
  const sampled: Section[] = [];
  for (let index = 0; index < sections.length - 1; index++) {
    const first = sections[index];
    const next = sections[index + 1];
    if (!first || !next) continue;
    for (let step = 0; step < subdivisions; step++) {
      const amount = step / subdivisions;
      const axisU = normalize(interpolate(first.axisU, next.axisU, amount));
      const provisionalV = interpolate(first.axisV, next.axisV, amount);
      const projection = dot(provisionalV, axisU);
      const axisV = normalize([
        provisionalV[0] - projection * axisU[0],
        provisionalV[1] - projection * axisU[1],
        provisionalV[2] - projection * axisU[2],
      ]);
      sampled.push({
        center: interpolate(first.center, next.center, amount),
        radiusU: first.radiusU + (next.radiusU - first.radiusU) * amount,
        radiusV: first.radiusV + (next.radiusV - first.radiusV) * amount,
        axisU,
        axisV,
      });
    }
  }
  const last = sections.at(-1);
  if (last) sampled.push(last);
  return sampled;
}

function surfacePoint(
  section: Section,
  across: number,
  depth: number,
  offset: number,
): Vector {
  const { center, axisU, axisV } = section;
  const width = (section.radiusU + offset) * across;
  const height = (section.radiusV + offset) * depth;
  return [
    center[0] + width * axisU[0] + height * axisV[0],
    center[1] + width * axisU[1] + height * axisV[1],
    center[2] + width * axisU[2] + height * axisV[2],
  ];
}

function makeMesh(
  source: SourceSection[],
  options: Required<FoilGeometryOptions>,
): FoilMeshGeometry {
  const sections = sampleSections(
    source.map(sourceSection),
    options.subdivisionsPerSpan,
  );
  const positions: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
  const loops: Vector[][] = [];
  let readingLoopLengthInches = 0;

  for (let row = 0; row <= options.meridianCount; row++) {
    const angle = (row / options.meridianCount) * Math.PI;
    const across = Math.cos(angle);
    // Exact zeros make the singular side meridians weld without tiny slivers.
    const depth =
      row === 0 || row === options.meridianCount ? 0 : Math.sin(angle);
    const front = sections.map((section) =>
      surfacePoint(section, across, depth, options.radiusOffsetInches),
    );
    const back = sections.map((section) =>
      surfacePoint(section, across, -depth, options.radiusOffsetInches),
    );
    const firstFront = front[0];
    const lastFront = front.at(-1);
    const firstBack = back[0];
    const lastBack = back.at(-1);
    if (!firstFront || !lastFront || !firstBack || !lastBack) {
      throw new Error("A foil surface requires at least two source sections.");
    }
    const loop = [...front];
    for (let step = 1; step <= options.capSteps; step++) {
      loop.push(interpolate(lastFront, lastBack, step / options.capSteps));
    }
    loop.push(...back.slice(0, -1).reverse());
    for (let step = 1; step < options.capSteps; step++) {
      loop.push(interpolate(firstBack, firstFront, step / options.capSteps));
    }
    // Duplicate the position at u=1 to preserve the artwork's reading seam.
    loop.push(firstFront);
    const distances = [0];
    let length = 0;
    for (let index = 1; index < loop.length; index++) {
      const previous = loop[index - 1];
      const current = loop[index];
      if (!previous || !current) continue;
      length += Math.hypot(...subtract(current, previous));
      distances.push(length);
    }
    if (row === Math.floor(options.meridianCount / 2)) {
      readingLoopLengthInches = length;
    }
    for (const [index, point] of loop.entries()) {
      positions.push(...point);
      uvs.push((distances[index] ?? 0) / length, row / options.meridianCount);
    }
    loops.push(loop);
  }

  const verticesPerMeridian = loops[0]?.length ?? 0;
  function triangle(a: number, b: number, c: number) {
    const point = (index: number): Vector => [
      positions[index * 3] ?? 0,
      positions[index * 3 + 1] ?? 0,
      positions[index * 3 + 2] ?? 0,
    ];
    const area = cross(
      subtract(point(b), point(a)),
      subtract(point(c), point(a)),
    );
    // End-cap chords collapse at v=0/1. Discard those degenerate triangles.
    if (dot(area, area) > 1e-16) indices.push(a, b, c);
  }
  for (let row = 0; row < options.meridianCount; row++) {
    for (let column = 0; column < verticesPerMeridian - 1; column++) {
      const a = row * verticesPerMeridian + column;
      const b = a + verticesPerMeridian;
      triangle(a, b, a + 1);
      triangle(b, b + 1, a + 1);
    }
  }

  return {
    positions,
    indices,
    uvs,
    readingLoopLengthInches,
    seamNotes: [...SEAM_NOTES],
    meridianCount: options.meridianCount,
    verticesPerMeridian,
  };
}

/** Capped outer-skin study in the source model's inch coordinate system. */
export function generateFoilGeometry(
  options: FoilGeometryOptions = {},
): FoilGeometry {
  const resolved: Required<FoilGeometryOptions> = {
    subdivisionsPerSpan: options.subdivisionsPerSpan ?? 4,
    meridianCount: options.meridianCount ?? 48,
    capSteps: options.capSteps ?? 8,
    radiusOffsetInches: options.radiusOffsetInches ?? 1,
  };
  for (const key of [
    "subdivisionsPerSpan",
    "meridianCount",
    "capSteps",
  ] as const) {
    if (
      !Number.isInteger(resolved[key]) ||
      resolved[key] < (key === "meridianCount" ? 4 : 1) ||
      resolved[key] > 256
    ) {
      throw new RangeError(
        `${key} must be an integer within its supported range.`,
      );
    }
  }
  if (
    !Number.isFinite(resolved.radiusOffsetInches) ||
    resolved.radiusOffsetInches < 0 ||
    resolved.radiusOffsetInches > 6
  ) {
    throw new RangeError("radiusOffsetInches must be between 0 and 6 inches.");
  }
  return {
    ...makeMesh(
      [...sectionData.sections, ...sectionData.upperHeadSections],
      resolved,
    ),
    jawGeometry: makeMesh(sectionData.jawSections, resolved),
  };
}
