import { expect, test } from "bun:test";
import {
  allocateScaleLettering,
  fillScaleLettering,
  fitScaleLettering,
  SCALE_AUTO_FIT_MAX_LINES_PER_PLATE,
  type ScaleLetteringPlate,
  type ScaleTextRange,
  typicalPlateFillFontSizeMm,
} from "./scale-lettering";

const characterMeasure = (text: string, fontSizeMm: number) =>
  text.length * fontSizeMm;

function plate(
  id: string,
  widthMm: number,
  heightMm: number,
  safeWidth = 1,
  safeHeight = 1,
): ScaleLetteringPlate {
  return {
    id,
    surface: "body",
    widthInches: widthMm / 25.4,
    heightInches: heightMm / 25.4,
    safeRect: { x: 0, y: 0, width: safeWidth, height: safeHeight },
  };
}

test("conserves ordered words and punctuation exactly once across faces", () => {
  const text = "One,  two\nthree! four — five?";
  const result = allocateScaleLettering(
    [plate("first", 18, 8), plate("second", 18, 8)],
    text,
    { fontSizeMm: 2, marginMm: 1, measure: characterMeasure },
  );

  const placedWords = result.placements.flatMap(({ lines }) =>
    lines.flatMap((line) => line.split(" ")),
  );
  expect(placedWords).toEqual(text.match(/\S+/gu) ?? []);
  expect(result.unplacedText).toBe("");
  expect(result.placedWordCount).toBe(6);
  expect(result.totalWordCount).toBe(6);
  expect(result.placements.every(({ lines }) => lines.length > 0)).toBe(true);
});

test("uses the shared script metrics when no measurer is supplied", () => {
  const result = allocateScaleLettering([plate("face", 4, 20)], "ab AB", {
    fontSizeMm: 5,
    marginMm: 0,
  });

  expect(result.placements[0]?.lines).toEqual(["ab"]);
  expect(result.unplacedText).toBe("AB");
});

test("uses normalized safe dimensions and physical margins", () => {
  const result = allocateScaleLettering(
    [plate("inset", 100, 100, 0.5, 0.25)],
    "aaaa bbbb cccc dddd",
    { fontSizeMm: 5, marginMm: 5, measure: characterMeasure },
  );

  // Usable area is 40 x 15 mm: two 7 mm lines, each at most 40 mm wide.
  expect(result.placements[0]?.lines).toEqual(["aaaa", "bbbb"]);
  expect(result.unplacedText).toBe("cccc dddd");
});

test("reallocates lines when face size changes", () => {
  const options = {
    fontSizeMm: 2,
    marginMm: 1,
    measure: characterMeasure,
  };
  const narrow = allocateScaleLettering(
    [plate("face", 18, 20)],
    "alpha beta gamma",
    options,
  );
  const wide = allocateScaleLettering(
    [plate("face", 40, 20)],
    "alpha beta gamma",
    options,
  );

  expect(narrow.placements[0]?.lines).toEqual(["alpha", "beta", "gamma"]);
  expect(wide.placements[0]?.lines).toEqual(["alpha beta gamma"]);
});

test("autofit chooses the greatest fitting physical font size", () => {
  const result = fitScaleLettering([plate("face", 50, 20)], "alpha beta", {
    fontSizeMm: 8,
    minFontSizeMm: 3,
    marginMm: 0,
    measure: characterMeasure,
  });

  expect(result.unplacedText).toBe("");
  expect(result.placements[0]?.fontSizeMm).toBeCloseTo(20 / 2 / 1.4, 5);
  expect(result.placements[0]?.lines).toEqual(["alpha", "beta"]);
});

test("lines remain within width and height budgets", () => {
  const face = plate("face", 72, 34, 0.75, 0.75);
  const fontSizeMm = 4;
  const marginMm = 3;
  const result = allocateScaleLettering(
    [face],
    "one two three four five six seven",
    { fontSizeMm, marginMm, measure: characterMeasure },
  );
  const lines = result.placements[0]?.lines ?? [];
  const usableWidth = 72 * 0.75 - 2 * marginMm;
  const usableHeight = 34 * 0.75 - 2 * marginMm;

  expect(lines.length * fontSizeMm * 1.4).toBeLessThanOrEqual(usableHeight);
  for (const line of lines)
    expect(characterMeasure(line, fontSizeMm)).toBeLessThanOrEqual(usableWidth);
});

