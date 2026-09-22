import {
  type CalligraphyScan,
  inspectScanImageHeader,
  MAX_SCAN_PIXELS,
  scanWords,
} from "../../shared/calligraphy-scan";
import type { LetteringPhysicalFit } from "../../shared/lettering-visibility";
import type {
  ScaleLetteringPlacement,
  ScaleLetteringPlate,
  ScaleLetteringResult,
} from "../../shared/scale-lettering";
import type { ScaleTypography } from "./scale-typography";

export interface ScaleLetteringVisibilityMetrics {
  /** Smallest measured selected-line ink height divided by its physical em size. */
  inkHeightEm?: number;
  /** Actual lower-case x ink, never line box height or the nominal em size. */
  xHeightEm?: number;
  /** Retained native scan ink height, before any display resizing. */
  sourceInkHeightPx?: number;
}

interface FontMetricsCache {
  xMeasured: boolean;
  xHeightEm?: number;
  lines: Map<string, number | undefined>;
  keyCharacters: number;
}
const fontMetrics = new WeakMap<ScaleTypography, FontMetricsCache>();
const MAX_LINES = 1024;
const MAX_KEY_CHARACTERS = 512 * 1024;

/** Half-opacity excludes faint antialias fringes; it is a declared sampling rule. */
export const SCAN_VISIBILITY_ALPHA_THRESHOLD = 128;
export interface ScanInkVisibility {
  scanId: string;
  imageWidth: number;
  imageHeight: number;
  alphaThreshold: typeof SCAN_VISIBILITY_ALPHA_THRESHOLD;
  segments: { wordStart: number; wordEnd: number; inkHeightPx: number }[];
}

/** Bounded deterministic scan of retained raster pixels, without recognizing text. */
export function measureScanInkPixels(
  scan: Pick<CalligraphyScan, "id" | "image" | "segments">,
  rgba: Uint8ClampedArray,
): ScanInkVisibility | undefined {
  const { width, height } = scan.image;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width * height > MAX_SCAN_PIXELS ||
    rgba.length !== width * height * 4 ||
    !scan.segments.length ||
    scan.segments.length > 2000
  )
    return undefined;
  let sampledArea = 0;
  const segments: ScanInkVisibility["segments"] = [];
  for (const region of scan.segments) {
    const { x, y, width: regionWidth, height: regionHeight } = region;
    sampledArea += regionWidth * regionHeight;
    if (
      ![
        x,
        y,
        regionWidth,
        regionHeight,
        region.wordStart,
        region.wordEnd,
      ].every(Number.isSafeInteger) ||
      x < 0 ||
      y < 0 ||
      regionWidth < 1 ||
      regionHeight < 1 ||
      x + regionWidth > width ||
      y + regionHeight > height ||
      sampledArea > MAX_SCAN_PIXELS ||
      region.wordStart < 0 ||
      region.wordEnd <= region.wordStart
    )
      return undefined;
    let top = height;
    let bottom = -1;
    for (let row = y; row < y + regionHeight; row++) {
      for (let column = x; column < x + regionWidth; column++) {
        if (
          (rgba[(row * width + column) * 4 + 3] ?? 0) <
          SCAN_VISIBILITY_ALPHA_THRESHOLD
        )
          continue;
        top = Math.min(top, row);
        bottom = Math.max(bottom, row);
        break;
      }
    }
    segments.push({
      wordStart: region.wordStart,
      wordEnd: region.wordEnd,
      inkHeightPx: bottom < top ? 0 : bottom - top + 1,
    });
  }
  return {
    scanId: scan.id,
    imageWidth: width,
    imageHeight: height,
    alphaThreshold: SCAN_VISIBILITY_ALPHA_THRESHOLD,
    segments,
  };
}

const scanMetrics = new WeakMap<
  CalligraphyScan,
  Promise<ScanInkVisibility | undefined>
>();

