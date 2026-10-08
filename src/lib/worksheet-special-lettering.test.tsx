import { expect, test } from "bun:test";
import {
  decodePDFRawStream,
  PDFArray,
  PDFDocument,
  PDFRawStream,
} from "pdf-lib";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_WORKSHEET_SETTINGS } from "../../shared/worksheet";
import { WorksheetFontTools } from "../components/calligraphy/worksheet-font-tools";
import { WorksheetLetteringSize } from "../components/calligraphy/worksheet-lettering-size";
import { WorksheetPreview } from "../components/calligraphy/worksheet-preview";
import {
  createWorksheetPdf,
  importWorksheetPdf,
  worksheetTextPages,
} from "./worksheet-export";
import { loadWorksheetFont } from "./worksheet-fonts";
import { withSpecialWordFont } from "./worksheet-special-lettering";
import {
  parseWorksheetSnapshot,
  serializeWorksheetSnapshot,
  type WorksheetSnapshot,
} from "./worksheet-store";

test("a name uses its own shaped font and size in the preview and editable PDF", async () => {
  const snapshot: WorksheetSnapshot = {
    version: 1,
    text: "Dear Ann Marie, welcome.",
    settings: {
      ...DEFAULT_WORKSHEET_SETTINGS,
      fontId: "serif",
      specialWords: "Ann Marie",
      specialSizePercent: 140,
      textEnabled: true,
      lineCount: 4,
      fontSizePt: 18,
    },
  };
  const base = await loadWorksheetFont({
    ...snapshot,
    settings: { ...snapshot.settings, specialWords: "" },
  });
  const bytes = await Bun.file("public/fonts/PinyonScript-Regular.ttf").bytes();
  const accent = await loadWorksheetFont({
    ...snapshot,
    settings: { ...snapshot.settings, specialWords: "", fontId: "custom" },
    customFont: {
      name: "Pinyon",
      dataUrl: `data:font/ttf;base64,${Buffer.from(bytes).toString("base64")}`,
    },
  });
  const font = withSpecialWordFont(base, accent, ["Ann Marie"]);
  const run = font.shape(snapshot.text, snapshot.settings);
  expect(run.parts?.map((part) => part.run.text)).toEqual([
    "Dear ",
    "Ann Marie",
    ", welcome.",
  ]);
  expect(run.parts?.map((part) => part.run.sizePt)).toEqual([18, 25.2, 18]);
  expect(font.measure(snapshot.text, snapshot.settings)).toBeCloseTo(
    run.widthMm,
    8,
  );
  const spaced = font.shape(snapshot.text, {
    ...snapshot.settings,
    letterSpacingMm: 1,
  });
  expect(spaced.widthMm - run.widthMm).toBeCloseTo(
    Array.from(snapshot.text).length - 1,
    8,
  );
  const model = worksheetTextPages(snapshot, font);
  const markup = renderToStaticMarkup(
    <WorksheetPreview
      snapshot={snapshot}
      layout={model.layout}
      lines={model.pages[0] ?? []}
      font={font}
      printed
    />,
  );
  expect(markup).toContain("Dear ");
  expect(markup).toContain(", welcome.");
  expect(markup).toContain("<path");
  expect(markup).not.toContain(">Ann Marie</text>");
  const pdf = await createWorksheetPdf(snapshot, {
    font,
    includeTemplate: true,
  });
  const document = await PDFDocument.load(pdf);
  expect(document.getPageCount()).toBe(1);
  const contents = document.getPage(0).node.Contents();
  if (!(contents instanceof PDFArray))
    throw new Error("Missing PDF content stream");
  const drawing = Array.from({ length: contents.size() }, (_, index) =>
    new TextDecoder().decode(
      decodePDFRawStream(contents.lookup(index, PDFRawStream)).decode(),
    ),
  ).join("\n");
  expect(drawing).toMatch(/\s[cv]\n/u);
  expect(drawing.match(/\nBT\n/gu)).toHaveLength(2);
  expect((await importWorksheetPdf(pdf)).settings.specialWords).toBe(
    "Ann Marie",
  );
  expect(parseWorksheetSnapshot(serializeWorksheetSnapshot(snapshot))).toEqual(
    snapshot,
  );
});

test("the normal loader composes pinned fonts with both engines and rejects unsupported special glyphs", async () => {
  const originalFetch = globalThis.fetch;
  const bytes = await Bun.file("public/fonts/PinyonScript-Regular.ttf").bytes();
  const baseBytes = await Bun.file(
    "public/fonts/GreatVibes-Regular.ttf",
  ).bytes();
  globalThis.fetch = (async (input) => {
    const url = String(input);
    if (url.includes("/fonts/PinyonScript-Regular.ttf?"))
      return new Response(bytes);
    if (url.includes("/fonts/GreatVibes-Regular.ttf?"))
      return new Response(baseBytes);
    throw new Error(`Unexpected font request: ${url}`);
  }) as typeof fetch;
  try {
    for (const shapingEngine of ["fontkit", "harfbuzz"] as const) {
      const source: WorksheetSnapshot = {
        version: 1,
        text: "Hello Ann Marie",
        settings: {
          ...DEFAULT_WORKSHEET_SETTINGS,
          shapingEngine,
          specialWords: "Ann Marie",
          fontSizeMode: "xheight",
          textXHeightMm: 3,
          specialSizePercent: 150,
        },
      };
      const font = await loadWorksheetFont(source);
      const run = font.shape(source.text, source.settings);
      expect(run.parts?.[1]?.run.engine).toBe(shapingEngine);
      const accent = await loadWorksheetFont({
        ...source,
        settings: {
          ...source.settings,
          fontId: "pinyon-script",
          specialWords: "",
        },
      });
      expect(run.parts?.[1]?.run.sizePt).toBeCloseTo(
        accent.resolveSizePt({ ...source.settings, textXHeightMm: 4.5 }),
        8,
      );
      const bad = withSpecialWordFont(font.baseFont ?? font, accent, ["🦄"]);
      expect(() => bad.shape("Hello 🦄", source.settings)).toThrow(
        "cannot print",
      );
      const controlsFont = withSpecialWordFont(font.baseFont ?? font, accent, [
        "Ag",
        "A",
      ]);
      const controls = renderToStaticMarkup(
        <>
          <WorksheetLetteringSize
            settings={source.settings}
            font={controlsFont}
            onChange={() => true}
          />
          <WorksheetFontTools
            settings={source.settings}
            font={controlsFont}
            section="features"
            onChange={() => {}}
            onImportFont={() => {}}
            onInsertGlyph={() => {}}
          />
        </>,
      );
      expect(controls).toMatch(/aria-label="Ag flourish[^>]*><path/u);
      expect(controls).toContain('class="ws-feature-sample"');
    }
    const source: WorksheetSnapshot = {
      version: 1,
      text: "Hello Ānn",
      settings: {
        ...DEFAULT_WORKSHEET_SETTINGS,
        fontId: "serif",
        specialWords: "Ānn",
      },
    };
    const font = await loadWorksheetFont(source);
    expect(worksheetTextPages(source, font).lines).toEqual(["Hello Ānn"]);
    const spacedName = {
      ...source,
      text: "Dear Ānn    Marie",
      settings: { ...source.settings, specialWords: "Ānn Marie" },
    };
    const spacedFont = await loadWorksheetFont(spacedName);
    expect(worksheetTextPages(spacedName, spacedFont).lines).toEqual([
      "Dear Ānn Marie",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
