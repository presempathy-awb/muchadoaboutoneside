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
import { deformedMaquetteBody } from "./scale-maquette-body";
import radial from "./scale-maquette-body.json";
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
    // Four complete STL adaptations include pathological physical offsets at
    // minimum model size; allow CPU contention without relaxing their budgets.
  }, 15_000);
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
}, 15_000);

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Missing test fixture value.");
  return value;
}

describe("local print-model body proportions", () => {
  test("identity is the exact original mesh and charts; metadata is bound to its inputs", async () => {
    const identity = deformedMaquetteBody();
    expect(identity.positionsMm).toBe(data.positionsMm);
    expect(identity.charts).toBe(data.charts);
    expect(radial.stlSha256).toBe(data.stlSha256);
    for (const [name, hash] of [
      ["scale-maquette.json", radial.sourceChartsSha256],
      ["foil-sections.json", radial.sourceSectionsSha256],
      ["../scripts/generate-scale-body.py", radial.generatorSha256],
    ] as const) {
      const bytes = await readFile(new URL(`./${name}`, import.meta.url));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(hash);
    }
    expect(radial.widthDisplacementsMm).toHaveLength(data.positionsMm.length);
    expect(radial.depthDisplacementsMm).toHaveLength(data.positionsMm.length);
    expect(radial.maximumProjectionDistanceMm).toBeLessThanOrEqual(0.37511);
  });
  test("local tube adjustments leave every contact and plinth vertex fixed", () => {
    const body = deformedMaquetteBody(1.1, 0.9);
    expect(radial.fixedVertices.length).toBeGreaterThan(100);
    for (const id of radial.fixedVertices) {
      expect(vectorAt(body.positionsMm, id)).toEqual(
        vectorAt(data.positionsMm, id),
      );
    }
    expect(body.positionsMm.every(Number.isFinite)).toBe(true);
    expect(body.positionsMm).not.toEqual(data.positionsMm);
  });
  test("changed hinge charts preserve actual deformed triangle edge lengths", () => {
    for (const [width, depth] of [
      [1.1, 0.9],
      [0.9, 1.1],
    ]) {
      const body = deformedMaquetteBody(width, depth);
      for (const chart of body.charts) {
        for (let offset = 0; offset < chart.indices.length; offset += 3) {
          for (let edge = 0; edge < 3; edge++) {
            const a = chart.indices[offset + edge] ?? 0;
            const b = chart.indices[offset + ((edge + 1) % 3)] ?? 0;
            const physical = Math.hypot(
              ...subtract(
                vectorAt(body.positionsMm, chart.vertices[a] ?? 0),
                vectorAt(body.positionsMm, chart.vertices[b] ?? 0),
              ),
            );
            const flat = Math.hypot(
              ((chart.uvs[a * 2] ?? 0) - (chart.uvs[b * 2] ?? 0)) *
                chart.widthMm,
              ((chart.uvs[a * 2 + 1] ?? 0) - (chart.uvs[b * 2 + 1] ?? 0)) *
                chart.heightMm,
            );
            expect(flat).toBeCloseTo(physical, 8);
          }
        }
      }
    }
  });
  test("source and generated plates use the same changed body, preserving physical layers", () => {
    const study = generateMaquetteScaleStudy({
      ...settings,
      bodyWidthScale: 1.1,
      bodyDepthScale: 0.9,
      supportOffsetInches: 0.015,
      relief: 0.01,
    });
    const body = deformedMaquetteBody(1.1, 0.9);
    expect(study.sourceGeometry?.positions).toEqual(
      body.positionsMm.map((v) => v * (1 / 25.4)),
    );
    expect(study.bodyWidthScale).toBe(1.1);
    expect(study.bodyDepthScale).toBe(0.9);
    expect(study.plates.length).toBeGreaterThan(0);
    for (const plate of study.plates) {
      expect(plate.positions.every(Number.isFinite)).toBe(true);
      expect(plate.appliedReliefInches).toBeGreaterThanOrEqual(0);
      expect(plate.appliedReliefInches).toBeLessThanOrEqual(0.01);
      expect(plate.safeRect.x + plate.safeRect.width).toBeLessThanOrEqual(
        1 + 1e-10,
      );
      expect(plate.safeRect.y + plate.safeRect.height).toBeLessThanOrEqual(
        1 + 1e-10,
      );
    }
    const larger = generateMaquetteScaleStudy({
      ...settings,
      modelScale: 2,
      bodyWidthScale: 1.1,
      bodyDepthScale: 0.9,
      supportOffsetInches: 0.015,
      relief: 0.01,
    });
    expect(
      Math.max(...larger.plates.map((p) => p.appliedReliefInches)),
    ).toBeCloseTo(0.01, 10);
    const lettering = allocateScaleLettering(
      study.plates,
      "Words follow changed plates in reading order.",
      { fontSizeMm: 0.5, marginMm: 0.1 },
    );
    expect(
      lettering.placedWordCount +
        lettering.unplacedText.split(/\s+/u).filter(Boolean).length,
    ).toBe(lettering.totalWordCount);
  });
  test("invalid factors are rejected before returning replacement geometry", () => {
    expect(() => deformedMaquetteBody(Number.NaN, 1)).toThrow();
    expect(() => deformedMaquetteBody(0.49, 1)).toThrow();
    expect(() => deformedMaquetteBody(1, 2.01)).toThrow();
    expect(() => deformedMaquetteBody(2, 0.5)).toThrow(
      "fold a print-model junction",
    );
  });
});

