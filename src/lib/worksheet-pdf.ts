import {
  getWorksheetLayout,
  normalizeWorksheetSettings,
  type WorksheetSettings,
  wrapText,
} from "../../shared/worksheet";
import {
  loadWorksheetFont,
  type WorksheetFont,
  worksheetFontBacking,
} from "./worksheet-fonts";
import { worksheetRunParts } from "./worksheet-shaping";
import {
  parseWorksheetSnapshot,
  type WorksheetPhoto,
  type WorksheetSnapshot,
} from "./worksheet-store";
import {
  validateWorksheetTextFit,
  type WorksheetTextPages,
  worksheetPlacedBounds,
  worksheetTextPages,
} from "./worksheet-text";

const POINTS_PER_MM = 72 / 25.4;
const TEMPLATE_FILENAME = "muchado-worksheet-template.json";
const MAX_IMPORT_PDF_BYTES = 15 * 1024 * 1024;
const MAX_TEMPLATE_SUBJECT_LENGTH = 512 * 1024;
const COMPARISON_FONT_COUNT = 6;
const MAX_COMPARISON_TEXT_LENGTH = 2_000;
const COMPARISON_HEADER_HEIGHT_MM = 14 / POINTS_PER_MM;
const COMPARISON_INK_PADDING_MM = 1.5;
const COMPARISON_ROW_GAP_MM = 2;

function colorComponents(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16) / 255,
    Number.parseInt(hex.slice(3, 5), 16) / 255,
    Number.parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

function templateSnapshot(snapshot: WorksheetSnapshot): WorksheetSnapshot {
  // Editable PDFs deliberately omit raw photo/font assets. The complete local
  // JSON backup is the lossless format for those private, potentially large files.
  return {
    version: 1,
    settings: normalizeWorksheetSettings(snapshot.settings),
    text: snapshot.text,
  };
}

async function embedSelectedFont(
  document: import("pdf-lib").PDFDocument,
  font: WorksheetFont,
) {
  const backing = worksheetFontBacking(font);
  if (backing.kind === "standard" && backing.standardName) {
    return document.embedFont(backing.standardName);
  }
  return undefined;
}

