import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Instructions from "../src/pages/instructions";
import {
  HANDOFF_CHECKLIST,
  INSTRUCTION_SECTIONS,
  PACKING_GROUPS,
  PROJECT_PATHS,
} from "./project-instructions";

describe("project instructions", () => {
  test("defines the required page anchors once and in workflow order", () => {
    expect(INSTRUCTION_SECTIONS.map((section) => section.id)).toEqual([
      "dimensions",
      "make",
      "pack",
      "send",
    ]);
    expect(
      new Set(INSTRUCTION_SECTIONS.map((section) => section.id)).size,
    ).toBe(4);
  });

  test("keeps the three production paths separate and downloadable", () => {
    expect(PROJECT_PATHS).toHaveLength(3);
    expect(PROJECT_PATHS.map((path) => path.title)).toEqual([
      "Letter the poem",
      "Build the 180 mm study",
      "Study the full-scale surface",
    ]);
    for (const path of PROJECT_PATHS) {
      expect(path.downloads.length).toBeGreaterThan(0);
      for (const download of path.downloads)
        expect(download.href).toStartWith("/");
    }
  });

  test("retains the material-specific packing constraints", () => {
    const packing = JSON.stringify(PACKING_GROUPS).toLowerCase();
    expect(packing).toContain("no tape");
    expect(packing).toContain("do not fold");
    expect(packing).toContain("jaw or tail");

    const checklist = HANDOFF_CHECKLIST.join(" ").toLowerCase();
    expect(checklist).toContain("confirmed colab iani mailing address");
    expect(checklist).toContain("after all padding");
  });

  test("renders required anchors, downloads, and client-only print action", () => {
    const html = renderToStaticMarkup(createElement(Instructions));

    for (const section of INSTRUCTION_SECTIONS)
      expect(html).toContain(`id="${section.id}"`);
    expect(html).toContain('href="/guide/calligraphy-guide.pdf"');
    expect(html).toContain(
      'href="/fabrication/print/muchado-maquette-180mm.stl"',
    );
    expect(html).toContain("Complete 180 mm foil kit");
    expect(html).toContain("Full-scale conceptual panel kit");
    expect(html).toContain('id="instructions-print"');
    expect(html).toContain("Print packing slip");
    expect(html).not.toContain("<form");
  });
});
