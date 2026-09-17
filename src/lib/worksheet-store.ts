import * as Y from "yjs";
import {
  getWorksheetLayout,
  normalizeWorksheetSettings,
  type WorksheetSettings,
} from "../../shared/worksheet";

const DATABASE_NAME = "muchado-calligraphy-worksheet-v1";
const DATABASE_STORE = "documents";
const DATABASE_KEY = "main";
const CHANNEL_NAME = "muchado:calligraphy-worksheet:v1";
const ROOT_NAME = "worksheet";
const TEXT_NAME = "practice-text";
const TEMPLATES_NAME = "templates";
const TEMPLATE_KEY_PREFIX = "template:";
const ASSET_KEY_PREFIX = "asset:";
const RESET_GENERATION_KEY = "resetGeneration";
const MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;
const MAX_ASSET_DATA_URL_BYTES = 3 * 1024 * 1024;
const MAX_TEXT_LENGTH = 20_000;

export interface WorksheetPhoto {
  dataUrl: string;
  pixelWidth: number;
  pixelHeight: number;
  widthMm: number;
  xMm: number;
  yMm: number;
  opacity: number;
  rotation: 0 | 90 | 180 | 270;
  print: boolean;
}

export interface WorksheetSnapshot {
  version: 1;
  settings: WorksheetSettings;
  text: string;
  photo?: WorksheetPhoto;
  customFont?: { name: string; dataUrl: string };
}

export interface Template {
  id: string;
  name: string;
  updatedAt: string;
  snapshot: WorksheetSnapshot;
}

export type WorksheetTemplate = Template;

export interface WorksheetStorageStatus {
  storage: "loading" | "saved" | "saving" | "memory" | "error";
  message: string;
}

export function worksheetBackgroundReadsHealthy(
  templateReadFailed: boolean,
  assetReadFailed: boolean,
): boolean {
  return !templateReadFailed && !assetReadFailed;
}

export interface WorksheetSession {
  readonly doc: Y.Doc;
  readonly text: Y.Text;
  readonly undo: Y.UndoManager;
  readonly ready: Promise<void>;
  getSnapshot(): WorksheetSnapshot;
  subscribe(listener: () => void): () => void;
  getStatus(): WorksheetStorageStatus;
  subscribeStatus(listener: () => void): () => void;
  updateSettings(settings: WorksheetSettings): void;
  setText(text: string): void;
  setPhoto(photo: WorksheetPhoto | undefined): void;
  setCustomFont(font: { name: string; dataUrl: string } | undefined): void;
  load(snapshot: WorksheetSnapshot): void;
  listTemplates(): readonly Template[];
  saveTemplate(name: string): string;
  deleteTemplate(id: string): void;
}

function fail(message: string): never {
  throw new Error(`Could not read worksheet: ${message}`);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  label: string,
  allowed: readonly string[],
) {
  const unexpected = Object.keys(value).find((key) => !allowed.includes(key));
  if (unexpected)
    fail(`${label} contains an unsupported “${unexpected}” field.`);
}

function finiteNumber(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
  integer = false,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum ||
    (integer && !Number.isInteger(value))
  )
    fail(`${label} is outside its supported range.`);
  return value;
}

function dataUrl(value: unknown, label: string, pattern: RegExp): string {
  if (typeof value !== "string" || !pattern.test(value))
    fail(`${label} must be an embedded base64 file of a supported type.`);
  if (new TextEncoder().encode(value).byteLength > MAX_ASSET_DATA_URL_BYTES)
    fail(`${label} must be smaller than 3 MB after encoding.`);
  return value;
}

const IMAGE_DATA_URL =
  /^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/]+={0,2}$/i;
const FONT_DATA_URL =
  /^data:(?:font\/(?:ttf|otf)|application\/(?:x-font-ttf|x-font-otf|font-sfnt));base64,[a-z\d+/]+={0,2}$/i;

function parsePhoto(input: unknown): WorksheetPhoto {
  const value = record(input, "Photo");
  exactKeys(value, "Photo", [
    "dataUrl",
    "pixelWidth",
    "pixelHeight",
    "widthMm",
    "xMm",
    "yMm",
    "opacity",
    "rotation",
    "print",
  ]);
  const rotation = finiteNumber(value.rotation, "Photo rotation", 0, 270, true);
  if (rotation !== 0 && rotation !== 90 && rotation !== 180 && rotation !== 270)
    fail("Photo rotation must be 0, 90, 180, or 270 degrees.");
  if (typeof value.print !== "boolean") fail("Photo print setting is invalid.");
  return {
    dataUrl: dataUrl(value.dataUrl, "Photo", IMAGE_DATA_URL),
    pixelWidth: finiteNumber(value.pixelWidth, "Photo width", 1, 100_000, true),
    pixelHeight: finiteNumber(
      value.pixelHeight,
      "Photo height",
      1,
      100_000,
      true,
    ),
    widthMm: finiteNumber(value.widthMm, "Photo printed width", 0.1, 5_000),
    xMm: finiteNumber(value.xMm, "Photo horizontal position", -5_000, 5_000),
    yMm: finiteNumber(value.yMm, "Photo vertical position", -5_000, 5_000),
    opacity: finiteNumber(value.opacity, "Photo opacity", 0, 1),
    rotation,
    print: value.print,
  };
}

function parseCustomFont(input: unknown): { name: string; dataUrl: string } {
  const value = record(input, "Custom font");
  exactKeys(value, "Custom font", ["name", "dataUrl"]);
  if (
    typeof value.name !== "string" ||
    value.name.trim().length === 0 ||
    value.name.length > 100
  )
    fail("Custom font name must be between 1 and 100 characters.");
  return {
    name: value.name.trim(),
    dataUrl: dataUrl(value.dataUrl, "Custom font", FONT_DATA_URL),
  };
}

interface WorksheetPhotoMeta extends Omit<WorksheetPhoto, "dataUrl"> {
  assetId: string;
}

