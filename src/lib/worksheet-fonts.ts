import type { Font as FontkitFont } from "@pdf-lib/fontkit";
import type { PDFFont, StandardFonts as StandardFontName } from "pdf-lib";
import type { WorksheetSettings } from "../../shared/worksheet";
import {
  isWorksheetBundledFontId,
  worksheetFontDefinition,
} from "../../shared/worksheet-font-catalog";
import {
  createFontkitShaper,
  createHarfBuzzShaper,
  supportedWorksheetFontFeatures,
  type WorksheetInkBounds,
  type WorksheetShapedRun,
  type WorksheetShaper,
  type WorksheetShapingEngine,
} from "./worksheet-shaping";
import type { WorksheetSnapshot } from "./worksheet-store";

const MM_PER_POINT = 25.4 / 72;
export const MAX_WORKSHEET_FONT_BYTES = 2 * 1024 * 1024;
const MAX_CACHED_FONTS = 16;
const MAX_CACHED_RUNS_PER_FONT = 64;
const MAX_CACHED_RUN_BYTES_PER_FONT = 4 * 1024 * 1024;

export interface WorksheetFont {
  id: string;
  /** A browser-ready CSS font-family value for the live preview. */
  family: string;
  engine: WorksheetShapingEngine;
  supportedFeatures: readonly string[];
  unitsPerEm: number;
  xHeightUnits: number;
  resolveSizePt(settings: WorksheetSettings): number;
  hasGlyph(text: string): boolean;
  shape(text: string, settings: WorksheetSettings): WorksheetShapedRun;
  measure(text: string, settings: WorksheetSettings): number;
}

export interface FontBacking {
  pdfFont: PDFFont;
  kind: "standard" | "embedded";
  standardName?: StandardFontName;
  bytes?: Uint8Array<ArrayBuffer>;
  fontkitFont?: FontkitFont;
}

interface LoadedFont {
  font: WorksheetFont;
  releaseBrowserFace(): void;
  dispose(): void;
}

const backingByFont = new WeakMap<WorksheetFont, FontBacking>();
const fontCache = new Map<string, Promise<LoadedFont>>();
const browserFaces = new Set<FontFace>();

function cssString(value: string) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function typographySettingsKey(settings: WorksheetSettings, sizePt: number) {
  return [
    sizePt,
    settings.fontFeatures,
    settings.letterSpacingMm,
    settings.wordSpacingMm,
    settings.writingScale,
  ].join(":");
}

function resolveSizePt(
  settings: WorksheetSettings,
  unitsPerEm: number,
  xHeightUnits: number,
) {
  const pointSize =
    settings.fontSizeMode === "xheight"
      ? (settings.textXHeightMm / MM_PER_POINT) * (unitsPerEm / xHeightUnits)
      : settings.fontSizePt;
  if (!Number.isFinite(pointSize) || pointSize <= 0 || pointSize > 2_000) {
    throw new RangeError(
      "The selected font and lowercase-height setting produce an unsafe text size.",
    );
  }
  return pointSize;
}

