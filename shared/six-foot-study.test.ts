import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import sourceManifest from "../source/assets/manifest.json";
import {
  type FoilMeshGeometry,
  generateFoilGeometry,
} from "../src/lib/foil-geometry";
import reference from "./six-foot-reference.json";
import { SIX_FOOT_STUDY } from "./six-foot-study";

test("six-foot proportions retain the source scale and distinguish the base", () => {
  expect(SIX_FOOT_STUDY.targetHeightInches).toBe(72);
  expect(SIX_FOOT_STUDY.scale * sourceManifest.model.dimensions.height).toBe(
    72,
  );
  expect(SIX_FOOT_STUDY.bodyWidthInches).toBeCloseTo(40.4, 1);
  expect(SIX_FOOT_STUDY.bodyDepthInches).toBeCloseTo(12, 1);
  expect(SIX_FOOT_STUDY.referenceBaseWidthInches).toBeCloseTo(59.7, 1);
  expect(SIX_FOOT_STUDY.bodyWidthInches).toBeLessThan(
    SIX_FOOT_STUDY.referenceBaseWidthInches,
  );
});

test("stored reference bounds match the unchanged source GLB without its base", () => {
  const bytes = readFileSync(
    new URL("../source/assets/snake_build.glb", import.meta.url),
  );
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(
    reference.sourceGlbSha256,
  );
  const gltf = JSON.parse(
    bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
  ) as {
    nodes: Array<{
      matrix?: number[];
      scale?: number[];
      rotation?: number[];
      translation?: number[];
    }>;
    meshes: Array<{
      name: string;
      primitives: Array<{ attributes: { POSITION: number } }>;
    }>;
    accessors: Array<{ min: number[]; max: number[] }>;
  };
  expect(
    gltf.nodes.every(
      (node) =>
        !node.matrix && !node.scale && !node.rotation && !node.translation,
    ),
  ).toBe(true);
  const bounds = gltf.meshes
    .filter((mesh) => mesh.name !== "base")
    .flatMap((mesh) =>
      mesh.primitives.map((p) => gltf.accessors[p.attributes.POSITION]),
    );
  for (let axis = 0; axis < 3; axis++) {
    expect(Math.min(...bounds.map((a) => a?.min[axis] ?? Infinity))).toBe(
      reference.bodyBoundsInches.min[axis] ?? Infinity,
    );
    expect(Math.max(...bounds.map((a) => a?.max[axis] ?? -Infinity))).toBe(
      reference.bodyBoundsInches.max[axis] ?? -Infinity,
    );
  }
});

function triangleAreaSum(mesh: FoilMeshGeometry) {
  let area = 0;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const points = mesh.indices
      .slice(i, i + 3)
      .map((index) => mesh.positions.slice(index * 3, index * 3 + 3));
    const a = points[0] ?? [];
    const ab = (points[1] ?? []).map((value, axis) => value - (a[axis] ?? 0));
    const ac = (points[2] ?? []).map((value, axis) => value - (a[axis] ?? 0));
    area +=
      Math.hypot(
        (ab[1] ?? 0) * (ac[2] ?? 0) - (ab[2] ?? 0) * (ac[1] ?? 0),
        (ab[2] ?? 0) * (ac[0] ?? 0) - (ab[0] ?? 0) * (ac[2] ?? 0),
        (ab[0] ?? 0) * (ac[1] ?? 0) - (ab[1] ?? 0) * (ac[0] ?? 0),
      ) / 2;
  }
  return area;
}

test("area estimates include body and jaw and scale by length squared", () => {
  const sections = readFileSync(
    new URL("./foil-sections.json", import.meta.url),
  );
  expect(createHash("sha256").update(sections).digest("hex")).toBe(
    reference.sectionDataSha256,
  );
  for (const [
    index,
    radiusOffsetInches,
  ] of reference.sourceRadiusOffsetsInches.entries()) {
    const mesh = generateFoilGeometry({
      ...reference.sampling,
      radiusOffsetInches,
    });
    const area = triangleAreaSum(mesh) + triangleAreaSum(mesh.jawGeometry);
    expect(area).toBeCloseTo(reference.skinAreaSquareInches[index] ?? 0, 6);
    expect(SIX_FOOT_STUDY.skinAreaSqFt[index]).toBeCloseTo(
      (area * SIX_FOOT_STUDY.scale ** 2) / 144,
      6,
    );
  }
  expect(SIX_FOOT_STUDY.skinAreaSqFt[0]).toBeCloseTo(24.5, 1);
  expect(SIX_FOOT_STUDY.skinAreaSqFt[1]).toBeCloseTo(27.6, 1);
});
