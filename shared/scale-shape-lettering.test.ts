import { expect, test } from "bun:test";
import {
  loadScaleTypography,
  type ScaleTypography,
} from "../src/lib/scale-typography";
import { loadScannedScaleTypography } from "../src/lib/scanned-scale-typography";
import type { CalligraphyScan } from "./calligraphy-scan";
import {
  fitScaleLettering,
  type ScaleLetteringResult,
} from "./scale-lettering";
import { generateMaquetteScaleStudy } from "./scale-maquette";
import {
  DEFAULT_SCALE_STUDY_SETTINGS,
  generateScaleStudy,
  type ScalePlate,
  type ScaleStudySettings,
} from "./scale-study";

const marginMm = 0.5;
function assertConservedAndFits(
  plates: ScalePlate[],
  text: string,
  result: ScaleLetteringResult,
  face: ScaleTypography,
) {
  const words = text.match(/\S+/gu) ?? [];
  const placed = result.placements.flatMap((p) =>
    p.lines.flatMap((line) => line.match(/\S+/gu) ?? []),
  );
  expect([...placed, ...(result.unplacedText.match(/\S+/gu) ?? [])]).toEqual(
    words,
  );
  expect(result.placedWordCount).toBe(placed.length);
  expect(result.totalWordCount).toBe(words.length);
  let occurrence = 0;
  for (const placement of result.placements) {
    const plate = plates.find((p) => p.id === placement.plateId);
    if (!plate) throw new Error("Allocation referenced an absent plate.");
    let height = 0;
    for (const [index, line] of placement.lines.entries()) {
      const range = placement.lineRanges?.[index];
      if (!range)
        throw new Error(
          "A mapped line lost its transcript occurrence identity.",
        );
      expect(range.wordStart).toBe(occurrence);
      expect(range.wordEnd).toBeGreaterThan(range.wordStart);
      occurrence = range.wordEnd;
      const metrics = face.measureLine(
        line,
        placement.fontSizeMm,
        placement.lineRanges?.[index],
      );
      expect(metrics.widthMm).toBeLessThanOrEqual(
        plate.widthInches * 25.4 * plate.safeRect.width - 2 * marginMm + 1e-6,
      );
      height += metrics.heightMm;
    }
    if (placement.lines.length)
      expect(height).toBeLessThanOrEqual(
        plate.heightInches * 25.4 * plate.safeRect.height - 2 * marginMm + 1e-6,
      );
  }
  expect(occurrence).toBe(result.placedWordCount);
}
function studies(modelId: "archival" | "maquette") {
  const input: ScaleStudySettings = {
    ...DEFAULT_SCALE_STUDY_SETTINGS,
    modelId,
    // The native maquette has conservative millimetre-thin writing regions.
    // Enlarging its frame exercises readable real ink rather than claiming a tiny crop fits.
    modelScale: modelId === "archival" ? 0.08 : 8,
    columns: 24,
    rows: 3,
    supportOffsetInches: 0,
    relief: 0,
    variation: 0,
    plateTaper: 0,
    plateAspect: 0,
  };
  const generate =
    modelId === "archival" ? generateScaleStudy : generateMaquetteScaleStudy;
  return [
    generate({ ...input, plateShape: "rectangle" }),
    generate({ ...input, plateShape: "diamond", plateAspect: 1.3 }),
  ];
}