function measuredFont(
  id: string,
  family: string,
  backing: FontBacking,
  shaper: WorksheetShaper,
  metrics: {
    unitsPerEm: number;
    xHeightUnits: number;
    supportedFeatures: readonly string[];
    hasGlyph(text: string): boolean;
  },
  browserFace?: FontFace,
): LoadedFont {
  const runCache = new Map<
    string,
    { run: WorksheetShapedRun; estimatedBytes: number }
  >();
  let cachedRunBytes = 0;
  let faceReleased = false;
  const releaseBrowserFace = () => {
    if (
      faceReleased ||
      !browserFace ||
      typeof document === "undefined" ||
      !document.fonts
    ) {
      return;
    }
    document.fonts.delete(browserFace);
    browserFaces.delete(browserFace);
    faceReleased = true;
  };
  const font: WorksheetFont = {
    id,
    family,
    engine: shaper.engine,
    supportedFeatures: Object.freeze([...metrics.supportedFeatures]),
    unitsPerEm: metrics.unitsPerEm,
    xHeightUnits: metrics.xHeightUnits,
    resolveSizePt(settings) {
      return resolveSizePt(settings, metrics.unitsPerEm, metrics.xHeightUnits);
    },
    hasGlyph: metrics.hasGlyph,
    shape(text, settings) {
      const sizePt = font.resolveSizePt(settings);
      const key = `${typographySettingsKey(settings, sizePt)}\u0000${text}`;
      const cached = runCache.get(key);
      if (cached) return cached.run;
      const run = shaper.shape(text, settings, sizePt);
      const estimatedBytes =
        key.length * 2 +
        run.glyphs.length * 128 +
        run.glyphs.reduce(
          (total, glyph) => total + (glyph.path?.length ?? 0) * 2,
          0,
        );
      while (
        runCache.size > 0 &&
        (runCache.size >= MAX_CACHED_RUNS_PER_FONT ||
          cachedRunBytes + estimatedBytes > MAX_CACHED_RUN_BYTES_PER_FONT)
      ) {
        const oldest = runCache.keys().next().value;
        if (oldest === undefined) break;
        const removed = runCache.get(oldest);
        if (removed) cachedRunBytes -= removed.estimatedBytes;
        runCache.delete(oldest);
      }
      if (estimatedBytes <= MAX_CACHED_RUN_BYTES_PER_FONT) {
        runCache.set(key, { run, estimatedBytes });
        cachedRunBytes += estimatedBytes;
      }
      return run;
    },
    measure(text, settings) {
      return font.shape(text, settings).widthMm;
    },
  };
  backingByFont.set(font, backing);
  return {
    font,
    releaseBrowserFace,
    dispose() {
      runCache.clear();
      cachedRunBytes = 0;
      releaseBrowserFace();
      shaper.dispose();
    },
  };
}

function assertFontByteLength(length: number) {
  if (!Number.isSafeInteger(length) || length <= 0) {
    throw new Error("The font file is empty or has an invalid size.");
  }
  if (length > MAX_WORKSHEET_FONT_BYTES) {
    throw new RangeError(
      `The font file is too large (${length.toLocaleString()} bytes; maximum ${MAX_WORKSHEET_FONT_BYTES.toLocaleString()}).`,
    );
  }
}