interface WorksheetFontMeta {
  assetId: string;
  name: string;
}

function assetId(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 160 ||
    !/^[a-zA-Z0-9_-]+$/.test(value)
  )
    fail(`${label} asset identifier is invalid.`);
  return value;
}

function parsePhotoMeta(input: unknown): WorksheetPhotoMeta {
  const value = record(input, "Photo metadata");
  exactKeys(value, "Photo metadata", [
    "assetId",
    "pixelWidth",
    "pixelHeight",
    "widthMm",
    "xMm",
    "yMm",
    "opacity",
    "rotation",
    "print",
  ]);
  const { assetId: rawAssetId, ...geometry } = value;
  const parsed = parsePhoto({
    ...geometry,
    dataUrl: "data:image/png;base64,AA==",
  });
  const { dataUrl: _dataUrl, ...metadata } = parsed;
  return { assetId: assetId(rawAssetId, "Photo"), ...metadata };
}

function parseFontMeta(input: unknown): WorksheetFontMeta {
  const value = record(input, "Custom font metadata");
  exactKeys(value, "Custom font metadata", ["assetId", "name"]);
  if (
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.length > 100
  )
    fail("Custom font name must be between 1 and 100 characters.");
  return {
    assetId: assetId(value.assetId, "Custom font"),
    name: value.name.trim(),
  };
}

function cloneSnapshot(snapshot: WorksheetSnapshot): WorksheetSnapshot {
  return parseWorksheetSnapshot(
    JSON.parse(serializeWorksheetSnapshot(snapshot)),
  );
}

/** Validates the complete, versioned format used for local backup files. */
export function parseWorksheetSnapshot(input: unknown): WorksheetSnapshot {
  let value: unknown = input;
  if (typeof input === "string") {
    if (new TextEncoder().encode(input).byteLength > MAX_SNAPSHOT_BYTES)
      fail("the file is larger than 8 MB.");
    try {
      value = JSON.parse(input);
    } catch {
      fail("the file is not valid JSON.");
    }
  }
  const source = record(value, "Worksheet backup");
  exactKeys(source, "Worksheet backup", [
    "version",
    "settings",
    "text",
    "photo",
    "customFont",
  ]);
  if (source.version !== 1) {
    if (typeof source.version === "number" && source.version > 1)
      fail("this backup was made by a newer version of the worksheet maker.");
    fail("the backup version is missing or unsupported.");
  }
  if (typeof source.text !== "string") fail("practice text must be text.");
  if (source.text.length > MAX_TEXT_LENGTH)
    fail(
      `practice text cannot exceed ${MAX_TEXT_LENGTH.toLocaleString()} characters.`,
    );

  record(source.settings, "Worksheet settings");
  const snapshot: WorksheetSnapshot = {
    version: 1,
    settings: normalizeWorksheetSettings(source.settings),
    text: source.text,
  };
  getWorksheetLayout(snapshot.settings);
  if (source.photo !== undefined) snapshot.photo = parsePhoto(source.photo);
  if (source.customFont !== undefined)
    snapshot.customFont = parseCustomFont(source.customFont);

  let encoded: Uint8Array;
  try {
    encoded = new TextEncoder().encode(JSON.stringify(snapshot));
  } catch {
    fail("the backup contains values that cannot be saved.");
  }
  if (encoded.byteLength > MAX_SNAPSHOT_BYTES)
    fail("the worksheet, photo, and font together are larger than 8 MB.");
  return snapshot;
}

export function serializeWorksheetSnapshot(
  snapshot: WorksheetSnapshot,
): string {
  const valid = parseWorksheetSnapshot(snapshot);
  const serialized = JSON.stringify(valid, null, 2);
  if (new TextEncoder().encode(serialized).byteLength > MAX_SNAPSHOT_BYTES)
    fail("the worksheet, photo, and font together are larger than 8 MB.");
  return serialized;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DATABASE_STORE))
        request.result.createObjectStore(DATABASE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB could not open."));
    request.onblocked = () =>
      reject(new Error("IndexedDB is blocked by another tab."));
  });
}

function readState(database: IDBDatabase): Promise<Uint8Array | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DATABASE_STORE, "readonly");
    const request = transaction.objectStore(DATABASE_STORE).get(DATABASE_KEY);
    request.onsuccess = () => {
      const value = request.result;
      if (value === undefined) resolve(undefined);
      else if (value instanceof Uint8Array) resolve(value);
      else if (value instanceof ArrayBuffer) resolve(new Uint8Array(value));
      else
        reject(new Error("Stored worksheet data has an unsupported format."));
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Stored draft could not be read."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Stored draft read was aborted."));
  });
}

function requireStoredBytes(value: unknown): Uint8Array | undefined {
  if (value === undefined) return undefined;
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  throw new Error("Stored worksheet data has an unsupported format.");
}

function mergeState(
  database: IDBDatabase,
  update: Uint8Array,
  cleanupAssetIds: ReadonlySet<string> = new Set(),
): Promise<readonly string[]> {
  return new Promise((resolve, reject) => {
    const deletedAssetIds: string[] = [];
    const transaction = database.transaction(DATABASE_STORE, "readwrite");
    const store = transaction.objectStore(DATABASE_STORE);
    const request = store.get(DATABASE_KEY);
    request.onsuccess = () => {
      try {
        const compacted = mergeAndCompactWorksheetUpdates(
          requireStoredBytes(request.result),
          update,
        );
        const references = worksheetAssetReferences(compacted);
        let remaining = references.length;
        const commit = () => {
          const referencedIds = new Set(
            references.map((reference) => reference.id),
          );
          for (const id of cleanupAssetIds)
            if (!referencedIds.has(id)) {
              store.delete(`${ASSET_KEY_PREFIX}${id}`);
              deletedAssetIds.push(id);
            }
          store.put(compacted, DATABASE_KEY);
        };
        if (remaining === 0) commit();
        for (const reference of references) {
          const assetRequest = store.get(`${ASSET_KEY_PREFIX}${reference.id}`);
          assetRequest.onsuccess = () => {
            try {
              dataUrl(
                assetRequest.result,
                reference.kind === "photo" ? "Photo" : "Custom font",
                reference.kind === "photo" ? IMAGE_DATA_URL : FONT_DATA_URL,
              );
              remaining -= 1;
              if (remaining === 0) commit();
            } catch (error) {
              transaction.abort();
              reject(error);
            }
          };
        }
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    };
    transaction.oncomplete = () => resolve(deletedAssetIds);
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Draft could not be saved."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Draft save was aborted."));
  });
}

