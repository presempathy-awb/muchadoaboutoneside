import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { surfaceLimitEm } from "../../shared/inscription-layout";
import PoemEditor from "./poem";

test("the editor page renders its version controls, surface budget, and limits on the server", () => {
  const html = renderToStaticMarkup(createElement(PoemEditor));
  expect(html).toContain("Load poem version");
  expect(html).not.toContain("Load selected wording");
  expect(html).toContain("Save version");
  expect(html).toContain("Delete version");
  expect(html).toContain("Import calligraphy scan");
  expect(html).toContain("Canonical");
  expect(html).toContain("Extended");
  expect(html).toContain("Surface budget");
  expect(html).toContain(`${Math.round(surfaceLimitEm("jaw"))} em (jaw limit)`);
  expect(html).toContain("Large body");
  expect(html).toContain("180 mm maquette");
  expect(html).toContain("<meter");
  expect(html).toContain("Opening your draft");
  expect(html).not.toContain("<form");
});
