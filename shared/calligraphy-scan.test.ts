import { describe, expect, test } from "bun:test";
import {
  type CalligraphyScan,
  inspectScanImageHeader,
  scanMatchesText,
  scanTextKey,
  segmentCalligraphyMask,
  validateCalligraphyScan,
} from "./calligraphy-scan";

function page(width = 100, height = 60) {
  const mask = new Uint8Array(width * height);
  return {
    mask,
    width,
    height,
    ink(x: number, y: number, w: number, h: number) {
      for (let row = y; row < y + h; row++)
        for (let col = x; col < x + w; col++) mask[row * width + col] = 1;
    },
    analyze(text: string, cuts?: number[]) {
      return segmentCalligraphyMask(mask, width, height, text, cuts);
    },
  };
}

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/9l8AAAAASUVORK5CYII=";

function scan(): CalligraphyScan {
  return {
    version: 1,
    id: "scan-one",
    name: "A poem",
    calligrapher: "Jill Winters",
    text: "Hello!",
    createdAt: "2026-09-18T00:00:00.000Z",
    algorithmVersion: "projection-occurrences-1",
    original: {
      name: "original.png",
      type: "image/png",
      bytes: 68,
      dataUrl: PNG,
      sha256: "a".repeat(64),
    },
    image: { width: 1, height: 1, dataUrl: PNG },
    emHeightPx: 1,
    segments: [
      {
        text: "Hello!",
        wordStart: 0,
        wordEnd: 1,
        lineIndex: 0,
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      },
    ],
    confirmed: true,
  };
}

describe("deterministic handwritten occurrence segmentation", () => {
  test("separate repeated word occurrences retain their own bounds", () => {
    const image = page();
    image.ink(4, 10, 12, 8);
    image.ink(34, 10, 18, 8);
    const result = image.analyze("echo echo");
    expect(result.error).toBeUndefined();
    expect(
      result.segments.map(({ text, wordStart, wordEnd, width }) => ({
        text,
        wordStart,
        wordEnd,
        width,
      })),
    ).toEqual([
      { text: "echo", wordStart: 0, wordEnd: 1, width: 12 },
      { text: "echo", wordStart: 1, wordEnd: 2, width: 18 },
    ]);
    expect(image.analyze("echo echo")).toEqual(result);
  });

  test("connected cursive strokes preserve the entire multiword region", () => {
    const image = page();
    image.ink(3, 10, 12, 8);
    image.ink(40, 10, 18, 8);
    image.ink(15, 16, 25, 1);
    const result = image.analyze("stay together");
    expect(result.error).toBeUndefined();
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]).toMatchObject({
      text: "stay together",
      wordStart: 0,
      wordEnd: 2,
      width: 55,
    });
    expect(result.warnings[0]).toContain("stays together");
  });

  test("ambiguous word counts retain a line instead of inventing boundaries", () => {
    const image = page();
    image.ink(5, 5, 10, 10);
    image.ink(30, 5, 15, 10);
    expect(image.analyze("one two three").segments[0]).toMatchObject({
      wordStart: 0,
      wordEnd: 3,
    });
  });

  test("line count mismatch blocks export until actual dividers are corrected", () => {
    const image = page();
    image.ink(10, 10, 10, 5);
    image.ink(10, 40, 10, 5);
    const result = image.analyze("one two");
    expect(result.error).toContain("2 ink lines for 1 typed lines");
    expect(result.segments).toEqual([]);
    expect(image.analyze("one\ntwo").error).toBeUndefined();
  });

  test("manual dividers can group detached dots with their line", () => {
    const image = page();
    image.ink(12, 7, 2, 2);
    image.ink(5, 15, 30, 6);
    image.ink(5, 40, 35, 6);
    expect(image.analyze("first\nsecond").error).toBeDefined();
    const result = image.analyze("first\nsecond", [30]);
    expect(result.error).toBeUndefined();
    expect(result.segments[0]).toMatchObject({ y: 7, height: 14 });
  });

  test("a manual divider cannot cut vertical or diagonal connected strokes", () => {
    const image = page();
    image.ink(20, 10, 2, 30);
    expect(image.analyze("one\ntwo", [25]).error).toContain(
      "crosses a connected stroke",
    );
    const diagonal = page();
    diagonal.ink(20, 24, 1, 1);
    diagonal.ink(21, 25, 1, 1);
    expect(diagonal.analyze("one\ntwo", [25]).error).toContain(
      "crosses a connected stroke",
    );
  });

  test("empty, dark, invalid-size and missing-transcription inputs fail clearly", () => {
    const image = page();
    expect(image.analyze("poem").error).toContain("No ink");
    image.ink(0, 0, 100, 60);
    expect(image.analyze("poem").error).toContain("Too much");
    expect(() =>
      segmentCalligraphyMask(new Uint8Array(4), 3, 2, "poem"),
    ).toThrow("dimensions");
    const small = page();
    small.ink(2, 2, 4, 4);
    expect(small.analyze(" \n ").error).toContain("exact transcription");
  });
});