function writeValue(
  database: IDBDatabase,
  key: string,
  value: unknown,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DATABASE_STORE, "readwrite");
    transaction.objectStore(DATABASE_STORE).put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(
        transaction.error ?? new Error("Browser data could not be saved."),
      );
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Browser data save was aborted."));
  });
}

function deleteValue(database: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DATABASE_STORE, "readwrite");
    transaction.objectStore(DATABASE_STORE).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(
        transaction.error ?? new Error("Browser data could not be deleted."),
      );
    transaction.onabort = () =>
      reject(
        transaction.error ?? new Error("Browser data deletion was aborted."),
      );
  });
}

function readValue(database: IDBDatabase, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DATABASE_STORE, "readonly");
    const request = transaction.objectStore(DATABASE_STORE).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Browser data could not be read."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Browser data read was aborted."));
  });
}

function readPrefixedValues(
  database: IDBDatabase,
  prefix: string,
): Promise<Array<[string, unknown]>> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DATABASE_STORE, "readonly");
    const store = transaction.objectStore(DATABASE_STORE);
    const keys = store.getAllKeys();
    keys.onsuccess = () => {
      const matching = keys.result.filter(
        (key): key is string =>
          typeof key === "string" && key.startsWith(prefix),
      );
      Promise.all(
        matching.map(
          async (key): Promise<[string, unknown]> => [
            key,
            await readValue(database, key),
          ],
        ),
      ).then(resolve, reject);
    };
    keys.onerror = () =>
      reject(keys.error ?? new Error("Browser library could not be read."));
    transaction.onabort = () =>
      reject(
        transaction.error ?? new Error("Browser library read was aborted."),
      );
  });
}

function errorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "QuotaExceededError")
    return "Browser storage is full. Your changes remain in this tab; export a backup before closing it.";
  return "Browser storage is unavailable. Your changes remain in this tab; export a backup before closing it.";
}

function newLocalId(prefix: string): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function jsonStringBytes(value: string): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function freezeSnapshot(snapshot: WorksheetSnapshot): WorksheetSnapshot {
  Object.freeze(snapshot.settings);
  if (snapshot.photo) Object.freeze(snapshot.photo);
  if (snapshot.customFont) Object.freeze(snapshot.customFont);
  return Object.freeze(snapshot);
}

export function worksheetSnapshotFromState(state: {
  settings?: unknown;
  text?: unknown;
  photo?: unknown;
  customFont?: unknown;
}): WorksheetSnapshot {
  const candidate: Record<string, unknown> = {
    version: 1,
    settings: state.settings ?? {},
    text: state.text ?? "",
  };
  if (state.photo !== undefined) candidate.photo = state.photo;
  if (state.customFont !== undefined) candidate.customFont = state.customFont;
  return parseWorksheetSnapshot(candidate);
}

/** Combines concurrent Yjs changes without choosing one tab's snapshot over another. */
export function mergeStoredWorksheetUpdates(
  stored: Uint8Array | undefined,
  incoming: Uint8Array,
): Uint8Array {
  return stored ? Y.mergeUpdates([stored, incoming]) : incoming;
}

function validateDocumentCore(doc: Y.Doc) {
  const root = doc.getMap<unknown>(ROOT_NAME);
  const settings = normalizeWorksheetSettings(root.get("settings") ?? {});
  getWorksheetLayout(settings);
  const currentText = doc.getText(TEXT_NAME).toString();
  if (currentText.length > MAX_TEXT_LENGTH)
    fail(
      `practice text cannot exceed ${MAX_TEXT_LENGTH.toLocaleString()} characters.`,
    );
  const generation = root.get(RESET_GENERATION_KEY);
  if (
    generation !== undefined &&
    (typeof generation !== "string" || generation.length > 160)
  )
    fail("Worksheet reset generation is invalid.");
  return { root, settings, currentText };
}

function validateDocument(doc: Y.Doc) {
  const { root, settings, currentText } = validateDocumentCore(doc);
  const photo = root.get("photo");
  let legacyPhoto: WorksheetPhoto | undefined;
  if (photo !== undefined) {
    const value = record(photo, "Photo");
    if ("dataUrl" in value) legacyPhoto = parsePhoto(value);
    else parsePhotoMeta(value);
  }
  const font = root.get("customFont");
  let legacyFont: { name: string; dataUrl: string } | undefined;
  if (font !== undefined) {
    const value = record(font, "Custom font");
    if ("dataUrl" in value) legacyFont = parseCustomFont(value);
    else parseFontMeta(value);
  }
  if (legacyPhoto || legacyFont)
    worksheetSnapshotFromState({
      settings,
      text: currentText,
      photo: legacyPhoto,
      customFont: legacyFont,
    });
}

function omitInvalidOptionalAssets(doc: Y.Doc): string[] {
  const root = doc.getMap<unknown>(ROOT_NAME);
  const omitted: string[] = [];
  const photo = root.get("photo");
  if (photo !== undefined) {
    try {
      const value = record(photo, "Photo");
      if ("dataUrl" in value) parsePhoto(value);
      else parsePhotoMeta(value);
    } catch {
      root.delete("photo");
      omitted.push("photo");
    }
  }
  const font = root.get("customFont");
  if (font !== undefined) {
    try {
      const value = record(font, "Custom font");
      if ("dataUrl" in value) parseCustomFont(value);
      else parseFontMeta(value);
    } catch {
      root.delete("customFont");
      omitted.push("custom font");
    }
  }
  return omitted;
}