/** Decode one already-saved local ink PNG; failures remain explicitly unmeasured. */
export function measureScanInkVisibility(
  scan: CalligraphyScan,
): Promise<ScanInkVisibility | undefined> {
  const cached = scanMetrics.get(scan);
  if (cached) return cached;
  const pending = (async () => {
    let image: HTMLImageElement | undefined;
    let canvas: HTMLCanvasElement | undefined;
    try {
      if (typeof Image === "undefined" || typeof document === "undefined")
        return undefined;
      const prefix = "data:image/png;base64,";
      if (
        !scan.image.dataUrl.startsWith(prefix) ||
        scan.image.dataUrl.length > Math.ceil((20 * 1024 * 1024) / 3) * 4 + 100
      )
        return undefined;
      const header = inspectScanImageHeader(
        Uint8Array.from(
          atob(scan.image.dataUrl.slice(prefix.length, prefix.length + 32)),
          (character) => character.charCodeAt(0),
        ),
      );
      if (
        header.width !== scan.image.width ||
        header.height !== scan.image.height ||
        header.width * header.height > MAX_SCAN_PIXELS
      )
        return undefined;
      image = new Image();
      image.decoding = "async";
      image.src = scan.image.dataUrl;
      await image.decode();
      if (
        image.naturalWidth !== header.width ||
        image.naturalHeight !== header.height
      )
        return undefined;
      canvas = document.createElement("canvas");
      canvas.width = header.width;
      canvas.height = header.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return undefined;
      context.drawImage(image, 0, 0);
      return measureScanInkPixels(
        scan,
        context.getImageData(0, 0, header.width, header.height).data,
      );
    } catch {
      return undefined;
    } finally {
      if (image) image.src = "";
      if (canvas) canvas.width = canvas.height = 0;
    }
  })();
  scanMetrics.set(scan, pending);
  return pending;
}

