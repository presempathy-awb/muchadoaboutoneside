import { describe, expect, test } from "bun:test";
import type { CalligraphyScan } from "../../shared/calligraphy-scan";
import { evaluateLetteringVisibility } from "../../shared/lettering-visibility";
import {
  allocateScaleLettering,
  type ScaleLetteringPlacement,
  type ScaleLetteringPlate,
} from "../../shared/scale-lettering";
import {
  measureScaleLetteringPhysicalFit,
  measureScaleLetteringVisibilityMetrics,
  measureScanInkPixels,
  measureScanInkVisibility,
  SCAN_VISIBILITY_ALPHA_THRESHOLD,
} from "./scale-lettering-visibility";
import { loadScaleTypography, type ScaleTypography } from "./scale-typography";

async function actualFace(): Promise<ScaleTypography> {
  const bytes = await Bun.file(
    "public/fonts/GreatVibes-Regular.ttf",
  ).arrayBuffer();
  return loadScaleTypography({
    fontId: "custom",
    shapingEngine: "fontkit",
    fontFeatures: "",
    customFont: {
      name: "Great Vibes",
      dataUrl: `data:font/ttf;base64,${Buffer.from(bytes).toString("base64")}`,
    },
  });
}

function placement(
  lines = ["A flourish", "quiet ink"],
): ScaleLetteringPlacement {
  return { plateId: "plate", lines, fontSizeMm: 10 };
}

function scanFixture(): CalligraphyScan {
  return {
    version: 1,
    id: "scan-pixel-test",
    name: "Two source occurrences",
    calligrapher: "",
    text: "a a",
    createdAt: "2026-09-18T00:00:00Z",
    algorithmVersion: "fixture",
    confirmed: true,
    original: {
      name: "fixture.png",
      type: "image/png",
      bytes: 1,
      dataUrl: "data:image/png;base64,AA==",
      sha256: "0".repeat(64),
    },
    image: { width: 10, height: 20, dataUrl: "data:image/png;base64,AA==" },
    emHeightPx: 20,
    segments: [
      {
        text: "a",
        wordStart: 0,
        wordEnd: 1,
        lineIndex: 0,
        x: 0,
        y: 0,
        width: 5,
        height: 20,
      },
      {
        text: "a",
        wordStart: 1,
        wordEnd: 2,
        lineIndex: 0,
        x: 5,
        y: 0,
        width: 5,
        height: 20,
      },
    ],
  };
}

