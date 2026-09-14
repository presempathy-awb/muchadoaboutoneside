import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import manifest from "./print-manifest.json";

function hash(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("print fabrication manifest", () => {
  test("publishes matched, validated 180 mm STL and GLB artifacts", async () => {
    expect(manifest.coordinateSystems.printStl).toEqual({
      units: "millimetres",
      upAxis: "+Z",
    });
    expect(manifest.coordinateSystems.previewGlb).toEqual({
      units: "metres",
      upAxis: "+Y",
    });
    expect(manifest.dimensionsMm.z).toBeCloseTo(180, 2);
    expect(manifest.validation.watertight).toBe(true);
    expect(manifest.validation.connectedComponents).toBe(1);
    expect(manifest.validation.everyEdgeIncidentToTwoFaces).toBe(true);
    expect(manifest.validation.positiveVolume).toBe(true);
    expect(manifest.validation.nonAdjacentTriangleIntersectionCount).toBe(0);
    expect(manifest.validation.buildPlateContactVertexCount).toBeGreaterThan(
      16,
    );
    expect(manifest.fabrication.gcode).toContain("Not supplied");
    expect(manifest.fabrication.lettering).toContain("smooth substrate");
    expect(manifest.fabrication.lettering).toContain(
      "/fabrication/small-foil/foil-kit-180mm.zip",
    );

    for (const artifact of Object.values(manifest.artifacts)) {
      const bytes = await readFile(
        new URL(`../${artifact.path}`, import.meta.url),
      );
      expect(bytes.byteLength).toBe(artifact.bytes);
      expect(hash(bytes)).toBe(artifact.sha256);
      expect(artifact.triangles).toBeGreaterThan(1_000);
    }

    const source = await readFile(
      new URL(`../${manifest.source.path}`, import.meta.url),
    );
    expect(hash(source)).toBe(manifest.source.sha256);

    for (const provenance of [
      manifest.generator.script,
      manifest.generator.requirements,
    ]) {
      const bytes = await readFile(
        new URL(`../${provenance.path}`, import.meta.url),
      );
      expect(hash(bytes)).toBe(provenance.sha256);
    }
  });
});