test("reports an unbreakable word and all following words without loss", () => {
  const result = allocateScaleLettering(
    [plate("narrow", 20, 20), plate("wider", 30, 20)],
    "ok extraordinarilylong after",
    { fontSizeMm: 2, marginMm: 1, measure: characterMeasure },
  );

  expect(result.placements[0]?.lines).toEqual(["ok"]);
  expect(result.placements[1]?.lines).toEqual([]);
  expect(result.unplacedText).toBe("extraordinarilylong after");
  expect(result.placedWordCount).toBe(1);
  expect(result.totalWordCount).toBe(3);
});

test("returns the minimum-size partial result when even autofit cannot fit", () => {
  const result = fitScaleLettering([plate("face", 10, 10)], "impossible rest", {
    fontSizeMm: 6,
    minFontSizeMm: 2,
    marginMm: 1,
    measure: characterMeasure,
  });

  expect(result.placements[0]?.fontSizeMm).toBe(2);
  expect(result.unplacedText).toBe("impossible rest");
});

test("handles blank text and rejects invalid bounds", () => {
  const blank = allocateScaleLettering([plate("face", 20, 20)], " \n\t ", {
    fontSizeMm: 4,
    marginMm: 1,
  });
  expect(blank.placements[0]?.lines).toEqual([]);
  expect(blank.totalWordCount).toBe(0);
  expect(blank.unplacedText).toBe("");

  expect(() =>
    allocateScaleLettering([plate("face", 20, 20)], "x".repeat(20_001), {
      fontSizeMm: 4,
      marginMm: 1,
    }),
  ).toThrow("at most 20000 characters");
});

test("uses actual vertical flourishes and never squashes a tall line to fit", () => {
  const measureLine = (text: string, fontSizeMm: number) => ({
    widthMm: text.length * fontSizeMm,
    heightMm: fontSizeMm * (text.includes("Tall") ? 3 : 1),
  });
  const result = allocateScaleLettering(
    [plate("short", 16, 8), plate("tall", 30, 15)],
    "one Tall two",
    { fontSizeMm: 4, marginMm: 0, measureLine },
  );
  expect(result.placements[0]?.lines).toEqual(["one"]);
  expect(result.placements[0]?.lineHeightsMm).toEqual([4]);
  expect(result.placements[1]?.lines).toEqual(["Tall"]);
  expect(result.placements[1]?.lineHeightsMm).toEqual([12]);
  expect(result.unplacedText).toBe("two");
});

test("autofit measures each line's vertical ink instead of assuming 1.4 em", () => {
  const result = fitScaleLettering([plate("face", 70, 20)], "Tall", {
    fontSizeMm: 10,
    minFontSizeMm: 2,
    marginMm: 0,
    measureLine: (text, size) => ({
      widthMm: text.length * size,
      heightMm: size * 3,
    }),
  });
  expect(result.unplacedText).toBe("");
  expect(result.placements[0]?.fontSizeMm).toBeCloseTo(20 / 3, 5);
  expect(result.placements[0]?.lineHeightsMm?.[0]).toBeLessThanOrEqual(20);
});

test("rejects invalid measured heights rather than reporting a false fit", () => {
  for (const heightMm of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(() =>
      allocateScaleLettering([plate("face", 40, 20)], "word", {
        fontSizeMm: 4,
        marginMm: 0,
        measureLine: () => ({ widthMm: 10, heightMm }),
      }),
    ).toThrow("positive height");
  }
});

