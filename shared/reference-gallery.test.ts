import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  REFERENCE_GALLERY,
  REFERENCE_IMAGES,
  referenceFileSize,
} from "./reference-gallery";

describe("supplied reference image preservation", () => {
  test("each public original matches its manifest size, signature, and fingerprint", async () => {
    expect(REFERENCE_IMAGES).toHaveLength(3);
    expect(new Set(REFERENCE_IMAGES.map((image) => image.sha256)).size).toBe(3);
    for (const image of REFERENCE_IMAGES) {
      expect(image.path).toBe(`/references/${image.file}`);
      expect(image.file).toMatch(/^[a-z0-9-]+\.(png|jpg)$/);
      const bytes = await readFile(
        new URL(`../public${image.path}`, import.meta.url),
      );
      expect(bytes.byteLength).toBe(image.bytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        image.sha256,
      );
      expect(image.width).toBeGreaterThan(0);
      expect(image.height).toBeGreaterThan(0);
      if (image.mediaType === "image/png") {
        expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
        expect(bytes.readUInt32BE(16)).toBe(image.width);
        expect(bytes.readUInt32BE(20)).toBe(image.height);
      } else {
        expect(bytes.subarray(0, 3).toString("hex")).toBe("ffd8ff");
      }
    }
  });

  test("public metadata carries no private recovery paths or task identifiers", () => {
    const metadata = JSON.stringify(REFERENCE_GALLERY);
    expect(metadata).not.toMatch(
      /\/Users\/|\.codex|\.jsonl|sourceThread|sourceLine/,
    );
    expect(metadata).not.toMatch(
      /[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/i,
    );
    expect(REFERENCE_GALLERY.preservation).toContain("Complete original");
  });

  test("file sizes stay legible without hiding the original download size", () => {
    expect(referenceFileSize(262_677)).toBe("263 kB");
    expect(referenceFileSize(1_238_253)).toBe("1.24 MB");
  });
});