test("actual font ink is deterministically reassigned to each rebuilt silhouette with explicit overflow", async () => {
  // Embedded, repository-local bytes exercise the production font engine without fetch or a server.
  const bytes = await Bun.file(
    "public/fonts/GreatVibes-Regular.ttf",
  ).arrayBuffer();
  const face = await loadScaleTypography({
    fontId: "custom",
    shapingEngine: "fontkit",
    fontFeatures: "",
    customFont: {
      name: "GreatVibes",
      dataUrl: `data:font/ttf;base64,${Buffer.from(bytes).toString("base64")}`,
    },
  });
  const text = Array.from(
    { length: 12 },
    () => "echo softly, a flourish flows gracefully.",
  ).join(" ");
  const options = {
    fontSizeMm: 12,
    minFontSizeMm: 2,
    marginMm,
    measure: face.measure,
    measureLine: face.measureLine,
  };
  for (const modelId of ["archival", "maquette"] as const) {
    const pair = studies(modelId);
    const allocations = pair.map((study) =>
      fitScaleLettering(study.plates, text, options),
    );
    expect(pair[0]?.plates.map((p) => p.safeRect)).not.toEqual(
      pair[1]?.plates.map((p) => p.safeRect),
    );
    expect(allocations[0]?.placements).not.toEqual(allocations[1]?.placements);
    for (const [index, study] of pair.entries()) {
      const result = allocations[index];
      if (!result) throw new Error("Missing allocation.");
      expect(result).toEqual(fitScaleLettering(study.plates, text, options));
      expect(result.placedWordCount).toBeGreaterThan(0);
      assertConservedAndFits(study.plates, text, result, face);
      // Overflow is a complete ordered suffix, even for an impossibly large word.
      const overflow = fitScaleLettering(
        study.plates,
        `${"W".repeat(80)} explicit ending`,
        options,
      );
      expect(overflow.placedWordCount).toBe(0);
      expect(overflow.unplacedText).toBe(`${"W".repeat(80)} explicit ending`);
      assertConservedAndFits(
        study.plates,
        `${"W".repeat(80)} explicit ending`,
        overflow,
        face,
      );
    }
  }
  face.dispose?.();
});

function scanFixture(): CalligraphyScan {
  const bytes = Buffer.alloc(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12);
  bytes.writeUInt32BE(100, 16);
  bytes.writeUInt32BE(50, 20);
  const dataUrl = `data:image/png;base64,${bytes.toString("base64")}`;
  return {
    version: 1,
    id: "scan-shape-remap",
    name: "Shape remap",
    calligrapher: "Jill Winters",
    text: "echo echo a joined ending",
    createdAt: "2026-09-18T00:00:00.000Z",
    algorithmVersion: "test-1",
    original: {
      name: "scan.png",
      type: "image/png",
      bytes: 33,
      dataUrl,
      sha256: "a".repeat(64),
    },
    image: { width: 100, height: 50, dataUrl },
    emHeightPx: 10,
    confirmed: true,
    segments: [
      {
        text: "echo",
        wordStart: 0,
        wordEnd: 1,
        lineIndex: 0,
        x: 2,
        y: 2,
        width: 10,
        height: 10,
      },
      {
        text: "echo",
        wordStart: 1,
        wordEnd: 2,
        lineIndex: 0,
        x: 16,
        y: 2,
        width: 20,
        height: 10,
      },
      {
        text: "a joined ending",
        wordStart: 2,
        wordEnd: 5,
        lineIndex: 1,
        x: 3,
        y: 25,
        width: 30,
        height: 12,
      },
    ],
  };
}

test("scanned occurrence metrics preserve joined ink when new shapes recalculate writing regions", async () => {
  // Only decoding is stubbed. Production scan validation, occurrence metrics,
  // unsplittable segments and placement are used; no synthesized letters.
  const descriptors = ["Image", "document"].map(
    (name) =>
      [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const,
  );
  class FixtureImage {
    src = "";
    decoding = "";
    naturalWidth = 100;
    naturalHeight = 50;
    async decode() {}
  }
  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    value: FixtureImage,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {},
  });
  let face: ScaleTypography | undefined;
  try {
    const scan = scanFixture();
    face = await loadScannedScaleTypography(scan, scan.text);
    const options = {
      fontSizeMm: 12,
      minFontSizeMm: 3,
      marginMm,
      measure: face.measure,
      measureLine: face.measureLine,
      segments: face.segments,
    };
    for (const modelId of ["archival", "maquette"] as const) {
      for (const study of studies(modelId)) {
        const result = fitScaleLettering(study.plates, scan.text, options);
        expect(result.placedWordCount).toBe(5);
        expect(result).toEqual(
          fitScaleLettering(study.plates, scan.text, options),
        );
        assertConservedAndFits(study.plates, scan.text, result, face);
        const ranges = result.placements.flatMap((p) => p.lineRanges ?? []);
        // A joined region may be assigned whole or remain wholly in overflow.
        expect(
          ranges.some(
            (r) =>
              (r.wordStart > 2 && r.wordStart < 5) ||
              (r.wordEnd > 2 && r.wordEnd < 5),
          ),
        ).toBe(false);
        if (result.placedWordCount > 2) expect(result.placedWordCount).toBe(5);
      }
    }
  } finally {
    face?.dispose?.();
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
