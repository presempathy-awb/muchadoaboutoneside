import {
  DEFAULT_POEM_VERSION_ID,
  isPoemId,
  isPoemVersionId,
  isSavedPoemId,
  POEM_TITLE,
  type PoemId,
  type PoemVersion,
  poemTextDownloadUrl,
  type SavedPoemId,
} from "./poem";
import { parseDraft } from "./poem-drafts";
import { loopWidthEm } from "./script-metrics";

export const MAX_POEM_TEXT_LENGTH = 20_000;
export const MAX_POEM_NAME_LENGTH = 80;

export interface SavePoemVersionInput {
  name: string;
  text: string;
  baseId?: PoemId;
  calligrapher?: string;
  calligraphyScanId?: string;
}

export interface SavedPoemRecord {
  readonly version: 1;
  readonly id: SavedPoemId;
  readonly name: string;
  readonly text: string;
  readonly baseId: PoemId;
  readonly createdAt: string;
  readonly calligrapher?: string;
  readonly calligraphyScanId?: string;
}

/** Used by both the form and the unique browser-storage index. */
export function poemNameKey(name: string): string {
  return name.trim().normalize("NFKC").toLowerCase();
}

export function poemVersionSaveError(
  input: SavePoemVersionInput,
  versions: readonly PoemVersion[],
  selectedBase?: PoemVersion,
): string | undefined {
  const name = input.name.trim();
  if (!name) return "Give this version a new name before saving.";
  if (name.length > MAX_POEM_NAME_LENGTH)
    return `Version names must be ${MAX_POEM_NAME_LENGTH} characters or fewer.`;
  const base =
    selectedBase ?? versions.find((item) => item.id === input.baseId);
  if (base && poemNameKey(name) === poemNameKey(base.label))
    return "Change the selected version’s name before saving a copy.";
  if (versions.some((item) => poemNameKey(item.label) === poemNameKey(name)))
    return "That version name already exists. Choose a unique name.";
  if (input.text.length > MAX_POEM_TEXT_LENGTH)
    return "Poem text must be 20,000 characters or fewer.";
  if (input.calligrapher && input.calligrapher.trim().length > 80)
    return "The calligrapher’s name must be 80 characters or fewer.";
  if (
    input.calligraphyScanId !== undefined &&
    (input.calligraphyScanId.length > 160 ||
      !/^scan-[a-zA-Z0-9_-]+$/.test(input.calligraphyScanId))
  )
    return "The linked calligraphy scan identifier is invalid.";
  return undefined;
}

export function assertDeletablePoemId(id: string): asserts id is SavedPoemId {
  if (isPoemVersionId(id))
    throw new Error("The Canonical and Extended originals cannot be deleted.");
  if (!isSavedPoemId(id)) throw new Error("Unknown saved poem version.");
}

export function parseSavedPoemRecord(input: unknown): SavedPoemRecord {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("A saved poem version must be an object.");
  const value = input as Record<string, unknown>;
  if (value.version !== 1 || !isSavedPoemId(value.id))
    throw new Error("This saved poem version has an unsupported format.");
  if (
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.trim().length > MAX_POEM_NAME_LENGTH ||
    typeof value.text !== "string" ||
    value.text.length > MAX_POEM_TEXT_LENGTH ||
    !isPoemId(value.baseId) ||
    typeof value.createdAt !== "string" ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    (value.calligraphyScanId !== undefined &&
      (typeof value.calligraphyScanId !== "string" ||
        value.calligraphyScanId.length > 160 ||
        !/^scan-[a-zA-Z0-9_-]+$/.test(value.calligraphyScanId))) ||
    (value.calligrapher !== undefined &&
      (typeof value.calligrapher !== "string" ||
        value.calligrapher.trim().length > 80))
  )
    throw new Error(
      "This saved poem version contains invalid text or metadata.",
    );
  const calligrapher =
    typeof value.calligrapher === "string" ? value.calligrapher.trim() : "";
  return Object.freeze({
    version: 1,
    id: value.id,
    name: value.name.trim(),
    text: value.text,
    baseId: value.baseId,
    createdAt: value.createdAt,
    ...(calligrapher ? { calligrapher } : {}),
    ...(typeof value.calligraphyScanId === "string"
      ? { calligraphyScanId: value.calligraphyScanId }
      : {}),
  });
}

export function createSavedPoemRecord(
  input: SavePoemVersionInput,
  versions: readonly PoemVersion[],
  id: SavedPoemId,
  createdAt: string,
): SavedPoemRecord {
  const error = poemVersionSaveError(input, versions);
  if (error) throw new Error(error);
  const baseId = input.baseId ?? DEFAULT_POEM_VERSION_ID;
  if (!versions.some((item) => item.id === baseId))
    throw new Error("The selected poem version is no longer available.");
  return parseSavedPoemRecord({ ...input, version: 1, id, baseId, createdAt });
}

export function savedPoemVersion(record: SavedPoemRecord): PoemVersion {
  const saved = parseSavedPoemRecord(record);
  const parsed = parseDraft(saved.text);
  const stanzas = Object.freeze(
    parsed.stanzas.map((stanza) => Object.freeze([...stanza])),
  );
  return Object.freeze({
    id: saved.id,
    label: saved.name,
    title: POEM_TITLE,
    summary: `A named wording saved privately in this browser${saved.calligrapher ? ` · calligrapher: ${saved.calligrapher}` : ""}.`,
    stanzas,
    lines: Object.freeze([...parsed.lines]),
    loop: parsed.loop,
    loopNote: "This saved wording is shown in the live previews.",
    sourceText: saved.text,
    sourceFile: "",
    textPath: poemTextDownloadUrl(saved.text),
    studyPath: "",
    scriptPdfPath: "",
    guidePdfPath: "",
    guideHtmlPath: "",
    guideVersion: "Saved browser wording",
    loopWidthEm: loopWidthEm(parsed.lines),
    fabricationArtwork: false,
    saved: true,
    savedAt: saved.createdAt,
    ...(saved.calligrapher ? { calligrapher: saved.calligrapher } : {}),
    ...(saved.calligraphyScanId
      ? { calligraphyScanId: saved.calligraphyScanId }
      : {}),
  });
}