function imageBytes(dataUrl: string): Uint8Array<ArrayBuffer> {
  const comma = dataUrl.indexOf(",");
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function drawPhoto(
  page: import("pdf-lib").PDFPage,
  image: import("pdf-lib").PDFImage,
  photo: WorksheetPhoto,
  pageHeightMm: number,
) {
  if (!photo.print) return;
  const { popGraphicsState, pushGraphicsState, rotateRadians, translate } =
    await import("pdf-lib");
  const width = photo.widthMm;
  const height = width * (photo.pixelHeight / photo.pixelWidth);
  const x = photo.xMm;
  const y = pageHeightMm - photo.yMm - height;
  const centerX = (photo.xMm + width / 2) * POINTS_PER_MM;
  const centerY = (pageHeightMm - photo.yMm - height / 2) * POINTS_PER_MM;
  page.pushOperators(
    pushGraphicsState(),
    translate(centerX, centerY),
    rotateRadians((-photo.rotation * Math.PI) / 180),
    translate(-centerX, -centerY),
  );
  page.drawImage(image, {
    x: x * POINTS_PER_MM,
    y: y * POINTS_PER_MM,
    width: width * POINTS_PER_MM,
    height: height * POINTS_PER_MM,
    opacity: photo.opacity,
  });
  page.pushOperators(popGraphicsState());
}

/** Creates a print-ready vector PDF. Pass includeTemplate for an editable reimport attachment. */
export async function createWorksheetPdf(
  snapshot: WorksheetSnapshot,
  options: { includeTemplate?: boolean; font?: WorksheetFont } = {},
): Promise<Uint8Array<ArrayBuffer>> {
  const valid = parseWorksheetSnapshot(snapshot);
  const font = valid.settings.textEnabled
    ? (options.font ?? (await loadWorksheetFont(valid)))
    : undefined;
  const model: WorksheetTextPages = font
    ? worksheetTextPages(valid, font)
    : (() => {
        const layout = getWorksheetLayout(valid.settings);
        return {
          layout,
          lines: [],
          pages: Array.from({ length: valid.settings.pageCount }, () => []),
          placedPages: Array.from(
            { length: valid.settings.pageCount },
            () => [],
          ),
          estimate: {
            lines: [],
            lineCount: 0,
            pagesNeeded: 0,
            rowsPerPage: layout.baselineYsMm.length,
            overflow: false,
          },
          warnings: [],
        };
      })();
  validateWorksheetTextFit(valid, model);

  const {
    beginText,
    endText,
    PDFDocument,
    PDFHexString,
    LineCapStyle,
    moveText,
    popGraphicsState,
    pushGraphicsState,
    rgb,
    scale,
    setFillingColor,
    setFontAndSize,
    setGraphicsState,
    setTextMatrix,
    showText,
    translate,
  } = await import("pdf-lib");
  const document = await PDFDocument.create();
  document.setTitle("Calligraphy practice worksheet");
  document.setCreator("muchadoaboutoneside.com/calligraphy/practice");
  document.setProducer("Much Ado About One Side worksheet maker");
  const pdfFont = font ? await embedSelectedFont(document, font) : undefined;
  const photoImage =
    valid.photo?.print === true
      ? valid.photo.dataUrl.startsWith("data:image/png")
        ? await document.embedPng(imageBytes(valid.photo.dataUrl))
        : await document.embedJpg(imageBytes(valid.photo.dataUrl))
      : undefined;
  const settings = valid.settings;
  const textRgb = rgb(...colorComponents(settings.textColor));

  if (options.includeTemplate) {
    const serialized = JSON.stringify(templateSnapshot(valid));
    await document.attach(
      new TextEncoder().encode(serialized),
      TEMPLATE_FILENAME,
      {
        mimeType: "application/json",
        description:
          "Editable worksheet settings and text. Photo and custom font files are omitted.",
        creationDate: new Date(0),
        modificationDate: new Date(0),
      },
    );
  }

  for (let pageIndex = 0; pageIndex < settings.pageCount; pageIndex += 1) {
    const page = document.addPage([
      model.layout.widthMm * POINTS_PER_MM,
      model.layout.heightMm * POINTS_PER_MM,
    ]);
    if (valid.photo && photoImage) {
      await drawPhoto(page, photoImage, valid.photo, model.layout.heightMm);
    }
    for (const line of model.layout.lines) {
      const lineRgb = rgb(...colorComponents(line.color));
      const dashArray =
        line.dash === "dashed"
          ? [3 * line.widthPt, 3 * line.widthPt]
          : line.dash === "dotted"
            ? [0, 2.5 * line.widthPt]
            : undefined;
      page.drawLine({
        start: {
          x: line.x1 * POINTS_PER_MM,
          y: (model.layout.heightMm - line.y1) * POINTS_PER_MM,
        },
        end: {
          x: line.x2 * POINTS_PER_MM,
          y: (model.layout.heightMm - line.y2) * POINTS_PER_MM,
        },
        thickness: line.widthPt,
        color: lineRgb,
        dashArray,
        lineCap:
          line.dash === "dotted" ? LineCapStyle.Round : LineCapStyle.Butt,
      });
    }

    if (settings.calibrationMark) {
      const calibrationY = 4;
      const calibrationX = model.layout.contentX1Mm;
      page.drawLine({
        start: {
          x: calibrationX * POINTS_PER_MM,
          y: calibrationY * POINTS_PER_MM,
        },
        end: {
          x: (calibrationX + 25) * POINTS_PER_MM,
          y: calibrationY * POINTS_PER_MM,
        },
        thickness: 0.6,
        color: rgb(0, 0, 0),
      });
      for (const offset of [0, 25]) {
        page.drawLine({
          start: {
            x: (calibrationX + offset) * POINTS_PER_MM,
            y: (calibrationY - 1) * POINTS_PER_MM,
          },
          end: {
            x: (calibrationX + offset) * POINTS_PER_MM,
            y: (calibrationY + 1) * POINTS_PER_MM,
          },
          thickness: 0.6,
          color: rgb(0, 0, 0),
        });
      }
      const calibrationFont = await document.embedFont("Helvetica");
      page.drawText("25 mm", {
        x: (calibrationX + 27) * POINTS_PER_MM,
        y: (calibrationY - 1) * POINTS_PER_MM,
        size: 7,
        font: calibrationFont,
        color: rgb(0.267, 0.267, 0.267),
      });
    }

    if (settings.textEnabled && font) {
      const fontKey = pdfFont
        ? page.node.newFontDictionary(pdfFont.name, pdfFont.ref)
        : undefined;
      const pageRows = (model.placedPages[pageIndex] ?? []).flatMap((row) =>
        row.run
          ? worksheetRunParts(row.run, font.family).map((part) => ({
              ...row,
              text: part.run.text,
              run: part.run,
              xMm: row.xMm + part.xMm,
            }))
          : [],
      );
      for (const row of pageRows) {
        const { run, text } = row;
        if (text === "") continue;
        const sizePt = run.sizePt;
        const anchorXPt = row.xMm * POINTS_PER_MM;
        const baselinePt =
          (model.layout.heightMm - row.baselineMm) * POINTS_PER_MM;
        try {
          if (
            run.glyphs.length > 0 &&
            run.glyphs.every((glyph) => glyph.path !== undefined)
          ) {
            for (const glyph of run.glyphs) {
              if (!glyph.path) continue;
              page.pushOperators(
                pushGraphicsState(),
                scale(run.writingScale, -1),
              );
              page.drawSvgPath(glyph.path, {
                x: ((row.xMm + glyph.xMm) * POINTS_PER_MM) / run.writingScale,
                y: -(
                  (model.layout.heightMm - row.baselineMm + glyph.yMm) *
                  POINTS_PER_MM
                ),
                scale: run.pathScaleMm * POINTS_PER_MM,
                color: textRgb,
                opacity: row.opacity,
              });
              page.pushOperators(popGraphicsState());
            }
            continue;
          }
          if (!pdfFont || !fontKey) {
            throw new Error(
              "The selected font did not provide printable vector outlines.",
            );
          }
          const opacityKey = page.node.newExtGState(
            "GS",
            document.context.obj({
              Type: "ExtGState",
              ca: row.opacity,
            }),
          );
          const backing = worksheetFontBacking(font);
          const encodedHex = pdfFont.encodeText(text).asString();
          const fontkitFont = backing.fontkitFont;
          const layoutRun = fontkitFont?.layout(text);
          const unitsPerEm = fontkitFont?.unitsPerEm ?? 1_000;
          const characters = Array.from(text);
          const glyphs = layoutRun
            ? layoutRun.glyphs.map((glyph, index) => {
                const position = layoutRun.positions[index];
                if (!position) {
                  throw new Error(
                    "The selected font returned incomplete glyph positions.",
                  );
                }
                return {
                  codePoints: glyph.codePoints,
                  xAdvance: (position.xAdvance / unitsPerEm) * sizePt,
                  xOffset: (position.xOffset / unitsPerEm) * sizePt,
                  yOffset: (position.yOffset / unitsPerEm) * sizePt,
                  hexWidth: 4,
                };
              })
            : characters.map((character, index) => {
                const next = characters[index + 1];
                const ownWidth = pdfFont.widthOfTextAtSize(character, sizePt);
                const xAdvance = next
                  ? pdfFont.widthOfTextAtSize(character + next, sizePt) -
                    pdfFont.widthOfTextAtSize(next, sizePt)
                  : ownWidth;
                return {
                  codePoints: Array.from(
                    character,
                    (part) => part.codePointAt(0) ?? 0,
                  ),
                  xAdvance,
                  xOffset: 0,
                  yOffset: 0,
                  hexWidth: 2,
                };
              });
          const expectedHexLength = glyphs.reduce(
            (total, glyph) => total + glyph.hexWidth,
            0,
          );
          if (encodedHex.length !== expectedHexLength) {
            throw new Error(
              "The selected font returned inconsistent shaped glyphs.",
            );
          }
          let graphemeEnd = 0;
          const graphemes = Array.from(
            new Intl.Segmenter(undefined, {
              granularity: "grapheme",
            }).segment(text),
            (part) => {
              graphemeEnd += Array.from(part.segment).length;
              return { text: part.segment, end: graphemeEnd };
            },
          );
          let hexOffset = 0;
          let consumedCodePoints = 0;
          let graphemeIndex = 0;
          let penX = 0;
          const glyphOperators = glyphs.flatMap((glyph) => {
            const hex = encodedHex.slice(hexOffset, hexOffset + glyph.hexWidth);
            hexOffset += glyph.hexWidth;
            consumedCodePoints += glyph.codePoints.length || 1;
            const operators = [
              setTextMatrix(1, 0, 0, 1, penX + glyph.xOffset, glyph.yOffset),
              showText(PDFHexString.of(hex)),
            ];
            penX += glyph.xAdvance;
            while (
              graphemeIndex < graphemes.length &&
              (graphemes[graphemeIndex]?.end ?? Number.POSITIVE_INFINITY) <=
                consumedCodePoints
            ) {
              const grapheme = graphemes[graphemeIndex];
              if (grapheme && graphemeIndex < graphemes.length - 1) {
                penX +=
                  (settings.letterSpacingMm * POINTS_PER_MM) /
                  settings.writingScale;
              }
              if (grapheme && /\s/u.test(grapheme.text)) {
                penX +=
                  (settings.wordSpacingMm * POINTS_PER_MM) /
                  settings.writingScale;
              }
              graphemeIndex += 1;
            }
            return operators;
          });
          page.pushOperators(
            pushGraphicsState(),
            setGraphicsState(opacityKey),
            translate(anchorXPt, baselinePt),
            scale(settings.writingScale, 1),
            beginText(),
            setFillingColor(textRgb),
            setFontAndSize(fontKey, sizePt),
            moveText(0, 0),
            ...glyphOperators,
            endText(),
            popGraphicsState(),
          );
        } catch (cause) {
          throw new Error(
            `The selected font cannot print part of the example text. Choose another font or remove the unsupported character. ${
              cause instanceof Error ? cause.message : ""
            }`.trim(),
          );
        }
      }
    }
  }

  const saved = await document.save();
  return new Uint8Array(saved);
}

export interface WorksheetComparisonFont {
  label: string;
  font: WorksheetFont;
}

const COMPARISON_SAMPLE =
  "minimum alphabet flourishing hand\nThe quick brown fox jumps over the lazy dog.";

function comparisonFontFeatures(
  settings: WorksheetSettings,
  font: WorksheetFont,
) {
  const supported = new Set(font.supportedFeatures);
  return settings.fontFeatures
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => supported.has(part.split("=")[0] ?? ""))
    .join(",");
}

