import { describe, expect, test } from "bun:test";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { guideForVersion } from "../../../shared/calligraphy-guide";
import { poemVersionById } from "../../../shared/poem";
import { GuideProvider } from "./guide-context";
import { PrintableGuide, PrintablePoemSheet } from "./printable";
import {
  BlankSheet,
  FreeSheet,
  HardWordsSheet,
  MasterSheets,
  ProportionsFigure,
  RibbonWorkingFigure,
  StyleSampleSheet,
} from "./templates";

function assertUniqueLocalClipReferences(markup: string) {
  const ids = [...markup.matchAll(/<clipPath id="([^"]+)"/g)].map(
    (match) => match[1],
  );
  const references = [...markup.matchAll(/clip-path="url\(#([^)]+)\)"/g)].map(
    (match) => match[1],
  );

  expect(ids.length).toBeGreaterThan(0);
  expect(new Set(ids).size).toBe(ids.length);
  expect(references).toHaveLength(ids.length);
  for (const reference of references) {
    expect(ids.filter((id) => id === reference)).toHaveLength(1);
  }

  const svgs = [...markup.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map(
    (match) => match[0],
  );
  expect(svgs.length).toBeGreaterThan(0);
  for (const svg of svgs) {
    const localIds = [...svg.matchAll(/<clipPath id="([^"]+)"/g)].map(
      (match) => match[1],
    );
    const localReferences = [
      ...svg.matchAll(/clip-path="url\(#([^)]+)\)"/g),
    ].map((match) => match[1]);
    for (const reference of localReferences) {
      expect(localIds).toContain(reference);
    }
  }
}

describe("calligraphy template SVG references", () => {
  test("every sheet and figure owns unique, local clip-path IDs", () => {
    const templates: ReactNode[] = [
      createElement(BlankSheet, { key: "blank" }),
      createElement(FreeSheet, { key: "free" }),
      createElement(MasterSheets, { key: "masters" }),
      createElement(StyleSampleSheet, { key: "style" }),
      createElement(HardWordsSheet, { key: "words" }),
      createElement(ProportionsFigure, { key: "proportions" }),
      createElement(RibbonWorkingFigure, { key: "working" }),
    ];
    const markup = renderToStaticMarkup(
      createElement(Fragment, null, templates),
    );

    assertUniqueLocalClipReferences(markup);
  });

  test("the complete printable guide has no cross-sheet clip-path collisions", () => {
    const markup = renderToStaticMarkup(
      createElement(PrintableGuide, { css: "", fontUrl: "font.ttf" }),
    );

    assertUniqueLocalClipReferences(markup);
    expect(markup).toContain("Master sheet 8 of 8");
    expect(markup).toContain("revision 2 · 2026-09-14");
  });

  test("the extended wording's printable guide renders its own sheets", () => {
    const extended = poemVersionById("extended");
    const markup = renderToStaticMarkup(
      createElement(PrintableGuide, {
        css: "",
        fontUrl: "font.ttf",
        version: extended,
      }),
    );

    assertUniqueLocalClipReferences(markup);
    expect(markup).toContain("Master sheet 16 of 16");
    expect(markup).toContain("R40 · come, palindove, let edges twine");
    expect(markup).toContain("(EXTENDED) · HARD WORDS");
    expect(markup).toContain("ouroborrows");
    expect(markup).toContain("calligraphy?poem=extended");
    expect(markup).not.toContain("twine…");
  });

  test("sheets rendered inside a provider follow that wording", () => {
    const guide = guideForVersion(poemVersionById("extended"));
    const markup = renderToStaticMarkup(
      createElement(
        GuideProvider,
        { guide },
        createElement(MasterSheets),
        createElement(HardWordsSheet),
      ),
    );

    assertUniqueLocalClipReferences(markup);
    expect(markup).toContain("R35a · Onesided. Hold.");
    expect(markup).toContain("R35b · The strip shrugs, Fine,");
    expect(markup).toContain("tigerstripes icering Onesided eightwise");
  });

  test("the poem sheet sets every line of each wording", () => {
    for (const id of ["canonical", "extended"] as const) {
      const version = poemVersionById(id);
      const markup = renderToStaticMarkup(
        createElement(PrintablePoemSheet, { fontUrl: "font.ttf", version }),
      );
      for (const line of version.lines)
        expect(markup).toContain(line.replaceAll("'", "&#x27;"));
      expect(markup).toContain(version.loopNote);
      expect(markup).toContain("Great Vibes");
      expect(markup.includes('class="sheet-poem is-columns"')).toBe(
        version.lines.length > 24,
      );
    }
  });
});
