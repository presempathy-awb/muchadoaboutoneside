import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { POEM_PAGES } from "../../shared/poems";
import PoemsIndex, { PoemPageView } from "./poems";

test("the poems index links to every finished poem", () => {
  const html = renderToStaticMarkup(createElement(PoemsIndex));
  for (const page of POEM_PAGES) {
    expect(html).toContain(page.title);
    expect(html).toContain(`href="/poems/${page.slug}"`);
  }
  expect(html).not.toContain("first draft");
});

test("a poem page renders the whole poem in reading order with its download", () => {
  const html = renderToStaticMarkup(
    createElement(PoemPageView, { slug: "turncoats" }),
  );
  expect(html).toContain("<h1>Turncoats</h1>");
  expect(html).toContain("Hold still.");
  expect(html).toContain("I&#x27;m the one on it now.");
  expect(html).toContain('class="poems-line poems-line-coat"');
  expect(html).toContain('download="turncoats.txt"');
  expect(html).toContain('href="/poems"');
  expect(html).not.toContain("Alternate ending");
});

test("the living poem page shows the site default wording and points to the editor", () => {
  const html = renderToStaticMarkup(
    createElement(PoemPageView, { slug: "much-ado-about-one-side" }),
  );
  expect(html).toContain("Come, palindove, let edges twine,");
  expect(html).toContain("the infinight, who draws them all.");
  expect(html).toContain('href="/poem"');
  expect(html).toContain('download="much-ado-about-one-side-extended.txt"');
});

test("an alternate ending appears only where one exists", () => {
  const html = renderToStaticMarkup(
    createElement(PoemPageView, { slug: "right-side-out" }),
  );
  expect(html).toContain("Alternate ending");
  expect(html).toContain("I know what we does.");
});

test("an unknown slug explains itself and links back to the list", () => {
  const html = renderToStaticMarkup(
    createElement(PoemPageView, { slug: "first-draft" }),
  );
  expect(html).toContain("Poem not found");
  expect(html).toContain('href="/poems"');
});