/** Performs bounded structural checks before an untrusted font reaches a parser. */
export function validateWorksheetSfnt(bytes: Uint8Array<ArrayBuffer>): void {
  assertFontByteLength(bytes.byteLength);
  if (bytes.byteLength < 12) {
    throw new Error("The font file is too short to be a TTF or OTF font.");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const signature = view.getUint32(0);
  const trueType = signature === 0x0001_0000 || signature === 0x7472_7565;
  const openType = signature === 0x4f54_544f;
  if (!trueType && !openType) {
    throw new Error("Choose an uncompressed TTF or OTF font file.");
  }
  const tableCount = view.getUint16(4);
  if (
    tableCount === 0 ||
    tableCount > 128 ||
    12 + tableCount * 16 > bytes.byteLength
  ) {
    throw new Error("The font contains an invalid table directory.");
  }
  const decoder = new TextDecoder("latin1");
  const tables = new Map<string, { offset: number; length: number }>();
  for (let index = 0; index < tableCount; index += 1) {
    const record = 12 + index * 16;
    const tag = decoder.decode(bytes.subarray(record, record + 4));
    const offset = view.getUint32(record + 8);
    const length = view.getUint32(record + 12);
    if (
      tables.has(tag) ||
      length === 0 ||
      offset > bytes.byteLength ||
      length > bytes.byteLength - offset
    ) {
      throw new Error(`The font contains an invalid “${tag}” table.`);
    }
    tables.set(tag, { offset, length });
  }
  for (const tag of ["head", "maxp", "cmap", "hhea", "hmtx"]) {
    if (!tables.has(tag)) {
      throw new Error(`The font is missing its required “${tag}” table.`);
    }
  }
  if (
    !(tables.has("glyf") && tables.has("loca")) &&
    !tables.has("CFF ") &&
    !tables.has("CFF2")
  ) {
    throw new Error("The font has no supported TrueType or OpenType outlines.");
  }
  const head = tables.get("head");
  const maxp = tables.get("maxp");
  if (
    !head ||
    head.length < 54 ||
    view.getUint32(head.offset + 12) !== 0x5f0f_3cf5
  ) {
    throw new Error("The font contains an invalid header table.");
  }
  const unitsPerEm = view.getUint16(head.offset + 18);
  if (unitsPerEm < 16 || unitsPerEm > 16_384) {
    throw new Error("The font declares an invalid units-per-em value.");
  }
  if (!maxp || maxp.length < 6) {
    throw new Error("The font contains an invalid maximum-profile table.");
  }
  const glyphCount = view.getUint16(maxp.offset + 4);
  if (glyphCount === 0 || glyphCount > 20_000) {
    throw new RangeError(
      `The font declares an unsafe glyph count (${glyphCount.toLocaleString()}; maximum 20,000).`,
    );
  }
}

function decodeDataUrl(dataUrl: string): Uint8Array<ArrayBuffer> {
  const comma = dataUrl.indexOf(",");
  if (comma < 0 || !dataUrl.slice(0, comma).endsWith(";base64")) {
    throw new Error("The custom font is not an embedded base64 font file.");
  }
  const encoded = dataUrl.slice(comma + 1);
  if (encoded.length > Math.ceil(MAX_WORKSHEET_FONT_BYTES / 3) * 4 + 4) {
    throw new RangeError("The custom font exceeds the 2 MB safety limit.");
  }
  const binary = atob(encoded);
  assertFontByteLength(binary.length);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function fetchFontBytes(source: string, expectedSha256: string) {
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error("The selected calligraphy font could not be loaded.");
  }
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > 0) {
    assertFontByteLength(declaredLength);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  assertFontByteLength(bytes.byteLength);
  const actualSha256 = await sha256Hex(bytes);
  if (actualSha256 !== expectedSha256.toLowerCase()) {
    throw new Error(
      "The selected calligraphy font failed its integrity check. Reload the page before trying again.",
    );
  }
  return bytes;
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
    return undefined;
  }
  const face = new FontFace(family, bytes.buffer);
  await face.load();
  document.fonts.add(face);
  browserFaces.add(face);
  return face;
}

function fallbackXHeight(font: FontkitFont) {
  if (Number.isFinite(font.xHeight) && font.xHeight > 0) return font.xHeight;
  const lowerX = font.glyphForCodePoint("x".codePointAt(0) ?? 120);
  if (lowerX.id !== 0 && lowerX.bbox.maxY > lowerX.bbox.minY) {
    return lowerX.bbox.maxY;
  }
  return font.unitsPerEm * 0.5;
}

async function embeddedFont(
  id: string,
  cacheKey: string,
  bytes: Uint8Array<ArrayBuffer>,
  browserFamily: string,
  engine: WorksheetShapingEngine,
): Promise<LoadedFont> {
  validateWorksheetSfnt(bytes);
  const [{ PDFDocument }, fontkitModule] = await Promise.all([
    import("pdf-lib"),
    import("@pdf-lib/fontkit"),
  ]);
  const document = await PDFDocument.create();
  document.registerFontkit(fontkitModule.default);
  try {
    const [pdfFont, fontkitFont, browserFace] = await Promise.all([
      document.embedFont(bytes, { subset: true }),
      Promise.resolve(fontkitModule.default.create(bytes)),
      registerBrowserFont(browserFamily, bytes),
    ]);
    const supportedFeatures = supportedWorksheetFontFeatures(
      fontkitFont.availableFeatures,
    );
    const shaper =
      engine === "harfbuzz"
        ? await createHarfBuzzShaper(bytes, supportedFeatures)
        : createFontkitShaper(fontkitFont, supportedFeatures);
    return measuredFont(
      id,
      cssString(browserFamily),
      { pdfFont, kind: "embedded", bytes, fontkitFont },
      shaper,
      {
        unitsPerEm: fontkitFont.unitsPerEm,
        xHeightUnits: fallbackXHeight(fontkitFont),
        supportedFeatures,
        hasGlyph(text) {
          return Array.from(text).every((character) => {
            if (
              character === "\n" ||
              character === "\r" ||
              character === "\t"
            ) {
              return true;
            }
            const codePoint = character.codePointAt(0);
            return (
              codePoint !== undefined &&
              fontkitFont.hasGlyphForCodePoint(codePoint)
            );
          });
        },
      },
      browserFace,
    );
  } catch (cause) {
    fontCache.delete(cacheKey);
    throw new Error(
      `The font could not be read or shaped. Choose a valid TTF or OTF font. ${
        cause instanceof Error ? cause.message : ""
      }`.trim(),
    );
  }
}

