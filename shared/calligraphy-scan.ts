/** A reviewed, occurrence-specific face for exactly one transcription. */
export interface CalligraphyScanSegment {
  text: string;
  wordStart: number;
  wordEnd: number;
  lineIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CalligraphyScan {
  version: 1;
  id: string;
  name: string;
  calligrapher: string;
  text: string;
  createdAt: string;
  algorithmVersion: string;
  original: {
    name: string;
    type: string;
    bytes: number;
    dataUrl: string;
    sha256: string;
  };
  image: { width: number; height: number; dataUrl: string };
  emHeightPx: number;
  segments: CalligraphyScanSegment[];
  confirmed: true;
}

export type CalligraphyScanSummary = Pick<
  CalligraphyScan,
  | "version"
  | "id"
  | "name"
  | "calligrapher"
  | "text"
  | "createdAt"
  | "algorithmVersion"
  | "emHeightPx"
  | "confirmed"
>;

export const SCAN_ALGORITHM_VERSION = "projection-occurrences-2";
export const MAX_SCAN_FILE_BYTES = 12 * 1024 * 1024;
export const MAX_SCAN_PIXELS = 4_000_000;
export const MAX_SCAN_SOURCE_PIXELS = 24_000_000;
export const MAX_SCAN_SOURCE_SIDE = 12_000;
export const MAX_SCAN_JSON_BYTES = 48 * 1024 * 1024;
export const MAX_SCAN_TEXT_LENGTH = 20_000;

/** Inspect dimensions before browser decode, so compressed files cannot bypass the pixel cap. */
export function inspectScanImageHeader(bytes: Uint8Array): {
  type: "image/png" | "image/jpeg";
  width: number;
  height: number;
} {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let type: "image/png" | "image/jpeg";
  let width = 0;
  let height = 0;
  if (
    bytes.length >= 24 &&
    view.getUint32(0) === 0x89504e47 &&
    view.getUint32(4) === 0x0d0a1a0a &&
    view.getUint32(12) === 0x49484452
  ) {
    type = "image/png";
    width = view.getUint32(16);
    height = view.getUint32(20);
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    type = "image/jpeg";
    let offset = 2;
    while (offset + 3 < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === undefined || marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2].includes(marker) && length >= 8) {
        height = view.getUint16(offset + 3);
        width = view.getUint16(offset + 5);
        break;
      }
      offset += length;
    }
  } else fail("choose a valid PNG or JPEG image.");
  if (!width || !height) fail("the image header is incomplete or unsupported.");
  if (width > MAX_SCAN_SOURCE_SIDE || height > MAX_SCAN_SOURCE_SIDE)
    fail("the original image exceeds 12,000 pixels on one side.");
  if (width * height > MAX_SCAN_SOURCE_PIXELS)
    fail(
      "the original image exceeds 24 million pixels. Use a smaller PNG or JPEG copy.",
    );
  return { type, width, height };
}

export function scanWords(text: string): string[] {
  return text.match(/\S+/gu) ?? [];
}

/** Only whitespace may vary; punctuation, case and Unicode remain exact. */
export function scanTextKey(text: string): string {
  return scanWords(text).join(" ");
}

export function scanMatchesText(
  scan: Pick<CalligraphyScan, "text">,
  text: string,
): boolean {
  return (
    scanTextKey(scan.text) !== "" &&
    scanTextKey(scan.text) === scanTextKey(text)
  );
}

function fail(message: string): never {
  throw new Error(`Cannot use this handwriting: ${message}`);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(`${label} is invalid.`);
  return value as Record<string, unknown>;
}

function string(
  value: unknown,
  label: string,
  max: number,
  empty = false,
): string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (!empty && !value.trim())
  )
    fail(`${label} is missing or too long.`);
  return value;
}

function number(
  value: unknown,
  label: string,
  min: number,
  max: number,
  integer = true,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    fail(`${label} is outside its supported range.`);
  return value;
}

