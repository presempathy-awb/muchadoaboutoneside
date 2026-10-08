import { describe, expect, test } from "bun:test";

import {
  CALLIGRAPHY_BOOK_CORPUS,
  selectCalligraphyBookKnowledge,
} from "./calligraphy-book-knowledge";

describe("calligraphy book knowledge", () => {
  test("finds an exact historical discussion that concise guidance cannot contain", () => {
    const results = selectCalligraphyBookKnowledge(
      "How do the shaft angle, cut nib, and paper tilt work together for horizontal thin strokes?",
      2,
    );

    expect(results[0]).toMatchObject({
      bookId: "johnston-writing-illuminating-lettering",
    });
    expect(results[0]?.sectionId).toMatch(/^formal-hand-(?:methods|models)$/);
    expect(results[0]?.text).toContain("thin strokes");
  });

  test("returns no generic excerpts for an unrelated query", () => {
    expect(selectCalligraphyBookKnowledge("quasar nebula orbit", 2)).toEqual(
      [],
    );
  });

  test("does not admit an incidental one-word hit for a multi-topic question", () => {
    expect(selectCalligraphyBookKnowledge("What ink should I mix?", 2)).toEqual(
      [],
    );
  });

  test("preserves focused one-topic searches", () => {
    const results = selectCalligraphyBookKnowledge("spacing", 1);

    expect(results).toHaveLength(1);
    expect(results[0]?.text.toLocaleLowerCase("en-US")).toContain("spacing");
  });

  test("keeps deterministic passages and a hard result ceiling", () => {
    const first = selectCalligraphyBookKnowledge(
      "letter spacing words lines margins manuscript practice",
      99,
    );
    const second = selectCalligraphyBookKnowledge(
      "letter spacing words lines margins manuscript practice",
      99,
    );

    expect(first).toEqual(second);
    expect(first.length).toBeLessThanOrEqual(2);
    expect(first.every(({ text }) => text.length <= 900)).toBe(true);
  });

  test("records exact source hashes and excludes recipe chapters", () => {
    expect(CALLIGRAPHY_BOOK_CORPUS.sources).toEqual([
      {
        bookId: "johnston-writing-illuminating-lettering",
        sha256:
          "686f9e448be1c627985f669ce153ac89f902021e2ddd1f9d2a23ce6a1ac91e5e",
      },
      {
        bookId: "palmer-method-business-writing",
        sha256:
          "dab0e10710659b723371dc8ae880f7820afdf17eccb062a463f877f6ad3f7f8b",
      },
    ]);
    expect(
      CALLIGRAPHY_BOOK_CORPUS.passages.some(({ sectionId }) =>
        ["gilding", "gold-colours", "binding"].includes(sectionId),
      ),
    ).toBe(false);
    const hazardousTerm =
      /(?:^|[^a-z0-9])(?:ammonia|arsenic|burnish(?:ed|ing)?|corrosive|formalin|gilding|gold[- ]leaf|lead white|mercury|nitric|poison(?:ous)?|scalpel|sulphuric)(?=$|[^a-z0-9])/i;
    expect(
      CALLIGRAPHY_BOOK_CORPUS.passages.some(({ text }) =>
        hazardousTerm.test(text),
      ),
    ).toBe(false);
  });
});
