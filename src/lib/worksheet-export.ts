import {
  getWorksheetLayout,
  normalizeWorksheetSettings,
  type WorksheetEstimate,
  type WorksheetLayout,
  wrapText,
} from "../../shared/worksheet";
import {
  loadWorksheetFont,
  type WorksheetFont,
  worksheetFontBacking,
} from "./worksheet-fonts";
import {
  parseWorksheetSnapshot,
  type WorksheetPhoto,
  type WorksheetSnapshot,
} from "./worksheet-store";

const POINTS_PER_MM = 72 / 25.4;
const TEMPLATE_FILENAME = "muchado-worksheet-template.json";
const MAX_IMPORT_PDF_BYTES = 15 * 1024 * 1024;
const MAX_TEMPLATE_SUBJECT_LENGTH = 512 * 1024;

export interface WorksheetTextPages {
  layout: WorksheetLayout;
  lines: string[];
  pages: string[][];
  estimate: WorksheetEstimate;
}

function assertNonnegativeTextSpacing(snapshot: WorksheetSnapshot) {
  if (
    snapshot.settings.letterSpacingMm < 0 ||
    snapshot.settings.wordSpacingMm < 0
  ) {
    throw new RangeError("Letter and word spacing cannot be negative.");
  }
}

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

export function worksheetTextPages(
  snapshot: WorksheetSnapshot,
  font: WorksheetFont,
): WorksheetTextPages {
  const settings = normalizeWorksheetSettings(snapshot.settings);
  assertNonnegativeTextSpacing({ ...snapshot, settings });
  const layout = getWorksheetLayout(settings);
  const availableWidth = layout.contentX2Mm - layout.contentX1Mm;
  // A paragraph repeatedly measures the same words and individual glyphs.
  // Keep the cache local to this model so edits never reuse stale font settings.
  const widths = new Map<string, number>();
  const measure = (text: string) => {
    const cached = widths.get(text);
    if (cached !== undefined) return cached;
    const width = font.measure(text, settings);
    widths.set(text, width);
    return width;
  };
  const lines = wrapText(snapshot.text, availableWidth, measure);
  const oversized = Array.from(snapshot.text).find(
    (character) =>
      character !== "\n" &&
      character !== "\r" &&
      measure(character) > availableWidth + 1e-8,
  );
  if (oversized) {
    throw new RangeError(
      `“${oversized}” is wider than the writing area at this font size. Reduce the font size or increase the page width.`,
    );
  }

  const rowsPerPage = layout.baselineYsMm.length;
  const pagesNeeded =
    lines.length === 0
      ? 0
      : rowsPerPage === 0
        ? Number.POSITIVE_INFINITY
        : Math.ceil(lines.length / rowsPerPage);
  const estimate: WorksheetEstimate = {
    lines,
    lineCount: lines.length,
    pagesNeeded,
    rowsPerPage,
    overflow: pagesNeeded > settings.pageCount,
  };
  const pages = Array.from({ length: settings.pageCount }, (_, pageIndex) => {
    if (lines.length === 0 || rowsPerPage === 0) return [];
    if (settings.textRepeat && !estimate.overflow) {
      return Array.from(
        { length: rowsPerPage },
        (_, rowIndex) =>
          lines[(pageIndex * rowsPerPage + rowIndex) % lines.length] ?? "",
      );
    }
    return lines.slice(pageIndex * rowsPerPage, (pageIndex + 1) * rowsPerPage);
  });
  return { layout, lines, pages, estimate };
}

function ensureTextFitsVertically(
  layout: WorksheetLayout,
  snapshot: WorksheetSnapshot,
  model: WorksheetTextPages,
) {
  if (!snapshot.settings.textEnabled || snapshot.text === "") return;
  const usedRows = model.pages.flatMap((page) =>
    page.flatMap((line, index) => (line === "" ? [] : [index])),
  );
  const firstIndex = usedRows.length === 0 ? undefined : Math.min(...usedRows);
  const lastIndex = usedRows.length === 0 ? undefined : Math.max(...usedRows);
  const first =
    firstIndex === undefined ? undefined : layout.baselineYsMm[firstIndex];
  const last =
    lastIndex === undefined ? undefined : layout.baselineYsMm[lastIndex];
  if (first === undefined || last === undefined) return;
  const sizeMm = snapshot.settings.fontSizePt * (25.4 / 72);
  const top = first - sizeMm * 0.85;
  const bottom = last + sizeMm * 0.3;
  if (top < 0 || bottom > layout.heightMm) {
    throw new RangeError(
      "The example text can extend off the page at this font size. Increase the top/bottom margins or reduce the font size.",
    );
  }
}

/** Throws when the current text model would be clipped or truncated on export. */
export function validateWorksheetTextFit(
  snapshot: WorksheetSnapshot,
  model: WorksheetTextPages,
): void {
  assertNonnegativeTextSpacing(snapshot);
  if (!snapshot.settings.textEnabled || snapshot.text === "") return;
  if (model.estimate.overflow) {
    throw new RangeError(
      `The example text needs ${model.estimate.pagesNeeded} pages, but the worksheet is set to ${snapshot.settings.pageCount}. Add pages, shorten the text, or reduce its size before printing.`,
    );
  }
  ensureTextFitsVertically(model.layout, snapshot, model);
}

async function embedSelectedFont(
  document: import("pdf-lib").PDFDocument,
  font: WorksheetFont,
) {
  const backing = worksheetFontBacking(font);
  if (backing.kind === "standard" && backing.standardName) {
    return document.embedFont(backing.standardName);
  }
  if (!backing.bytes) throw new Error("The selected font data is unavailable.");
  const fontkitModule = await import("@pdf-lib/fontkit");
  document.registerFontkit(fontkitModule.default);
  return document.embedFont(backing.bytes, { subset: true });
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
  assertNonnegativeTextSpacing(valid);
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
          estimate: {
            lines: [],
            lineCount: 0,
            pagesNeeded: 0,
            rowsPerPage: layout.baselineYsMm.length,
            overflow: false,
          },
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

    if (settings.textEnabled && font && pdfFont) {
      const fontKey = page.node.newFontDictionary(pdfFont.name, pdfFont.ref);
      const opacityKey = page.node.newExtGState(
        "GS",
        document.context.obj({
          Type: "ExtGState",
          ca: settings.textOpacity,
        }),
      );
      const pageLines = model.pages[pageIndex] ?? [];
      for (let rowIndex = 0; rowIndex < pageLines.length; rowIndex += 1) {
        const text = pageLines[rowIndex] ?? "";
        const baseline = model.layout.baselineYsMm[rowIndex];
        if (baseline === undefined || text === "") continue;
        const widthMm = font.measure(text, settings);
        const xMm =
          settings.textAlign === "center"
            ? (model.layout.contentX1Mm + model.layout.contentX2Mm - widthMm) /
              2
            : settings.textAlign === "right"
              ? model.layout.contentX2Mm - widthMm
              : model.layout.contentX1Mm;
        const sizePt = settings.fontSizePt;
        const anchorXPt = xMm * POINTS_PER_MM;
        const baselinePt = (model.layout.heightMm - baseline) * POINTS_PER_MM;
        try {
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
            new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
              text,
            ),
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