function embeddedImage(value: unknown, type: string, max: number): string {
  const url = string(value, "Embedded image", Math.ceil(max / 3) * 4 + 100);
  const prefix = `data:${type};base64,`;
  if (!url.startsWith(prefix))
    fail("the embedded image type does not match its metadata.");
  const payload = url.slice(prefix.length);
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      payload,
    ) ||
    !payload.length
  )
    fail("the embedded image is not valid base64.");
  return url;
}

export function validateCalligraphyScan(input: unknown): CalligraphyScan {
  const value = record(input, "Scan");
  if (value.version !== 1 || value.confirmed !== true)
    fail("a supported, reviewed scan is required.");
  const text = string(value.text, "Exact transcription", MAX_SCAN_TEXT_LENGTH);
  const words = scanWords(text);
  if (!words.length || words.length > 2_000)
    fail("the transcription must contain 1–2,000 words.");
  const id = string(value.id, "Identifier", 160);
  if (!/^scan-[A-Za-z0-9_-]+$/.test(id))
    fail(
      "the identifier must start with scan- and contain only letters, digits, hyphens or underscores.",
    );
  const createdAt = string(value.createdAt, "Creation date", 40);
  if (!Number.isFinite(Date.parse(createdAt)))
    fail("the creation date is invalid.");
  const source = record(value.original, "Original image");
  const type = string(source.type, "Original image type", 20);
  if (type !== "image/png" && type !== "image/jpeg")
    fail("only PNG and JPEG originals are supported.");
  const originalDataUrl = embeddedImage(
    source.dataUrl,
    type,
    MAX_SCAN_FILE_BYTES,
  );
  const bytes = number(
    source.bytes,
    "Original file size",
    1,
    MAX_SCAN_FILE_BYTES,
  );
  const payload = originalDataUrl.slice(originalDataUrl.indexOf(",") + 1);
  const actualBytes =
    (payload.length * 3) / 4 -
    (payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0);
  if (actualBytes !== bytes)
    fail("the original file size does not match its data.");
  const sourceHeader = inspectScanImageHeader(
    Uint8Array.from(atob(payload), (char) => char.charCodeAt(0)),
  );
  if (sourceHeader.type !== type)
    fail("the original image header does not match its type.");
  const sha256 = string(source.sha256, "Original image digest", 64);
  if (!/^[a-f\d]{64}$/.test(sha256))
    fail("the original image digest is invalid.");
  const image = record(value.image, "Ink image");
  const width = number(image.width, "Image width", 1, MAX_SCAN_PIXELS);
  const height = number(image.height, "Image height", 1, MAX_SCAN_PIXELS);
  if (width * height > MAX_SCAN_PIXELS)
    fail("the ink image exceeds four million pixels.");
  const imageDataUrl = embeddedImage(
    image.dataUrl,
    "image/png",
    20 * 1024 * 1024,
  );
  const inkHeader = inspectScanImageHeader(
    Uint8Array.from(
      atob(
        imageDataUrl.slice(
          imageDataUrl.indexOf(",") + 1,
          imageDataUrl.indexOf(",") + 33,
        ),
      ),
      (char) => char.charCodeAt(0),
    ),
  );
  if (
    inkHeader.type !== "image/png" ||
    inkHeader.width !== width ||
    inkHeader.height !== height
  )
    fail("the ink image dimensions do not match its PNG header.");
  if (
    !Array.isArray(value.segments) ||
    !value.segments.length ||
    value.segments.length > words.length
  )
    fail("the text regions are missing or invalid.");
  let nextWord = 0;
  let lastLine = -1;
  const segments = value.segments.map((item, index): CalligraphyScanSegment => {
    const region = record(item, `Region ${index + 1}`);
    const wordStart = number(
      region.wordStart,
      "First word",
      0,
      words.length - 1,
    );
    const wordEnd = number(
      region.wordEnd,
      "Last word",
      wordStart + 1,
      words.length,
    );
    const lineIndex = number(
      region.lineIndex,
      "Line index",
      0,
      words.length - 1,
    );
    if (
      wordStart !== nextWord ||
      lineIndex < lastLine ||
      lineIndex > lastLine + 1
    )
      fail("the regions must cover the poem once, in reading order.");
    const label = string(region.text, "Region text", MAX_SCAN_TEXT_LENGTH);
    if (scanTextKey(label) !== words.slice(wordStart, wordEnd).join(" "))
      fail("a region does not match the exact transcription.");
    const x = number(region.x, "Region left", 0, width - 1);
    const y = number(region.y, "Region top", 0, height - 1);
    const regionWidth = number(region.width, "Region width", 1, width - x);
    const regionHeight = number(region.height, "Region height", 1, height - y);
    nextWord = wordEnd;
    lastLine = lineIndex;
    return {
      text: label,
      wordStart,
      wordEnd,
      lineIndex,
      x,
      y,
      width: regionWidth,
      height: regionHeight,
    };
  });
  if (nextWord !== words.length) fail("some words have no handwriting region.");
  for (let i = 0; i < segments.length; i++) {
    const a = segments[i];
    if (!a) continue;
    for (let j = i + 1; j < segments.length; j++) {
      const b = segments[j];
      if (
        b &&
        a.x < b.x + b.width &&
        b.x < a.x + a.width &&
        a.y < b.y + b.height &&
        b.y < a.y + a.height
      )
        fail("handwriting regions overlap.");
    }
  }
  return {
    version: 1,
    id,
    name: string(value.name, "Poem name", 160),
    calligrapher: string(value.calligrapher, "Calligrapher", 160),
    text,
    createdAt,
    algorithmVersion: string(value.algorithmVersion, "Algorithm version", 100),
    original: {
      name: string(source.name, "Original filename", 255),
      type,
      bytes,
      dataUrl: originalDataUrl,
      sha256,
    },
    image: { width, height, dataUrl: imageDataUrl },
    emHeightPx: number(value.emHeightPx, "Writing height", 1, height, false),
    segments,
    confirmed: true,
  };
}

