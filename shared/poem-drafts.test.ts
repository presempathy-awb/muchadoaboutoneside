import { expect, test } from "bun:test";
import * as Y from "yjs";
import { CANONICAL_POEM, POEM_VERSIONS, poemVersionById } from "./poem";
import {
  applyDraft,
  DRAFT_TEXT_NAME,
  draftRoom,
  draftSource,
  parseDraft,
  seedUpdate,
  versionIdForRoom,
} from "./poem-drafts";

test("the draft text round-trips every fixed wording", () => {
  for (const version of POEM_VERSIONS) {
    const parsed = parseDraft(draftSource(version));
    expect(parsed.stanzas).toEqual(version.stanzas.map((s) => [...s]));
    expect(parsed.loop).toBe(version.loop);
    expect(applyDraft(version, draftSource(version))).toBe(version);
    expect(versionIdForRoom(draftRoom(version.id))).toBe(version.id);
  }
  expect(versionIdForRoom("poem-missing")).toBeUndefined();
  expect(versionIdForRoom("other-canonical")).toBeUndefined();
});

test("parsing tolerates Windows line endings, stray spaces, and extra blank lines", () => {
  const parsed = parseDraft("  One  two \r\n\r\n\r\nthree\r\n four \n\n");
  expect(parsed.stanzas).toEqual([["One two"], ["three", "four"]]);
  expect(parsed.loop).toBe("One two  three  four");
});

test("seeds are identical bytes on every peer and merge without duplicating", () => {
  const first = seedUpdate(CANONICAL_POEM);
  const second = seedUpdate(CANONICAL_POEM);
  expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);

  const docA = new Y.Doc();
  Y.applyUpdate(docA, first);
  const docB = new Y.Doc();
  Y.applyUpdate(docB, second);
  docB.getText(DRAFT_TEXT_NAME).insert(0, "X");
  Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB));
  expect(docA.getText(DRAFT_TEXT_NAME).toString()).toBe(
    `X${draftSource(CANONICAL_POEM)}`,
  );
  Y.applyUpdate(docA, first);
  expect(docA.getText(DRAFT_TEXT_NAME).toString()).toBe(
    `X${draftSource(CANONICAL_POEM)}`,
  );
  expect(
    Buffer.from(seedUpdate(poemVersionById("extended"))).equals(
      Buffer.from(first),
    ),
  ).toBe(false);
});

test("an edited draft becomes a preview wording without fabrication artwork", () => {
  const edited = draftSource(CANONICAL_POEM).replace("twine;", "twine,");
  const drafted = applyDraft(CANONICAL_POEM, edited);
  expect(drafted).not.toBe(CANONICAL_POEM);
  expect(drafted.id).toBe("canonical");
  expect(drafted.draft).toBe(true);
  expect(drafted.fabricationArtwork).toBe(false);
  expect(drafted.label).toBe("Canonical draft");
  expect(drafted.lines[0]).toBe("Come, palindove, let edges twine,");
  expect(drafted.lines).toHaveLength(CANONICAL_POEM.lines.length);
  expect(drafted.textPath).toBe(CANONICAL_POEM.textPath);
  expect(CANONICAL_POEM.draft).toBeUndefined();
});