function settingsForComparisonFont(
  common: WorksheetSettings,
  font: WorksheetFont,
): WorksheetSettings {
  return {
    ...common,
    fontFeatures: comparisonFontFeatures(common, font),
    shapingEngine: font.engine,
  };
}

function comparisonRuns(
  text: string,
  settings: WorksheetSettings,
  entries: readonly WorksheetComparisonFont[],
) {
  const layout = getWorksheetLayout(settings);
  const availableWidth = layout.contentX2Mm - layout.contentX1Mm;
  return entries.flatMap(({ font }) => {
    const fontSettings = settingsForComparisonFont(settings, font);
    const lines = wrapText(text, availableWidth, (line) =>
      font.measure(line, fontSettings),
    );
    return lines.flatMap((line) => {
      const run = font.shape(line, fontSettings);
      return run.inkBoundsMm ? [{ run, bounds: run.inkBoundsMm }] : [];
    });
  });
}

function comparisonLayout(
  base: WorksheetSnapshot,
  text: string,
  entries: readonly WorksheetComparisonFont[],
): WorksheetSettings {
  let common = normalizeWorksheetSettings({
    ...base.settings,
    mode: "plain",
    spacingMode: "fixed",
    spacingMm: Math.max(0.5, base.settings.spacingMm),
    textEnabled: true,
    fontSizeMode: "xheight",
    practicePattern: "continuous",
    textRepeat: false,
    pageCount: 1,
  });

  // Ink overhang can change wrapping, which can in turn change the extrema.
  // Two bounded passes converge the content width without an open-ended loop.
  for (let pass = 0; pass < 2; pass += 1) {
    const runs = comparisonRuns(text, common, entries);
    const leftOverhang = Math.max(
      0,
      ...runs.map(({ bounds }) => Math.max(0, -bounds.xMin)),
    );
    const rightOverhang = Math.max(
      0,
      ...runs.map(({ run, bounds }) => Math.max(0, bounds.xMax - run.widthMm)),
    );
    common = normalizeWorksheetSettings({
      ...common,
      marginLeftMm: Math.max(
        base.settings.marginLeftMm,
        leftOverhang + COMPARISON_INK_PADDING_MM,
      ),
      marginRightMm: Math.max(
        base.settings.marginRightMm,
        rightOverhang + COMPARISON_INK_PADDING_MM,
      ),
    });
  }

  const runs = comparisonRuns(text, common, entries);
  const ascentMm = Math.max(0, ...runs.map(({ bounds }) => bounds.yMax));
  const descentMm = Math.max(0, ...runs.map(({ bounds }) => -bounds.yMin));
  const rowPitchMm = ascentMm + descentMm + COMPARISON_ROW_GAP_MM;
  if (rowPitchMm > 100) {
    throw new RangeError(
      "The requested physical lowercase height makes the comparison rows too tall. Reduce the lowercase height before exporting.",
    );
  }
  return normalizeWorksheetSettings({
    ...common,
    marginTopMm: Math.max(
      base.settings.marginTopMm,
      COMPARISON_HEADER_HEIGHT_MM + COMPARISON_INK_PADDING_MM + ascentMm,
    ),
    marginBottomMm: Math.max(
      base.settings.marginBottomMm,
      COMPARISON_INK_PADDING_MM + descentMm,
    ),
    spacingMm: Math.max(0.5, rowPitchMm),
  });
}