function positive(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

/** Cache by loaded typography identity; never shape again on every camera frame. */
export function measureScaleLetteringVisibilityMetrics(
  typography: ScaleTypography,
  placements: readonly ScaleLetteringPlacement[],
  scan?: CalligraphyScan,
  scanInk?: ScanInkVisibility,
): ScaleLetteringVisibilityMetrics {
  // A scan's region rectangle may contain empty pixels above a short word.
  // Its crop/em metadata cannot establish actual ink height or x-height.
  if (typography.engine === "scan") {
    if (
      !scan ||
      !scanInk ||
      !positive(scan.emHeightPx) ||
      scanInk.scanId !== scan.id ||
      scanInk.imageWidth !== scan.image.width ||
      scanInk.imageHeight !== scan.image.height
    )
      return {};
    const words = scanWords(scan.text);
    let minimum = Number.POSITIVE_INFINITY;
    for (const placement of placements) {
      for (const [index, line] of placement.lines.entries()) {
        if (!line.trim()) continue;
        const range = placement.lineRanges?.[index];
        if (
          !range ||
          words.slice(range.wordStart, range.wordEnd).join(" ") !==
            scanWords(line).join(" ")
        )
          return {};
        const selected = scanInk.segments.filter(
          (segment) =>
            segment.wordStart >= range.wordStart &&
            segment.wordEnd <= range.wordEnd,
        );
        if (
          selected[0]?.wordStart !== range.wordStart ||
          selected.at(-1)?.wordEnd !== range.wordEnd
        )
          return {};
        for (const segment of selected)
          minimum = Math.min(minimum, segment.inkHeightPx);
      }
    }
    return Number.isFinite(minimum)
      ? {
          ...(minimum > 0 ? { inkHeightEm: minimum / scan.emHeightPx } : {}),
          sourceInkHeightPx: minimum,
        }
      : {};
  }
  let cache = fontMetrics.get(typography);
  if (!cache) {
    cache = { xMeasured: false, lines: new Map(), keyCharacters: 0 };
    fontMetrics.set(typography, cache);
  }
  if (!cache.xMeasured) {
    cache.xMeasured = true;
    try {
      if (typography.hasGlyph("x")) {
        const height = typography.shape("x", 1).inkBoundsMm?.height;
        if (positive(height)) cache.xHeightEm = height;
      }
    } catch {
      // Missing/unsupported glyphs remain explicitly unmeasured.
    }
  }
  let minimum = Number.POSITIVE_INFINITY;
  let complete = true;
  for (const placement of placements) {
    for (const text of placement.lines) {
      if (!text.trim()) continue;
      let height = cache.lines.get(text);
      if (!cache.lines.has(text)) {
        try {
          const value = typography.shape(text, 1).inkBoundsMm?.height;
          if (positive(value)) height = value;
        } catch {
          // One unsupported run prevents a blanket measured-ink claim.
        }
        while (
          cache.lines.size &&
          (cache.lines.size >= MAX_LINES ||
            cache.keyCharacters + text.length > MAX_KEY_CHARACTERS)
        ) {
          const oldest = cache.lines.keys().next().value;
          if (oldest === undefined) break;
          cache.lines.delete(oldest);
          cache.keyCharacters -= oldest.length;
        }
        if (text.length <= MAX_KEY_CHARACTERS) {
          cache.lines.set(text, height);
          cache.keyCharacters += text.length;
        }
      }
      if (positive(height)) minimum = Math.min(minimum, height);
      else complete = false;
    }
  }
  return {
    ...(complete && Number.isFinite(minimum) ? { inkHeightEm: minimum } : {}),
    ...(cache.xHeightEm === undefined ? {} : { xHeightEm: cache.xHeightEm }),
  };
}

/** Rechecks the actual line measurer/ranges and the line boxes used by rendering. */
export function measureScaleLetteringPhysicalFit(
  plates: readonly ScaleLetteringPlate[],
  lettering: ScaleLetteringResult,
  typography: ScaleTypography,
  marginMm: number,
): LetteringPhysicalFit {
  const result: LetteringPhysicalFit = {
    totalWordCount: lettering.totalWordCount,
    placedWordCount: lettering.placements.reduce(
      (sum, placement) =>
        placement.flipped
          ? sum
          : sum +
            placement.lines.reduce(
              (count, line) => count + (line.match(/\S+/gu)?.length ?? 0),
              0,
            ),
      0,
    ),
    unplacedText: lettering.unplacedText,
  };
  if (!Number.isFinite(marginMm) || marginMm < 0) return result;
  const byId = new Map(plates.map((plate) => [plate.id, plate]));
  const seen = new Set<string>();
  let overflow = 0;
  try {
    for (const placement of lettering.placements) {
      if (!placement.lines.some((line) => line.trim())) continue;
      const plate = byId.get(placement.plateId);
      if (!plate || seen.has(placement.plateId)) {
        overflow++;
        continue;
      }
      seen.add(placement.plateId);
      const { x, y, width, height } = plate.safeRect;
      if (
        ![x, y, width, height].every(Number.isFinite) ||
        x < 0 ||
        y < 0 ||
        width < 0 ||
        height < 0 ||
        x + width > 1 ||
        y + height > 1 ||
        !positive(plate.widthInches) ||
        !positive(plate.heightInches)
      ) {
        overflow++;
        continue;
      }
      const availableWidth = Math.max(
        0,
        plate.widthInches * 25.4 * width - 2 * marginMm,
      );
      const availableHeight = Math.max(
        0,
        plate.heightInches * 25.4 * height - 2 * marginMm,
      );
      let usedHeight = 0;
      let outside = false;
      for (const [index, text] of placement.lines.entries()) {
        const measured = typography.measureLine(
          text,
          placement.fontSizeMm,
          placement.lineRanges?.[index],
        );
        const renderedHeight =
          placement.lineHeightsMm?.[index] ?? placement.fontSizeMm * 1.4;
        if (
          !positive(measured.heightMm) ||
          !Number.isFinite(measured.widthMm) ||
          measured.widthMm < 0 ||
          !positive(renderedHeight)
        )
          return result;
        // A shorter rendered box could overlap neighboring ink even if the sum fits.
        outside ||=
          measured.widthMm > availableWidth + 1e-7 ||
          measured.heightMm > renderedHeight + 1e-7;
        usedHeight += renderedHeight;
      }
      if (outside || usedHeight > availableHeight + 1e-7) overflow++;
    }
  } catch {
    return result;
  }
  return { ...result, inkOverflowCount: overflow };
}
