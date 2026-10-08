import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CalligraphyKnowledgeLibrary } from "./calligraphy-knowledge-library";

test("the guide library exposes searchable assistant notes and downloadable source editions", () => {
  const html = renderToStaticMarkup(<CalligraphyKnowledgeLibrary />);
  expect(html).toContain('type="search"');
  expect(html).toContain("Knowledge &amp; guides");
  expect(html).toContain("Writing &amp; Illuminating, &amp; Lettering");
  expect(html).toContain("download=");
  expect(html).toContain("Studio chat");
  expect(html).toContain('aria-label="Knowledge pages"');
  expect(html).not.toContain("<iframe");
});
