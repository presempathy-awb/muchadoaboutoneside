import { describe, expect, test } from "bun:test";
import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFStream,
} from "pdf-lib";
import { DEFAULT_WORKSHEET_SETTINGS } from "../../shared/worksheet";
import {
  createWorksheetComparisonPdf,
  createWorksheetPdf,
  importWorksheetPdf,
  validateWorksheetTextFit,
  worksheetTextPages,
} from "./worksheet-export";
import { loadWorksheetFont, type WorksheetFont } from "./worksheet-fonts";
import type { WorksheetSnapshot } from "./worksheet-store";

function worksheet(
  overrides: Partial<WorksheetSnapshot["settings"]> = {},
): WorksheetSnapshot {
  return {
    version: 1,
    settings: {
      ...DEFAULT_WORKSHEET_SETTINGS,
      fontId: "serif",
      lineCount: 3,
      pageCount: 2,
      textEnabled: true,
      ...overrides,
    },
    text: "one\ntwo\nthree\nfour",
  };
}

function decodedPageContent(document: PDFDocument, pageIndex = 0) {
  const contents = document.getPage(pageIndex).node.Contents();
  const streams =
    contents instanceof PDFArray
      ? Array.from({ length: contents.size() }, (_, index) =>
          contents.lookup(index, PDFRawStream),
        )
      : contents instanceof PDFRawStream
        ? [contents]
        : [];
  return streams
    .map((stream) =>
      new TextDecoder().decode(decodePDFRawStream(stream).decode()),
    )
    .join("\n");
}

function boundedTestFont(inkBoundsMm: {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}): WorksheetFont {
  const bounds = {
    ...inkBoundsMm,
    width: inkBoundsMm.xMax - inkBoundsMm.xMin,
    height: inkBoundsMm.yMax - inkBoundsMm.yMin,
  };
  return {
    id: "bounds-test",
    family: "serif",
    engine: "fontkit",
    supportedFeatures: [],
    unitsPerEm: 1_000,
    xHeightUnits: 500,
    resolveSizePt: () => 20,
    hasGlyph: () => true,
    measure: () => 20,
    shape: (text, settings) => ({
      engine: "fontkit",
      text,
      sizePt: 20,
      widthMm: 20,
      inkBoundsMm: bounds,
      glyphs: [
        {
          id: 1,
          cluster: 0,
          xMm: 0,
          yMm: 0,
          advanceMm: 20,
          inkBoundsMm: bounds,
        },
      ],
      pathScaleMm: 0.01,
      writingScale: settings.writingScale,
    }),
  };
}

const comparisonFontFiles = [
  ["Great Vibes", "GreatVibes-Regular.ttf"],
  ["Pinyon Script", "PinyonScript-Regular.ttf"],
  ["Imperial Script", "ImperialScript-Regular.ttf"],
  ["Italianno", "Italianno-Regular.ttf"],
  ["Herr Von Muellerhoff", "HerrVonMuellerhoff-Regular.ttf"],
  ["Mrs Saint Delafield", "MrsSaintDelafield-Regular.ttf"],
] as const;

async function realComparisonFonts(shapingEngine: "fontkit" | "harfbuzz") {
  return Promise.all(
    comparisonFontFiles.map(async ([label, filename]) => {
      const bytes = new Uint8Array(
        await Bun.file(`public/fonts/${filename}`).arrayBuffer(),
      );
      const snapshot: WorksheetSnapshot = {
        version: 1,
        settings: {
          ...DEFAULT_WORKSHEET_SETTINGS,
          fontId: "custom",
          shapingEngine,
        },
        text: "",
        customFont: {
          name: label,
          dataUrl: `data:font/ttf;base64,${Buffer.from(bytes).toString("base64")}`,
        },
      };
      return { label, font: await loadWorksheetFont(snapshot) };
    }),
  );
}

