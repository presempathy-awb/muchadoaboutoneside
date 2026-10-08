import { expect, test } from "bun:test";
import { parseWorksheetVisionMeasurements } from "./worksheet-vision";

test("sizing suggestions retain only validated fields and reject unusable measurements", () => {
  const measurements = {
    xHeightMm: 5,
    lineSpacingMm: 12,
    letterWidthMm: 3,
    confidence: "medium" as const,
    notes: "Two straight rows",
  };
  expect(
    parseWorksheetVisionMeasurements({
      ...measurements,
      unvalidated: "discard",
    }),
  ).toEqual(measurements);
  for (const invalid of [
    { ...measurements, xHeightMm: Number.NaN },
    { ...measurements, lineSpacingMm: 4 },
    { ...measurements, letterWidthMm: 0 },
    { ...measurements, confidence: "certain" },
    { ...measurements, notes: "x".repeat(501) },
  ])
    expect(() => parseWorksheetVisionMeasurements(invalid)).toThrow();
});
