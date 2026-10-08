import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  CALLIGRAPHY_KNOWLEDGE,
  selectCalligraphyKnowledge,
} from "./calligraphy-knowledge";
import { CALLIGRAPHY_LIBRARY } from "./calligraphy-library";

describe("calligraphy knowledge retrieval", () => {
  test("grounds font completion in SVG review and FontForge export guidance", () => {
    const generation = selectCalligraphyKnowledge(
      "Can VecGlypher propose missing glyphs from reference images?",
      2,
    );
    expect(generation[0]?.url).toBe("https://github.com/xk-huang/VecGlypher");

    const finishing = selectCalligraphyKnowledge(
      "How do I import SVG into FontForge and export TTF or OTF?",
      3,
    );
    expect(finishing.map(({ url }) => url)).toContain(
      "https://fontforge.org/docs/tutorial/importexample.html",
    );
    expect(finishing.map(({ url }) => url)).toContain(
      "https://fontforge.org/docs/ui/dialogs/generate.html",
    );
  });

  test("keeps ink compatibility questions with the manufacturer guidance", () => {
    const results = selectCalligraphyKnowledge(
      "Can I mix gold and silver drawing ink and save it?",
      3,
    );

    expect(results[0]?.id).toBe("drawing-ink-metallic-safety");
    expect(results.every((entry) => entry.topics.includes("ink"))).toBe(true);
  });

  test("prefers nib-width guidance for broad-edge sizing questions", () => {
    const results = selectCalligraphyKnowledge(
      "How should a broad-edge nib determine x-height and guide spacing?",
      2,
    );

    expect(results[0]?.id).toBe("broad-edge-nib-guides");
    expect(results[0]?.topics).toContain("nib");
  });

  test("returns bounded, stable starter guidance when no terms match", () => {
    const first = selectCalligraphyKnowledge("quasar nebula", 2);
    const second = selectCalligraphyKnowledge("quasar nebula", 2);

    expect(first).toEqual(second);
    expect(first).toHaveLength(2);
    expect(first.every((entry) => CALLIGRAPHY_KNOWLEDGE.includes(entry))).toBe(
      true,
    );
  });

  test("uses tradition boundaries when a question has no Latin lexical tokens", () => {
    for (const question of ["中国书法怎么练？", "كيف أتعلم الخط العربي؟"]) {
      const ids = selectCalligraphyKnowledge(question, 3).map(({ id }) => id);
      expect(ids[0]).toBe("script-tradition-boundaries");
      expect(ids).not.toContain("pointed-pen-pressure");
      expect(ids).not.toContain("broad-edge-nib-guides");
    }
  });

  test("normalizes Latin diacritics before lexical matching", () => {
    expect(
      selectCalligraphyKnowledge("späcing", 3).map(({ id }) => id),
    ).toContain("font-spacing-and-kerning");
  });

  test("caps callers to the retrieval ceiling", () => {
    expect(selectCalligraphyKnowledge("paper ink font nib", 500)).toHaveLength(
      8,
    );
    expect(selectCalligraphyKnowledge("paper", 0)).toEqual([]);
  });

  test("retrieves posture and layout guidance from the local library sources", () => {
    expect(
      selectCalligraphyKnowledge(
        "How should I arrange my desk, posture, paper, and writing level?",
        3,
      ).map(({ id }) => id),
    ).toContain("comfortable-writing-posture");

    expect(
      selectCalligraphyKnowledge(
        "How do I plan margins and columns for a manuscript page?",
        3,
      ).map(({ id }) => id),
    ).toContain("manuscript-page-proportions");
  });

  test("retrieves troubleshooting and historical-boundary guidance", () => {
    expect(
      selectCalligraphyKnowledge(
        "My broad nib catches fibres, the ink skips, and strokes have ragged edges",
        4,
      ).map(({ id }) => id),
    ).toContain("broad-nib-troubleshooting");

    expect(
      selectCalligraphyKnowledge(
        "Can I use a Latin italic worksheet to learn Arabic calligraphy?",
        3,
      ).map(({ id }) => id),
    ).toContain("script-tradition-boundaries");
  });

  test("publishes stable, downloadable public-domain library provenance", () => {
    expect(CALLIGRAPHY_LIBRARY).toHaveLength(2);

    for (const guide of CALLIGRAPHY_LIBRARY) {
      expect(guide.id).toMatch(/^[a-z0-9-]+$/);
      expect(guide.rights).toContain("Public domain in the USA");
      expect(guide.localFiles.length).toBeGreaterThan(0);
      expect(
        guide.localFiles.every(
          ({ href, mediaType, sha256 }) =>
            href.startsWith("/guide/library/") &&
            mediaType === "text/plain; charset=utf-8" &&
            /^[a-f0-9]{64}$/.test(sha256),
        ),
      ).toBe(true);
    }
  });

  test("matches every retained guide to its recorded content hash", async () => {
    for (const guide of CALLIGRAPHY_LIBRARY) {
      for (const file of guide.localFiles) {
        const bytes = await readFile(
          new URL(`../public${file.href}`, import.meta.url),
        );
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(
          file.sha256,
        );
      }
    }
  });
});