describe("worksheet text pagination", () => {
  test("continues wrapped text across requested pages", async () => {
    const snapshot = worksheet();
    const font = await loadWorksheetFont(snapshot);
    const result = worksheetTextPages(snapshot, font);
    expect(result.pages).toEqual([["one", "two", "three"], ["four"]]);
    expect(result.estimate).toMatchObject({
      lineCount: 4,
      pagesNeeded: 2,
      rowsPerPage: 3,
      overflow: false,
    });
  });

  test("cycles repeated text through every baseline and page", async () => {
    const snapshot = { ...worksheet({ textRepeat: true }), text: "one\ntwo" };
    const font = await loadWorksheetFont(snapshot);
    expect(worksheetTextPages(snapshot, font).pages).toEqual([
      ["one", "two", "one"],
      ["two", "one", "two"],
    ]);
  });

  test("does not cycle repeat text until every source line fits", async () => {
    const snapshot = {
      ...worksheet({ textRepeat: true }),
      text: "one\ntwo\nthree\nfour\nfive\nsix\nseven",
    };
    const font = await loadWorksheetFont(snapshot);
    const model = worksheetTextPages(snapshot, font);
    expect(model.estimate.overflow).toBe(true);
    expect(model.pages).toEqual([
      ["one", "two", "three"],
      ["four", "five", "six"],
    ]);
    expect(() => validateWorksheetTextFit(snapshot, model)).toThrow(
      "needs 3 pages",
    );
    await expect(createWorksheetPdf(snapshot, { font })).rejects.toThrow(
      "needs 3 pages",
    );
  });

  test("allocates a model, trace, and blank physical row for every source line", async () => {
    const snapshot = {
      ...worksheet({
        lineCount: 6,
        pageCount: 1,
        practicePattern: "model-trace-blank",
      }),
      text: "one\ntwo",
    };
    const font = await loadWorksheetFont(snapshot);
    const model = worksheetTextPages(snapshot, font);
    expect(model.pages).toEqual([["one", "one", "", "two", "two", ""]]);
    expect(model.placedPages[0]?.map(({ role }) => role)).toEqual([
      "model",
      "trace",
      "blank",
      "model",
      "trace",
      "blank",
    ]);
    expect(model.placedPages[0]?.[1]?.opacity).toBeCloseTo(
      snapshot.settings.textOpacity * 0.25,
      8,
    );
    expect(model.estimate).toMatchObject({
      lineCount: 2,
      pagesNeeded: 1,
      rowsPerPage: 6,
      overflow: false,
    });
  });

  test("rejects the three-row practice pattern when a page has fewer than three rows", async () => {
    const snapshot = {
      ...worksheet({
        lineCount: 2,
        pageCount: 20,
        practicePattern: "model-trace-blank",
      }),
      text: "one",
    };
    const font = await loadWorksheetFont(snapshot);
    const model = worksheetTextPages(snapshot, font);
    expect(model.estimate.pagesNeeded).toBe(Number.POSITIVE_INFINITY);
    expect(() => validateWorksheetTextFit(snapshot, model)).toThrow(
      "requires at least three writing rows",
    );
  });

  test("reports exact-ink row collisions separately from physical clipping", () => {
    const snapshot = {
      ...worksheet({
        spacingMode: "fixed",
        spacingMm: 1,
        pageCount: 1,
      }),
      text: "one\ntwo",
    };
    const font = boundedTestFont({ xMin: -2, yMin: -2, xMax: 20, yMax: 2 });
    const model = worksheetTextPages(snapshot, font);
    expect(model.warnings).toContain(
      "Some example strokes overlap another occupied practice row. Increase row spacing or reduce the text size.",
    );
    expect(model.warnings).toContain(
      "Some flourishes extend beyond the writing area, but they remain on the physical page.",
    );
    expect(() => validateWorksheetTextFit(snapshot, model)).not.toThrow();

    const clipped = worksheetTextPages(
      snapshot,
      boundedTestFont({ xMin: -20, yMin: -2, xMax: 20, yMax: 2 }),
    );
    expect(() => validateWorksheetTextFit(snapshot, clipped)).toThrow(
      "extends off the physical page",
    );
  });
});

