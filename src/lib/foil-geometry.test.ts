import { describe, expect, test } from "bun:test";
import sectionData from "../../shared/foil-sections.json";
import { type FoilMeshGeometry, generateFoilGeometry } from "./foil-geometry";

const geometry = generateFoilGeometry();

function coordinate(mesh: FoilMeshGeometry, index: number) {
  return mesh.positions.slice(index * 3, index * 3 + 3);
}

function surfaceEvidence(mesh: FoilMeshGeometry) {
  const vertexCount = mesh.positions.length / 3;
  expect(mesh.positions.every(Number.isFinite)).toBe(true);
  expect(mesh.uvs.every(Number.isFinite)).toBe(true);
  expect(mesh.uvs.length).toBe(vertexCount * 2);
  expect(mesh.indices.length % 3).toBe(0);
  expect(
    mesh.indices.every(
      (index) => Number.isInteger(index) && index >= 0 && index < vertexCount,
    ),
  ).toBe(true);

  let minimumDoubleArea = Number.POSITIVE_INFINITY;
  const edges = new Map<string, number>();
  const weld = (index: number) =>
    coordinate(mesh, index)
      .map((value) => Math.round(value * 100_000))
      .join(",");
  const welded = Array.from({ length: vertexCount }, (_, index) => weld(index));
  for (let index = 0; index < mesh.indices.length; index += 3) {
    const a = mesh.indices[index] ?? 0;
    const b = mesh.indices[index + 1] ?? 0;
    const c = mesh.indices[index + 2] ?? 0;
    const pa = coordinate(mesh, a);
    const pb = coordinate(mesh, b);
    const pc = coordinate(mesh, c);
    const ab = pb.map((value, axis) => value - (pa[axis] ?? 0));
    const ac = pc.map((value, axis) => value - (pa[axis] ?? 0));
    const cross = [
      (ab[1] ?? 0) * (ac[2] ?? 0) - (ab[2] ?? 0) * (ac[1] ?? 0),
      (ab[2] ?? 0) * (ac[0] ?? 0) - (ab[0] ?? 0) * (ac[2] ?? 0),
      (ab[0] ?? 0) * (ac[1] ?? 0) - (ab[1] ?? 0) * (ac[0] ?? 0),
    ];
    minimumDoubleArea = Math.min(minimumDoubleArea, Math.hypot(...cross));
    for (const [from, to] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      const edge = [welded[from ?? 0], welded[to ?? 0]].sort().join("|");
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
  }
  expect(minimumDoubleArea).toBeGreaterThan(1e-8);
  // UV seams duplicate vertices, but the welded physical surface has no holes.
  expect([...edges.values()].every((count) => count === 2)).toBe(true);
}

describe("foil reading surface", () => {
  test("main skin and jaw have finite coordinates, valid triangles and closed boundaries", () => {
    surfaceEvidence(geometry);
    surfaceEvidence(geometry.jawGeometry);
  });

  test("each meridian closes in position while preserving the 0-to-1 artwork seam", () => {
    for (const mesh of [geometry, geometry.jawGeometry]) {
      for (let row = 0; row <= mesh.meridianCount; row++) {
        const first = row * mesh.verticesPerMeridian;
        const last = first + mesh.verticesPerMeridian - 1;
        expect(coordinate(mesh, first)).toEqual(coordinate(mesh, last));
        expect(mesh.uvs[first * 2]).toBe(0);
        expect(mesh.uvs[last * 2]).toBe(1);
      }
    }
  });

  test("u measures actual loop distance including head and end caps", () => {
    const mesh = geometry;
    const first = Math.floor(mesh.meridianCount / 2) * mesh.verticesPerMeridian;
    let measured = 0;
    for (let offset = 1; offset < mesh.verticesPerMeridian; offset++) {
      const current = coordinate(mesh, first + offset);
      const previous = coordinate(mesh, first + offset - 1);
      measured += Math.hypot(
        ...current.map((value, axis) => value - (previous[axis] ?? 0)),
      );
      expect(mesh.uvs[(first + offset) * 2]).toBeCloseTo(
        measured / mesh.readingLoopLengthInches,
        10,
      );
    }
    expect(measured).toBeCloseTo(mesh.readingLoopLengthInches, 8);
    expect(measured).toBeGreaterThan(1_050);
    expect(measured).toBeLessThan(1_200);
  });

  test("source-derived skin keeps the sculpture bounds and separate open endpoints", () => {
    const zeroOffset = generateFoilGeometry({ radiusOffsetInches: 0 });
    const xs = zeroOffset.positions.filter((_, index) => index % 3 === 0);
    const ys = zeroOffset.positions.filter((_, index) => index % 3 === 1);
    const zs = zeroOffset.positions.filter((_, index) => index % 3 === 2);
    expect(Math.min(...xs)).toBeGreaterThan(-61);
    expect(Math.max(...xs)).toBeLessThan(57);
    expect(Math.min(...ys)).toBeGreaterThan(10);
    expect(Math.max(...ys)).toBeLessThan(207);
    expect(Math.max(...ys)).toBeGreaterThan(204);
    expect(Math.min(...zs)).toBeGreaterThan(-17);
    expect(Math.max(...zs)).toBeLessThan(18);
    expect(sectionData.sections).toHaveLength(34);
    expect(sectionData.upperHeadSections).toHaveLength(4);
    expect(sectionData.jawSections).toHaveLength(3);
    expect(sectionData.longitudinallyClosed).toBe(false);
    expect(sectionData.mobius).toBe(false);
    expect(geometry.seamNotes.join(" ")).toContain("UV singularities");
  });

  test("the skin contains every source perimeter, preserving elliptical head and jaw widths", () => {
    const parts = [
      {
        mesh: geometry,
        sections: [...sectionData.sections, ...sectionData.upperHeadSections],
      },
      { mesh: geometry.jawGeometry, sections: sectionData.jawSections },
    ];
    let minimumClearance = Number.POSITIVE_INFINITY;
    for (const { mesh, sections } of parts) {
      const sampledCount = (sections.length - 1) * 4 + 1;
      for (const [index, section] of sections.entries()) {
        const sourceAxes = [section.perimeter[0], section.perimeter[8]].map(
          (point) => {
            const radial = (point ?? []).map(
              (value, axis) => value - (section.center[axis] ?? 0),
            );
            const length = Math.hypot(...radial);
            return radial.map((value) => value / length);
          },
        );
        const project = (point: number[]) =>
          sourceAxes.map((axis) =>
            axis.reduce(
              (sum, value, component) =>
                sum +
                value *
                  ((point[component] ?? 0) - (section.center[component] ?? 0)),
              0,
            ),
          );
        const frontColumn = index * 4;
        const backColumn = 2 * sampledCount + 8 - 2 - frontColumn;
        const perimeter: number[][] = [];
        for (let row = 0; row <= mesh.meridianCount; row++) {
          perimeter.push(
            project(
              coordinate(mesh, row * mesh.verticesPerMeridian + frontColumn),
            ),
          );
        }
        for (let row = mesh.meridianCount - 1; row > 0; row--) {
          perimeter.push(
            project(
              coordinate(mesh, row * mesh.verticesPerMeridian + backColumn),
            ),
          );
        }
        // Test the actual mesh polygon, not the construction formula: each
        // exported GLB perimeter point must lie inside every polygon edge.
        for (const sourcePoint of section.perimeter) {
          const point = project(sourcePoint);
          for (let edge = 0; edge < perimeter.length; edge++) {
            const first = perimeter[edge] ?? [];
            const next = perimeter[(edge + 1) % perimeter.length] ?? [];
            const dx = (next[0] ?? 0) - (first[0] ?? 0);
            const dy = (next[1] ?? 0) - (first[1] ?? 0);
            const signedDistance =
              (dx * ((point[1] ?? 0) - (first[1] ?? 0)) -
                dy * ((point[0] ?? 0) - (first[0] ?? 0))) /
              Math.hypot(dx, dy);
            minimumClearance = Math.min(minimumClearance, signedDistance);
          }
        }
        // The fix adds the requested allowance to each semiaxis separately,
        // rather than inflating both dimensions to the longest source radius.
        for (const axis of [0, 1]) {
          const sourceExtent = Math.max(
            ...section.perimeter.map((point) => project(point)[axis] ?? 0),
          );
          const skinExtent = Math.max(
            ...perimeter.map((point) => point[axis] ?? 0),
          );
          expect(skinExtent - sourceExtent).toBeCloseTo(1, 3);
        }
      }
    }
    expect(minimumClearance).toBeGreaterThan(0.75);
  });

  test("rejects invalid sampling and nonphysical radius values", () => {
    expect(() => generateFoilGeometry({ meridianCount: 0 })).toThrow(
      RangeError,
    );
    expect(() => generateFoilGeometry({ capSteps: 1.5 })).toThrow(RangeError);
    expect(() => generateFoilGeometry({ radiusOffsetInches: NaN })).toThrow(
      RangeError,
    );
    expect(() => generateFoilGeometry({ radiusOffsetInches: -1 })).toThrow(
      RangeError,
    );
  });
});
