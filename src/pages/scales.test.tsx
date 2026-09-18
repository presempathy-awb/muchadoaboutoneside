import { expect, test } from "bun:test";
import { DEFAULT_POEM } from "../../shared/poem";
import { draftSource } from "../../shared/poem-drafts";
import {
  DEFAULT_SCALE_DESIGN,
  MAX_SCALE_DESIGN_BYTES,
} from "../../shared/scale-design";
import { initialScaleDraft, seedFreshScaleDraft } from "./scales";

test("a saved deliberately blank scale draft remains authoritative", () => {
  const stored = initialScaleDraft(
    JSON.stringify({
      ...DEFAULT_SCALE_DESIGN,
      text: "",
      notes: "Blank study kept on purpose",
    }),
  );
  expect(stored.saved).toBe(true);
  expect(stored.design.text).toBe("");
  expect(stored.design.notes).toBe("Blank study kept on purpose");
});

test("a fresh homepage draft uses the selected poem without changing geometry", () => {
  const initial = initialScaleDraft(null);
  expect(initial.saved).toBe(false);
  const seeded = seedFreshScaleDraft(
    initial.design,
    initial.design,
    DEFAULT_POEM,
  );
  expect(seeded.text).toBe(draftSource(DEFAULT_POEM));
  expect(seeded.geometry).toBe(initial.design.geometry);
  expect(seeded.layers).toBe(initial.design.layers);
  expect(DEFAULT_SCALE_DESIGN.text).toBe("");
});

test("fresh saved-poem wording and handwriting are kept exactly", () => {
  const initial = initialScaleDraft(null);
  const poem = {
    ...DEFAULT_POEM,
    sourceText: "  Two words\n\nwith a pause.  ",
    calligraphyScanId: "scan-selected",
  };
  const seeded = seedFreshScaleDraft(initial.design, initial.design, poem);
  expect(seeded.text).toBe(poem.sourceText);
  expect(seeded.calligraphyFaceId).toBe("scan-selected");
});

test("edits made before the poem library finishes opening are not replaced", () => {
  const initial = initialScaleDraft(null);
  const edited = {
    ...initial.design,
    text: "",
    notes: "An intentionally empty new idea",
  };
  expect(seedFreshScaleDraft(edited, initial.design, DEFAULT_POEM)).toBe(
    edited,
  );
});

test("unreadable and oversized browser drafts fall back to a fresh design", () => {
  for (const stored of ["{", "null", "x".repeat(MAX_SCALE_DESIGN_BYTES + 1)]) {
    const initial = initialScaleDraft(stored);
    expect(initial.saved).toBe(false);
    expect(initial.design).toBe(DEFAULT_SCALE_DESIGN);
  }
});
