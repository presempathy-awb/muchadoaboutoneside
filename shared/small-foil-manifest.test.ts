import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { POEM_LOOP } from "./poem";

const root = resolve(import.meta.dir, "..");
const output = resolve(root, "public/fabrication/small-foil");
const digest = (value: Uint8Array | string) =>
  createHash("sha256").update(value).digest("hex");

describe("180 mm printed-sculpture foil artifacts", () => {
  test("cover the exact print STL surface except its contact underside", async () => {
    const manifest = await Bun.file(resolve(output, "manifest.json")).json();
    const stl = await readFile(resolve(root, manifest.source.stlPath));
    expect(digest(stl)).toBe(manifest.source.stlSha256);
    expect(manifest.source.stlTriangles).toBe(5_490);
    expect(manifest.coverage.exposedTriangleCount).toBe(5_426);
    expect(manifest.coverage.excludedUndersideTriangleCount).toBe(64);
    expect(manifest.coverage.coveredTriangleCount).toBe(5_426);
    expect(manifest.coverage.baseTopAndSidesIncluded).toBeTrue();
    expect(manifest.validation.uniqueCoveredFaces).toBe(5_426);
    expect(manifest.validation.maximumUnfoldedEdgeErrorMm).toBeLessThan(1e-6);
    expect(manifest.validation.maximumPatchOverlapAreaMm2).toBeLessThanOrEqual(
      1e-7,
    );
    expect(manifest.validation.allPatchesWithinStock).toBeTrue();
  });

  test("retains two complete outlined poems on the closed reading track", async () => {
    const manifest = await Bun.file(resolve(output, "manifest.json")).json();
    expect(manifest.artwork.poemSha256).toBe(digest(POEM_LOOP));
    expect(manifest.artwork.readingTracks).toBe(1);
    expect(manifest.artwork.poemRepetitionsOnClosedCircuit).toBe(2);
    expect(manifest.artwork.masterGlyphOutlineCount).toBeGreaterThan(0);
    expect(manifest.artwork.glyphOutlinesCoveredAtLeast99Point9Percent).toBe(
      manifest.artwork.masterGlyphOutlineCount,
    );
    expect(manifest.artwork.minimumGlyphCoverageRatio).toBeGreaterThanOrEqual(
      0.999,
    );
    const master = await Bun.file(resolve(output, "marking-master.svg")).text();
    const coupon = await Bun.file(resolve(output, "test-coupon.svg")).text();
    expect(master).not.toContain("<text");
    expect(master).not.toContain("<font");
    expect(coupon).not.toContain("<text");
    expect(coupon).not.toContain("<font");
  });

  test("keeps every recorded artifact byte-for-byte reproducible", async () => {
    const manifest = await Bun.file(resolve(output, "manifest.json")).json();
    for (const [relative, record] of Object.entries(
      manifest.artifacts as Record<string, { bytes: number; sha256: string }>,
    )) {
      const bytes = await readFile(resolve(output, relative));
      expect(bytes.byteLength).toBe(record.bytes);
      expect(digest(bytes)).toBe(record.sha256);
    }
    const glb = await readFile(resolve(output, "muchado-foil-180mm.glb"));
    expect(glb.toString("ascii", 0, 4)).toBe("glTF");
    expect(glb.readUInt32LE(4)).toBe(2);
    expect(glb.readUInt32LE(8)).toBe(glb.byteLength);
    expect(manifest.licensing).toEqual({
      projectAuthored: "MIT OR Apache-2.0",
      font: "OFL-1.1",
      scope: "REUSE.txt",
    });
    const listing = Bun.spawnSync([
      "unzip",
      "-Z1",
      resolve(output, "foil-kit-180mm.zip"),
    ]);
    expect(listing.exitCode).toBe(0);
    expect(listing.stdout.toString().trim().split("\n")).toEqual(
      expect.arrayContaining([
        "LICENSE-MIT.txt",
        "LICENSE-APACHE.txt",
        "REUSE.txt",
        "OFL.txt",
      ]),
    );
  });
});
