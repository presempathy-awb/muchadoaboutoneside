import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { escapeXml, POEM_LINES, POEM_LOOP, POEM_TITLE } from "./poem";

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
