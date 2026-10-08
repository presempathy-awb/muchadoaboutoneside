import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CalligraphyWorkflow } from "./calligraphy-workflow";

test("workflow navigation stays available before the optional map renderer loads", () => {
  const html = renderToStaticMarkup(
    <CalligraphyWorkflow
      onSelect={() => undefined}
      onStartJourney={() => undefined}
    />,
  );
  expect(html).toContain("Loading the interactive map");
  expect(html).toContain("Follow this path");
  expect(html).toContain('aria-label="Open a path tool"');
  expect(html).toContain("Paper");
  expect(html).toContain("Download Mermaid");
});
