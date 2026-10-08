import { expect, test } from "bun:test";
import { restoreWorksheetGlyphJob } from "./worksheet-glyph-job";

test("restoring an uncertain request preserves its key and rejects malformed or expired local jobs", () => {
  const now = 100_000_000;
  const input = {
    key: "00000000-0000-4000-8000-000000000001",
    profile: "qwen-vec",
    glyph: "a",
    style: "Fine italic",
    rounds: 2,
  };
  const job = { input, state: "receipt_pending", started: now - 1 };
  expect(restoreWorksheetGlyphJob(JSON.stringify(job), now)).toEqual(job);
  for (const invalid of [
    { ...job, input: { ...input, key: "new-key" } },
    { ...job, input: { ...input, profile: "x".repeat(65) } },
    { ...job, input: { ...input, style: "x".repeat(2049) } },
    { ...job, input: { ...input, glyph: "\n" } },
    { ...job, input: { ...input, rounds: 4 } },
    {
      ...job,
      input: {
        ...input,
        photo: {
          dataUrl: "data:image/png;base64,YQ==",
          pixelWidth: 961,
          pixelHeight: 100,
          mmPerPixel: 0.2,
        },
      },
    },
    { ...job, state: "unrecognized" },
    { ...job, access: "x".repeat(1001) },
    { ...job, started: now + 1 },
    { ...job, started: now - 86_400_001 },
  ])
    expect(
      restoreWorksheetGlyphJob(JSON.stringify(invalid), now),
    ).toBeUndefined();
  expect(restoreWorksheetGlyphJob("malformed", now)).toBeUndefined();
  expect(restoreWorksheetGlyphJob(null, now)).toBeUndefined();
});