test("keeps identical word occurrences distinct through measurement and reflow", () => {
  const seen: ScaleTextRange[] = [];
  const options = {
    fontSizeMm: 1,
    marginMm: 0,
    measureLine: (_text: string, size: number, range?: ScaleTextRange) => {
      if (!range) throw new Error("Missing occurrence range");
      seen.push(range);
      const widths = [5, 12, 7];
      return {
        widthMm:
          widths.slice(range.wordStart, range.wordEnd).reduce((a, b) => a + b) *
          size,
        heightMm: size * 2,
      };
    },
  };
  const narrow = allocateScaleLettering(
    [plate("narrow", 12, 7)],
    "echo echo echo",
    options,
  );
  expect(narrow.placements[0]?.lines).toEqual(["echo", "echo", "echo"]);
  expect(narrow.placements[0]?.lineRanges).toEqual([
    { wordStart: 0, wordEnd: 1 },
    { wordStart: 1, wordEnd: 2 },
    { wordStart: 2, wordEnd: 3 },
  ]);
  const wide = allocateScaleLettering(
    [plate("wide", 24, 7)],
    "echo echo echo",
    options,
  );
  expect(wide.placements[0]?.lineRanges).toEqual([
    { wordStart: 0, wordEnd: 3 },
  ]);
  expect(narrow.unplacedText).toBe("");
  expect(wide.unplacedText).toBe("");
  expect(seen).toContainEqual({ wordStart: 1, wordEnd: 2 });
});

test("joined handwriting cannot split across lines or plates, including autofit", () => {
  const options = {
    fontSizeMm: 1,
    marginMm: 0,
    measure: characterMeasure,
    segments: [
      { wordStart: 0, wordEnd: 2 },
      { wordStart: 2, wordEnd: 3 },
    ],
  };
  const result = allocateScaleLettering(
    [plate("short", 6, 20), plate("wide", 12, 20)],
    "one two three",
    options,
  );
  expect(result.placements[0]?.lines).toEqual([]);
  expect(result.placements[1]?.lines).toEqual(["one two", "three"]);
  expect(result.placements[1]?.lineRanges).toEqual(options.segments);
  const fit = fitScaleLettering([plate("fit", 6, 20)], "one two three", {
    ...options,
    minFontSizeMm: 0.5,
  });
  expect(fit.placements[0]?.lines).toEqual(["one two", "three"]);
  expect(fit.placements[0]?.lineRanges).toEqual(options.segments);
  expect(fit.unplacedText).toBe("");
});

test("rejects incomplete, overlapping, unordered and fractional source segments", () => {
  const invalid = [
    [],
    [{ wordStart: 0, wordEnd: 1 }],
    [{ wordStart: 1, wordEnd: 2 }],
    [{ wordStart: 0, wordEnd: 3 }],
    [{ wordStart: 0, wordEnd: 0 }],
    [{ wordStart: 0, wordEnd: 1.5 }],
    [
      { wordStart: 0, wordEnd: 1 },
      { wordStart: 0, wordEnd: 2 },
    ],
    [
      { wordStart: 1, wordEnd: 2 },
      { wordStart: 0, wordEnd: 1 },
    ],
  ];
  for (const segments of invalid)
    expect(() =>
      allocateScaleLettering([plate("face", 100, 100)], "one two", {
        fontSizeMm: 1,
        marginMm: 0,
        segments,
      }),
    ).toThrow("segments must cover");
});

test("a line cap sends later words along following faces", () => {
  const options = {
    fontSizeMm: 2,
    marginMm: 1,
    measure: characterMeasure,
    maxLinesPerPlate: 1,
  };
  const packed = allocateScaleLettering(
    [plate("tall", 10, 100)],
    "aaaa bbbb cccc",
    { fontSizeMm: 2, marginMm: 1, measure: characterMeasure },
  );
  expect(packed.placements[0]?.lines).toEqual(["aaaa", "bbbb", "cccc"]);
  const spread = allocateScaleLettering(
    [
      plate("first", 10, 100),
      plate("second", 10, 100),
      plate("third", 10, 100),
    ],
    "aaaa bbbb cccc",
    options,
  );
  expect(spread.placements.map(({ lines }) => lines)).toEqual([
    ["aaaa"],
    ["bbbb"],
    ["cccc"],
  ]);
  expect(spread.unplacedText).toBe("");
});

