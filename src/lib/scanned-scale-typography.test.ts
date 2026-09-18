import { expect, test } from "bun:test";
import type { CalligraphyScan } from "../../shared/calligraphy-scan";
import {
  allocateScaleLettering,
  fitScaleLettering,
  type ScaleLetteringPlate,
} from "../../shared/scale-lettering";
import { loadScannedScaleTypography } from "./scanned-scale-typography";

function pngHeader(width: number, height: number) {
  const bytes = Buffer.alloc(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

function fixture(): CalligraphyScan {
  return {
    version: 1,
    id: "scan-echo-study",
    name: "Echo study",
    calligrapher: "Jill Winters",
    text: "echo echo\na joined ending",
    createdAt: "2026-09-18T00:00:00.000Z",
    algorithmVersion: "test-1",
    original: {
      name: "scan.png",
      type: "image/png",
      bytes: 33,
      dataUrl: pngHeader(100, 50),
      sha256: "a".repeat(64),
    },
    image: { width: 100, height: 50, dataUrl: pngHeader(100, 50) },
    emHeightPx: 10,
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
    confirmed: true,
  };
}

function plate(widthMm: number, heightMm: number): ScaleLetteringPlate {
  return {
    id: "face",
    surface: "body",
    widthInches: widthMm / 25.4,
    heightInches: heightMm / 25.4,
    safeRect: { x: 0, y: 0, width: 1, height: 1 },
  };
}

function browserFixture(
  options: { wrongDecodedSize?: boolean; failDecode?: boolean } = {},
) {
  const descriptors = ["Image", "document"].map(
    (name) =>
      [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const,
  );
  let decodes = 0;
  const images: TestImage[] = [];
  class TestImage {
    src = "";
    decoding = "";
    naturalWidth = 100;
    naturalHeight = 50;
    constructor() {
      images.push(this);
    }
    async decode() {
      decodes++;
      if (options.failDecode) throw new Error("Invalid PNG");
      if (options.wrongDecodedSize) this.naturalWidth++;
    }
  }
  const operations: { operation: string; values: unknown[] }[] = [];
  const context = {
    globalCompositeOperation: "source-over",
    fillStyle: "#000000",
    clearRect(...values: unknown[]) {
      operations.push({ operation: "clear", values });
    },
    drawImage(...values: unknown[]) {
      operations.push({ operation: this.globalCompositeOperation, values });
    },
    fillRect(...values: unknown[]) {
      operations.push({
        operation: this.globalCompositeOperation,
        values: [this.fillStyle, ...values],
      });
    },
  };
  const canvases: {
    width: number;
    height: number;
    getContext(): typeof context;
  }[] = [];
  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    value: TestImage,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement(name: string) {
        expect(name).toBe("canvas");
        const canvas = { width: 0, height: 0, getContext: () => context };
        canvases.push(canvas);
        return canvas;
      },
    },
  });
  return {
    operations,
    canvases,
    images,
    get decodes() {
      return decodes;
    },
    restore() {
      for (const [name, descriptor] of descriptors) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
    },
  };
}

test("scanned occurrences retain distinct widths, source gaps and uniform physical scaling", async () => {
  const browser = browserFixture();
  try {
    const scan = fixture();
    const face = await loadScannedScaleTypography(
      scan,
      "echo  echo a joined\tending",
    );
    const first = { wordStart: 0, wordEnd: 1 };
    const second = { wordStart: 1, wordEnd: 2 };
    expect(face.engine).toBe("scan");
    expect(face.measure("echo", 5, first)).toBe(5);
    expect(face.measure("echo", 5, second)).toBe(10);
    expect(face.measure("echo echo", 5, { wordStart: 0, wordEnd: 2 })).toBe(17);
    expect(face.measureLine("echo", 15, second)).toEqual({
      widthMm: 30,
      heightMm: 18,
    });
    expect(face.measureLine(scan.text, 5)).toEqual({
      widthMm: 34,
      heightMm: 7,
    });
    expect(() => face.measure("echo", 5)).toThrow(
      "source word occurrence range",
    );
    expect(() => face.shape("echo", 5)).toThrow("raster ink");
    face.dispose?.();
  } finally {
    browser.restore();
  }
});

test("scan allocation reflows occurrences while joined words stay intact", async () => {
  const browser = browserFixture();
  try {
    const scan = fixture();
    const face = await loadScannedScaleTypography(scan, scan.text);
    const options = {
      fontSizeMm: 5,
      marginMm: 0,
      measureLine: face.measureLine,
      segments: face.segments,
    };
    const narrow = allocateScaleLettering([plate(16, 30)], scan.text, options);
    expect(narrow.placements[0]?.lines).toEqual([
      "echo",
      "echo",
      "a joined ending",
    ]);
    expect(narrow.placements[0]?.lineRanges).toEqual([
      ...(face.segments ?? []),
    ]);
    const wide = allocateScaleLettering([plate(40, 30)], scan.text, options);
    expect(wide.placements[0]?.lineRanges).toEqual([
      { wordStart: 0, wordEnd: 5 },
    ]);
    expect(wide.placements[0]?.fontSizeMm).toBe(
      narrow.placements[0]?.fontSizeMm,
    );
    const fit = fitScaleLettering([plate(12, 30)], scan.text, {
      ...options,
      minFontSizeMm: 2,
    });
    expect(fit.unplacedText).toBe("");
    expect(fit.placements[0]?.lines).toContain("a joined ending");
    expect(fit.placements[0]?.fontSizeMm).toBeCloseTo(4, 5);
    expect(() =>
      face.measure("a joined", 5, { wordStart: 2, wordEnd: 4 }),
    ).toThrow("Joined handwriting");
    face.dispose?.();
  } finally {
    browser.restore();
  }
});

