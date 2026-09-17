import type { Font as FontkitFont } from "@pdf-lib/fontkit";
import type { PDFFont, StandardFonts as StandardFontName } from "pdf-lib";
import type { WorksheetSettings } from "../../shared/worksheet";
import type { WorksheetSnapshot } from "./worksheet-store";

const MM_PER_POINT = 25.4 / 72;

export interface WorksheetFont {
  /** A browser-ready CSS font-family value for the live preview. */
  family: string;
  /** Measures the rendered line, including scale and spacing controls, in mm. */
  measure(text: string, settings: WorksheetSettings): number;
}

interface FontBacking {
  pdfFont: PDFFont;
  kind: "standard" | "embedded";
  standardName?: StandardFontName;
  bytes?: Uint8Array<ArrayBuffer>;
  fontkitFont?: FontkitFont;
}

const backingByFont = new WeakMap<WorksheetFont, FontBacking>();
const fontCache = new Map<string, Promise<WorksheetFont>>();

function cssString(value: string) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function customBrowserFamily(dataUrl: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < dataUrl.length; index += 1) {
    hash ^= dataUrl.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `WorksheetCustom-${(hash >>> 0).toString(36)}`;
}

function decodeDataUrl(dataUrl: string): Uint8Array<ArrayBuffer> {
  const comma = dataUrl.indexOf(",");
  if (comma < 0 || !dataUrl.slice(0, comma).endsWith(";base64")) {
    throw new Error("The custom font is not an embedded base64 font file.");
  }
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function measuredFont(family: string, backing: FontBacking): WorksheetFont {
  const font: WorksheetFont = {
    family,
    measure(text, settings) {
      if (settings.letterSpacingMm < 0 || settings.wordSpacingMm < 0) {
        throw new RangeError("Letter and word spacing cannot be negative.");
      }
      const shaped = backing.fontkitFont?.layout(text);
      if (shaped?.glyphs.some((glyph) => glyph.id === 0)) {
        const unsupported = Array.from(
          new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
            text,
          ),
          (part) => part.segment,
        ).find((grapheme) =>
          backing.fontkitFont
            ?.layout(grapheme)
            .glyphs.some((glyph) => glyph.id === 0),
        );
        throw new Error(
          `The selected font cannot print “${unsupported ?? "this character"}”. Choose another font or remove the unsupported character.`,
        );
      }
      const baseWidthPt = shaped
        ? (shaped.positions.reduce(
            (total, position) => total + position.xAdvance,
            0,
          ) /
            (backing.fontkitFont?.unitsPerEm ?? 1_000)) *
          settings.fontSizePt
        : backing.pdfFont.widthOfTextAtSize(text, settings.fontSizePt);
      let widthMm = baseWidthPt * MM_PER_POINT * settings.writingScale;
      const graphemes = Array.from(
        new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
          text,
        ),
        (part) => part.segment,
      );
      widthMm += Math.max(0, graphemes.length - 1) * settings.letterSpacingMm;
      widthMm +=
        graphemes.filter((grapheme) => /\s/u.test(grapheme)).length *
        settings.wordSpacingMm;
      return Math.max(0, widthMm);
    },
  };
  backingByFont.set(font, backing);
  return font;
}

async function registerBrowserFont(
  family: string,
  bytes: Uint8Array<ArrayBuffer>,
) {
  if (
    typeof document === "undefined" ||
    typeof FontFace === "undefined" ||
    !document.fonts
  ) {
    return;
  }
  const face = new FontFace(family, bytes.buffer);
  await face.load();
  document.fonts.add(face);
}

async function standardFont(
  id: "serif" | "sans" | "mono",
): Promise<WorksheetFont> {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const document = await PDFDocument.create();
  const details = {
    serif: {
      family: "'Times New Roman', Times, serif",
      name: StandardFonts.TimesRoman,
    },
    sans: {
      family: "Arial, Helvetica, sans-serif",
      name: StandardFonts.Helvetica,
    },
    mono: {
      family: "'Courier New', Courier, monospace",
      name: StandardFonts.Courier,
    },
  } as const;
  const selected = details[id];
  const pdfFont = await document.embedFont(selected.name);
  return measuredFont(selected.family, {
    pdfFont,
    kind: "standard",
    standardName: selected.name,
  });
}

async function embeddedFont(
  cacheKey: string,
  family: string,
  bytes: Uint8Array<ArrayBuffer>,
  browserFamily: string,
): Promise<WorksheetFont> {
  const [{ PDFDocument }, fontkitModule] = await Promise.all([
    import("pdf-lib"),
    import("@pdf-lib/fontkit"),
  ]);
  const document = await PDFDocument.create();
  document.registerFontkit(fontkitModule.default);
  let pdfFont: PDFFont;
  let fontkitFont: FontkitFont;
  try {
    [pdfFont, fontkitFont] = await Promise.all([
      document.embedFont(bytes, { subset: true }),
      fontkitModule.default.create(bytes),
      registerBrowserFont(browserFamily, bytes),
    ]);
  } catch (cause) {
    fontCache.delete(cacheKey);
    throw new Error(
      `The font could not be read. Choose a valid TTF or OTF font. ${
        cause instanceof Error ? cause.message : ""
      }`.trim(),
    );
  }
  return measuredFont(family, {
    pdfFont,
    kind: "embedded",
    bytes,
    fontkitFont,
  });
}

async function loadGreatVibes(): Promise<WorksheetFont> {
  const source =
    typeof location === "undefined"
      ? "http://localhost/fonts/GreatVibes-Regular.ttf"
      : new URL("/fonts/GreatVibes-Regular.ttf", location.origin).href;
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(
      "The Great Vibes font could not be loaded. Try another font.",
    );
  }
  return embeddedFont(
    "great-vibes",
    "'Great Vibes', cursive",
    new Uint8Array(await response.arrayBuffer()),
    "Great Vibes",
  );
}

/** Loads and caches the selected preview/measurement font. */
export async function loadWorksheetFont(
  snapshot: WorksheetSnapshot,
): Promise<WorksheetFont> {
  const { fontId } = snapshot.settings;
  if (fontId === "custom" && !snapshot.customFont) {
    throw new Error(
      "This worksheet used a custom font that is not stored in the PDF. Reselect the TTF or OTF font to continue.",
    );
  }

  const cacheKey =
    fontId === "custom"
      ? `custom:${snapshot.customFont?.name}:${snapshot.customFont?.dataUrl}`
      : fontId;
  const cached = fontCache.get(cacheKey);
  if (cached) return cached;

  const loading =
    fontId === "great-vibes"
      ? loadGreatVibes()
      : fontId === "custom" && snapshot.customFont
        ? (() => {
            const browserFamily = customBrowserFamily(
              snapshot.customFont.dataUrl,
            );
            return embeddedFont(
              cacheKey,
              cssString(browserFamily),
              decodeDataUrl(snapshot.customFont.dataUrl),
              browserFamily,
            );
          })()
        : standardFont(fontId as "serif" | "sans" | "mono");
  fontCache.set(cacheKey, loading);
  loading.catch(() => fontCache.delete(cacheKey));
  return loading;
}

export function worksheetFontBacking(font: WorksheetFont): FontBacking {
  const backing = backingByFont.get(font);
  if (!backing) {
    throw new TypeError("Use a font returned by loadWorksheetFont().");
  }
  return backing;
}