export function recoverWorksheetUpdateWithoutInvalidAssets(
  update: Uint8Array,
): { update: Uint8Array; omitted: readonly string[] } {
  const recovered = new Y.Doc();
  try {
    Y.applyUpdate(recovered, update);
    validateDocumentCore(recovered);
    const omitted = omitInvalidOptionalAssets(recovered);
    if (omitted.length === 0)
      fail("the stored worksheet does not contain a recoverable asset error.");
    return {
      update: Y.encodeStateAsUpdate(recovered),
      omitted: Object.freeze(omitted),
    };
  } finally {
    recovered.destroy();
  }
}

function parseTemplate(id: string, serialized: unknown): Template {
  if (typeof serialized !== "string") fail("Template data must be text.");
  const value = record(JSON.parse(serialized), "Template");
  exactKeys(value, "Template", ["id", "name", "updatedAt", "snapshot"]);
  if (value.id !== id)
    fail("Template identifier does not match its library entry.");
  if (
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.length > 80
  )
    fail("Template name is invalid.");
  if (
    typeof value.updatedAt !== "string" ||
    Number.isNaN(Date.parse(value.updatedAt))
  )
    fail("Template date is invalid.");
  return Object.freeze({
    id,
    name: value.name,
    updatedAt: value.updatedAt,
    snapshot: freezeSnapshot(parseWorksheetSnapshot(value.snapshot)),
  });
}

/** Checks untrusted browser bytes without applying them to the live worksheet. */
export function validateStoredWorksheetUpdate(update: Uint8Array): void {
  const restored = new Y.Doc();
  try {
    Y.applyUpdate(restored, update);
    validateDocument(restored);
  } finally {
    restored.destroy();
  }
}

/** Merges, validates, and compacts a committed document update. */
export function mergeAndCompactWorksheetUpdates(
  stored: Uint8Array | undefined,
  incoming: Uint8Array,
): Uint8Array {
  const merged = mergeStoredWorksheetUpdates(stored, incoming);
  const compacted = new Y.Doc();
  try {
    Y.applyUpdate(compacted, merged);
    validateDocument(compacted);
    return Y.encodeStateAsUpdate(compacted);
  } finally {
    compacted.destroy();
  }
}

interface WorksheetAssetReference {
  id: string;
  kind: "photo" | "font";
}

export function worksheetAssetReferences(
  update: Uint8Array,
): WorksheetAssetReference[] {
  const restored = new Y.Doc();
  try {
    Y.applyUpdate(restored, update);
    validateDocument(restored);
    const root = restored.getMap<unknown>(ROOT_NAME);
    const references: WorksheetAssetReference[] = [];
    const photo = root.get("photo");
    if (photo !== undefined && !("dataUrl" in record(photo, "Photo")))
      references.push({ id: parsePhotoMeta(photo).assetId, kind: "photo" });
    const font = root.get("customFont");
    if (font !== undefined && !("dataUrl" in record(font, "Custom font")))
      references.push({ id: parseFontMeta(font).assetId, kind: "font" });
    return references;
  } finally {
    restored.destroy();
  }
}

export function installResetGenerationGuard(
  root: Y.Map<unknown>,
  undo: Y.UndoManager,
): () => void {
  let generation = root.get(RESET_GENERATION_KEY);
  const observer = () => {
    const next = root.get(RESET_GENERATION_KEY);
    if (next !== generation) {
      generation = next;
      undo.clear();
    }
  };
  root.observe(observer);
  return () => root.unobserve(observer);
}

interface WorksheetRootFields {
  settings: WorksheetSettings;
  photo?: WorksheetPhoto;
  customFont?: { name: string; dataUrl: string };
  emptyTextBytes: number;
}

