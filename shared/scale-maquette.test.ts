import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { allocateScaleLettering } from "./scale-lettering";
import {
  generateMaquetteScaleStudy,
  maquettePatchMetrics,
  maquetteWritingRect,
} from "./scale-maquette";
import data from "./scale-maquette.json";
import { DEFAULT_SCALE_STUDY_SETTINGS } from "./scale-study";
import { cross, dot, subtract, vectorAt } from "./scale-surface";

const settings = {
  ...DEFAULT_SCALE_STUDY_SETTINGS,
  modelId: "maquette" as const,
  modelScale: 1,
  columns: 12,
  rows: 2,
  supportOffsetInches: 0,
  relief: 0,
  variation: 0,
};

describe("actual print maquette scale adapter", () => {
  test("UV clipping roundoff cannot invalidate the entire lettering remap", () => {
    const slivers = [
      [-1e-12, 0.4, -1e-12, 0.6, 0, 0.4],
      [1, 0.4, 1, 0.6, 1 + 1e-12, 0.4],
      [0.4, -1e-12, 0.4, 0, 0.6, -1e-12],
      [0.4, 1, 0.4, 1 + 1e-12, 0.6, 1],
    ];
    for (const uvs of slivers) {
      const safeRect = maquetteWritingRect({ uvs, indices: [0, 1, 2] });
      expect(safeRect.x).toBeGreaterThanOrEqual(0);
      expect(safeRect.y).toBeGreaterThanOrEqual(0);
      expect(safeRect.x + safeRect.width).toBeLessThanOrEqual(1);
      expect(safeRect.y + safeRect.height).toBeLessThanOrEqual(1);
      const result = allocateScaleLettering(
        [
          {
            id: "edge",
            surface: "body",
            widthInches: 1,
            heightInches: 1,
            safeRect,
          },
          {
            id: "next",
            surface: "body",
            widthInches: 10,
            heightInches: 10,
            safeRect: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
          },
        ],
        "Words continue on the next face.",
        { fontSizeMm: 3, marginMm: 1 },
      );
      expect(result.placements[0]?.lines).toEqual([]);
      expect(result.unplacedText).toBe("");
      expect(result.placedWordCount).toBe(result.totalWordCount);
    }
  });
  test("derived charts remain bound to the exact original STL and fabrication manifest", async () => {
    const stl = await readFile(
      new URL(
        "../public/fabrication/print/muchado-maquette-180mm.stl",
        import.meta.url,
      ),
    );
    const manifest = await readFile(
      new URL(
        "../public/fabrication/small-foil/manifest.json",
        import.meta.url,
      ),
    );
    expect(createHash("sha256").update(stl).digest("hex")).toBe(data.stlSha256);
    expect(createHash("sha256").update(manifest).digest("hex")).toBe(
      data.chartManifestSha256,
    );
    expect(stl.readUInt32LE(80)).toBe(5490);
    expect(data.indices.length).toBe(5490 * 3);
    expect(data.charts).toHaveLength(307);
    expect(
      data.charts.reduce((total, chart) => total + chart.indices.length / 3, 0),
    ).toBe(5426);
    expect(data.excludedUndersideTriangles).toBe(64);
    let exact = true;
    for (let face = 0; face < 5490; face++) {
      for (let corner = 0; corner < 3; corner++) {
        const offset = 84 + face * 50 + 12 + corner * 12;
        const point = vectorAt(
          data.positionsMm,
          data.indices[face * 3 + corner] ?? 0,
        );
        exact &&=
          point[0] === stl.readFloatLE(offset) &&
          point[1] === stl.readFloatLE(offset + 8) &&
          point[2] === -stl.readFloatLE(offset + 4);
      }
    }
    expect(exact).toBe(true);
  });

  test("native print scale and doubled size preserve the actual base and remap physical plate metrics", () => {
    const native = generateMaquetteScaleStudy(settings);
    const doubled = generateMaquetteScaleStudy({ ...settings, modelScale: 2 });
    expect(native.modelId).toBe("maquette");
    expect(native.sourceGeometry?.indices).toHaveLength(5490 * 3);
    const heights =
      native.sourceGeometry?.positions.filter((_, index) => index % 3 === 1) ??
      [];
    expect(Math.max(...heights) - Math.min(...heights)).toBeCloseTo(
      180 / 25.4,
      5,
    );
    expect(native.plates.length).toBeGreaterThan(307);
    expect(native.plates.length).toBeLessThan(2500);
    expect(doubled.plates).toHaveLength(native.plates.length);
    expect(native.unletterablePlateCount).toBe(0);
    for (const [index, plate] of native.plates.entries()) {
      const larger = doubled.plates[index];
      expect(larger?.id).toBe(plate.id);
      expect(larger?.widthInches).toBeCloseTo(plate.widthInches * 2, 8);
      expect(larger?.heightInches).toBeCloseTo(plate.heightInches * 2, 8);
      expect(larger?.positions).toEqual(
        plate.positions.map((value) => value * 2),
      );
    }
  });

  test("thin physical metal and raised scales work at native size with honest unusable lettering regions", () => {
    const study = generateMaquetteScaleStudy({
      ...settings,
      columns: 120,
      rows: 4,
      supportOffsetInches: 0.127 / 25.4,
      relief: 1 / 25.4,
    });
    expect(study.plates.length).toBeGreaterThan(0);
    expect(study.plates.length).toBeLessThan(2500);
    expect(study.triangleCount).toBeLessThan(80000);
    expect(study.unletterablePlateCount).toBeGreaterThan(0);
    expect(study.unletterablePlateCount).toBe(
      study.plates.filter((plate) => plate.safeRect.width === 0).length,
    );
    let finite = true;
    let outward = true;
    for (const plate of study.plates) {
      finite &&=
        plate.positions.every(Number.isFinite) &&
        plate.normals.every(Number.isFinite) &&
        Number.isFinite(plate.widthInches + plate.heightInches) &&
        plate.widthInches > 0 &&
        plate.heightInches > 0;
      expect(plate.safeRect.x).toBeGreaterThanOrEqual(-1e-9);
      expect(plate.safeRect.y).toBeGreaterThanOrEqual(-1e-9);
      expect(plate.safeRect.x + plate.safeRect.width).toBeLessThanOrEqual(
        1 + 1e-9,
      );
      expect(plate.safeRect.y + plate.safeRect.height).toBeLessThanOrEqual(
        1 + 1e-9,
      );
      for (let offset = 0; offset < plate.indices.length; offset += 3) {
        const ids = plate.indices.slice(offset, offset + 3);
        const [a, b, c] = ids.map((id) => vectorAt(plate.positions, id));
        if (!a || !b || !c) throw new Error("Incomplete triangle");
        const normal = cross(subtract(b, a), subtract(c, a));
        outward &&= ids.every(
          (id) => dot(normal, vectorAt(plate.normals, id)) > 0,
        );
      }
    }
    expect(finite).toBe(true);
    expect(outward).toBe(true);
  });

  test("writing rectangles stay within an actual triangle and distorted physical mappings are rejected", () => {
    const triangle = { uvs: [0, 0, 0, 1, 1, 0], indices: [0, 1, 2] };
    const rect = maquetteWritingRect(triangle);
    expect(rect.width * rect.height).toBeGreaterThan(0);
    expect(rect.x + rect.width + rect.y + rect.height).toBeLessThanOrEqual(
      1 + 1e-10,
    );
    const good = maquettePatchMetrics({
      ...triangle,
      positions: [0, 0, 0, 0, 1, 0, 2, 0, 0],
    });
    expect(good.widthInches).toBeCloseTo(2, 8);
    expect(good.heightInches).toBeCloseTo(1, 8);
    expect(good.suitableForLettering).toBe(true);
    const shear = maquettePatchMetrics({
      ...triangle,
      positions: [0, 0, 0, 1, 1, 0, 2, 0, 0],
    });
    expect(shear.suitableForLettering).toBe(false);
  });

  test("density directions and seeded layouts remap independently within a bounded extreme study", () => {
    const first = generateMaquetteScaleStudy({
      ...settings,
      columns: 120,
      rows: 4,
      variation: 0.6,
      seed: 12,
    });
    const second = generateMaquetteScaleStudy({
      ...settings,
      columns: 60,
      rows: 8,
      variation: 0.6,
      seed: 12,
    });
    const reseeded = generateMaquetteScaleStudy({
      ...settings,
      columns: 120,
      rows: 4,
      variation: 0.6,
      seed: 13,
    });
    expect(first.plates.map((plate) => plate.sourceBounds)).not.toEqual(
      second.plates.map((plate) => plate.sourceBounds),
    );
    expect(first.plates.map((plate) => plate.sourceBounds)).not.toEqual(
      reseeded.plates.map((plate) => plate.sourceBounds),
    );
    const extreme = generateMaquetteScaleStudy({
      ...settings,
      columns: 240,
      rows: 12,
      modelScale: 0.02,
      supportOffsetInches: 6,
      relief: 6,
    });
    expect(extreme.plates.length).toBeLessThanOrEqual(6000);
    expect(extreme.triangleCount).toBeLessThanOrEqual(100000);
    expect(
      extreme.plates.every((plate) => plate.positions.every(Number.isFinite)),
    ).toBe(true);
  });
});

