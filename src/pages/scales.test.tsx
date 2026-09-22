import { expect, test } from "bun:test";
import { DEFAULT_POEM } from "../../shared/poem";
import { draftSource } from "../../shared/poem-drafts";
import {
  DEFAULT_SCALE_DESIGN,
  MAX_SCALE_DESIGN_BYTES,
} from "../../shared/scale-design";
import {
  DEFAULT_SCALE_SHAPE,
  LEGACY_SCALE_SHAPE,
} from "../../shared/scale-shape";
import { DEFAULT_SCALE_STUDY_SETTINGS } from "../../shared/scale-study";
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

test("retired 120×4 inset homepage drafts open on the close-set default plates", () => {
  const stored = initialScaleDraft(
    JSON.stringify({
      ...DEFAULT_SCALE_DESIGN,
      text: "Keep my wording.",
      notes: "Saved before tessellation",
      geometry: {
        ...DEFAULT_SCALE_DESIGN.geometry,
        columns: 120,
        rows: 4,
        gap: 0.12,
        variation: 0.6,
        plateShape: "clipped",
        plateFit: "inset",
        plateAspect: 1.3,
        cornerCut: 0.12,
        plateTaper: 0.12,
      },
    }),
  );
  expect(stored.saved).toBe(true);
  expect(stored.design.text).toBe("Keep my wording.");
  expect(stored.design.notes).toBe("Saved before tessellation");
  expect(stored.design.geometry.columns).toBe(
    DEFAULT_SCALE_STUDY_SETTINGS.columns,
  );
  expect(stored.design.geometry.rows).toBe(DEFAULT_SCALE_STUDY_SETTINGS.rows);
  expect(stored.design.geometry.gap).toBe(DEFAULT_SCALE_STUDY_SETTINGS.gap);
  expect(stored.design.geometry.variation).toBe(
    DEFAULT_SCALE_STUDY_SETTINGS.variation,
  );
  expect(stored.design.geometry.plateFit).toBe(DEFAULT_SCALE_SHAPE.plateFit);
  expect(stored.design.geometry.plateShape).toBe(
    DEFAULT_SCALE_SHAPE.plateShape,
  );
  expect(stored.design.geometry.plateAspect).toBe(
    DEFAULT_SCALE_SHAPE.plateAspect,
  );
});

test("archival original-plate drafts keep their 120×4 layout", () => {
  const stored = initialScaleDraft(
    JSON.stringify({
      ...DEFAULT_SCALE_DESIGN,
      text: "Archival wording stays.",
      geometry: {
        ...DEFAULT_SCALE_DESIGN.geometry,
        ...LEGACY_SCALE_SHAPE,
        columns: 120,
        rows: 4,
        gap: 0.12,
        variation: 0.6,
        relief: 0.65,
      },
    }),
  );
  expect(stored.design.text).toBe("Archival wording stays.");
  expect(stored.design.geometry.columns).toBe(120);
  expect(stored.design.geometry.rows).toBe(4);
  expect(stored.design.geometry.gap).toBe(0.12);
  expect(stored.design.geometry.plateShape).toBe("legacy");
});

test("unreadable and oversized browser drafts fall back to a fresh design", () => {
  for (const stored of ["{", "null", "x".repeat(MAX_SCALE_DESIGN_BYTES + 1)]) {
    const initial = initialScaleDraft(stored);
    expect(initial.saved).toBe(false);
    expect(initial.design).toBe(DEFAULT_SCALE_DESIGN);
  }
});