function createSession(): WorksheetSession {
  const doc = new Y.Doc({ guid: CHANNEL_NAME });
  const root = doc.getMap<unknown>(ROOT_NAME);
  const text = doc.getText(TEXT_NAME);
  const undo = new Y.UndoManager(text, { captureTimeout: 400 });
  installResetGenerationGuard(root, undo);
  const listeners = new Set<() => void>();
  const statusListeners = new Set<() => void>();
  const templateLibrary = new Map<string, Template>();
  let snapshotCache: WorksheetSnapshot | undefined;
  let rootFieldsCache: WorksheetRootFields | undefined;
  let templateCache: readonly WorksheetTemplate[] | undefined;
  let status: WorksheetStorageStatus = {
    storage: "loading",
    message: "Opening the draft saved in this browser…",
  };
  let database: IDBDatabase | undefined;
  let channel: BroadcastChannel | undefined;
  let readyComplete = false;
  let persistenceRunning = false;
  let pendingPersistenceUpdate: Uint8Array | undefined;
  let auxiliaryWrites = 0;
  let auxiliaryWriteFailed = false;
  let auxiliaryQueue = Promise.resolve();
  let assetQueue = Promise.resolve();
  let assetWriteFailed = false;
  let templateReadFailed = false;
  let assetReadFailed = false;
  let templateNoticeRevision = 0;
  const pendingAssetCleanup = new Set<string>();
  let photoAssetId: string | undefined;
  let photoAssetData: string | undefined;
  let photoAssetJsonBytes = 0;
  let fontAssetId: string | undefined;
  let fontAssetData: string | undefined;
  let fontAssetJsonBytes = 0;
  let lastValidSnapshot = freezeSnapshot(
    worksheetSnapshotFromState({ settings: {}, text: "" }),
  );

  const setStatus = (next: WorksheetStorageStatus) => {
    if (status.storage === next.storage && status.message === next.message)
      return;
    status = Object.freeze(next);
    for (const listener of statusListeners) listener();
  };

  const currentRootFields = () => {
    if (rootFieldsCache) return rootFieldsCache;
    const settings = normalizeWorksheetSettings(root.get("settings") ?? {});
    getWorksheetLayout(settings);
    const photoValue = root.get("photo");
    const fontValue = root.get("customFont");
    let photo: WorksheetPhoto | undefined;
    let customFont: { name: string; dataUrl: string } | undefined;
    if (photoValue !== undefined) {
      const metadata = parsePhotoMeta(photoValue);
      if (photoAssetId === metadata.assetId && photoAssetData) {
        const { assetId: _assetId, ...geometry } = metadata;
        photo = Object.freeze({ ...geometry, dataUrl: photoAssetData });
      }
    }
    if (fontValue !== undefined) {
      const metadata = parseFontMeta(fontValue);
      if (fontAssetId === metadata.assetId && fontAssetData)
        customFont = Object.freeze({
          name: metadata.name,
          dataUrl: fontAssetData,
        });
    }
    const sizingSnapshot = {
      version: 1,
      settings,
      text: "",
      ...(photo ? { photo: { ...photo, dataUrl: "" } } : {}),
      ...(customFont ? { customFont: { ...customFont, dataUrl: "" } } : {}),
    };
    const emptyTextBytes =
      new TextEncoder().encode(JSON.stringify(sizingSnapshot)).byteLength +
      (photo ? photoAssetJsonBytes - 2 : 0) +
      (customFont ? fontAssetJsonBytes - 2 : 0);
    if (emptyTextBytes > MAX_SNAPSHOT_BYTES)
      fail("the worksheet, photo, and font together are larger than 8 MB.");
    const fields: WorksheetRootFields = {
      settings: Object.freeze(settings),
      emptyTextBytes,
    };
    if (photo) fields.photo = photo;
    if (customFont) fields.customFont = customFont;
    rootFieldsCache = Object.freeze(fields);
    return rootFieldsCache;
  };

  const currentSnapshot = (): WorksheetSnapshot => {
    if (snapshotCache) return snapshotCache;
    try {
      const fields = currentRootFields();
      const currentText = text.toString();
      if (currentText.length > MAX_TEXT_LENGTH)
        fail(
          `practice text cannot exceed ${MAX_TEXT_LENGTH.toLocaleString()} characters.`,
        );
      const textBytes = new TextEncoder().encode(
        JSON.stringify(currentText),
      ).byteLength;
      if (fields.emptyTextBytes + textBytes - 2 > MAX_SNAPSHOT_BYTES)
        fail("the worksheet, photo, and font together are larger than 8 MB.");
      const candidate: WorksheetSnapshot = {
        version: 1,
        settings: fields.settings,
        text: currentText,
      };
      if (fields.photo) candidate.photo = fields.photo;
      if (fields.customFont) candidate.customFont = fields.customFont;
      snapshotCache = Object.freeze(candidate);
      lastValidSnapshot = snapshotCache;
    } catch {
      // Invalid restored or cross-tab data never escapes through React's
      // synchronous external-store getter.
      snapshotCache = lastValidSnapshot;
    }
    return snapshotCache;
  };

  const snapshotChanged = () => {
    snapshotCache = undefined;
    for (const listener of listeners) listener();
  };
  root.observe(() => {
    rootFieldsCache = undefined;
    snapshotChanged();
  });
  text.observe(snapshotChanged);

  const templatesChanged = () => {
    templateCache = undefined;
    // Templates are exposed alongside the snapshot through the same external
    // store subscription, so change its identity without re-reading assets.
    if (snapshotCache) snapshotCache = Object.freeze({ ...snapshotCache });
    for (const listener of listeners) listener();
  };

  const markSavedIfIdle = () => {
    if (
      database &&
      !persistenceRunning &&
      !pendingPersistenceUpdate &&
      auxiliaryWrites === 0 &&
      !auxiliaryWriteFailed &&
      !assetWriteFailed &&
      worksheetBackgroundReadsHealthy(templateReadFailed, assetReadFailed)
    )
      setStatus({
        storage: "saved",
        message: "Saved privately in this browser.",
      });
  };

  const queueAuxiliaryWrite = (
    operation: (activeDatabase: IDBDatabase) => Promise<void>,
    committed?: () => void,
  ) => {
    if (!database) return;
    auxiliaryWrites += 1;
    setStatus({ storage: "saving", message: "Saving in this browser…" });
    auxiliaryQueue = auxiliaryQueue
      .then(() => operation(database as IDBDatabase))
      .then(() => committed?.())
      .catch((error: unknown) => {
        auxiliaryWriteFailed = true;
        setStatus({ storage: "error", message: errorMessage(error) });
      })
      .finally(() => {
        auxiliaryWrites -= 1;
        markSavedIfIdle();
      });
  };

  const queueAssetWrite = (
    operation: (activeDatabase: IDBDatabase) => Promise<void>,
    committed?: () => void,
  ) => {
    if (!database) return;
    auxiliaryWrites += 1;
    assetWriteFailed = false;
    setStatus({ storage: "saving", message: "Saving in this browser…" });
    assetQueue = assetQueue
      .then(() => operation(database as IDBDatabase))
      .then(() => committed?.())
      .catch((error: unknown) => {
        assetWriteFailed = true;
        setStatus({ storage: "error", message: errorMessage(error) });
      })
      .finally(() => {
        auxiliaryWrites -= 1;
        markSavedIfIdle();
      });
  };

  const flushPersistence = async () => {
    if (persistenceRunning || !database || !readyComplete) return;
    persistenceRunning = true;
    while (pendingPersistenceUpdate) {
      const update = pendingPersistenceUpdate;
      pendingPersistenceUpdate = undefined;
      try {
        await assetQueue;
        if (assetWriteFailed)
          throw new Error("Worksheet assets could not be saved.");
        const photoValue = root.get("photo");
        const fontValue = root.get("customFont");
        const referencedPhotoId =
          photoValue === undefined
            ? undefined
            : parsePhotoMeta(photoValue).assetId;
        const referencedFontId =
          fontValue === undefined
            ? undefined
            : parseFontMeta(fontValue).assetId;
        if (
          referencedPhotoId !== photoAssetId ||
          referencedFontId !== fontAssetId
        ) {
          const problems = await loadReferencedAssets();
          if (problems.length > 0)
            throw new Error(
              `Referenced ${problems.join(" and ")} data is missing.`,
            );
        }
        const deletedAssetIds = await mergeState(
          database,
          update,
          pendingAssetCleanup,
        );
        for (const id of deletedAssetIds) pendingAssetCleanup.delete(id);
      } catch (error) {
        pendingPersistenceUpdate = pendingPersistenceUpdate
          ? Y.mergeUpdates([update, pendingPersistenceUpdate])
          : update;
        setStatus({ storage: "error", message: errorMessage(error) });
        persistenceRunning = false;
        return;
      }
    }
    persistenceRunning = false;
    markSavedIfIdle();
  };

  const persist = (update: Uint8Array, origin: unknown) => {
    if (!database || !readyComplete || origin === "indexeddb") return;
    pendingPersistenceUpdate = pendingPersistenceUpdate
      ? Y.mergeUpdates([pendingPersistenceUpdate, update])
      : update;
    setStatus({ storage: "saving", message: "Saving in this browser…" });
    void flushPersistence();
  };

  const loadReferencedAssets = async (): Promise<string[]> => {
    const problems: string[] = [];
    if (!database) return problems;
    const photoValue = root.get("photo");
    if (photoValue === undefined) {
      photoAssetId = undefined;
      photoAssetData = undefined;
      photoAssetJsonBytes = 0;
    } else {
      const metadata = parsePhotoMeta(photoValue);
      photoAssetId = metadata.assetId;
      try {
        const stored = await readValue(
          database,
          `${ASSET_KEY_PREFIX}${metadata.assetId}`,
        );
        const { assetId: _assetId, ...geometry } = metadata;
        photoAssetData = parsePhoto({ ...geometry, dataUrl: stored }).dataUrl;
        photoAssetJsonBytes = jsonStringBytes(photoAssetData);
      } catch {
        photoAssetData = undefined;
        photoAssetJsonBytes = 0;
        problems.push("photo");
      }
    }
    const fontValue = root.get("customFont");
    if (fontValue === undefined) {
      fontAssetId = undefined;
      fontAssetData = undefined;
      fontAssetJsonBytes = 0;
    } else {
      const metadata = parseFontMeta(fontValue);
      fontAssetId = metadata.assetId;
      try {
        const stored = await readValue(
          database,
          `${ASSET_KEY_PREFIX}${metadata.assetId}`,
        );
        fontAssetData = parseCustomFont({
          name: metadata.name,
          dataUrl: stored,
        }).dataUrl;
        fontAssetJsonBytes = jsonStringBytes(fontAssetData);
      } catch {
        fontAssetData = undefined;
        fontAssetJsonBytes = 0;
        problems.push("custom font");
      }
    }
    rootFieldsCache = undefined;
    snapshotChanged();
    return problems;
  };

  const loadTemplateEntry = async (id: string) => {
    if (!database) return;
    const value = await readValue(database, `${TEMPLATE_KEY_PREFIX}${id}`);
    if (value === undefined) {
      if (templateLibrary.delete(id)) templatesChanged();
      return;
    }
    try {
      templateLibrary.set(id, parseTemplate(id, value));
      templatesChanged();
    } catch {
      // Preserve a damaged template key and keep the rest of the library usable.
    }
  };

  const reconcileTemplates = async () => {
    if (!database) return;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const revision = templateNoticeRevision;
      const storedTemplates = await readPrefixedValues(
        database,
        TEMPLATE_KEY_PREFIX,
      );
      if (revision !== templateNoticeRevision) continue;
      const found = new Map<string, Template>();
      for (const [key, value] of storedTemplates) {
        const id = key.slice(TEMPLATE_KEY_PREFIX.length);
        try {
          found.set(id, parseTemplate(id, value));
        } catch {
          // Preserve the individual bad key; other templates and the draft load.
        }
      }
      templateLibrary.clear();
      for (const [id, template] of found) templateLibrary.set(id, template);
      templatesChanged();
      return;
    }
  };

  const connectTabs = () => {
    if (channel || typeof BroadcastChannel === "undefined") return;
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      channel = undefined;
      return;
    }
    channel.onmessage = (event: MessageEvent<unknown>) => {
      try {
        if (event.data instanceof Uint8Array) {
          const candidate = new Y.Doc();
          try {
            Y.applyUpdate(candidate, Y.encodeStateAsUpdate(doc));
            Y.applyUpdate(candidate, event.data);
            validateDocument(candidate);
          } finally {
            candidate.destroy();
          }
          Y.applyUpdate(doc, event.data, channel);
        } else if (
          event.data &&
          typeof event.data === "object" &&
          "hello" in event.data
        ) {
          channel?.postMessage(Y.encodeStateAsUpdate(doc));
        } else if (
          event.data &&
          typeof event.data === "object" &&
          "templateId" in event.data &&
          typeof event.data.templateId === "string"
        ) {
          templateNoticeRevision += 1;
          void loadTemplateEntry(event.data.templateId)
            .then(() => {
              templateReadFailed = false;
              markSavedIfIdle();
            })
            .catch(() => {
              templateReadFailed = true;
              setStatus({
                storage: "error",
                message:
                  "The saved template library could not be refreshed. The current worksheet remains available.",
              });
            });
        } else if (
          event.data &&
          typeof event.data === "object" &&
          "assetId" in event.data &&
          typeof event.data.assetId === "string"
        ) {
          void loadReferencedAssets()
            .then((problems) => {
              if (problems.length > 0)
                throw new Error(
                  `Referenced ${problems.join(" and ")} data is unavailable.`,
                );
              assetReadFailed = false;
              return flushPersistence();
            })
            .catch(() => {
              assetReadFailed = true;
              setStatus({
                storage: "error",
                message:
                  "A referenced browser asset could not be read. Valid text and page settings remain available for export.",
              });
            });
        }
      } catch {
        setStatus({
          storage: "error",
          message:
            "Another tab sent damaged worksheet data. This tab kept its last valid view.",
        });
      }
    };
    doc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin !== channel) {
        try {
          channel?.postMessage(update);
        } catch {
          // Storage remains authoritative when cross-tab messaging is blocked.
        }
      }
    });
    try {
      channel.postMessage({ hello: true });
    } catch {
      channel.close();
      channel = undefined;
    }
  };

  const migrateLegacyData = async (): Promise<boolean> => {
    if (!database) return false;
    let migrated = false;
    const photoValue = root.get("photo");
    if (
      photoValue &&
      typeof photoValue === "object" &&
      "dataUrl" in photoValue
    ) {
      const photo = parsePhoto(photoValue);
      const id = newLocalId("photo");
      await writeValue(database, `${ASSET_KEY_PREFIX}${id}`, photo.dataUrl);
      const { dataUrl: _dataUrl, ...metadata } = photo;
      photoAssetId = id;
      photoAssetData = photo.dataUrl;
      photoAssetJsonBytes = jsonStringBytes(photo.dataUrl);
      root.set("photo", { assetId: id, ...metadata });
      migrated = true;
    }
    const fontValue = root.get("customFont");
    if (fontValue && typeof fontValue === "object" && "dataUrl" in fontValue) {
      const font = parseCustomFont(fontValue);
      const id = newLocalId("font");
      await writeValue(database, `${ASSET_KEY_PREFIX}${id}`, font.dataUrl);
      fontAssetId = id;
      fontAssetData = font.dataUrl;
      fontAssetJsonBytes = jsonStringBytes(font.dataUrl);
      root.set("customFont", { assetId: id, name: font.name });
      migrated = true;
    }
    const legacyTemplates = doc.getMap<unknown>(TEMPLATES_NAME);
    if (legacyTemplates.size > 0) {
      const writes: Promise<void>[] = [];
      legacyTemplates.forEach((value, id) => {
        writes.push(
          writeValue(
            database as IDBDatabase,
            `${TEMPLATE_KEY_PREFIX}${id}`,
            value,
          ),
        );
      });
      await Promise.all(writes);
      legacyTemplates.clear();
      migrated = true;
    }
    if (migrated) await mergeState(database, Y.encodeStateAsUpdate(doc));
    return migrated;
  };

  const ready = (async () => {
    if (typeof indexedDB === "undefined") {
      readyComplete = true;
      setStatus({
        storage: "memory",
        message:
          "Browser storage is unavailable. Changes remain in this tab only.",
      });
      connectTabs();
      return;
    }
    try {
      database = await openDatabase();
      const stored = await readState(database);
      let corrupt = false;
      let optionalRecovery = false;
      if (stored) {
        try {
          validateStoredWorksheetUpdate(stored);
          Y.applyUpdate(doc, stored, "indexeddb");
        } catch {
          try {
            const recovered =
              recoverWorksheetUpdateWithoutInvalidAssets(stored);
            Y.applyUpdate(doc, recovered.update, "indexeddb");
            optionalRecovery = true;
          } catch {
            corrupt = true;
          }
          database.close();
          database = undefined;
        }
      } else {
        await mergeState(database, Y.encodeStateAsUpdate(doc));
      }
      if (!corrupt && !optionalRecovery) {
        await migrateLegacyData();
        const assetProblems = await loadReferencedAssets();
        connectTabs();
        await reconcileTemplates();
        if (assetProblems.length > 0) {
          database?.close();
          database = undefined;
          assetReadFailed = true;
        }
      }
      readyComplete = true;
      if (database) doc.on("update", persist);
      setStatus(
        corrupt ||
          optionalRecovery ||
          !worksheetBackgroundReadsHealthy(templateReadFailed, assetReadFailed)
          ? {
              storage: "error",
              message: optionalRecovery
                ? "A saved optional asset was damaged and was omitted. Valid text and page settings remain available for export; original browser data was preserved."
                : assetReadFailed
                  ? "A saved optional asset could not be read. Valid text and page settings remain available for export; original browser data was preserved."
                  : templateReadFailed
                    ? "The saved template library could not be refreshed. The current worksheet remains available."
                    : "Saved data could not be read; the original browser data was preserved. Export changes from this tab before closing it.",
            }
          : {
              storage: "saved",
              message: "Saved privately in this browser.",
            },
      );
    } catch (error) {
      const hadDatabase = Boolean(database);
      database?.close();
      database = undefined;
      readyComplete = true;
      setStatus(
        hadDatabase
          ? {
              storage: "error",
              message:
                "Saved browser data could not be read; the original data was preserved. Export changes from this tab before closing it.",
            }
          : { storage: "memory", message: errorMessage(error) },
      );
    }
    connectTabs();
  })();

  const assertReady = () => {
    if (!readyComplete)
      throw new Error("Wait for the browser draft to finish opening.");
  };

  const announce = (message: Record<string, string>) => {
    try {
      channel?.postMessage(message);
    } catch {
      // The committed IndexedDB value remains available on the next page load.
    }
  };

  const preparePhoto = (photo: WorksheetPhoto | undefined) => {
    const previousId = photoAssetId;
    if (!photo) {
      if (previousId) pendingAssetCleanup.add(previousId);
      photoAssetId = undefined;
      photoAssetData = undefined;
      photoAssetJsonBytes = 0;
      return undefined;
    }
    const valid = parsePhoto(photo);
    const id =
      photoAssetData === valid.dataUrl && photoAssetId
        ? photoAssetId
        : newLocalId("photo");
    photoAssetId = id;
    photoAssetData = valid.dataUrl;
    photoAssetJsonBytes = jsonStringBytes(valid.dataUrl);
    if (id !== previousId) {
      if (previousId) pendingAssetCleanup.add(previousId);
      queueAssetWrite(
        (activeDatabase) =>
          writeValue(activeDatabase, `${ASSET_KEY_PREFIX}${id}`, valid.dataUrl),
        () => announce({ assetId: id }),
      );
    }
    const { dataUrl: _dataUrl, ...metadata } = valid;
    return { assetId: id, ...metadata } satisfies WorksheetPhotoMeta;
  };

  const prepareFont = (font: { name: string; dataUrl: string } | undefined) => {
    const previousId = fontAssetId;
    if (!font) {
      if (previousId) pendingAssetCleanup.add(previousId);
      fontAssetId = undefined;
      fontAssetData = undefined;
      fontAssetJsonBytes = 0;
      return undefined;
    }
    const valid = parseCustomFont(font);
    const id =
      fontAssetData === valid.dataUrl && fontAssetId
        ? fontAssetId
        : newLocalId("font");
    fontAssetId = id;
    fontAssetData = valid.dataUrl;
    fontAssetJsonBytes = jsonStringBytes(valid.dataUrl);
    if (id !== previousId) {
      if (previousId) pendingAssetCleanup.add(previousId);
      queueAssetWrite(
        (activeDatabase) =>
          writeValue(activeDatabase, `${ASSET_KEY_PREFIX}${id}`, valid.dataUrl),
        () => announce({ assetId: id }),
      );
    }
    return { assetId: id, name: valid.name } satisfies WorksheetFontMeta;
  };

  const replaceSnapshot = (snapshot: WorksheetSnapshot) => {
    assertReady();
    const valid = cloneSnapshot(snapshot);
    const photo = preparePhoto(valid.photo);
    const customFont = prepareFont(valid.customFont);
    doc.transact(() => {
      root.set("settings", valid.settings);
      root.set(RESET_GENERATION_KEY, newLocalId("reset"));
      if (photo) root.set("photo", photo);
      else root.delete("photo");
      if (customFont) root.set("customFont", customFont);
      else root.delete("customFont");
      text.delete(0, text.length);
      if (valid.text) text.insert(0, valid.text);
    }, "worksheet-load");
    undo.clear();
  };

  const session: WorksheetSession = {
    doc,
    text,
    undo,
    ready,
    getSnapshot: currentSnapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getStatus: () => status,
    subscribeStatus(listener) {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    updateSettings(settings) {
      assertReady();
      const valid = normalizeWorksheetSettings(settings);
      getWorksheetLayout(valid);
      root.set("settings", valid);
    },
    setText(nextText) {
      assertReady();
      if (nextText.length > MAX_TEXT_LENGTH)
        fail(
          `practice text cannot exceed ${MAX_TEXT_LENGTH.toLocaleString()} characters.`,
        );
      const fields = currentRootFields();
      const textBytes = new TextEncoder().encode(
        JSON.stringify(nextText),
      ).byteLength;
      if (fields.emptyTextBytes + textBytes - 2 > MAX_SNAPSHOT_BYTES)
        fail("the worksheet, photo, and font together are larger than 8 MB.");
      doc.transact(() => {
        text.delete(0, text.length);
        if (nextText) text.insert(0, nextText);
      });
    },
    setPhoto(photo) {
      assertReady();
      if (photo && photoAssetId && photo.dataUrl === photoAssetData) {
        const { dataUrl: _dataUrl, ...geometry } = photo;
        root.set(
          "photo",
          parsePhotoMeta({ assetId: photoAssetId, ...geometry }),
        );
        return;
      }
      const candidate = { ...currentSnapshot(), photo };
      if (!photo) delete candidate.photo;
      const valid = parseWorksheetSnapshot(candidate);
      const metadata = preparePhoto(valid.photo);
      if (metadata) root.set("photo", metadata);
      else root.delete("photo");
    },
    setCustomFont(font) {
      assertReady();
      const candidate = { ...currentSnapshot(), customFont: font };
      if (!font) delete candidate.customFont;
      const valid = parseWorksheetSnapshot(candidate);
      const metadata = prepareFont(valid.customFont);
      if (metadata) root.set("customFont", metadata);
      else root.delete("customFont");
    },
    load: replaceSnapshot,
    listTemplates() {
      if (templateCache) return templateCache;
      const result = [...templateLibrary.values()];
      result.sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      );
      templateCache = Object.freeze(result);
      return templateCache;
    },
    saveTemplate(name) {
      assertReady();
      const cleanName = name.trim();
      if (!cleanName || cleanName.length > 80)
        throw new Error("Template name must be between 1 and 80 characters.");
      const id = newLocalId("template");
      const template: Template = {
        id,
        name: cleanName,
        updatedAt: new Date().toISOString(),
        snapshot: freezeSnapshot(cloneSnapshot(currentSnapshot())),
      };
      templateLibrary.set(id, Object.freeze(template));
      templatesChanged();
      const serialized = JSON.stringify(template);
      queueAuxiliaryWrite(
        (activeDatabase) =>
          writeValue(activeDatabase, `${TEMPLATE_KEY_PREFIX}${id}`, serialized),
        () => announce({ templateId: id }),
      );
      return id;
    },
    deleteTemplate(id) {
      assertReady();
      templateLibrary.delete(id);
      templatesChanged();
      queueAuxiliaryWrite(
        (activeDatabase) =>
          deleteValue(activeDatabase, `${TEMPLATE_KEY_PREFIX}${id}`),
        () => announce({ templateId: id }),
      );
    },
  };
  return session;
}

let singleton: WorksheetSession | undefined;

/** One private local worksheet document for this browser profile. */
export function getWorksheetSession(): WorksheetSession {
  singleton ??= createSession();
  return singleton;
}