test("drawing selects the exact source crops and retains alpha while tinting once per color", async () => {
  const browser = browserFixture();
  try {
    const scan = fixture();
    const face = await loadScannedScaleTypography(scan, scan.text);
    const draws: unknown[][] = [];
    const target = {
      fillStyle: "#123456",
      drawImage(...values: unknown[]) {
        draws.push(values);
      },
      fillText() {
        throw new Error("Never replace ink with a font");
      },
    } as unknown as CanvasRenderingContext2D;
    face.draw(target, "echo", 5, 50, 20, { wordStart: 0, wordEnd: 1 });
    face.draw(target, "echo", 5, 50, 20, { wordStart: 1, wordEnd: 2 });
    expect(draws.map((draw) => draw.slice(1))).toEqual([
      [2, 2, 10, 10, 47.5, 17.5, 5, 5],
      [16, 2, 20, 10, 45, 17.5, 10, 5],
    ]);
    expect(browser.canvases).toHaveLength(1);
    expect(browser.operations.map(({ operation }) => operation)).toEqual([
      "clear",
      "source-over",
      "source-in",
    ]);
    expect(browser.operations[2]?.values[0]).toBe("#123456");
    target.fillStyle = "#654321";
    face.draw(target, "echo", 10, 50, 20, { wordStart: 1, wordEnd: 2 });
    expect(draws[2]?.slice(1)).toEqual([16, 2, 20, 10, 40, 15, 20, 10]);
    expect(browser.canvases).toHaveLength(1);
    expect(browser.operations[5]?.values[0]).toBe("#654321");
    face.dispose?.();
    face.dispose?.();
    expect(browser.canvases[0]?.width).toBe(0);
    expect(browser.canvases[0]?.height).toBe(0);
    expect(browser.images[0]?.src).toBe("");
    expect(() => face.measure(scan.text, 5)).toThrow("released");
  } finally {
    browser.restore();
  }
});

test("changed spelling, punctuation, case, invalid ranges and unseen words never synthesize ink", async () => {
  const browser = browserFixture();
  try {
    const scan = fixture();
    for (const changed of [
      "Echo echo a joined ending",
      "echo echo a joined ending!",
      "echo other a joined ending",
    ])
      await expect(loadScannedScaleTypography(scan, changed)).rejects.toThrow(
        "different transcription",
      );
    expect(browser.decodes).toBe(0);
    const face = await loadScannedScaleTypography(scan, scan.text);
    expect(face.hasGlyph("unseen")).toBe(false);
    expect(() =>
      face.measure("other", 5, { wordStart: 1, wordEnd: 2 }),
    ).toThrow("does not match");
    for (const range of [
      { wordStart: -1, wordEnd: 1 },
      { wordStart: 0, wordEnd: 1.5 },
      { wordStart: 1, wordEnd: 1 },
      { wordStart: 0, wordEnd: 6 },
    ])
      expect(() => face.measure("echo", 5, range)).toThrow("range is invalid");
    for (const size of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 701])
      expect(() => face.measure(scan.text, size)).toThrow("Font size");
    face.dispose?.();
  } finally {
    browser.restore();
  }
});

test("actual PNG dimensions are bounded before decode and checked again afterward", async () => {
  let browser = browserFixture();
  try {
    const scan = fixture();
    scan.image.dataUrl = pngHeader(100_000, 100_000);
    await expect(loadScannedScaleTypography(scan, scan.text)).rejects.toThrow(
      "exceeds",
    );
    expect(browser.decodes).toBe(0);
  } finally {
    browser.restore();
  }
  browser = browserFixture({ wrongDecodedSize: true });
  try {
    const scan = fixture();
    await expect(loadScannedScaleTypography(scan, scan.text)).rejects.toThrow(
      "decoded handwriting dimensions",
    );
    expect(browser.canvases).toHaveLength(0);
    expect(browser.images[0]?.src).toBe("");
  } finally {
    browser.restore();
  }
  browser = browserFixture({ failDecode: true });
  try {
    const scan = fixture();
    await expect(loadScannedScaleTypography(scan, scan.text)).rejects.toThrow(
      "could not be decoded",
    );
    expect(browser.images[0]?.src).toBe("");
  } finally {
    browser.restore();
  }
});