test("auto-fit with a line cap shrinks type instead of packing a few tall faces", () => {
  const plates = [
    plate("first", 10, 100),
    plate("second", 10, 100),
    plate("third", 10, 8),
  ];
  const packed = fitScaleLettering(plates, "aaaa bbbb cccc", {
    fontSizeMm: 2,
    minFontSizeMm: 0.5,
    marginMm: 1,
    measure: characterMeasure,
  });
  expect(
    packed.placements.filter(({ lines }) => lines.length > 0),
  ).toHaveLength(1);
  const spread = fitScaleLettering(plates, "aaaa bbbb cccc", {
    fontSizeMm: 2,
    minFontSizeMm: 0.5,
    marginMm: 1,
    measure: characterMeasure,
    maxLinesPerPlate: SCALE_AUTO_FIT_MAX_LINES_PER_PLATE,
  });
  expect(spread.unplacedText).toBe("");
  expect(
    spread.placements.filter(({ lines }) => lines.length > 0).length,
  ).toBeGreaterThan(1);
});

test("rejects a non-positive line cap", () => {
  expect(() =>
    allocateScaleLettering([plate("face", 20, 20)], "word", {
      fontSizeMm: 2,
      marginMm: 0,
      maxLinesPerPlate: 0,
    }),
  ).toThrow("maxLinesPerPlate");
});

test("typical plate fill size follows median usable height", () => {
  expect(typicalPlateFillFontSizeMm([], 2)).toBe(0);
  expect(
    typicalPlateFillFontSizeMm(
      [plate("short", 10, 14), plate("tall", 10, 140), plate("mid", 10, 70)],
      0,
      1,
    ),
  ).toBeCloseTo(70 / 1.4, 10);
});

test("fill auto-fit puts one word on each plate as large as the face allows", () => {
  const plates = [plate("a", 40, 40), plate("b", 40, 40), plate("c", 40, 40)];
  const packed = allocateScaleLettering(plates, "aa bb cc", {
    fontSizeMm: 2,
    marginMm: 0,
    measure: characterMeasure,
  });
  expect(packed.placements.filter(({ lines }) => lines.length).length).toBe(1);
  const filled = fillScaleLettering(plates, "aa bb cc", {
    fontSizeMm: 2,
    minFontSizeMm: 1,
    marginMm: 0,
    measure: characterMeasure,
  });
  expect(filled.unplacedText).toBe("");
  expect(filled.placements.map(({ lines }) => lines)).toEqual([
    ["aa"],
    ["bb"],
    ["cc"],
  ]);
  expect(filled.placements[0]?.fontSizeMm).toBeGreaterThan(2);
  expect(
    filled.placements.every(
      (placement) => placement.fontSizeMm === filled.placements[0]?.fontSizeMm,
    ),
  ).toBe(true);
});

test("fill auto-fit sizes each plate independently", () => {
  const filled = fillScaleLettering(
    [plate("narrow", 20, 40), plate("wide", 80, 40)],
    "aa aa",
    {
      fontSizeMm: 2,
      minFontSizeMm: 1,
      marginMm: 0,
      measure: characterMeasure,
    },
  );
  expect(filled.placements[0]?.fontSizeMm).toBeCloseTo(10, 5);
  expect(filled.placements[1]?.fontSizeMm).toBeGreaterThan(
    filled.placements[0]?.fontSizeMm ?? 0,
  );
});

test("fill auto-fit skips a face that cannot take the next word at the minimum size", () => {
  const filled = fillScaleLettering(
    [plate("tiny", 3, 40), plate("wide", 40, 40)],
    "aaaa",
    {
      fontSizeMm: 2,
      minFontSizeMm: 1,
      marginMm: 0,
      measure: characterMeasure,
    },
  );
  expect(filled.placements[0]?.lines).toEqual([]);
  expect(filled.placements[1]?.lines).toEqual(["aaaa"]);
  expect(filled.unplacedText).toBe("");
});

test("fill auto-fit keeps a joined segment on one plate", () => {
  const filled = fillScaleLettering(
    [plate("first", 80, 40), plate("second", 80, 40)],
    "one two three",
    {
      fontSizeMm: 2,
      minFontSizeMm: 1,
      marginMm: 0,
      measure: characterMeasure,
      segments: [
        { wordStart: 0, wordEnd: 2 },
        { wordStart: 2, wordEnd: 3 },
      ],
    },
  );
  expect(filled.placements[0]?.lines).toEqual(["one two"]);
  expect(filled.placements[1]?.lines).toEqual(["three"]);
  expect(filled.unplacedText).toBe("");
});
