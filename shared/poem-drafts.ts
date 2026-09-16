/**
 * Editable drafts of the poem: the plain-text form the editor works on, the
 * deterministic seed every browser and the sync server start from, and the
 * derived wording the rest of the site previews while a draft differs.
 */
import * as Y from "yjs";
import { isPoemVersionId, type PoemVersion, type PoemVersionId } from "./poem";
import { loopWidthEm } from "./script-metrics";

export const DRAFT_TEXT_NAME = "poem";
const ROOM_PREFIX = "poem-";
/** Every seed is written by this client id, so identical seeds merge as one. */
const SEED_CLIENT_ID = 1;

export function draftRoom(id: PoemVersionId) {
  return `${ROOM_PREFIX}${id}`;
}

export function versionIdForRoom(room: string): PoemVersionId | undefined {
  if (!room.startsWith(ROOM_PREFIX)) return undefined;
  const id = room.slice(ROOM_PREFIX.length);
  return isPoemVersionId(id) ? id : undefined;
}

/** One verse line per line, one blank line between stanzas, no title. */
export function draftSource(version: PoemVersion) {
  return version.stanzas.map((stanza) => stanza.join("\n")).join("\n\n");
}

export interface ParsedDraft {
  stanzas: readonly (readonly string[])[];
  lines: readonly string[];
  loop: string;
}

export function parseDraft(text: string): ParsedDraft {
  const stanzas = text
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n+/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.trim().replace(/\s+/g, " "))
        .filter(Boolean),
    )
    .filter((stanza) => stanza.length > 0);
  const lines = stanzas.flat();
  return { stanzas, lines, loop: lines.join("  ") };
}

/** The same bytes on every peer: applying them a second time changes nothing. */
export function seedUpdate(version: PoemVersion): Uint8Array {
  const doc = new Y.Doc();
  doc.clientID = SEED_CLIENT_ID;
  doc.getText(DRAFT_TEXT_NAME).insert(0, draftSource(version));
  const update = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return update;
}

/** The wording the site shows when a draft differs from its fixed version. */
export function applyDraft(version: PoemVersion, text: string): PoemVersion {
  const parsed = parseDraft(text);
  if (parsed.loop === version.loop) return version;
  return {
    ...version,
    label: `${version.label} draft`,
    summary: `The ${version.label.toLowerCase()} wording as edited in the poem editor; not a fixed version.`,
    stanzas: parsed.stanzas,
    lines: parsed.lines,
    loop: parsed.loop,
    loopWidthEm: loopWidthEm(parsed.lines),
    fabricationArtwork: false,
    draft: true,
  };
}
