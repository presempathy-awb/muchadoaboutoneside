import { describe, expect, test } from "bun:test";
import { generateFoilGeometry } from "../src/lib/foil-geometry";
import { LEGACY_SCALE_SHAPE } from "./scale-shape";
import {
  DEFAULT_SCALE_STUDY_SETTINGS,
  generateScaledScaleGeometry,
  generateScaleStudy,
  normalizeScaleStudySettings,
  physicalScaleCoursePartitions,
  type ScalePlate,
} from "./scale-study";
import { cross, dot, ScaleSurface, subtract, vectorAt } from "./scale-surface";

function directedEdges(plate: ScalePlate) {
  const edges = new Map<string, [number, number][]>();
  for (let offset = 0; offset < plate.indices.length; offset += 3) {
    for (let side = 0; side < 3; side++) {
      const a = plate.indices[offset + side] ?? 0;
      const b = plate.indices[offset + ((side + 1) % 3)] ?? 0;
      const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
      edges.set(key, [...(edges.get(key) ?? []), [a, b]]);
    }
  }
  return edges;
}

function polygonArea(outline: [number, number][]) {
  return (
    outline.reduce((area, point, index) => {
      const next = outline[(index + 1) % outline.length] ?? point;
      return area + point[0] * next[1] - point[1] * next[0];
    }, 0) / 2
  );
}

function validatePlate(plate: ScalePlate) {
  const vertices = plate.positions.length / 3;
  const errors: string[] = [];
  if (
    ![
      ...plate.positions,
      ...plate.normals,
      ...plate.uvs,
      ...plate.edgePositions,
    ].every(Number.isFinite)
  )
    errors.push("nonfinite vertex");
  if (
    plate.normals.length !== plate.positions.length ||
    plate.uvs.length !== vertices * 2
  )
    errors.push("vertex attribute count");
  if (
    !plate.indices.every(
      (index) => Number.isInteger(index) && index >= 0 && index < vertices,
    )
  )
    errors.push("index outside mesh");
  if (!plate.uvs.every((value) => value >= 0 && value <= 1))
    errors.push("UV outside footprint");
  let totalArea = 0;
  for (let offset = 0; offset < plate.indices.length; offset += 3) {
    const a = plate.indices[offset] ?? 0;
    const b = plate.indices[offset + 1] ?? 0;
    const c = plate.indices[offset + 2] ?? 0;
    const area = cross(
      subtract(vectorAt(plate.positions, b), vectorAt(plate.positions, a)),
      subtract(vectorAt(plate.positions, c), vectorAt(plate.positions, a)),
    );
    if (Math.hypot(...area) <= 1e-13) errors.push("zero 3D area");
    if (
      [a, b, c].some((index) => dot(area, vectorAt(plate.normals, index)) <= 0)
    )
      errors.push("inward face");
    const uvs = plate.uvs;
    const uvArea =
      ((uvs[b * 2] ?? 0) - (uvs[a * 2] ?? 0)) *
        ((uvs[c * 2 + 1] ?? 0) - (uvs[a * 2 + 1] ?? 0)) -
      ((uvs[b * 2 + 1] ?? 0) - (uvs[a * 2 + 1] ?? 0)) *
        ((uvs[c * 2] ?? 0) - (uvs[a * 2] ?? 0));
    if (uvArea >= 0) errors.push("folded UV triangle");
    totalArea -= uvArea / 2;
  }
  if (Math.abs(totalArea - polygonArea(plate.outline)) > 1e-8)
    errors.push("missing or duplicate footprint area");
  const edges = directedEdges(plate);
  const boundaryDegree = new Map<number, number>();
  let boundaryCount = 0;
  for (const directions of edges.values()) {
    if (directions.length > 2) errors.push("nonmanifold edge");
    const first = directions[0];
    const second = directions[1];
    if (first && second && (first[0] !== second[1] || first[1] !== second[0]))
      errors.push("inconsistent shared-edge winding");
    if (directions.length === 1 && first) {
      boundaryCount++;
      for (const vertex of first)
        boundaryDegree.set(vertex, (boundaryDegree.get(vertex) ?? 0) + 1);
    }
  }
  if ([...boundaryDegree.values()].some((count) => count !== 2))
    errors.push("open or branched boundary");
  if (vertices - edges.size + plate.indices.length / 3 !== 1)
    errors.push("face is not a single topological disk");
  if (
    plate.appliedReliefInches > 0 &&
    plate.edgeIndices.length / 6 !== boundaryCount
  )
    errors.push("sidewalls miss actual boundary segments");
  if (plate.appliedReliefInches === 0 && plate.edgeIndices.length)
    errors.push("zero-height sidewalls");
  for (let offset = 0; offset < plate.edgeIndices.length; offset += 6) {
    const values = plate.edgePositions;
    const ids = plate.edgeIndices.slice(offset, offset + 6);
    const a = vectorAt(values, ids[0] ?? 0);
    const b = vectorAt(values, ids[1] ?? 0);
    const c = vectorAt(values, ids[2] ?? 0);
    const d = vectorAt(values, ids[3] ?? 0);
    const e = vectorAt(values, ids[4] ?? 0);
    const f = vectorAt(values, ids[5] ?? 0);
    const first = cross(subtract(b, a), subtract(c, a));
    const second = cross(subtract(e, d), subtract(f, d));
    if (
      Math.hypot(...first) <= 1e-13 ||
      Math.hypot(...second) <= 1e-13 ||
      dot(first, second) <= 0
    )
      errors.push("degenerate or folded sidewall");
  }
  return errors;
}

