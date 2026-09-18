import { expect, test } from "bun:test";
import { buildCalligraphyGuide } from "./calligraphy-guide";
import type { CalligraphyScan } from "./calligraphy-scan";
import { savedPoemVersion } from "./poem-library";
import {
  DEFAULT_SCALE_DESIGN,
  normalizeScaleDesign,
  resizeScaleDesign,
} from "./scale-design";
import { parseScaleStudyFile, scaleStudyFile } from "./scale-scan-file";

const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n0kAAAAASUVORK5CYII=";
const scan: CalligraphyScan = {
  version: 1,
  id: "scan-original",
  name: "My ink",
  calligrapher: "Jill Winters",
  text: "Same same",
  createdAt: "2026-09-18T00:00:00Z",
  algorithmVersion: "projection-occurrences-1",
  original: {
    name: "original.png",
    type: "image/png",
    dataUrl: `data:image/png;base64,${png}`,
    bytes: atob(png).length,
    sha256: "a".repeat(64),
  },
  image: { width: 1, height: 1, dataUrl: `data:image/png;base64,${png}` },
  emHeightPx: 1,
  segments: [
    {
      text: "Same same",
      wordStart: 0,
      wordEnd: 2,
      lineIndex: 0,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    },
  ],
  confirmed: true,
};

test("scale files carry the exact source scan while ordinary browser drafts keep only a face ID", () => {
  const design = {
    ...DEFAULT_SCALE_DESIGN,
    text: "Same\nsame",
    calligraphyFaceId: scan.id,
  };
  const file = JSON.parse(JSON.stringify(scaleStudyFile(design, scan)));
  const restored = parseScaleStudyFile(file);
  expect(restored.scan).toEqual(scan);
  expect(restored.design.text).toBe(design.text);
  expect(restored.design.calligraphyFaceId).toBe(scan.id);
  expect(Object.hasOwn(normalizeScaleDesign(file), "calligraphyScan")).toBe(
    false,
  );
  expect(resizeScaleDesign(restored.design, 2).calligraphyFaceId).toBe(scan.id);
  expect(parseScaleStudyFile(DEFAULT_SCALE_DESIGN)).toEqual({
    design: DEFAULT_SCALE_DESIGN,
  });
});

test("scan imports reject changed words or a substituted face; arbitrary URLs cannot become saved face IDs", () => {
  expect(() =>
    scaleStudyFile({ ...DEFAULT_SCALE_DESIGN, calligraphyFaceId: scan.id }),
  ).toThrow("Restore the original scan");
  expect(() =>
    scaleStudyFile(
      {
        ...DEFAULT_SCALE_DESIGN,
        text: scan.text,
        calligraphyFaceId: "scan-other",
      },
      scan,
    ),
  ).toThrow("different faces");
  expect(() =>
    scaleStudyFile(
      { ...DEFAULT_SCALE_DESIGN, text: scan.text, calligraphyFaceId: "font" },
      scan,
    ),
  ).toThrow("different faces");
  expect(() =>
    scaleStudyFile({ ...DEFAULT_SCALE_DESIGN, text: "Same different" }, scan),
  ).toThrow("same words");
  expect(() =>
    parseScaleStudyFile({
      ...DEFAULT_SCALE_DESIGN,
      text: "Same same",
      calligraphyFaceId: "scan-other",
      calligraphyScan: scan,
    }),
  ).toThrow("different faces");
  expect(() =>
    parseScaleStudyFile({
      ...DEFAULT_SCALE_DESIGN,
      text: "same same",
      calligraphyScan: scan,
    }),
  ).toThrow("transcription");
  expect(
    normalizeScaleDesign({
      ...DEFAULT_SCALE_DESIGN,
      calligraphyFaceId: "https://example.test/scan",
    }).calligraphyFaceId,
  ).toBe("auto");
  expect(
    normalizeScaleDesign({ ...DEFAULT_SCALE_DESIGN, calligraphyFaceId: "font" })
      .calligraphyFaceId,
  ).toBe("font");
});

test("custom and empty saved poems derive their own guide rather than indexing builtin-only measurements", () => {
  for (const text of [
    "Gentle shapes remain.\nLet each inked line return.",
    "",
  ]) {
    const poem = savedPoemVersion({
      version: 1,
      id: "saved-11111111-1111-4111-8111-111111111111",
      name: "A different poem",
      text,
      baseId: "extended",
      createdAt: "2026-09-18T00:00:00Z",
      calligrapher: "An Artist",
    });
    const guide = buildCalligraphyGuide(poem);
    expect(guide.lineWidthsEm).toHaveLength(poem.lines.length);
    expect(Number.isFinite(guide.loopFigureEm)).toBe(true);
    expect(guide.subtitle).toContain("An Artist");
    expect(guide.pdfPath).toBe("");
    expect(guide.hardWords.every((word) => text.includes(word))).toBe(true);
  }
});
