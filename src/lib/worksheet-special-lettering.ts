import type { WorksheetSettings } from "../../shared/worksheet";
import { specialWordParts } from "../../shared/worksheet-special-words";
import type { WorksheetFont } from "./worksheet-fonts";
import {
  MAX_RUN_PATH_CHARACTERS,
  MAX_SHAPED_GLYPHS,
  MAX_SHAPING_TEXT_BYTES,
  type WorksheetInkBounds,
  type WorksheetShapedPart,
  type WorksheetShapedRun,
} from "./worksheet-shaping";

/** Apply a separate font to complete names and phrases. */
export function withSpecialWordFont(
  base: WorksheetFont,
  accent: WorksheetFont,
  phrases: readonly string[],
): WorksheetFont {
  let cachedText: string | undefined;
  let cachedSettings: WorksheetSettings | undefined;
  let cachedRun: WorksheetShapedRun | undefined;
  const font: WorksheetFont = {
    ...base,
    baseFont: base,
    hasGlyph: (text) =>
      specialWordParts(text, phrases).every((part) =>
        (part.special ? accent : base).hasGlyph(part.text),
      ),
    measure: (text, settings) => font.shape(text, settings).widthMm,
    shape(text, settings) {
      if (cachedText === text && cachedSettings === settings && cachedRun)
        return cachedRun;
      const sections = specialWordParts(text, phrases);
      if (!sections.some((part) => part.special))
        return base.shape(text, settings);
      if (new TextEncoder().encode(text).byteLength > MAX_SHAPING_TEXT_BYTES)
        throw new RangeError("This line is too long to shape safely.");
      if (/[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/u.test(text))
        throw new Error(
          "Special-word lettering currently supports left-to-right lines. Clear special words to keep this line's original shaping.",
        );
      let widthMm = 0;
      let inkBoundsMm: WorksheetInkBounds | null = null;
      let glyphCount = 0;
      let pathCharacters = 0;
      const parts: WorksheetShapedPart[] = sections.map((section, index) => {
        const selected = section.special ? accent : base;
        if (!selected.hasGlyph(section.text))
          throw new Error(
            `The selected font cannot print “${section.text}”. Choose a different font.`,
          );
        const scale = settings.specialSizePercent / 100;
        const run = selected.shape(
          section.text,
          section.special
            ? {
                ...settings,
                fontFeatures: "",
                fontSizePt: settings.fontSizePt * scale,
                textXHeightMm: settings.textXHeightMm * scale,
              }
            : settings,
        );
        glyphCount += run.glyphs.length;
        pathCharacters += run.glyphs.reduce(
          (total, glyph) => total + (glyph.path?.length ?? 0),
          0,
        );
        if (
          glyphCount > MAX_SHAPED_GLYPHS ||
          pathCharacters > MAX_RUN_PATH_CHARACTERS
        )
          throw new RangeError(
            "This line has too many glyph outlines. Shorten the line before printing.",
          );
        const xMm = widthMm;
        const bounds = run.inkBoundsMm;
        if (bounds) {
          const xMin = Math.min(
            inkBoundsMm?.xMin ?? Infinity,
            xMm + bounds.xMin,
          );
          const xMax = Math.max(
            inkBoundsMm?.xMax ?? -Infinity,
            xMm + bounds.xMax,
          );
          const yMin = Math.min(inkBoundsMm?.yMin ?? Infinity, bounds.yMin);
          const yMax = Math.max(inkBoundsMm?.yMax ?? -Infinity, bounds.yMax);
          inkBoundsMm = {
            xMin,
            xMax,
            yMin,
            yMax,
            width: xMax - xMin,
            height: yMax - yMin,
          };
        }
        widthMm +=
          run.widthMm +
          (index < sections.length - 1 ? settings.letterSpacingMm : 0);
        return { xMm, family: selected.family, run };
      });
      cachedText = text;
      cachedSettings = settings;
      cachedRun = {
        engine: base.engine,
        text,
        sizePt: base.resolveSizePt(settings),
        widthMm,
        inkBoundsMm,
        glyphs: [],
        pathScaleMm: 1,
        writingScale: settings.writingScale,
        parts,
      };
      return cachedRun;
    },
  };
  return font;
}