const defaultStudy = generateScaleStudy();

describe("conforming 3D scale study", () => {
  test("defaults to curved blocks, scales jaw density, and is deterministic", () => {
    expect(generateScaleStudy()).toEqual(defaultStudy);
    expect(
      defaultStudy.plates.filter((plate) => plate.surface === "body"),
    ).toHaveLength(480);
    expect(
      defaultStudy.plates.filter((plate) => plate.surface === "jaw"),
    ).toHaveLength(24);
    const aspects = defaultStudy.plates
      .filter((plate) => plate.surface === "body")
      .map((plate) => plate.widthInches / plate.heightInches)
      .sort((a, b) => a - b);
    expect(aspects[Math.floor(aspects.length / 2)]).toBeLessThan(3);
    expect(
      new Set(defaultStudy.plates.map((plate) => plate.widthInches.toFixed(4)))
        .size,
    ).toBeGreaterThan(100);
    expect(generateScaleStudy({ seed: 2 }).plates[0]).not.toEqual(
      defaultStudy.plates[0],
    );
  });

  test("clips complete, coherent, outward, nonfolded curved faces at all supported extremes", () => {
    for (const study of [
      defaultStudy,
      generateScaleStudy({
        columns: 4,
        rows: 2,
        variation: 1,
        supportOffsetInches: 6,
        relief: 6,
      }),
      generateScaleStudy({
        columns: 50,
        rows: 12,
        variation: 1,
        supportOffsetInches: 0,
        relief: 6,
      }),
      generateScaleStudy({
        columns: 240,
        rows: 12,
        gap: 0,
        variation: 0,
        relief: 0,
      }),
    ]) {
      const failures = study.plates.flatMap((plate) =>
        validatePlate(plate).map((error) => `${plate.id}: ${error}`),
      );
      expect(failures).toEqual([]);
      expect(study.triangleCount).toBe(
        study.plates.reduce(
          (total, plate) =>
            total + (plate.indices.length + plate.edgeIndices.length) / 3,
          0,
        ),
      );
      expect(study.plates.length).toBeLessThanOrEqual(1_200);
      expect(study.triangleCount).toBeLessThan(250_000);
    }
  });

  test("curved faces remain nonplanar and preserve the source surface at zero relief", () => {
    const study = generateScaleStudy({
      columns: 4,
      rows: 2,
      variation: 0,
      relief: 0,
    });
    const geometry = generateFoilGeometry();
    const surfaces = {
      body: new ScaleSurface(geometry),
      jaw: new ScaleSurface(geometry.jawGeometry),
    };
    let maximumDistance = 0;
    let maximumPlaneDistance = 0;
    for (const plate of study.plates) {
      const origin = vectorAt(plate.positions, plate.indices[0] ?? 0);
      const normal = vectorAt(plate.normals, plate.indices[0] ?? 0);
      for (let vertex = 0; vertex < plate.positions.length / 3; vertex++) {
        const bounds = plate.sourceBounds;
        const u =
          bounds.u0 + (plate.uvs[vertex * 2] ?? 0) * (bounds.u1 - bounds.u0);
        const v =
          bounds.v0 +
          (plate.uvs[vertex * 2 + 1] ?? 0) * (bounds.v1 - bounds.v0);
        const position = vectorAt(plate.positions, vertex);
        maximumDistance = Math.max(
          maximumDistance,
          Math.hypot(
            ...subtract(
              position,
              surfaces[plate.surface].sample(u, v).position,
            ),
          ),
        );
        maximumPlaneDistance = Math.max(
          maximumPlaneDistance,
          Math.abs(dot(subtract(position, origin), normal)),
        );
      }
    }
    expect(maximumDistance).toBeLessThan(1e-7);
    expect(maximumPlaneDistance).toBeGreaterThan(1);
    const plate = study.plates[0];
    if (!plate) throw new Error("Missing body plate");
    const { u0, u1, v0, v1 } = plate.sourceBounds;
    const chord = Math.hypot(
      ...subtract(
        surfaces.body.sample(u1, (v0 + v1) / 2).position,
        surfaces.body.sample(u0, (v0 + v1) / 2).position,
      ),
    );
    expect(plate.widthInches).toBeGreaterThan(chord * 1.1);
  });

  test("reduces whole-plate relief at tight bends and reports the adjustment", () => {
    const study = generateScaleStudy({
      columns: 4,
      rows: 2,
      variation: 1,
      supportOffsetInches: 6,
      relief: 6,
    });
    expect(study.adjustedReliefCount).toBeGreaterThan(0);
    expect(
      study.plates.every(
        (plate) =>
          plate.appliedReliefInches >= 0 && plate.appliedReliefInches <= 6,
      ),
    ).toBe(true);
    expect(defaultStudy.adjustedReliefCount).toBe(0);
  });

  test("varied courses have disjoint footprints and keep writing gutters within beveled corners", () => {
    for (const plate of defaultStudy.plates) {
      const bounds = plate.sourceBounds;
      expect(bounds.u0).toBeLessThan(bounds.u1);
      expect(bounds.v0).toBeLessThan(bounds.v1);
      expect(plate.safeRect).toEqual({
        x: 0.2,
        y: 0.2,
        width: 0.6,
        height: 0.6,
      });
      expect(plate.outline).toHaveLength(8);
      for (const corner of [
        [0.2, 0.2],
        [0.8, 0.2],
        [0.8, 0.8],
        [0.2, 0.8],
      ]) {
        for (let i = 0; i < plate.outline.length; i++) {
          const a = plate.outline[i];
          const b = plate.outline[(i + 1) % plate.outline.length];
          if (!a || !b) continue;
          expect(
            (b[0] - a[0]) * ((corner[1] ?? 0) - a[1]) -
              (b[1] - a[1]) * ((corner[0] ?? 0) - a[0]),
          ).toBeGreaterThanOrEqual(0);
        }
      }
    }
    const overlap: string[] = [];
    for (let i = 0; i < defaultStudy.plates.length; i++) {
      const a = defaultStudy.plates[i];
      for (let j = i + 1; j < defaultStudy.plates.length; j++) {
        const b = defaultStudy.plates[j];
        if (!a || !b || a.surface !== b.surface) continue;
        if (
          a.sourceBounds.u0 < b.sourceBounds.u1 &&
          b.sourceBounds.u0 < a.sourceBounds.u1 &&
          a.sourceBounds.v0 < b.sourceBounds.v1 &&
          b.sourceBounds.v0 < a.sourceBounds.v1
        )
          overlap.push(`${a.id}:${b.id}`);
      }
    }
    expect(overlap).toEqual([]);
    const firstCourse = defaultStudy.plates.find(
      (plate) =>
        plate.surface === "body" && plate.row === 0 && plate.column === 1,
    );
    const nextCourse = defaultStudy.plates.find(
      (plate) =>
        plate.surface === "body" && plate.row === 1 && plate.column === 1,
    );
    expect(firstCourse?.sourceBounds.u0).not.toBe(nextCourse?.sourceBounds.u0);
  });

  test("keeps explicit planar mode planar with coherent topology", () => {
    const study = generateScaleStudy({
      columns: 12,
      rows: 3,
      surfaceMode: "planar",
    });
    expect(study.adjustedReliefCount).toBe(0);
    for (const plate of study.plates) {
      expect(validatePlate(plate)).toEqual([]);
      const center = vectorAt(plate.positions, 0);
      const normal = vectorAt(plate.normals, 0);
      for (let vertex = 1; vertex < plate.positions.length / 3; vertex++)
        expect(
          Math.abs(
            dot(subtract(vectorAt(plate.positions, vertex), center), normal),
          ),
        ).toBeLessThan(1e-8);
    }
  });

  test("normalizes old designs to conforming and bounds all dimensions", () => {
    expect(normalizeScaleStudySettings(null)).toEqual({
      ...DEFAULT_SCALE_STUDY_SETTINGS,
      ...LEGACY_SCALE_SHAPE,
      relief: 0.65,
    });
    expect(
      normalizeScaleStudySettings({ columns: 24, rows: 8 }).surfaceMode,
    ).toBe("conforming");
    expect(
      normalizeScaleStudySettings({
        columns: 999,
        rows: 999,
        gap: -1,
        relief: 99,
        supportOffsetInches: 99,
        variation: Number.NaN,
        seed: -20,
      }),
    ).toEqual({
      ...LEGACY_SCALE_SHAPE,
      modelId: "archival",
      modelScale: 1,
      columns: 240,
      rows: 2,
      gap: 0,
      relief: 6,
      supportOffsetInches: 6,
      surfaceMode: "conforming",
      variation: DEFAULT_SCALE_STUDY_SETTINGS.variation,
      seed: 0,
    });
  });

  test("resizes physical surfaces and lettering dimensions without changing plate identities", () => {
    const settings = {
      columns: 12,
      rows: 3,
      supportOffsetInches: 0,
      relief: 0,
    };
    const fullSize = generateScaleStudy(settings);
    for (const factor of [0.02, 180 / 25.4 / 206.3, 72 / 206.3, 1, 1.25, 30]) {
      const resized = generateScaleStudy({ ...settings, modelScale: factor });
      expect(resized.modelId).toBe("archival");
      expect(resized.modelScale).toBe(factor);
      expect(resized.plates.map((plate) => plate.id)).toEqual(
        fullSize.plates.map((plate) => plate.id),
      );
      expect(resized.plates.flatMap(validatePlate)).toEqual([]);
      for (let index = 0; index < fullSize.plates.length; index++) {
        const original = fullSize.plates[index];
        const scaled = resized.plates[index];
        if (!original || !scaled) throw new Error("Missing resized plate");
        expect(scaled.widthInches).toBeCloseTo(
          original.widthInches * factor,
          7,
        );
        expect(scaled.heightInches).toBeCloseTo(
          original.heightInches * factor,
          7,
        );
      }
    }
  });

  test("keeps stock allowance and relief in real inches when a frame shrinks", () => {
    const supportOffsetInches = 1 / 25.4;
    const relief = 0.5 / 25.4;
    const referenceBare = generateScaledScaleGeometry({
      modelScale: 1,
      supportOffsetInches: 0,
    });
    const referenceLayer = generateScaledScaleGeometry({
      modelScale: 1,
      supportOffsetInches,
    });
    for (const factor of [180 / 25.4 / 206.3, 72 / 206.3, 1.25]) {
      const bare = generateScaledScaleGeometry({
        modelScale: factor,
        supportOffsetInches: 0,
      });
      const layer = generateScaledScaleGeometry({
        modelScale: factor,
        supportOffsetInches,
      });
      let maximumLayerError = 0;
      for (let i = 0; i < bare.positions.length; i++) {
        maximumLayerError = Math.max(
          maximumLayerError,
          Math.abs(
            (layer.positions[i] ?? 0) -
              (bare.positions[i] ?? 0) -
              ((referenceLayer.positions[i] ?? 0) -
                (referenceBare.positions[i] ?? 0)),
          ),
        );
      }
      expect(maximumLayerError).toBeLessThan(1e-10);
      const study = generateScaleStudy({
        modelScale: factor,
        supportOffsetInches,
        relief,
        columns: 24,
        rows: 4,
        variation: 0,
      });
      expect(study.plates.flatMap(validatePlate)).toEqual([]);
      expect(
        study.plates.some(
          (plate) => Math.abs(plate.appliedReliefInches - relief) < 1e-12,
        ),
      ).toBe(true);
      expect(
        study.plates.every((plate) => plate.appliedReliefInches <= relief),
      ).toBe(true);
    }
  });

  test("scaled surface adapter preserves the original geometry and recomputes physical loop lengths", () => {
    const historical = generateFoilGeometry({ radiusOffsetInches: 2 });
    const adapted = generateScaledScaleGeometry({
      modelScale: 1,
      supportOffsetInches: 2,
    });
    let maximumError = 0;
    for (let i = 0; i < historical.positions.length; i++)
      maximumError = Math.max(
        maximumError,
        Math.abs((adapted.positions[i] ?? 0) - (historical.positions[i] ?? 0)),
      );
    expect(maximumError).toBeLessThan(1e-10);
    expect(adapted.readingLoopLengthInches).toBeCloseTo(
      historical.readingLoopLengthInches,
      8,
    );
    const bare = generateScaledScaleGeometry({
      modelScale: 1,
      supportOffsetInches: 0,
    });
    const scaled = generateScaledScaleGeometry({
      modelScale: 0.1,
      supportOffsetInches: 0,
    });
    expect(scaled.readingLoopLengthInches).toBeCloseTo(
      bare.readingLoopLengthInches * 0.1,
      8,
    );
    expect(scaled.jawGeometry.readingLoopLengthInches).toBeCloseTo(
      bare.jawGeometry.readingLoopLengthInches * 0.1,
      8,
    );
  });

  test("normalizes source and scale limits and reports physically folded thick miniature layers", () => {
    expect(normalizeScaleStudySettings({ modelScale: 0 }).modelScale).toBe(
      0.02,
    );
    expect(normalizeScaleStudySettings({ modelScale: 999 }).modelScale).toBe(
      30,
    );
    expect(
      normalizeScaleStudySettings({ modelScale: Number.NaN }).modelScale,
    ).toBe(1);
    expect(
      normalizeScaleStudySettings({ modelScale: Number.POSITIVE_INFINITY })
        .modelScale,
    ).toBe(1);
    expect(normalizeScaleStudySettings({ modelId: "unknown" }).modelId).toBe(
      "archival",
    );
    expect(normalizeScaleStudySettings({ modelId: "maquette" }).modelId).toBe(
      "maquette",
    );
    expect(() =>
      generateScaleStudy({
        modelScale: 0.02,
        supportOffsetInches: 6,
        relief: 0,
      }),
    ).toThrow("Reduce the intermediate-layer thickness or enlarge the model");
  });

  test("layer allowance changes the study without mutating historical geometry", () => {
    const original = generateFoilGeometry();
    const snapshot = structuredClone(original);
    const raised = generateScaleStudy({ supportOffsetInches: 3 });
    expect(raised.plates[0]?.positions).not.toEqual(
      defaultStudy.plates[0]?.positions,
    );
    expect(original).toEqual(snapshot);
    expect(generateFoilGeometry()).toEqual(snapshot);
  });
});