function makeBounds(
  xMin: number,
  yMin: number,
  xMax: number,
  yMax: number,
): WorksheetInkBounds {
  return {
    xMin,
    yMin,
    xMax,
    yMax,
    width: Math.max(0, xMax - xMin),
    height: Math.max(0, yMax - yMin),
  };
}

async function standardFont(
  id: "serif" | "sans" | "mono",
  requestedEngine: WorksheetShapingEngine,
): Promise<LoadedFont> {
  if (requestedEngine === "harfbuzz") {
    throw new Error(
      "HarfBuzz shaping requires an embedded calligraphy or custom font. Choose Fontkit for the standard system fonts.",
    );
  }
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const document = await PDFDocument.create();
  const details = {
    serif: {
      family: "'Times New Roman', Times, serif",
      name: StandardFonts.TimesRoman,
      xHeight: 450,
    },
    sans: {
      family: "Arial, Helvetica, sans-serif",
      name: StandardFonts.Helvetica,
      xHeight: 523,
    },
    mono: {
      family: "'Courier New', Courier, monospace",
      name: StandardFonts.Courier,
      xHeight: 426,
    },
  } as const;
  const selected = details[id];
  const pdfFont = await document.embedFont(selected.name);
  let disposed = false;
  const shaper: WorksheetShaper = {
    engine: "fontkit",
    shape(text, settings, sizePt) {
      if (disposed) throw new Error("This font shaper has been disposed.");
      if (settings.fontFeatures.trim()) {
        throw new Error(
          "Standard system fonts do not expose OpenType alternates.",
        );
      }
      const graphemes = Array.from(
        new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
          text,
        ),
        ({ segment, index }) => ({ segment, index }),
      );
      let xMm = 0;
      const glyphs = graphemes.map(({ segment, index }, glyphIndex) => {
        const baseMm =
          pdfFont.widthOfTextAtSize(segment, sizePt) * MM_PER_POINT;
        const spacingMm =
          (glyphIndex < graphemes.length - 1 ? settings.letterSpacingMm : 0) +
          (/\s/u.test(segment) ? settings.wordSpacingMm : 0);
        const advanceMm = baseMm * settings.writingScale + spacingMm;
        const glyph = {
          id: segment.codePointAt(0) ?? 0,
          cluster: index,
          xMm,
          yMm: 0,
          advanceMm,
          inkBoundsMm:
            segment.trim() === ""
              ? null
              : makeBounds(
                  xMm,
                  -sizePt * MM_PER_POINT * 0.22,
                  xMm + baseMm * settings.writingScale,
                  sizePt * MM_PER_POINT * 0.72,
                ),
        };
        xMm += advanceMm;
        return glyph;
      });
      const runBounds = glyphs.reduce<WorksheetInkBounds | null>(
        (current, glyph) => {
          if (!glyph.inkBoundsMm) return current;
          if (!current) return glyph.inkBoundsMm;
          return makeBounds(
            Math.min(current.xMin, glyph.inkBoundsMm.xMin),
            Math.min(current.yMin, glyph.inkBoundsMm.yMin),
            Math.max(current.xMax, glyph.inkBoundsMm.xMax),
            Math.max(current.yMax, glyph.inkBoundsMm.yMax),
          );
        },
        null,
      );
      return {
        engine: "fontkit",
        text,
        sizePt,
        widthMm: xMm,
        inkBoundsMm: runBounds,
        glyphs,
        pathScaleMm: (sizePt * MM_PER_POINT) / 1_000,
        writingScale: settings.writingScale,
      };
    },
    dispose() {
      disposed = true;
    },
  };
  return measuredFont(
    id,
    selected.family,
    { pdfFont, kind: "standard", standardName: selected.name },
    shaper,
    {
      unitsPerEm: 1_000,
      xHeightUnits: selected.xHeight,
      supportedFeatures: [],
      hasGlyph(text) {
        if (/^[\n\r\t]*$/u.test(text)) return true;
        try {
          pdfFont.encodeText(text);
          return true;
        } catch {
          return false;
        }
      },
    },
    undefined,
  );
}

