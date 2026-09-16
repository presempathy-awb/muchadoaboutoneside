import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Instructions from "../src/pages/instructions";
import { poemVersionById } from "./poem";
import {
  HANDOFF_CHECKLIST,
  INSTRUCTION_SECTIONS,
  PACKING_GROUPS,
  PROJECT_PATHS,
  projectPaths,
} from "./project-instructions";

describe("project instructions", () => {
  test("defines the required page anchors once and in workflow order", () => {
    expect(INSTRUCTION_SECTIONS.map((section) => section.id)).toEqual([
      "dimensions",
      "make",
      "large-sculpture",
      "pack",
      "send",
    ]);
    expect(
      new Set(INSTRUCTION_SECTIONS.map((section) => section.id)).size,
    ).toBe(5);
  });

  test("keeps the three production paths separate and downloadable", () => {
    expect(PROJECT_PATHS).toHaveLength(3);
    expect(PROJECT_PATHS.map((path) => path.title)).toEqual([
      "Letter the poem",
      "Build the 180 mm study",
      "Fit aluminum to the large wood sculpture",
    ]);
    for (const path of PROJECT_PATHS) {
      expect(path.downloads.length).toBeGreaterThan(0);
      for (const download of path.downloads)
        expect(download.href).toStartWith("/");
    }
  });

  test("lettering downloads follow the chosen poem version", () => {
    const canonical = projectPaths(poemVersionById("canonical"));
    expect(canonical.map((path) => path.title)).toEqual(
      PROJECT_PATHS.map((path) => path.title),
    );
    const hrefs = canonical[0]?.downloads.map((download) => download.href);
    expect(hrefs).toContain("/guide/calligraphy-guide.pdf");
    expect(hrefs).toContain("/editions/much-ado-about-one-side.txt");
    // The default paths carry the extended wording.
    expect(PROJECT_PATHS[0]?.downloads.map((d) => d.href)).toContain(
      "/guide/calligraphy-guide-extended.pdf",
    );
    expect(canonical.slice(1)).toEqual(PROJECT_PATHS.slice(1));
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
    expect(html).toContain('href="/guide/calligraphy-guide-extended.pdf"');
    expect(html).toContain(
      'href="/fabrication/print/muchado-maquette-180mm.stl"',
    );
    expect(html).toContain("Complete 180 mm foil kit");
    expect(html).toContain("Full-scale conceptual panel kit");
    expect(html).toContain('id="instructions-print"');
    expect(html).toContain("Print packing slip");
    expect(html).toContain('download="iani-large-wood-aluminum.txt"');
    expect(html).not.toContain("<form");
  });
});
