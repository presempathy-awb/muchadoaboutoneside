import { describe, expect, test } from "bun:test";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PrintableGuide } from "./printable";
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
  });
});
