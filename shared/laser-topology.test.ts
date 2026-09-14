import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { generateFoilGeometry } from "../src/lib/foil-geometry";
import { FABRICATION_GEOMETRY_OPTIONS } from "./fabrication";

interface Panel {
  id: string;
  sourceTriangleId: string;
  surface: "body" | "jaw";
  sheetXYMm: number[][];
  edgeMatches: string[][];
}
const root = resolve(import.meta.dir, "../public/fabrication/laser");
const manifest = await Bun.file(resolve(root, "manifest.json")).json();
const panels: Panel[] = manifest.panels;

test("every flat facet preserves its actual preview triangle and reciprocal neighbors", () => {
  const geometry = generateFoilGeometry(FABRICATION_GEOMETRY_OPTIONS);
  const byId = new Map(panels.map((panel) => [panel.id, panel]));
  expect(byId.size).toBe(panels.length);
  expect(new Set(panels.map((panel) => panel.sourceTriangleId)).size).toBe(
    geometry.indices.length / 3 + geometry.jawGeometry.indices.length / 3,
  );
  const edges = [
    [0, 1],
    [1, 2],
    [2, 0],
  ] as const;
  for (const panel of panels) {
    expect(panel.id).toBe(panel.sourceTriangleId);
    const mesh = panel.surface === "body" ? geometry : geometry.jawGeometry;
    const triangleNumber = Number(panel.sourceTriangleId.split("-T")[1]) - 1;
    const source = mesh.indices
      .slice(triangleNumber * 3, triangleNumber * 3 + 3)
      .map((index) => mesh.positions.slice(index * 3, index * 3 + 3));
    expect(source).toHaveLength(3);
    for (const [edgeIndex, [a, b]] of edges.entries()) {
      const first = source[a] ?? [];
      const second = source[b] ?? [];
      const length =
        Math.hypot(...first.map((value, axis) => value - (second[axis] ?? 0))) *
        25.4;
      const flatA = panel.sheetXYMm[a] ?? [];
      const flatB = panel.sheetXYMm[b] ?? [];
      const flatLength = Math.hypot(
        (flatA[0] ?? 0) - (flatB[0] ?? 0),
        (flatA[1] ?? 0) - (flatB[1] ?? 0),
      );
      expect(Math.abs(flatLength - length)).toBeLessThanOrEqual(0.01);
      const mates = panel.edgeMatches[edgeIndex] ?? [];
      expect(mates).toHaveLength(1);
      const [mateId, mateEdge] = (mates[0] ?? "").split(":E");
      const mate = byId.get(mateId ?? "");
      expect(mate).toBeDefined();
      expect(mate?.edgeMatches[Number(mateEdge) - 1]).toEqual([
        `${panel.id}:E${edgeIndex + 1}`,
      ]);
    }
  }
});

test("the full ZIP contains exactly the verified artifact bytes", () => {
  const archive = resolve(root, "panel-kit.zip");
  const listing = Bun.spawnSync(["unzip", "-Z1", archive]);
  expect(listing.exitCode).toBe(0);
  const entries: { path: string; bytes: number; sha256: string }[] =
    manifest.archiveEntries;
  expect(listing.stdout.toString().trim().split("\n")).toEqual(
    entries.map((entry) => entry.path),
  );
  const contents = Bun.spawnSync(["unzip", "-p", archive]);
  expect(contents.exitCode).toBe(0);
  let offset = 0;
  for (const entry of entries) {
    const bytes = contents.stdout.subarray(offset, offset + entry.bytes);
    expect(bytes.length).toBe(entry.bytes);
    expect(new Bun.CryptoHasher("sha256").update(bytes).digest("hex")).toBe(
      entry.sha256,
    );
    offset += entry.bytes;
  }
  expect(offset).toBe(contents.stdout.byteLength);
  expect(entries.map((entry) => entry.path)).toEqual(
    expect.arrayContaining([
      "LICENSE-MIT.txt",
      "LICENSE-APACHE.txt",
      "REUSE.txt",
      "OFL.txt",
    ]),
  );
});
