import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { DEFAULT_POEM, POEM_TITLE } from "./poem";
import {
  isCoatLine,
  POEM_PAGES,
  poemPageBySlug,
  poemPageDownloadUrl,
  poemPageText,
  poemWordCount,
} from "./poems";

test("the site lists one page per finished poem, the living poem first", () => {
  expect(POEM_PAGES.map((page) => page.slug)).toEqual([
    "much-ado-about-one-side",
    "right-side-out",
    "understudy",
    "turncoats",
  ]);
  for (const page of POEM_PAGES) expect(page.slug).toMatch(/^[a-z0-9-]+$/);
  const living = POEM_PAGES[0];
  expect(living?.title).toBe(POEM_TITLE);
  expect(living?.stanzas).toBe(DEFAULT_POEM.stanzas);
  expect(living?.sourceFile).toBe(DEFAULT_POEM.sourceFile);
});

test("every page carries its archival source text exactly", async () => {
  for (const page of POEM_PAGES) {
    const original = await Bun.file(
      resolve(import.meta.dir, "..", page.sourceFile),
    ).text();
    expect(original.startsWith(`${page.title}\n\n`)).toBe(true);
    const body = original.slice(page.title.length).trim();
    expect(body.replace(/\s+/g, " ")).toBe(
      poemPageText(page).replace(/\s+/g, " "),
    );
    if (page.slug !== "much-ado-about-one-side")
      expect(original).toBe(`${page.title}\n\n${poemPageText(page)}\n`);
  }
});

test("the two-voice poem keeps the coat's indentation and the others have none", () => {
  const turncoats = poemPageBySlug("turncoats");
  const coatLines = turncoats?.stanzas.flat().filter(isCoatLine) ?? [];
  expect(coatLines.length).toBeGreaterThan(20);
  expect(coatLines[0]).toBe("    Your inside. That's where I'm from,");
  expect(poemPageText(turncoats as NonNullable<typeof turncoats>)).toContain(
    "\n    Your inside.",
  );
  for (const slug of [
    "right-side-out",
    "understudy",
    "much-ado-about-one-side",
  ]) {
    const page = poemPageBySlug(slug);
    expect(page?.stanzas.flat().some(isCoatLine)).toBe(false);
  }
  expect(poemPageBySlug("first-draft")).toBeUndefined();
});

test("word counts and downloads come from the page text itself", () => {
  const page = poemPageBySlug("understudy");
  if (!page) throw new Error("understudy page missing");
  expect(poemWordCount(page)).toBe(
    poemPageText(page).split(/\s+/).filter(Boolean).length,
  );
  const url = poemPageDownloadUrl(page);
  expect(url.startsWith("data:text/plain;charset=utf-8,")).toBe(true);
  expect(decodeURIComponent(url.split(",")[1] ?? "")).toBe(
    `${page.title}\n\n${poemPageText(page)}\n`,
  );
  expect(page.textFileName).toBe("understudy.txt");
});

test("alternate endings are short and only where the notes give one", () => {
  for (const page of POEM_PAGES) {
    if (!page.alternateEnding) continue;
    expect(["right-side-out", "understudy"]).toContain(page.slug);
    expect(page.alternateEnding.lines.length).toBeLessThanOrEqual(4);
    expect(page.alternateEnding.replaces.length).toBeGreaterThan(0);
  }
  expect(poemPageBySlug("right-side-out")?.alternateEnding).toBeDefined();
  expect(poemPageBySlug("understudy")?.alternateEnding).toBeDefined();
  expect(poemPageBySlug("turncoats")?.alternateEnding).toBeUndefined();
});