describe("tunable archival footprints", () => {
  test("each silhouette remains complete, outward and nonfolded with disjoint fitted cells", () => {
    for (const plateShape of ["clipped", "rectangle", "diamond"] as const) {
      for (const surfaceMode of ["conforming", "planar"] as const) {
        const study = generateScaleStudy({
          ...DEFAULT_SCALE_STUDY_SETTINGS,
          columns: 24,
          rows: 3,
          plateShape,
          surfaceMode,
          cornerCut: 0.3,
          plateTaper: -0.4,
          variation: 1,
          relief: 0.5,
        });
        expect(study.plates.length).toBeGreaterThan(0);
        expect(study.plates.flatMap(validatePlate)).toEqual([]);
        for (const plate of study.plates) {
          const rect = plate.safeRect;
          for (const [x, y] of [
            [rect.x, rect.y],
            [rect.x + rect.width, rect.y],
            [rect.x + rect.width, rect.y + rect.height],
            [rect.x, rect.y + rect.height],
          ]) {
            for (let i = 0; i < plate.outline.length; i++) {
              const a = required(plate.outline[i]),
                b = required(plate.outline[(i + 1) % plate.outline.length]);
              expect(
                (b[0] - a[0]) * (required(y) - a[1]) -
                  (b[1] - a[1]) * (required(x) - a[0]),
              ).toBeGreaterThanOrEqual(-1e-10);
            }
          }
        }
        const overlaps = study.plates.flatMap((a, i) =>
          study.plates
            .slice(i + 1)
            .filter(
              (b) =>
                a.surface === b.surface &&
                a.sourceBounds.u0 < b.sourceBounds.u1 &&
                b.sourceBounds.u0 < a.sourceBounds.u1 &&
                a.sourceBounds.v0 < b.sourceBounds.v1 &&
                b.sourceBounds.v0 < a.sourceBounds.v1,
            ),
        );
        expect(overlaps).toEqual([]);
      }
    }
  });

  test("physical aspect adjustment remaps face size without changing real stock", () => {
    const input = {
      ...DEFAULT_SCALE_STUDY_SETTINGS,
      columns: 24,
      rows: 3,
      surfaceMode: "planar" as const,
      variation: 0,
      relief: 0.5,
      plateShape: "rectangle" as const,
      plateTaper: 0,
    };
    const original = generateScaleStudy({ ...input, plateAspect: 0 });
    const fitted = generateScaleStudy({ ...input, plateAspect: 1.3 });
    const resized = generateScaleStudy({
      ...input,
      plateAspect: 1.3,
      modelScale: 0.5,
    });
    expect(
      resized.plates.every((plate) => plate.appliedReliefInches === 0.5),
    ).toBe(true);
    expect(resized.plates.flatMap(validatePlate)).toEqual([]);
    expect(fitted.plates.map((p) => p.id)).toEqual(
      original.plates.map((p) => p.id),
    );
    for (let i = 0; i < fitted.plates.length; i++) {
      const plate = required(fitted.plates[i]),
        old = required(original.plates[i]);
      expect(plate.appliedReliefInches).toBe(0.5);
      expect(plate.sourceBounds.u0).toBeGreaterThanOrEqual(0);
      expect(plate.sourceBounds.u1).toBeLessThanOrEqual(1);
      expect(plate.sourceBounds.v0).toBeGreaterThanOrEqual(0);
      expect(plate.sourceBounds.v1).toBeLessThanOrEqual(1);
      expect(plate.widthInches + plate.heightInches).not.toBe(
        old.widthInches + old.heightInches,
      );
    }
    const errors = fitted.plates
      .map((p) => Math.abs(p.widthInches / p.heightInches - 1.3))
      .sort((a, b) => a - b);
    expect(errors[Math.floor(errors.length / 2)]).toBeLessThan(0.1);
  });
});

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Missing test fixture value.");
  return value;
}

