import {
  type CalligraphyScan,
  MAX_SCAN_JSON_BYTES,
  scanMatchesText,
  validateCalligraphyScan,
} from "./calligraphy-scan";
import {
  MAX_SCALE_DESIGN_BYTES,
  normalizeScaleDesign,
  type ScaleDesign,
} from "./scale-design";

export const MAX_SCALE_STUDY_FILE_BYTES =
  MAX_SCALE_DESIGN_BYTES + MAX_SCAN_JSON_BYTES;

/** An exported study can carry its original scan; browser drafts keep only its ID. */
export function scaleStudyFile(design: ScaleDesign, scan?: CalligraphyScan) {
  const normalized = normalizeScaleDesign(design);
  const face = normalized.calligraphyFaceId ?? "auto";
  if (!scan) {
    if (face !== "auto" && face !== "font")
      throw new Error(
        "Restore the original scan before exporting this handwriting.",
      );
    return normalized;
  }
  const checked = validateCalligraphyScan(scan);
  if (face !== "auto" && face !== checked.id)
    throw new Error(
      "The study and embedded handwriting refer to different faces.",
    );
  if (!scanMatchesText(checked, normalized.text))
    throw new Error(
      "The scan must contain the same words and punctuation as this study.",
    );
  return {
    ...normalized,
    calligraphyFaceId: checked.id,
    calligraphyScan: checked,
  };
}

export function parseScaleStudyFile(input: unknown) {
  const design = normalizeScaleDesign(input);
  const raw = input as Record<string, unknown>;
  if (raw.calligraphyScan === undefined) return { design };
  const scan = validateCalligraphyScan(raw.calligraphyScan);
  if (!scanMatchesText(scan, design.text))
    throw new Error(
      "This study's handwriting does not match its original transcription.",
    );
  if (
    design.calligraphyFaceId !== scan.id &&
    design.calligraphyFaceId !== "auto"
  )
    throw new Error(
      "The study and embedded handwriting refer to different faces.",
    );
  return { design: { ...design, calligraphyFaceId: scan.id }, scan };
}
