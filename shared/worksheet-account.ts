import { normalizeWorksheetSettings } from "./worksheet";

/** A crew account holds one current worksheet. Photos and fonts ride inside it. */
export const WORKSHEET_ACCOUNT_MAX_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_LENGTH = 20_000;
const MAX_ASSET_DATA_URL_LENGTH = 3 * 1024 * 1024;

export const CREW_WORKSHEET_ORIGIN = "https://erebe.muchadoaboutoneside.com";
export const CREW_WORKSHEET_PATH = "/crew/api/worksheet";

export interface WorksheetAccountPhoto {
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

export interface WorksheetAccountSnapshot {
  version: 1;
  settings: ReturnType<typeof normalizeWorksheetSettings>;
  text: string;
  photo?: WorksheetAccountPhoto;
  customFont?: { name: string; dataUrl: string };
}

export class WorksheetAccountRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorksheetAccountRejected";
  }
}

function finite(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new WorksheetAccountRejected(`${label} must be a finite number`);
  return value;
}

function photoOf(value: unknown): WorksheetAccountPhoto | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null)
    throw new WorksheetAccountRejected("photo must be an object");
  const photo = value as Record<string, unknown>;
  const dataUrl = photo.dataUrl;
  if (typeof dataUrl !== "string" || dataUrl.length > MAX_ASSET_DATA_URL_LENGTH)
    throw new WorksheetAccountRejected("photo is missing or too large");
  const rotation = photo.rotation;
  if (rotation !== 0 && rotation !== 90 && rotation !== 180 && rotation !== 270)
    throw new WorksheetAccountRejected("photo rotation is not a quarter turn");
  return {
    dataUrl,
    pixelWidth: finite(photo.pixelWidth, "pixelWidth"),
    pixelHeight: finite(photo.pixelHeight, "pixelHeight"),
    widthMm: finite(photo.widthMm, "widthMm"),
    xMm: finite(photo.xMm, "xMm"),
    yMm: finite(photo.yMm, "yMm"),
    opacity: finite(photo.opacity, "opacity"),
    rotation,
    print: photo.print === true,
  };
}

function fontOf(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null)
    throw new WorksheetAccountRejected("customFont must be an object");
  const font = value as Record<string, unknown>;
  if (
    typeof font.name !== "string" ||
    font.name.length === 0 ||
    font.name.length > 200
  )
    throw new WorksheetAccountRejected(
      "customFont name is missing or too long",
    );
  if (
    typeof font.dataUrl !== "string" ||
    font.dataUrl.length > MAX_ASSET_DATA_URL_LENGTH
  )
    throw new WorksheetAccountRejected("customFont is missing or too large");
  return { name: font.name, dataUrl: font.dataUrl };
}

/** Accept a browser snapshot and return the exact document the account will store. */
export function parseWorksheetAccountSnapshot(
  value: unknown,
): WorksheetAccountSnapshot {
  if (typeof value !== "object" || value === null)
    throw new WorksheetAccountRejected("worksheet must be an object");
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1)
    throw new WorksheetAccountRejected("worksheet version must be 1");
  if (typeof raw.text !== "string" || raw.text.length > MAX_TEXT_LENGTH)
    throw new WorksheetAccountRejected("worksheet text is missing or too long");
  let settings: WorksheetAccountSnapshot["settings"];
  try {
    settings = normalizeWorksheetSettings(raw.settings);
  } catch {
    throw new WorksheetAccountRejected("worksheet settings are not usable");
  }
  const snapshot: WorksheetAccountSnapshot = {
    version: 1,
    settings,
    text: raw.text,
    photo: photoOf(raw.photo),
    customFont: fontOf(raw.customFont),
  };
  if (JSON.stringify(snapshot).length > WORKSHEET_ACCOUNT_MAX_BYTES)
    throw new WorksheetAccountRejected("worksheet is too large");
  return snapshot;
}
