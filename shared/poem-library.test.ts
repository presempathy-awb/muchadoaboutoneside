import { describe, expect, test } from "bun:test";
import {
  CANONICAL_POEM,
  isPoemVersionId,
  POEM_VERSIONS,
  poemTextDownloadUrl,
} from "./poem";
import {
  applyDraft,
  draftRoom,
  draftSource,
  versionIdForRoom,
} from "./poem-drafts";
import {
  assertDeletablePoemId,
  createSavedPoemRecord,
  parseSavedPoemRecord,
  poemNameKey,
  poemVersionSaveError,
  savedPoemVersion,
} from "./poem-library";

const createdAt = "2026-09-18T12:00:00.000Z";
const input = {
  name: "Jill’s reading",
  text: "  First line\nsecond line\n\n\nLast line  \n",
  baseId: "canonical" as const,
};

describe("named poem versions", () => {
  test("preserves exact source formatting in immutable snapshots and draft seeds", () => {
    const record = createSavedPoemRecord(
      { ...input, calligrapher: " Jill " },
      POEM_VERSIONS,
      "saved-one",
      createdAt,
    );
    const version = savedPoemVersion(record);
    expect(record.calligrapher).toBe("Jill");
    expect(Object.isFrozen(record)).toBe(true);
    expect(Object.isFrozen(version)).toBe(true);
    expect(Object.isFrozen(version.stanzas[0])).toBe(true);
    expect(draftSource(version)).toBe(input.text);
    expect(applyDraft(version, input.text)).toBe(version);
    const changed = applyDraft(version, input.text.replace("\n\n\n", "\n\n"));
    expect(changed.draft).toBe(true);
    expect(draftSource(changed)).toBe(input.text.replace("\n\n\n", "\n\n"));
    expect(record.text).toBe(input.text);
  });

  test("requires a changed unique trimmed case-insensitive name, not changed words", () => {
    expect(
      poemVersionSaveError({ ...input, name: "  CANONICAL  " }, POEM_VERSIONS),
    ).toContain("Change");
    expect(
      poemVersionSaveError({ ...input, name: "extended" }, POEM_VERSIONS),
    ).toContain("already exists");
    expect(
      poemVersionSaveError({ ...input, name: " " }, POEM_VERSIONS),
    ).toContain("new name");
    expect(
      poemVersionSaveError({ ...input, name: "x".repeat(81) }, POEM_VERSIONS),
    ).toContain("80");
    const sameWords = createSavedPoemRecord(
      { ...input, text: draftSource(CANONICAL_POEM) },
      POEM_VERSIONS,
      "saved-copy",
      createdAt,
    );
    expect(sameWords.text).toBe(draftSource(CANONICAL_POEM));
    const versions = [...POEM_VERSIONS, savedPoemVersion(sameWords)];
    expect(
      poemVersionSaveError({ ...input, name: " JILL’S READING " }, versions),
    ).toContain("already exists");
    expect(poemNameKey(" ＣＡＮＯＮＩＣＡＬ ")).toBe("canonical");
  });

  test("bounds untrusted stored text and metadata and refuses original ids", () => {
    const record = createSavedPoemRecord(
      input,
      POEM_VERSIONS,
      "saved-one",
      createdAt,
    );
    expect(() => parseSavedPoemRecord({ ...record, id: "canonical" })).toThrow(
      "unsupported",
    );
    expect(() =>
      parseSavedPoemRecord({ ...record, text: "x".repeat(20_001) }),
    ).toThrow("invalid");
    expect(() => parseSavedPoemRecord({ ...record, calligrapher: 1 })).toThrow(
      "invalid",
    );
    expect(() =>
      parseSavedPoemRecord({ ...record, baseId: "../../other" }),
    ).toThrow("invalid");
    expect(() =>
      parseSavedPoemRecord({ ...record, createdAt: "not a date" }),
    ).toThrow("invalid");
    for (const original of POEM_VERSIONS)
      expect(() => assertDeletablePoemId(original.id)).toThrow(
        "cannot be deleted",
      );
    expect(() => assertDeletablePoemId("saved-one")).not.toThrow();
  });

  test("never exposes private ids as public collaboration rooms or static artwork", () => {
    const version = savedPoemVersion(
      createSavedPoemRecord(input, POEM_VERSIONS, "saved-one", createdAt),
    );
    expect(isPoemVersionId(version.id)).toBe(false);
    expect(draftRoom(version.id)).toBe("private-poem-saved-one");
    expect(versionIdForRoom(draftRoom(version.id))).toBeUndefined();
    expect(versionIdForRoom(`poem-${version.id}`)).toBeUndefined();
    expect(version.fabricationArtwork).toBe(false);
    expect([
      version.studyPath,
      version.scriptPdfPath,
      version.guidePdfPath,
      version.guideHtmlPath,
    ]).toEqual(["", "", "", ""]);
    expect(version.textPath.startsWith("data:text/plain;charset=utf-8,")).toBe(
      true,
    );
    expect(decodeURIComponent(version.textPath.split(",")[1] ?? "")).toContain(
      input.text,
    );
  });

  test("generated text downloads preserve Unicode while repairing malformed input", () => {
    const uri = poemTextDownloadUrl("A dove 🕊 and a lone surrogate \uD800");
    expect(decodeURIComponent(uri.slice(uri.indexOf(",") + 1))).toContain(
      "A dove 🕊 and a lone surrogate �",
    );
  });

  test("keeps a specific scan association and rejects reserved or unsafe scan ids", () => {
    const record = createSavedPoemRecord(
      { ...input, calligraphyScanId: "scan-jill-one" },
      POEM_VERSIONS,
      "saved-linked",
      createdAt,
    );
    expect(savedPoemVersion(record).calligraphyScanId).toBe("scan-jill-one");
    for (const calligraphyScanId of [
      "auto",
      "font",
      "../scan-one",
      "scan-",
      `scan-${"x".repeat(156)}`,
    ]) {
      expect(() =>
        parseSavedPoemRecord({ ...record, calligraphyScanId }),
      ).toThrow("invalid");
      expect(
        poemVersionSaveError({ ...input, calligraphyScanId }, POEM_VERSIONS),
      ).toContain("identifier");
    }
  });
});