async function cacheFont(cacheKey: string, load: () => Promise<LoadedFont>) {
  const cached = fontCache.get(cacheKey);
  if (cached) return (await cached).font;
  const loading = load();
  fontCache.set(cacheKey, loading);
  loading.catch(() => fontCache.delete(cacheKey));
  if (fontCache.size > MAX_CACHED_FONTS) {
    const oldest = fontCache.keys().next().value;
    if (oldest !== undefined && oldest !== cacheKey) {
      const evicted = fontCache.get(oldest);
      fontCache.delete(oldest);
      // A component may still hold this WorksheetFont. Releasing the browser
      // face bounds document.fonts while leaving the synchronous shaper valid;
      // the engine itself becomes collectible with that last external holder.
      evicted
        ?.then(({ releaseBrowserFace }) => releaseBrowserFace())
        .catch(() => undefined);
    }
  }
  return (await loading).font;
}

/** Loads and caches the selected preview/measurement font and chosen shaper. */
export async function loadWorksheetFont(
  snapshot: WorksheetSnapshot,
): Promise<WorksheetFont> {
  const { fontId, shapingEngine } = snapshot.settings;
  if (fontId === "custom" && !snapshot.customFont) {
    throw new Error(
      "This worksheet used a custom font that is not stored in the PDF. Reselect the TTF or OTF font to continue.",
    );
  }
  if (isWorksheetBundledFontId(fontId)) {
    const definition = worksheetFontDefinition(fontId);
    const source = new URL(
      definition.path,
      typeof location === "undefined" ? "http://localhost" : location.origin,
    );
    source.searchParams.set("sha256", definition.sha256);
    const cacheKey = `${fontId}:${shapingEngine}`;
    return cacheFont(cacheKey, async () => {
      const bytes = await fetchFontBytes(source.href, definition.sha256);
      return embeddedFont(
        fontId,
        cacheKey,
        bytes,
        `Worksheet-${fontId}`,
        shapingEngine,
      );
    });
  }
  if (fontId === "custom" && snapshot.customFont) {
    const bytes = decodeDataUrl(snapshot.customFont.dataUrl);
    const digest = await sha256Hex(bytes);
    const cacheKey = `custom:${digest}:${shapingEngine}`;
    return cacheFont(cacheKey, () =>
      embeddedFont(
        "custom",
        cacheKey,
        bytes,
        `Worksheet-Custom-${digest.slice(0, 12)}`,
        shapingEngine,
      ),
    );
  }
  return cacheFont(`${fontId}:${shapingEngine}`, () =>
    standardFont(fontId as "serif" | "sans" | "mono", shapingEngine),
  );
}

/** Releases cached font/shaper references and removes registered browser faces. */
export async function disposeWorksheetTypography(): Promise<void> {
  const loaded = [...fontCache.values()];
  fontCache.clear();
  const settled = await Promise.allSettled(loaded);
  for (const result of settled) {
    if (result.status === "fulfilled") result.value.dispose();
  }
  if (typeof document !== "undefined" && document.fonts) {
    for (const face of browserFaces) document.fonts.delete(face);
  }
  browserFaces.clear();
}

export function worksheetFontBacking(font: WorksheetFont): FontBacking {
  const backing = backingByFont.get(font);
  if (!backing) {
    throw new TypeError("Use a font returned by loadWorksheetFont().");
  }
  return backing;
}
