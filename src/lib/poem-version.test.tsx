import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PoemVersionPicker } from "@/components/poem-version-picker";
import { PoemVersionProvider, usePoemVersion } from "./poem-version";

function VersionLabel() {
  const { version } = usePoemVersion();
  return createElement("span", null, `${version.id}:${version.lines.length}`);
}

test("the canonical poem is selected by default, with and without a provider", () => {
  expect(renderToStaticMarkup(createElement(VersionLabel))).toBe(
    "<span>canonical:17</span>",
  );
  const markup = renderToStaticMarkup(
    createElement(
      PoemVersionProvider,
      null,
      createElement(VersionLabel),
      createElement(PoemVersionPicker),
    ),
  );
  expect(markup).toContain("<span>canonical:17</span>");
  expect(markup).toContain('<option value="canonical" selected="">');
  expect(markup).toContain('<option value="extended">Extended · 40 lines');
});
