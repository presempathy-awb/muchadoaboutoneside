import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CopperplateMaker } from "../src/components/calligraphy/copperplate-maker";
import { createSheetLayout, DEFAULT_SHEET_SETTINGS } from "./copperplate-sheet";

test("the initial maker previews the same 24 horizontal rules as the PDF layout", () => {
  const html = renderToStaticMarkup(<CopperplateMaker />);
  const layout = createSheetLayout(DEFAULT_SHEET_SETTINGS);
  const lines = [...html.matchAll(/<line\s[^>]+>/g)].map((match) => match[0]);
  expect(lines).toHaveLength(24);
  for (const [index, line] of lines.entries()) {
    expect(line).toContain(`x1="${layout.x1Mm}"`);
    expect(line).toContain(`x2="${layout.x2Mm}"`);
    expect(line).toContain(`y1="${layout.lineYsMm[index]}"`);
    expect(line).toContain(`y2="${layout.lineYsMm[index]}"`);
  }
  expect(html).toContain('viewBox="0 0 279.4 215.9"');
  expect(html).toContain("24 lines · 8.28 mm apart");
  expect(html).toContain("Download PDF");
  expect(html).not.toContain("disabled");
  for (const control of [
    "lines",
    "paper",
    "orientation",
    "margin",
    "weight",
    "darkness",
  ]) {
    expect(html).toContain(`for="copperplate-${control}"`);
    expect(html).toContain(`id="copperplate-${control}"`);
  }
});