describe("reviewed scan format", () => {
  test("permits whitespace and reflow only", () => {
    expect(scanTextKey(" the\tpoem\nagain ")).toBe("the poem again");
    expect(
      scanMatchesText({ text: "A poem,\nagain." }, "A  poem, again. "),
    ).toBe(true);
    expect(scanMatchesText({ text: "A poem," }, "a poem,")).toBe(false);
    expect(scanMatchesText({ text: "A poem," }, "A poem.")).toBe(false);
    expect(scanMatchesText({ text: "é" }, "e\u0301")).toBe(false);
    expect(scanMatchesText({ text: " " }, "\n")).toBe(false);
  });

  test("accepts reviewed exact data and checks original bytes/header", () => {
    expect(validateCalligraphyScan(scan())).toEqual(scan());
    for (const id of ["auto", "font", "scan-", "other-id"])
      expect(() => validateCalligraphyScan({ ...scan(), id })).toThrow(
        "identifier",
      );
    expect(() =>
      validateCalligraphyScan({ ...scan(), confirmed: false }),
    ).toThrow("reviewed");
    expect(() =>
      validateCalligraphyScan({
        ...scan(),
        original: { ...scan().original, bytes: 9 },
      }),
    ).toThrow("file size");
    expect(() =>
      validateCalligraphyScan({
        ...scan(),
        image: { ...scan().image, width: 2 },
      }),
    ).toThrow("PNG header");
  });

  test("rejects changed text, missing ranges, and out-of-image crops", () => {
    const original = scan();
    expect(() =>
      validateCalligraphyScan({ ...original, text: "Other" }),
    ).toThrow("transcription");
    expect(() =>
      validateCalligraphyScan({ ...original, text: "Hello! there" }),
    ).toThrow("no handwriting");
    expect(() =>
      validateCalligraphyScan({
        ...original,
        segments: [{ ...original.segments[0], x: 1 }],
      }),
    ).toThrow("Region left");
    expect(() =>
      validateCalligraphyScan({ ...original, emHeightPx: Number.NaN }),
    ).toThrow("Writing height");
    expect(() =>
      validateCalligraphyScan({
        ...original,
        segments: [{ ...original.segments[0], lineIndex: 2 }],
      }),
    ).toThrow();
  });

  test("bounds compressed-image headers before allocation", () => {
    const bytes = Uint8Array.from(atob(PNG.split(",")[1] ?? ""), (char) =>
      char.charCodeAt(0),
    );
    expect(inspectScanImageHeader(bytes)).toEqual({
      type: "image/png",
      width: 1,
      height: 1,
    });
    const oversized = bytes.slice();
    new DataView(oversized.buffer).setUint32(16, 6_001);
    new DataView(oversized.buffer).setUint32(20, 4_000);
    expect(() => inspectScanImageHeader(oversized)).toThrow("24 million");
    const phone = bytes.slice();
    new DataView(phone.buffer).setUint32(16, 4_000);
    new DataView(phone.buffer).setUint32(20, 3_000);
    expect(inspectScanImageHeader(phone)).toMatchObject({
      width: 4_000,
      height: 3_000,
    });
    new DataView(phone.buffer).setUint32(16, 12_001);
    expect(() => inspectScanImageHeader(phone)).toThrow("12,000 pixels");
    expect(() =>
      inspectScanImageHeader(new Uint8Array([0xff, 0xd8, 0xff])),
    ).toThrow("incomplete");
    expect(() => inspectScanImageHeader(new Uint8Array(30))).toThrow(
      "PNG or JPEG",
    );
  });
});
