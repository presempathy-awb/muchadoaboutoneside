import { expect, test } from "bun:test";
import { parseWorksheetGlyphProgress } from "./worksheet-glyph-progress";

test("progress safely renders durable steps and rejects malformed response objects", () => {
  const step = {
    ordinal: 1,
    name: "style",
    model: "qwen3.5:27b",
    state: "ambiguous",
  };
  const data = {
    state: "held",
    errorCode: "uncertain_step",
    reconciliationRequired: true,
    steps: [step],
  };
  expect(parseWorksheetGlyphProgress(data)).toEqual(data);
  for (const invalid of [
    null,
    { ...data, state: "invented" },
    { ...data, steps: [null] },
    { ...data, steps: [step, step] },
    { ...data, steps: [{ ...step, name: "review-4" }] },
    { ...data, errorCode: "<secret>" },
  ]) {
    expect(() => parseWorksheetGlyphProgress(invalid)).toThrow("incomplete");
  }
});