test("physical course CDF keeps deterministic disjoint endpoints and improves fresh face coverage", () => {
  const surface = new ScaleSurface(
    generateScaledScaleGeometry(DEFAULT_SCALE_STUDY_SETTINGS),
  );
  const fractions = Array.from({ length: 121 }, (_, i) => i / 120);
  const v0 = 0.055,
    v1 = 0.28;
  const weighted = physicalScaleCoursePartitions(surface, fractions, v0, v1);
  expect(weighted).toEqual(
    physicalScaleCoursePartitions(surface, fractions, v0, v1),
  );
  expect(weighted).toHaveLength(fractions.length);
  expect(weighted[0]).toBe(0);
  expect(weighted.at(-1)).toBe(1);
  const ratios = (course: number[]) =>
    course
      .slice(0, -1)
      .map((u0, i) => {
        const u1 = required(course[i + 1]),
          u = (u0 + u1) / 2,
          v = (v0 + v1) / 2;
        const ratio =
          surface.arcLength([u0, v], [u1, v], 0) /
          surface.arcLength([u, v0], [u, v1], 0);
        return Math.min(ratio / 1.3, 1.3 / ratio);
      })
      .sort((a, b) => a - b);
  for (let i = 1; i < weighted.length; i++)
    expect(required(weighted[i])).toBeGreaterThan(required(weighted[i - 1]));
  const old = ratios(fractions),
    improved = ratios(weighted);
  expect(required(improved[60])).toBeGreaterThan(required(old[60]) + 0.2);
  expect(required(improved[30])).toBeGreaterThan(required(old[30]) + 0.2);
});

test("course weighting handles only collapsed height and rejects invalid physical metrics", () => {
  const surface = new ScaleSurface(
    generateScaledScaleGeometry(DEFAULT_SCALE_STUDY_SETTINGS),
  );
  const fractions = [0, 0.2, 0.4, 0.7, 1];
  const collapsed = physicalScaleCoursePartitions(surface, fractions, 0.2, 0.2);
  expect(collapsed.every(Number.isFinite)).toBe(true);
  for (let i = 1; i < collapsed.length; i++)
    expect(required(collapsed[i])).toBeGreaterThan(required(collapsed[i - 1]));
  surface.arcLength = () => Number.NaN;
  expect(() =>
    physicalScaleCoursePartitions(surface, fractions, 0.1, 0.3),
  ).toThrow("invalid physical dimensions");
  surface.arcLength = () => 0;
  expect(() =>
    physicalScaleCoursePartitions(surface, fractions, 0.1, 0.3),
  ).toThrow("no positive physical length");
});