describe("measured scale lettering visibility", () => {
  test("uses real small x-height and ink outlines, while caching font samples", async () => {
    const loaded = await actualFace();
    let shapes = 0;
    const typography: ScaleTypography = {
      ...loaded,
      shape: (...args) => {
        shapes++;
        return loaded.shape(...args);
      },
    };
    const placements = [placement()];
    const metrics = measureScaleLetteringVisibilityMetrics(
      typography,
      placements,
    );
    expect(metrics.xHeightEm).toBeCloseTo(
      loaded.shape("x", 1).inkBoundsMm?.height ?? 0,
      10,
    );
    expect(metrics.xHeightEm).toBeLessThan(loaded.measureLine("x", 1).heightMm);
    expect(metrics.xHeightEm).toBeLessThan(0.5);
    expect(metrics.inkHeightEm).toBeCloseTo(
      Math.min(
        ...placement().lines.map(
          (line) => loaded.shape(line, 1).inkBoundsMm?.height ?? 0,
        ),
      ),
      10,
    );
    const firstShapes = shapes;
    expect(
      measureScaleLetteringVisibilityMetrics(typography, placements),
    ).toEqual(metrics);
    expect(shapes).toBe(firstShapes);
    expect(
      measureScaleLetteringVisibilityMetrics(typography, [
        { ...placement(), fontSizeMm: 30 },
      ]),
    ).toEqual(metrics);
    expect(shapes).toBe(firstShapes);
    const report = evaluateLetteringVisibility({
      text: "A flourish quiet ink",
      texture: { xHeightPx: (metrics.xHeightEm ?? 0) * 24 },
    });
    expect(
      report.checks.find((check) => check.id === "texture-xHeightPx")?.status,
    ).toBe("fail");
  });

  test("does not replace missing or unmeasurable glyphs with an em-size estimate", async () => {
    const loaded = await actualFace();
    const unavailable: ScaleTypography = {
      ...loaded,
      hasGlyph: () => false,
      shape() {
        throw new Error("No supported outline");
      },
    };
    expect(
      measureScaleLetteringVisibilityMetrics(unavailable, [placement()]),
    ).toEqual({});
    expect(
      measureScaleLetteringVisibilityMetrics(
        {
          ...loaded,
          engine: "scan",
          shape() {
            throw new Error("Raster has no outlines");
          },
        },
        [placement()],
      ),
    ).toEqual({});
  });

  test("measures native alpha ink rather than padded crop height, preserving occurrences", async () => {
    const scan = scanFixture();
    const rgba = new Uint8ClampedArray(10 * 20 * 4);
    for (let row = 10; row < 12; row++) rgba[(row * 10 + 2) * 4 + 3] = 255;
    for (let row = 5; row < 15; row++) rgba[(row * 10 + 7) * 4 + 3] = 255;
    rgba[3] = SCAN_VISIBILITY_ALPHA_THRESHOLD - 1;
    const sample = measureScanInkPixels(scan, rgba);
    expect(sample?.segments.map((segment) => segment.inkHeightPx)).toEqual([
      2, 10,
    ]);
    expect(sample?.alphaThreshold).toBe(128);
    const loaded = await actualFace();
    const typography: ScaleTypography = {
      ...loaded,
      engine: "scan",
      shape() {
        throw new Error("Must not synthesize font outlines");
      },
    };
    const first = {
      ...placement(["a"]),
      lineRanges: [{ wordStart: 0, wordEnd: 1 }],
    };
    const second = {
      ...placement(["a"]),
      lineRanges: [{ wordStart: 1, wordEnd: 2 }],
    };
    expect(
      measureScaleLetteringVisibilityMetrics(typography, [first], scan, sample),
    ).toEqual({ inkHeightEm: 0.1, sourceInkHeightPx: 2 });
    expect(
      measureScaleLetteringVisibilityMetrics(
        typography,
        [second],
        scan,
        sample,
      ),
    ).toEqual({ inkHeightEm: 0.5, sourceInkHeightPx: 10 });
    expect(
      measureScaleLetteringVisibilityMetrics(
        typography,
        [first, second],
        scan,
        sample,
      ).xHeightEm,
    ).toBeUndefined();
    expect(
      measureScaleLetteringVisibilityMetrics(
        typography,
        [{ ...first, lines: ["different"] }],
        scan,
        sample,
      ),
    ).toEqual({});
    expect(
      measureScanInkPixels(scan, new Uint8ClampedArray(rgba.length))
        ?.segments[0]?.inkHeightPx,
    ).toBe(0);
  });

  test("invalid scans and unavailable decoding remain unmeasured and bounded", async () => {
    const scan = scanFixture();
    expect(
      measureScanInkPixels(scan, new Uint8ClampedArray(1)),
    ).toBeUndefined();
    expect(
      measureScanInkPixels(
        { ...scan, image: { ...scan.image, width: 5_000_000 } },
        new Uint8ClampedArray(0),
      ),
    ).toBeUndefined();
    const region = scan.segments[0];
    if (!region) throw new Error("Expected source segment.");
    expect(
      measureScanInkPixels(
        { ...scan, segments: [{ ...region, x: -1 }] },
        new Uint8ClampedArray(800),
      ),
    ).toBeUndefined();
    const first = measureScanInkVisibility(scan);
    expect(measureScanInkVisibility(scan)).toBe(first);
    expect(await first).toBeUndefined();
  });

  test("saved scan decoding runs once, stays local and releases temporary resources", async () => {
    const originalImage = Object.getOwnPropertyDescriptor(globalThis, "Image");
    const originalDocument = Object.getOwnPropertyDescriptor(
      globalThis,
      "document",
    );
    const scan = scanFixture();
    const header = new Uint8Array(24);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x89504e47);
    view.setUint32(4, 0x0d0a1a0a);
    view.setUint32(12, 0x49484452);
    view.setUint32(16, scan.image.width);
    view.setUint32(20, scan.image.height);
    scan.image.dataUrl = `data:image/png;base64,${Buffer.from(header).toString("base64")}`;
    const rgba = new Uint8ClampedArray(800);
    rgba[(10 * 10 + 2) * 4 + 3] = 255;
    const images: FakeImage[] = [];
    const canvases: { width: number; height: number }[] = [];
    let decodes = 0;
    let failDecode = false;
    class FakeImage {
      src = "";
      decoding = "";
      naturalWidth = 10;
      naturalHeight = 20;
      constructor() {
        images.push(this);
      }
      async decode() {
        decodes++;
        if (failDecode) throw new Error("Decode failed");
      }
    }
    try {
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        value: FakeImage,
      });
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: {
          createElement(tag: string) {
            if (tag !== "canvas")
              throw new Error("Only a local canvas is allowed.");
            const canvas = {
              width: 0,
              height: 0,
              getContext() {
                return {
                  drawImage() {},
                  getImageData() {
                    return { data: rgba };
                  },
                };
              },
            };
            canvases.push(canvas);
            return canvas;
          },
        },
      });
      const pending = measureScanInkVisibility(scan);
      expect(measureScanInkVisibility(scan)).toBe(pending);
      const measured = await pending;
      expect(measured?.segments.map((segment) => segment.inkHeightPx)).toEqual([
        1, 0,
      ]);
      expect(decodes).toBe(1);
      expect(images[0]?.src).toBe("");
      expect(canvases[0]).toMatchObject({ width: 0, height: 0 });
      failDecode = true;
      expect(
        await measureScanInkVisibility({ ...scan, id: "scan-failure" }),
      ).toBeUndefined();
      expect(images[1]?.src).toBe("");
      expect(canvases).toHaveLength(1);
      expect(
        await measureScanInkVisibility({
          ...scan,
          image: { ...scan.image, dataUrl: "https://example.test/ink.png" },
        }),
      ).toBeUndefined();
      expect(decodes).toBe(2);
    } finally {
      if (originalImage)
        Object.defineProperty(globalThis, "Image", originalImage);
      else Reflect.deleteProperty(globalThis, "Image");
      if (originalDocument)
        Object.defineProperty(globalThis, "document", originalDocument);
      else Reflect.deleteProperty(globalThis, "document");
    }
  });

  test("remeasures actual fitted lines, clipped widths and rendered line-box heights", async () => {
    const typography = await actualFace();
    const plate: ScaleLetteringPlate = {
      id: "plate",
      surface: "body",
      widthInches: 100 / 25.4,
      heightInches: 40 / 25.4,
      safeRect: { x: 0, y: 0, width: 1, height: 1 },
    };
    const lettering = allocateScaleLettering(
      [plate],
      "A flourish quietly flows",
      { fontSizeMm: 8, marginMm: 2, measureLine: typography.measureLine },
    );
    expect(
      measureScaleLetteringPhysicalFit([plate], lettering, typography, 2),
    ).toMatchObject({
      totalWordCount: 4,
      placedWordCount: 4,
      inkOverflowCount: 0,
    });
    expect(
      measureScaleLetteringPhysicalFit(
        [{ ...plate, widthInches: 0.1 }],
        lettering,
        typography,
        2,
      ).inkOverflowCount,
    ).toBe(1);
    const squeezed = {
      ...lettering,
      placements: lettering.placements.map((item) => ({
        ...item,
        lineHeightsMm: item.lines.map(() => 0.01),
      })),
    };
    expect(
      measureScaleLetteringPhysicalFit([plate], squeezed, typography, 2)
        .inkOverflowCount,
    ).toBe(1);
    const staleCounts = { ...lettering, placedWordCount: 999 };
    expect(
      measureScaleLetteringPhysicalFit([plate], staleCounts, typography, 2)
        .placedWordCount,
    ).toBe(4);
    expect(
      measureScaleLetteringPhysicalFit(
        [plate],
        lettering,
        {
          ...typography,
          measureLine() {
            throw new Error("Measurement failed");
          },
        },
        2,
      ).inkOverflowCount,
    ).toBeUndefined();
    expect(
      measureScaleLetteringPhysicalFit([], lettering, typography, 2)
        .inkOverflowCount,
    ).toBe(1);
  });

  test("physical fitting preserves the scan's occurrence-specific measurement ranges", async () => {
    const loaded = await actualFace();
    const calls: unknown[] = [];
    const typography: ScaleTypography = {
      ...loaded,
      engine: "scan",
      measureLine(_text, _size, range) {
        calls.push(range);
        return { widthMm: range?.wordStart === 0 ? 5 : 40, heightMm: 5 };
      },
    };
    const plate: ScaleLetteringPlate = {
      id: "plate",
      surface: "body",
      widthInches: 20 / 25.4,
      heightInches: 20 / 25.4,
      safeRect: { x: 0, y: 0, width: 1, height: 1 },
    };
    const lettering = {
      placements: [
        {
          ...placement(["a", "a"]),
          lineHeightsMm: [5, 5],
          lineRanges: [
            { wordStart: 0, wordEnd: 1 },
            { wordStart: 1, wordEnd: 2 },
          ],
        },
      ],
      totalWordCount: 2,
      placedWordCount: 2,
      unplacedText: "",
    };
    expect(
      measureScaleLetteringPhysicalFit([plate], lettering, typography, 0)
        .inkOverflowCount,
    ).toBe(1);
    expect(calls).toEqual(lettering.placements[0]?.lineRanges ?? []);
  });
});