export interface ScanLine {
  y: number;
  height: number;
}
export interface ScanAnalysis {
  lines: ScanLine[];
  segments: CalligraphyScanSegment[];
  emHeightPx: number;
  error?: string;
  warnings: string[];
}

/** Binary mask analysis only: never infers characters, spelling or missing ink. */
export function segmentCalligraphyMask(
  mask: Uint8Array,
  width: number,
  height: number,
  text: string,
  lineCuts?: number[],
): ScanAnalysis {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width * height > MAX_SCAN_PIXELS ||
    mask.length !== width * height
  )
    fail("the analysis image dimensions are invalid.");
  if (text.length > MAX_SCAN_TEXT_LENGTH || scanWords(text).length > 2_000)
    fail("the transcription is too long.");
  const transcriptLines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const rows = new Uint32Array(height);
  let ink = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (mask[y * width + x]) {
        rows[y] = (rows[y] ?? 0) + 1;
        ink++;
      }
  const result: ScanAnalysis = {
    lines: [],
    segments: [],
    emHeightPx: 1,
    warnings: [],
  };
  if (!ink)
    return {
      ...result,
      error: "No ink was found. Adjust the threshold or crop.",
    };
  if (ink > mask.length * 0.6)
    return {
      ...result,
      error:
        "Too much of the image is marked as ink. Crop the page or lower the threshold.",
    };
  if (!transcriptLines.length)
    return {
      ...result,
      error:
        "Enter the exact transcription, with one typed line for each handwritten line.",
    };
  const bands: ScanLine[] = [];
  let start = -1;
  for (let y = 0; y <= height; y++) {
    if ((rows[y] ?? 0) > 0 && start < 0) start = y;
    if ((rows[y] ?? 0) === 0 && start >= 0) {
      bands.push({ y: start, height: y - start });
      start = -1;
    }
  }
  if (lineCuts) {
    const cuts = [0, ...lineCuts, height];
    if (
      cuts.some(
        (cut, i) =>
          !Number.isInteger(cut) ||
          cut < 0 ||
          cut > height ||
          (i > 0 && cut <= (cuts[i - 1] ?? 0)),
      )
    )
      return {
        ...result,
        lines: bands,
        error:
          "Line dividers must be increasing pixel positions inside the image.",
      };
    for (const cut of lineCuts) {
      for (let x = 0; x < width; x++) {
        if (!mask[cut * width + x]) continue;
        for (let dx = -1; dx <= 1; dx++)
          if (x + dx >= 0 && x + dx < width && mask[(cut - 1) * width + x + dx])
            return {
              ...result,
              lines: bands,
              error:
                "A line divider crosses a connected stroke. Move the divider or correct the crop/rotation.",
            };
      }
    }
    for (let i = 1; i < cuts.length; i++) {
      let top = cuts[i - 1] ?? 0;
      let bottom = cuts[i] ?? height;
      while (top < bottom && !rows[top]) top++;
      while (bottom > top && !rows[bottom - 1]) bottom--;
      if (bottom === top)
        return {
          ...result,
          lines: bands,
          error: "A manually defined line contains no ink.",
        };
      result.lines.push({ y: top, height: bottom - top });
    }
  } else {
    // Merge very small vertical gaps, never force a desired transcript count.
    const mergeGap = Math.max(1, Math.round(height * 0.002));
    for (const band of bands) {
      const previous = result.lines.at(-1);
      if (previous && band.y - previous.y - previous.height <= mergeGap)
        previous.height = band.y + band.height - previous.y;
      else result.lines.push({ ...band });
    }
  }
  if (result.lines.length !== transcriptLines.length)
    return {
      ...result,
      error: `Found ${result.lines.length} ink lines for ${transcriptLines.length} typed lines. Correct the crop, rotation, transcription line breaks, or set line dividers before saving.`,
    };
  let wordStart = 0;
  const heights: number[] = [];
  result.lines.forEach((line, lineIndex) => {
    const words = scanWords(transcriptLines[lineIndex] ?? "");
    const columns = new Uint32Array(width);
    for (let y = line.y; y < line.y + line.height; y++)
      for (let x = 0; x < width; x++)
        if (mask[y * width + x]) columns[x] = (columns[x] ?? 0) + 1;
    let left = 0;
    let right = width;
    while (left < right && !columns[left]) left++;
    while (right > left && !columns[right - 1]) right--;
    const boundaries: number[] = [];
    const minimumGap = Math.max(2, Math.ceil(line.height * 0.25));
    for (let x = left; x < right; ) {
      if (columns[x]) {
        x++;
        continue;
      }
      const begin = x;
      while (x < right && !columns[x]) x++;
      if (x - begin >= minimumGap) boundaries.push(Math.floor((begin + x) / 2));
    }
    const splitWords = boundaries.length === words.length - 1;
    const edges = splitWords ? [left, ...boundaries, right] : [left, right];
    if (!splitWords && words.length > 1)
      result.warnings.push(
        `Line ${lineIndex + 1} stays together as ${words.length} words because clear word spaces could not be matched safely.`,
      );
    for (let i = 1; i < edges.length; i++) {
      let x = edges[i - 1] ?? left;
      let end = edges[i] ?? right;
      while (x < end && !columns[x]) x++;
      while (end > x && !columns[end - 1]) end--;
      const count = splitWords ? 1 : words.length;
      result.segments.push({
        text: splitWords ? (words[i - 1] ?? "") : words.join(" "),
        wordStart,
        wordEnd: wordStart + count,
        lineIndex,
        x,
        y: line.y,
        width: end - x,
        height: line.height,
      });
      wordStart += count;
    }
    heights.push(line.height);
  });
  heights.sort((a, b) => a - b);
  result.emHeightPx = heights[Math.floor(heights.length / 2)] ?? 1;
  return result;
}
