import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { generateFoilGeometry } from "../src/lib/foil-geometry";
import { FABRICATION_GEOMETRY_OPTIONS } from "./fabrication";
import { INSCRIPTION_LAYOUT, JAW_INSCRIPTION_LAYOUT, POEM_LOOP } from "./poem";

const root = resolve(import.meta.dir, "..");
const laserRoot = resolve(root, "public/fabrication/laser");
const manifest = await Bun.file(resolve(laserRoot, "manifest.json")).json();

function digest(value: string | ArrayBuffer): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

function triangleArea(points: number[][]): number {
  const [a, b, c] = points;
  if (!a || !b || !c) return 0;
  return (
    Math.abs(
      ((b[0] ?? 0) - (a[0] ?? 0)) * ((c[1] ?? 0) - (a[1] ?? 0)) -
        ((b[1] ?? 0) - (a[1] ?? 0)) * ((c[0] ?? 0) - (a[0] ?? 0)),
    ) / 2
  );
}

function pointInTriangle(point: number[], triangle: number[][]): boolean {
  const [a, b, c] = triangle;
  if (!a || !b || !c) return false;
  const cross = (first: number[], second: number[], probe: number[]) =>
    ((second[0] ?? 0) - (first[0] ?? 0)) * ((probe[1] ?? 0) - (first[1] ?? 0)) -
    ((second[1] ?? 0) - (first[1] ?? 0)) * ((probe[0] ?? 0) - (first[0] ?? 0));
  const distanceFromEdge = (first: number[], second: number[]) =>
    cross(first, second, point) /
    Math.hypot(
      (second[0] ?? 0) - (first[0] ?? 0),
      (second[1] ?? 0) - (first[1] ?? 0),
    );
  const values = [
    distanceFromEdge(a, b),
    distanceFromEdge(b, c),
    distanceFromEdge(c, a),
  ];
  return (
    values.every((value) => value >= -0.002) ||
    values.every((value) => value <= 0.002)
  );
}

