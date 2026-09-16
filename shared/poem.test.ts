import { expect, test } from "bun:test";
import { resolve } from "node:path";
import {
  CANONICAL_POEM,
  DEFAULT_POEM_VERSION_ID,
  escapeXml,
  isPoemVersionId,
  POEM_LINES,
  POEM_LOOP,
  POEM_TITLE,
  POEM_VERSIONS,
  poemVersionById,
} from "./poem";

test("the inscription preserves Andrew’s complete poem and circular ending", async () => {
  const original = await Bun.file(
    resolve(import.meta.dir, "../source/poem/much-ado-about-one-side.txt"),
  ).text();
  const normalizedSource = original
    .slice(POEM_TITLE.length)
    .trim()
    .replace(/\s+/g, " ");
  expect(POEM_LOOP.replace(/\s+/g, " ")).toBe(normalizedSource);
  expect(POEM_LINES).toHaveLength(17);
  expect(POEM_LINES[0]).toBe("Come, palindove, let edges twine;");
  expect(POEM_LINES.at(-1)).toBe("come, palindove, let edges twine…");
});

test("poem text is escaped before insertion into a vector document", () => {
  expect(escapeXml(`<foil & "ink">'`)).toBe(
    "&lt;foil &amp; &quot;ink&quot;&gt;&apos;",
  );
});

test("every poem version matches its archival source text and shares the loop shape", async () => {
  expect(POEM_VERSIONS.map((version) => version.id)).toEqual([
    "canonical",
    "extended",
  ]);
  for (const version of POEM_VERSIONS) {
    const original = await Bun.file(
      resolve(import.meta.dir, "..", version.sourceFile),
    ).text();
    expect(original.startsWith(version.title)).toBe(true);
    const normalizedSource = original
      .slice(version.title.length)
      .trim()
      .replace(/\s+/g, " ");
    expect(version.loop.replace(/\s+/g, " ")).toBe(normalizedSource);
    expect(version.lines).toEqual(version.stanzas.flat());
    expect(version.loop).toBe(version.lines.join("  "));
    expect(version.lines[0]?.toLowerCase().startsWith("come, palindove")).toBe(
      true,
    );
    expect(version.lines.at(-1)?.startsWith("come, palindove")).toBe(true);
    for (const path of [
      version.textPath,
      version.studyPath,
      version.scriptPdfPath,
      version.guidePdfPath,
      version.guideHtmlPath,
    ])
      expect(path).toStartWith("/");
  }
  const paths = POEM_VERSIONS.flatMap((version) => [
    version.textPath,
    version.studyPath,
    version.scriptPdfPath,
    version.guidePdfPath,
    version.guideHtmlPath,
  ]);
  expect(new Set(paths).size).toBe(paths.length);
});

test("the canonical wording stays the default and lookups fall back to it", () => {
  expect(DEFAULT_POEM_VERSION_ID).toBe("canonical");
  expect(CANONICAL_POEM.lines).toEqual([...POEM_LINES]);
  expect(CANONICAL_POEM.fabricationArtwork).toBe(true);
  expect(poemVersionById("extended").lines).toHaveLength(40);
  expect(poemVersionById("extended").fabricationArtwork).toBe(false);
  expect(poemVersionById("missing").id).toBe("canonical");
  expect(poemVersionById(undefined).id).toBe("canonical");
  expect(isPoemVersionId("extended")).toBe(true);
  expect(isPoemVersionId("Extended")).toBe(false);
});