describe("worksheet PDF export", () => {
  test("creates correctly sized vector pages without a private editable payload", async () => {
    const snapshot = worksheet({ orientation: "landscape" });
    const font = await loadWorksheetFont(snapshot);
    const bytes = await createWorksheetPdf(snapshot, { font });
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(2);
    const size = document.getPage(0).getSize();
    expect(size.width).toBeCloseTo((279.4 * 72) / 25.4, 4);
    expect(size.height).toBeCloseTo((215.9 * 72) / 25.4, 4);
    expect(document.getSubject()).toBeUndefined();
    await expect(importWorksheetPdf(bytes)).rejects.toThrow(
      "no editable worksheet template",
    );
  });

  test("exports guides without loading a missing custom font or printing hidden text", async () => {
    const snapshot: WorksheetSnapshot = {
      ...worksheet({ fontId: "custom", textEnabled: false, pageCount: 1 }),
      text: "hidden emoji that a standard PDF font cannot encode 🧑‍🎨",
    };
    const bytes = await createWorksheetPdf(snapshot);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  test("can print an imported PNG, dotted guides, and the calibration mark", async () => {
    const snapshot: WorksheetSnapshot = {
      ...worksheet({
        lineStyle: "dotted",
        calibrationMark: true,
        pageCount: 3,
      }),
      photo: {
        dataUrl:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        pixelWidth: 1,
        pixelHeight: 1,
        widthMm: 20,
        xMm: 20,
        yMm: 20,
        opacity: 0.35,
        rotation: 90,
        print: true,
      },
    };
    const font = await loadWorksheetFont(snapshot);
    const bytes = await createWorksheetPdf(snapshot, { font });
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(3);
    const imageCount = document.context
      .enumerateIndirectObjects()
      .filter(([, object]) => {
        if (!(object instanceof PDFRawStream)) return false;
        return (
          object.dict
            .lookupMaybe(PDFName.of("Subtype"), PDFName)
            ?.asString() === "/Image"
        );
      }).length;
    expect(imageCount).toBe(1);
  });

  test("draws the font's shaped outlines, including ligatures and combining marks", async () => {
    const fontBytes = new Uint8Array(
      await Bun.file("public/fonts/GreatVibes-Regular.ttf").arrayBuffer(),
    );
    const snapshot: WorksheetSnapshot = {
      ...worksheet({
        fontId: "custom",
        pageCount: 1,
        letterSpacingMm: 0.4,
        wordSpacingMm: 0.8,
        writingScale: 1.5,
      }),
      text: "office e\u0301lan",
      customFont: {
        name: "Shaping test",
        dataUrl: `data:font/ttf;base64,${Buffer.from(fontBytes).toString("base64")}`,
      },
    };
    const font = await loadWorksheetFont(snapshot);
    const unspacedWidth = font.measure(snapshot.text, {
      ...snapshot.settings,
      letterSpacingMm: 0,
      wordSpacingMm: 0,
    });
    expect(
      font.measure(snapshot.text, snapshot.settings) - unspacedWidth,
    ).toBeCloseTo(4.8, 8);
    const bytes = await createWorksheetPdf(snapshot, { font });
    const content = decodedPageContent(await PDFDocument.load(bytes));
    expect(content).not.toContain(" Tj");
    expect(content.match(/ m/g)?.length ?? 0).toBeGreaterThan(0);
    expect(content).toContain("1.5 0 0 -1 0 0 cm");
    expect(Array.from(snapshot.text)).toHaveLength(12);
    expect(content).not.toContain(" Tc");
    expect(content).not.toContain(" Tw");
  });

  test("rejects custom-font missing glyphs before drawing the PDF", async () => {
    const fontBytes = new Uint8Array(
      await Bun.file("public/fonts/GreatVibes-Regular.ttf").arrayBuffer(),
    );
    const base: WorksheetSnapshot = {
      ...worksheet({ fontId: "custom", pageCount: 1 }),
      text: "Supported",
      customFont: {
        name: "Limited repertoire test",
        dataUrl: `data:font/ttf;base64,${Buffer.from(fontBytes).toString("base64")}`,
      },
    };
    const font = await loadWorksheetFont(base);
    for (const unsupported of ["漢", "🙂"]) {
      const snapshot = { ...base, text: `A${unsupported}` };
      expect(() => font.measure(snapshot.text, snapshot.settings)).toThrow(
        `“${unsupported}”`,
      );
      await expect(createWorksheetPdf(snapshot, { font })).rejects.toThrow(
        `“${unsupported}”`,
      );
    }
  });

  test("round trips the explicit editable template while omitting raw assets", async () => {
    const snapshot: WorksheetSnapshot = {
      ...worksheet({ fontId: "custom", notes: "Brause nib on cotton paper" }),
      text: "A private practice line",
      photo: {
        dataUrl: "data:image/png;base64,iVBORw0KGgo=",
        pixelWidth: 100,
        pixelHeight: 50,
        widthMm: 80,
        xMm: 10,
        yMm: 10,
        opacity: 0.5,
        rotation: 0,
        print: false,
      },
      customFont: {
        name: "Private hand",
        dataUrl: "data:font/ttf;base64,AAECAw==",
      },
    };
    const font = await loadWorksheetFont(worksheet()).then((loaded) => loaded);
    const bytes = await createWorksheetPdf(snapshot, {
      includeTemplate: true,
      font,
    });
    const imported = await importWorksheetPdf(bytes);
    expect(imported.text).toBe(snapshot.text);
    expect(imported.settings.notes).toBe("Brause nib on cotton paper");
    expect(imported.settings.fontId).toBe("custom");
    expect(imported.photo).toBeUndefined();
    expect(imported.customFont).toBeUndefined();
  });

  test("rejects text that can visibly run off the physical page", async () => {
    const snapshot = worksheet({
      fontSizePt: 300,
      marginTopMm: 1,
      marginBottomMm: 1,
    });
    const font = await loadWorksheetFont(snapshot);
    await expect(createWorksheetPdf(snapshot, { font })).rejects.toThrow(
      /extends off.*page/,
    );
  });

  test("checks vertical fit only for rows that actually contain text", async () => {
    const snapshot = {
      ...worksheet({
        lineCount: 2,
        pageCount: 1,
        marginTopMm: 100,
        marginBottomMm: 0,
        fontSizePt: 20,
      }),
      text: "Only the first row is used",
    };
    const font = await loadWorksheetFont(snapshot);
    const model = worksheetTextPages(snapshot, font);
    expect(model.pages).toEqual([["Only the first row is used"]]);
    expect(() => validateWorksheetTextFit(snapshot, model)).not.toThrow();
    expect(await createWorksheetPdf(snapshot, { font })).toBeInstanceOf(
      Uint8Array,
    );
  });

  test("rejects negative spacing even when raw settings bypass the UI", async () => {
    const snapshot = worksheet({ letterSpacingMm: -0.5 });
    await expect(createWorksheetPdf(snapshot)).rejects.toThrow(
      /between 0|negative/,
    );
  });

  test("bounds attachment decompression before validating its declared size", async () => {
    const document = await PDFDocument.create();
    document.setTitle("Calligraphy practice worksheet");
    document.setCreator("muchadoaboutoneside.com/calligraphy/practice");
    document.addPage();
    await document.attach(
      new Uint8Array(512 * 1024 + 2).fill(65),
      "muchado-worksheet-template.json",
      { mimeType: "application/json" },
    );
    const loaded = await PDFDocument.load(await document.save());
    const names = loaded.catalog.lookup(PDFName.of("Names"), PDFDict);
    const embeddedFiles = names.lookup(PDFName.of("EmbeddedFiles"), PDFDict);
    const attachmentNames = embeddedFiles.lookup(PDFName.of("Names"), PDFArray);
    const fileSpec = attachmentNames.lookup(1, PDFDict);
    const embedded = fileSpec
      .lookup(PDFName.of("EF"), PDFDict)
      .lookup(PDFName.of("F"), PDFStream);
    if (!(embedded instanceof PDFRawStream)) {
      throw new Error("Expected a raw embedded-file stream in the test PDF.");
    }
    embedded.dict
      .lookup(PDFName.of("Params"), PDFDict)
      .set(PDFName.of("Size"), PDFNumber.of(1));

    await expect(importWorksheetPdf(await loaded.save())).rejects.toThrow(
      "invalid size",
    );
  });

  test("builds a bounded six-page comparison without mutating the draft", async () => {
    const snapshot = {
      ...worksheet({ lineCount: 24, pageCount: 2 }),
      text: "",
    };
    const before = structuredClone(snapshot);
    const font = await loadWorksheetFont(snapshot);
    const entries = Array.from({ length: 6 }, (_, index) => ({
      label: `Font ${index + 1}`,
      font,
    }));
    const bytes = await createWorksheetComparisonPdf(snapshot, entries);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(6);
    expect(snapshot).toEqual(before);
    await expect(
      createWorksheetComparisonPdf(snapshot, entries.slice(0, 5)),
    ).rejects.toThrow("exactly 6 fonts");
  });

  test("fits the untouched default comparison below its reserved header with all six real fonts and both engines", async () => {
    const snapshot: WorksheetSnapshot = {
      version: 1,
      settings: DEFAULT_WORKSHEET_SETTINGS,
      text: "",
    };
    for (const engine of ["fontkit", "harfbuzz"] as const) {
      const entries = await realComparisonFonts(engine);
      const document = await PDFDocument.load(
        await createWorksheetComparisonPdf(snapshot, entries),
      );
      expect(document.getPageCount()).toBe(6);
    }
  }, 20_000);

  test("drops unsupported alternate tags independently for each comparison font", async () => {
    const entries = await realComparisonFonts("fontkit");
    const snapshot: WorksheetSnapshot = {
      version: 1,
      settings: {
        ...DEFAULT_WORKSHEET_SETTINGS,
        fontFeatures: "ss10,swsh",
      },
      text: "",
    };
    expect(
      (
        await PDFDocument.load(
          await createWorksheetComparisonPdf(snapshot, entries),
        )
      ).getPageCount(),
    ).toBe(6);
  }, 20_000);
});
