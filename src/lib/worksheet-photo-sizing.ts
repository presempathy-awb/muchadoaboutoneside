import type { WorksheetSettings } from "../../shared/worksheet";
import {
  parseWorksheetVisionMeasurements,
  type WorksheetVisionMeasurements,
} from "../../shared/worksheet-vision";
import type { WorksheetFont } from "./worksheet-fonts";

/** Match plain rows and measured font proportions to calibrated handwriting estimates. */
export function worksheetPhotoSizing(
  settings: WorksheetSettings,
  selectedFont: WorksheetFont,
  measurements: WorksheetVisionMeasurements,
): Partial<WorksheetSettings> {
  const font = selectedFont.baseFont ?? selectedFont;
  const valid = parseWorksheetVisionMeasurements(measurements);
  if (valid.confidence === "low")
    throw new Error(
      "Measure manually or use a clearer photo before applying low-confidence sizing.",
    );
  const sized = {
    ...settings,
    fontSizeMode: "xheight" as const,
    textXHeightMm: valid.xHeightMm,
    writingScale: 1,
    letterSpacingMm: 0,
    wordSpacingMm: 0,
  };
  if (!font.hasGlyph("n"))
    throw new Error(
      "This font cannot match the reference letter n. Choose another font or adjust width manually.",
    );
  const run = font.shape("n", sized);
  const width = run.inkBoundsMm?.width ?? run.widthMm;
  const writingScale = valid.letterWidthMm / width;
  if (!Number.isFinite(writingScale) || writingScale < 0.1 || writingScale > 10)
    throw new Error(
      "This font cannot match the measured letter width. Choose another font or adjust width manually.",
    );
  return {
    mode: "plain",
    guidesEnabled: true,
    slantEnabled: false,
    spacingMode: "fixed",
    spacingMm: valid.lineSpacingMm,
    xHeightMm: valid.xHeightMm,
    fontSizeMode: "xheight",
    textXHeightMm: valid.xHeightMm,
    writingScale,
  };
}