test("every tunable maquette silhouette clips actual source faces without folds or invented writing space", () => {
  for (const plateShape of ["clipped", "rectangle", "diamond"] as const) {
    const study = generateMaquetteScaleStudy({
      ...settings,
      plateShape,
      plateAspect: 1.3,
      plateTaper: 0.4,
      cornerCut: 0.3,
      variation: 1,
      relief: 0.5 / 25.4,
    });
    expect(study.plates.length).toBeGreaterThan(0);
    expect(study.plates.length).toBeLessThan(6000);
    expect(study.triangleCount).toBeLessThan(100000);
    let outward = true,
      unfolded = true;
    for (const plate of study.plates) {
      expect(plate.appliedReliefInches).toBeLessThanOrEqual(0.5 / 25.4);
      expect(plate.positions.every(Number.isFinite)).toBe(true);
      for (let i = 0; i < plate.indices.length; i += 3) {
        const ids = plate.indices.slice(i, i + 3);
        const [a, b, c] = ids.map((id) => vectorAt(plate.positions, id));
        const normal = cross(
          subtract(required(b), required(a)),
          subtract(required(c), required(a)),
        );
        outward &&= ids.every(
          (id) => dot(normal, vectorAt(plate.normals, id)) > 0,
        );
        const [u, v, w] = ids.map(
          (id) =>
            [required(plate.uvs[id * 2]), required(plate.uvs[id * 2 + 1])] as [
              number,
              number,
            ],
        );
        unfolded &&=
          (required(v)[0] - required(u)[0]) *
            (required(w)[1] - required(u)[1]) -
            (required(v)[1] - required(u)[1]) *
              (required(w)[0] - required(u)[0]) <
          0;
      }
      expect(plate.safeRect).toEqual(
        maquettePatchMetrics(plate).suitableForLettering
          ? maquetteWritingRect(plate)
          : { x: 0, y: 0, width: 0, height: 0 },
      );
    }
    expect(outward).toBe(true);
    expect(unfolded).toBe(true);
  }
});

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Missing test fixture value.");
  return value;
}
