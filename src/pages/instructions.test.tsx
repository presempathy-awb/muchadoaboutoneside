import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { savedPoemVersion } from "../../shared/poem-library";
import { projectPaths } from "../../shared/project-instructions";
import { InstructionDownloads } from "./instructions";

test("a saved wording offers its own text without links to unavailable generated artwork", () => {
  const version = savedPoemVersion({
    version: 1,
    id: "saved-local-test",
    name: "Jill’s copy",
    text: "My exact words\n\nAnother line",
    baseId: "extended",
    createdAt: "2026-09-18T12:00:00.000Z",
  });
  const lettering = projectPaths(version)[0];
  expect(lettering).toBeDefined();
  const html = renderToStaticMarkup(
    createElement(InstructionDownloads, {
      downloads: lettering?.downloads ?? [],
    }),
  );
  expect(html).toContain("Jill’s copy poem text");
  expect(html).toContain("data:text/plain");
  expect(html).not.toContain('href=""');
  expect(html).not.toContain("Printable lettering guide");
  expect(html).not.toContain("Print-ready web guide");
  expect(html).not.toContain(".pdf");
});