function meshSurfaceArea(positions: number[], indices: number[]) {
  let area = 0;
  for (let offset = 0; offset < indices.length; offset += 3) {
    const a = vectorAt(positions, indices[offset] ?? 0);
    const b = vectorAt(positions, indices[offset + 1] ?? 0);
    const c = vectorAt(positions, indices[offset + 2] ?? 0);
    area += Math.hypot(...cross(subtract(b, a), subtract(c, a))) / 2;
  }
  return area;
}

describe("maquette cover packing", () => {
  test("fresh wood plates cover 90–95% of actual eligible STL surface, excluding contact underside", () => {
    for (const bodySettings of [
      { modelScale: 1, bodyWidthScale: 1, bodyDepthScale: 1 },
      { modelScale: 2, bodyWidthScale: 1.1, bodyDepthScale: 0.9 },
    ]) {
      const study = generateMaquetteScaleStudy({
        ...DEFAULT_SCALE_STUDY_SETTINGS,
        ...bodySettings,
        modelId: "maquette",
        supportOffsetInches: 0,
        relief: 0,
      });
      expect(DEFAULT_SCALE_STUDY_SETTINGS.plateFit).toBe("cover");
      const sourcePositions = required(study.sourceGeometry).positions;
      // The existing 5,426 exposed chart triangles include base top/sides;
      // only the 64 build-plate contact underside triangles are excluded.
      const eligibleIndices = data.charts.flatMap((chart) =>
        chart.indices.map((id) => chart.vertices[id] ?? 0),
      );
      expect(eligibleIndices).toHaveLength(5426 * 3);
      const eligibleArea = meshSurfaceArea(sourcePositions, eligibleIndices);
      const fullArea = meshSurfaceArea(sourcePositions, data.indices);
      const platedArea = study.plates.reduce(
        (sum, plate) => sum + meshSurfaceArea(plate.positions, plate.indices),
        0,
      );
      expect(eligibleArea).toBeLessThan(fullArea);
      expect(platedArea / eligibleArea).toBeGreaterThanOrEqual(0.9);
      expect(platedArea / eligibleArea).toBeLessThanOrEqual(0.951);
      expect(study.plates.length).toBeLessThanOrEqual(6000);
      expect(study.triangleCount).toBeLessThanOrEqual(100000);
    }
  });
  test("cover aspect changes chart cell allocation without inscribing tiny plates", () => {
    const common = {
      ...DEFAULT_SCALE_STUDY_SETTINGS,
      modelId: "maquette" as const,
      supportOffsetInches: 0,
      relief: 0,
      gap: 0,
      variation: 0,
      plateShape: "rectangle" as const,
      plateTaper: 0,
    };
    const narrow = generateMaquetteScaleStudy({ ...common, plateAspect: 0.5 });
    const wide = generateMaquetteScaleStudy({ ...common, plateAspect: 2.5 });
    const sourcePositions = required(narrow.sourceGeometry).positions;
    const eligibleIndices = data.charts.flatMap((chart) =>
      chart.indices.map((id) => chart.vertices[id] ?? 0),
    );
    const eligibleArea = meshSurfaceArea(sourcePositions, eligibleIndices);
    for (const study of [narrow, wide]) {
      const platedArea = study.plates.reduce(
        (sum, plate) => sum + meshSurfaceArea(plate.positions, plate.indices),
        0,
      );
      expect(platedArea / eligibleArea).toBeCloseTo(1, 8);
      expect(
        study.plates.every((plate) => plate.positions.every(Number.isFinite)),
      ).toBe(true);
    }
    expect(narrow.plates.map((plate) => plate.sourceBounds)).not.toEqual(
      wide.plates.map((plate) => plate.sourceBounds),
    );
  });
  test("an old saved inset study and its explicit inset migration are byte-identical", () => {
    const { plateFit: _plateFit, ...oldSettings } = {
      ...settings,
      plateShape: "clipped" as const,
      plateFit: "inset" as const,
      plateAspect: 1.3,
      cornerCut: 0.12,
      plateTaper: 0.08,
    };
    // Normalization accepts the older missing field and preserves inset behavior.
    const old = generateMaquetteScaleStudy(oldSettings as typeof settings);
    const explicit = generateMaquetteScaleStudy({
      ...oldSettings,
      plateFit: "inset",
    });
    expect(JSON.stringify(old)).toBe(JSON.stringify(explicit));
  });
});