describe("laser fabrication artifacts", () => {
  test("stay tied to the shared preview geometry, poem, and layout", async () => {
    const geometry = generateFoilGeometry(FABRICATION_GEOMETRY_OPTIONS);
    const sourceTriangles =
      geometry.indices.length / 3 + geometry.jawGeometry.indices.length / 3;
    expect(manifest.geometryOptions).toEqual(FABRICATION_GEOMETRY_OPTIONS);
    expect(manifest.coverage.sourceTriangles).toBe(sourceTriangles);
    expect(manifest.coverage.generatedFacets).toBe(sourceTriangles);
    expect(manifest.coverage.coveredSourceTriangleIds).toBe(sourceTriangles);
    expect(manifest.foilSectionsSha256).toBe(
      digest(
        await Bun.file(
          resolve(root, "shared/foil-sections.json"),
        ).arrayBuffer(),
      ),
    );
    expect(manifest.geometryGeneratorSha256).toBe(
      digest(
        await Bun.file(resolve(root, "src/lib/foil-geometry.ts")).arrayBuffer(),
      ),
    );
    expect(manifest.poemSha256).toBe(digest(POEM_LOOP));
    expect(manifest.inscriptionLayout).toEqual(INSCRIPTION_LAYOUT);
    expect(manifest.jawInscriptionLayout).toEqual(JAW_INSCRIPTION_LAYOUT);
    expect(manifest.artwork.surfaceMasters).toEqual({
      body: "marking-master.svg",
      jaw: "jaw-marking-master.svg",
    });
    for (const panel of manifest.panels) {
      expect(panel.artworkMaster).toBe(
        manifest.artwork.surfaceMasters[panel.surface],
      );
    }
  });

  test("records physically dimensioned exact facets within stock", () => {
    const byId = new Map(
      manifest.panels.map((panel: { id: string }) => [panel.id, panel]),
    );
    expect(
      manifest.verification.maximumExportedEdgeErrorMm,
    ).toBeLessThanOrEqual(0.01);
    expect(manifest.verification.allArtworkClippedToFacetBoundaries).toBe(true);
    expect(manifest.verification.allSheetsWithinStock).toBe(true);
    expect(manifest.verification.allAreasPositive).toBe(true);
    expect(manifest.verification.allSourceTrianglesCovered).toBe(true);
    expect(manifest.verification.edgeMatchesAreReciprocal).toBe(true);
    for (const panel of manifest.panels) {
      expect(triangleArea(panel.sheetXYMm)).toBeGreaterThan(0);
      for (const [x, y] of panel.sheetXYMm) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(304.8);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(508);
      }
      expect(panel.maximumExportedEdgeErrorMm).toBeLessThanOrEqual(0.01);
      for (const [edgeIndex, matches] of panel.edgeMatches.entries()) {
        expect(matches).toHaveLength(1);
        const [peerId, peerEdgeText] = matches[0].split(":E");
        const peer = byId.get(peerId) as
          | { edgeMatches: string[][] }
          | undefined;
        expect(peer).toBeDefined();
        expect(peer?.edgeMatches[Number(peerEdgeText) - 1]).toContain(
          `${panel.id}:E${edgeIndex + 1}`,
        );
      }
    }
  });

  test("clips every emitted marking polygon to its associated facet", async () => {
    const panels = new Map(
      manifest.panels.map((panel: { id: string; sheetXYMm: number[][] }) => [
        panel.id,
        panel.sheetXYMm,
      ]),
    );
    for (let sheet = 1; sheet <= manifest.coverage.stockSheets; sheet += 1) {
      const name = `mark-sheet-${String(sheet).padStart(3, "0")}.svg`;
      const svg = await Bun.file(resolve(laserRoot, "panels", name)).text();
      for (const match of svg.matchAll(/data-facet="([^"]+)" d="([^"]+)"/g)) {
        const id = match[1];
        const triangle = panels.get(id) as number[][] | undefined;
        expect(triangle).toBeDefined();
        const values = [
          ...(match[2] ?? "").matchAll(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/g),
        ];
        expect(values.length).toBeGreaterThan(2);
        for (const value of values) {
          const point = value[0].split(",").map(Number);
          expect(pointInTriangle(point, triangle ?? [])).toBe(true);
        }
      }
    }
  });

  test("uses only outlined artwork and carries verified file hashes", async () => {
    const master = await Bun.file(
      resolve(laserRoot, "marking-master.svg"),
    ).text();
    const coupon = await Bun.file(
      resolve(laserRoot, "denhac-test-coupon.svg"),
    ).text();
    expect(master).not.toContain("<text");
    expect(master).not.toContain("<font");
    expect(master).not.toContain("<rect");
    expect(master.match(/<use /g)).toHaveLength(INSCRIPTION_LAYOUT.rows);
    expect(master).toContain('viewBox="0 0 8192 2048"');
    expect(coupon).not.toContain("<text");
    expect(coupon).not.toContain("<font");
    expect(coupon).toContain('width="250mm" height="190mm"');
    for (const file of manifest.files) {
      const artifact = Bun.file(resolve(laserRoot, file.path));
      expect(await artifact.exists()).toBe(true);
      const bytes = await artifact.arrayBuffer();
      expect(bytes.byteLength).toBe(file.bytes);
      expect(digest(bytes)).toBe(file.sha256);
    }
  });

  test("keeps body and jaw poem circuits complete, distinct, and inside their masters", async () => {
    const heights: number[] = [];
    for (const [file, layout] of [
      ["marking-master.svg", INSCRIPTION_LAYOUT],
      ["jaw-marking-master.svg", JAW_INSCRIPTION_LAYOUT],
    ] as const) {
      const master = await Bun.file(resolve(laserRoot, file)).text();
      expect(master).toContain(POEM_LOOP);
      expect(master).not.toContain("<text");
      expect(master).not.toContain("<font");
      expect(master).not.toContain("<rect");
      const offsets = [
        ...master.matchAll(
          /<use href="#poem-row" transform="translate\(0 ([\d.]+)\)"\/>/g,
        ),
      ].map((match) => Number(match[1]));
      expect(offsets).toHaveLength(layout.rows);
      const paths = [...master.matchAll(/<path d="([^"]+)"\/>/g)];
      expect(paths.length).toBeGreaterThan(100);
      const points = paths.flatMap((path) =>
        [
          ...(path[1] ?? "").matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g),
        ].map((point) => [Number(point[1]), Number(point[2])] as const),
      );
      const minX = Math.min(...points.map(([x]) => x));
      const maxX = Math.max(...points.map(([x]) => x));
      const minY = Math.min(...points.map(([, y]) => y));
      const maxY = Math.max(...points.map(([, y]) => y));
      expect(minX).toBeGreaterThan(0);
      expect(maxX).toBeLessThan(layout.width);
      expect(minY).toBeGreaterThan(65);
      expect(maxY + (offsets.at(-1) ?? 0)).toBeLessThan(layout.height - 65);
      for (let row = 1; row < offsets.length; row += 1) {
        expect(minY + (offsets[row] ?? 0)).toBeGreaterThan(
          maxY + (offsets[row - 1] ?? 0),
        );
      }
      heights.push(maxY - minY);
      expect(
        manifest.archiveEntries.some(
          (entry: { path: string }) => entry.path === file,
        ),
      ).toBe(true);
    }
    expect(heights[0]).toBeGreaterThan(300);
    expect(heights[1]).toBeLessThan(60);
  });

  test("packages separate marking and manual-trim sample files deterministically", () => {
    const listing = Bun.spawnSync([
      "unzip",
      "-Z1",
      resolve(laserRoot, "representative-fit-kit.zip"),
    ]);
    expect(listing.exitCode).toBe(0);
    const names = listing.stdout.toString().trim().split("\n");
    expect(names).toEqual([
      "README.txt",
      "LICENSE-MIT.txt",
      "LICENSE-APACHE.txt",
      "REUSE.txt",
      "OFL.txt",
      "representative-jaw-fit-mark.svg",
      "representative-jaw-fit-manual-trim.svg",
    ]);

    const readmeResult = Bun.spawnSync([
      "unzip",
      "-p",
      resolve(laserRoot, "representative-fit-kit.zip"),
      "README.txt",
    ]);
    const trimResult = Bun.spawnSync([
      "unzip",
      "-p",
      resolve(laserRoot, "representative-fit-kit.zip"),
      "representative-jaw-fit-manual-trim.svg",
    ]);
    expect(readmeResult.exitCode).toBe(0);
    expect(trimResult.exitCode).toBe(0);
    const readme = readmeResult.stdout.toString();
    const trim = trimResult.stdout.toString();
    const sampleIds = new Set(
      manifest.coverage.representativeFitSampleFacetIds as string[],
    );
    const internalPairs = new Set<string>();
    for (const panel of manifest.panels) {
      if (!sampleIds.has(panel.id)) continue;
      const group = trim.match(
        new RegExp(`<g id="${panel.id}">([\\s\\S]*?)</g>`),
      )?.[1];
      expect(group).toBeDefined();
      for (const edge of ["E1", "E2", "E3"]) expect(group).toContain(edge);
      for (const [edgeIndex, matches] of panel.edgeMatches.entries()) {
        const peer = matches[0] as string;
        const peerId = peer.split(":E")[0] ?? "";
        if (sampleIds.has(peerId)) {
          internalPairs.add(
            [peer, `${panel.id}:E${edgeIndex + 1}`].sort().join(" ↔ "),
          );
        }
      }
    }
    expect(internalPairs.size).toBeGreaterThan(0);
    for (const pairing of internalPairs) {
      expect(readme.match(new RegExp(pairing, "g"))).toHaveLength(1);
    }
    expect(readme).toContain(
      "Edges not listed above connect to facets outside this eight-facet sample",
    );
    expect(readme).toContain("your choice of MIT or Apache-2.0");
  });
});