/** Builds one independently shaped page per font at the same physical x-height. */
export async function createWorksheetComparisonPdf(
  snapshot: WorksheetSnapshot,
  entries: readonly WorksheetComparisonFont[],
): Promise<Uint8Array<ArrayBuffer>> {
  if (entries.length !== COMPARISON_FONT_COUNT) {
    throw new RangeError(
      `The comparison sheet requires exactly ${COMPARISON_FONT_COUNT} fonts.`,
    );
  }
  const base = parseWorksheetSnapshot(snapshot);
  const comparisonText = base.text.trim() ? base.text : COMPARISON_SAMPLE;
  if (comparisonText.length > MAX_COMPARISON_TEXT_LENGTH) {
    throw new RangeError(
      `Comparison text must be ${MAX_COMPARISON_TEXT_LENGTH.toLocaleString()} characters or fewer. Shorten the passage before exporting the six-font comparison.`,
    );
  }
  const commonSettings = comparisonLayout(base, comparisonText, entries);
  const { PDFDocument, rgb } = await import("pdf-lib");
  const comparison = await PDFDocument.create();
  comparison.setTitle("Calligraphy font comparison");
  comparison.setCreator("muchadoaboutoneside.com/calligraphy/practice");
  comparison.setProducer("Much Ado About One Side worksheet maker");
  const labelFont = await comparison.embedFont("Helvetica");

  for (const entry of entries) {
    if (!entry.label.trim()) {
      throw new TypeError("Every comparison font needs a label.");
    }
    const candidate: WorksheetSnapshot = {
      ...base,
      settings: settingsForComparisonFont(commonSettings, entry.font),
      text: comparisonText,
    };
    const measured = worksheetTextPages(candidate, entry.font);
    if (measured.estimate.overflow) {
      throw new RangeError(
        `The comparison passage needs ${measured.estimate.pagesNeeded} pages in ${entry.label}. Shorten the passage or reduce its physical x-height so every font fits on one clearly labeled page.`,
      );
    }
    const headerOverlap = measured.placedPages.some((pageRows) =>
      pageRows.some((row) => {
        const bounds = worksheetPlacedBounds(row);
        return (
          bounds !== undefined &&
          bounds.yMin <
            COMPARISON_HEADER_HEIGHT_MM + COMPARISON_INK_PADDING_MM - 1e-8
        );
      }),
    );
    if (headerOverlap) {
      throw new RangeError(
        `The requested physical lowercase height leaves no safe header space in ${entry.label}. Reduce the lowercase height before exporting.`,
      );
    }
    const source = await PDFDocument.load(
      await createWorksheetPdf(candidate, { font: entry.font }),
    );
    const [page] = await comparison.copyPages(source, [0]);
    if (!page) throw new Error("A comparison page could not be created.");
    comparison.addPage(page);
    const size = page.getSize();
    page.drawRectangle({
      x: 0,
      y: size.height - 14,
      width: size.width,
      height: 14,
      color: rgb(1, 1, 1),
      opacity: 0.88,
    });
    page.drawText(entry.label.trim().slice(0, 120), {
      x: base.settings.marginLeftMm * POINTS_PER_MM,
      y: size.height - 10,
      size: 7,
      font: labelFont,
      color: rgb(0.267, 0.267, 0.267),
    });
  }

  return new Uint8Array(await comparison.save());
}

