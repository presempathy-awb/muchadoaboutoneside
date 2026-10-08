export interface WorksheetVisionMeasurements {
  xHeightMm: number;
  lineSpacingMm: number;
  letterWidthMm: number;
  confidence: "low" | "medium" | "high";
  notes: string;
}

/** Validate calibrated suggestions before they can change worksheet settings. */
export function parseWorksheetVisionMeasurements(
  value: unknown,
): WorksheetVisionMeasurements {
  if (!value || typeof value !== "object")
    throw new Error("The sizing suggestion is invalid.");
  const row = value as Record<string, unknown>;
  for (const [key, min, max] of [
    ["xHeightMm", 0.5, 50],
    ["lineSpacingMm", 0.5, 100],
    ["letterWidthMm", 0.1, 100],
  ] as const) {
    if (
      typeof row[key] !== "number" ||
      !Number.isFinite(row[key]) ||
      row[key] < min ||
      row[key] > max
    )
      throw new Error(
        "The photo measurements are outside the worksheet's supported range.",
      );
  }
  if (
    (row.lineSpacingMm as number) <= (row.xHeightMm as number) ||
    !["low", "medium", "high"].includes(String(row.confidence)) ||
    typeof row.notes !== "string" ||
    row.notes.length > 500
  )
    throw new Error(
      "The model did not identify usable letter and baseline measurements.",
    );
  return {
    xHeightMm: row.xHeightMm as number,
    lineSpacingMm: row.lineSpacingMm as number,
    letterWidthMm: row.letterWidthMm as number,
    confidence: row.confidence as WorksheetVisionMeasurements["confidence"],
    notes: row.notes,
  };
}