/** Reopens PDFs created with the explicit “include editable template” option. */
export async function importWorksheetPdf(
  bytes: Uint8Array | ArrayBuffer,
): Promise<WorksheetSnapshot> {
  if (bytes.byteLength > MAX_IMPORT_PDF_BYTES) {
    throw new RangeError("The PDF is larger than the 15 MB import limit.");
  }
  const pdfLib = await import("pdf-lib");
  const { PDFDocument } = pdfLib;
  let document: import("pdf-lib").PDFDocument;
  try {
    document = await PDFDocument.load(bytes);
  } catch {
    throw new Error("This file is not a readable PDF.");
  }
  let serialized: string | undefined;
  const recognizedWorksheet =
    document.getCreator() === "muchadoaboutoneside.com/calligraphy/practice" &&
    document.getTitle() === "Calligraphy practice worksheet";
  if (recognizedWorksheet) {
    const names = document.catalog.lookupMaybe(
      pdfLib.PDFName.of("Names"),
      pdfLib.PDFDict,
    );
    const embeddedFiles = names?.lookupMaybe(
      pdfLib.PDFName.of("EmbeddedFiles"),
      pdfLib.PDFDict,
    );
    const attachmentNames = embeddedFiles?.lookupMaybe(
      pdfLib.PDFName.of("Names"),
      pdfLib.PDFArray,
    );
    if (attachmentNames) {
      for (let index = 0; index + 1 < attachmentNames.size(); index += 2) {
        const name = attachmentNames.lookupMaybe(
          index,
          pdfLib.PDFString,
          pdfLib.PDFHexString,
        );
        if (name?.decodeText() !== TEMPLATE_FILENAME) continue;
        const fileSpec = attachmentNames.lookupMaybe(index + 1, pdfLib.PDFDict);
        const embedded = fileSpec
          ?.lookupMaybe(pdfLib.PDFName.of("EF"), pdfLib.PDFDict)
          ?.lookupMaybe(pdfLib.PDFName.of("F"), pdfLib.PDFStream);
        if (embedded && !(embedded instanceof pdfLib.PDFRawStream)) {
          throw new Error(
            "The embedded worksheet template has an unsupported stream format.",
          );
        }
        const declaredSize = embedded?.dict
          .lookupMaybe(pdfLib.PDFName.of("Params"), pdfLib.PDFDict)
          ?.lookupMaybe(pdfLib.PDFName.of("Size"), pdfLib.PDFNumber)
          ?.asNumber();
        if (
          !embedded ||
          declaredSize === undefined ||
          declaredSize < 0 ||
          declaredSize > MAX_TEMPLATE_SUBJECT_LENGTH
        ) {
          throw new RangeError(
            "The embedded worksheet template is too large or invalid.",
          );
        }
        const decoded = pdfLib
          .decodePDFRawStream(embedded)
          .getBytes(MAX_TEMPLATE_SUBJECT_LENGTH + 1);
        if (
          decoded.byteLength !== declaredSize ||
          decoded.byteLength > MAX_TEMPLATE_SUBJECT_LENGTH
        ) {
          throw new RangeError(
            "The embedded worksheet template has an invalid size.",
          );
        }
        serialized = new TextDecoder("utf-8", { fatal: true }).decode(decoded);
        break;
      }
    }
  }

  if (!serialized) {
    throw new Error(
      "This PDF has no editable worksheet template. Import a PDF saved with “Include editable template,” or load a digital JSON backup.",
    );
  }
  try {
    return parseWorksheetSnapshot(serialized);
  } catch (cause) {
    throw new Error(
      `The PDF worksheet template is damaged or unsupported. ${
        cause instanceof Error ? cause.message : ""
      }`.trim(),
    );
  }
}
