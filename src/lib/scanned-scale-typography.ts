import {
  type CalligraphyScan,
  scanMatchesText,
  scanWords,
  validateCalligraphyScan,
} from "../../shared/calligraphy-scan";
import type { ScaleTextRange } from "../../shared/scale-lettering";
import type { ScaleTypography } from "./scale-typography";

const MAX_LAYOUTS = 1_024;
const LEADING_EM = 0.2;

interface InkLayout {
  first: number;
  end: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A poem-specific raster face: each crop is the reviewed ink for that occurrence.
 * Source-row gaps stay intact; reflow between source rows uses their median gap.
 * Every crop is scaled uniformly, with no character synthesis or font shaping.
 */
export async function loadScannedScaleTypography(
  input: CalligraphyScan,
  text: string,
): Promise<ScaleTypography> {
  const scan = validateCalligraphyScan(input);
  if (!scanMatchesText(scan, text))
    throw new Error(
      "This handwriting belongs to a different transcription. Restore its exact words and punctuation or select another face.",
    );
  if (typeof Image === "undefined" || typeof document === "undefined")
    throw new Error("Scanned handwriting needs a browser image and canvas.");

  const image = new Image();
  image.decoding = "async";
  image.src = scan.image.dataUrl;
  try {
    await image.decode();
  } catch {
    image.src = "";
    throw new Error("The saved handwriting ink image could not be decoded.");
  }
  if (
    image.naturalWidth !== scan.image.width ||
    image.naturalHeight !== scan.image.height
  ) {
    image.src = "";
    throw new Error(
      "The decoded handwriting dimensions do not match its saved regions.",
    );
  }

  const words = scanWords(scan.text);
  const regions = scan.segments;
  const segments = regions.map(({ wordStart, wordEnd }) => ({
    wordStart,
    wordEnd,
  }));
  const firstByWord = new Map(
    regions.map((region, index) => [region.wordStart, index]),
  );
  const endByWord = new Map(
    regions.map((region, index) => [region.wordEnd, index + 1]),
  );
  const rowBottoms = new Map<number, number>();
  const gaps: number[] = [];
  for (const [index, region] of regions.entries()) {
    rowBottoms.set(
      region.lineIndex,
      Math.max(rowBottoms.get(region.lineIndex) ?? 0, region.y + region.height),
    );
    const previous = regions[index - 1];
    if (previous && previous.lineIndex === region.lineIndex) {
      const gap = region.x - previous.x - previous.width;
      if (gap < 0) {
        image.src = "";
        throw new Error(
          "Handwriting regions on a line must follow their left-to-right reading order.",
        );
      }
      gaps.push(gap);
    }
  }
  gaps.sort((left, right) => left - right);
  const rowGap = gaps[Math.floor(gaps.length / 2)] ?? scan.emHeightPx * 0.4;
  let cursor = 0;
  const positions = regions.map((region, index) => {
    const previous = regions[index - 1];
    if (previous)
      cursor +=
        previous.lineIndex === region.lineIndex
          ? region.x - previous.x - previous.width
          : rowGap;
    const position = {
      x: cursor,
      y:
        region.y -
        (rowBottoms.get(region.lineIndex) ?? region.y + region.height),
    };
    cursor += region.width;
    return position;
  });

  const layouts = new Map<string, InkLayout>();
  let tintCanvas: HTMLCanvasElement | undefined;
  let tintContext: CanvasRenderingContext2D | null | undefined;
  let tint: CanvasRenderingContext2D["fillStyle"] | undefined;
  let disposed = false;

  const checkSize = (sizeMm: number) => {
    if (disposed)
      throw new Error("This handwriting preview has been released.");
    if (!Number.isFinite(sizeMm) || sizeMm <= 0 || sizeMm > 700)
      throw new RangeError(
        "Font size must be greater than zero and at most 700 mm.",
      );
    return sizeMm / scan.emHeightPx;
  };
  const layoutFor = (line: string, range?: ScaleTextRange): InkLayout => {
    const actual =
      range ??
      (scanMatchesText(scan, line)
        ? { wordStart: 0, wordEnd: words.length }
        : undefined);
    if (!actual)
      throw new Error(
        "A handwriting line needs its source word occurrence range.",
      );
    const { wordStart, wordEnd } = actual;
    if (
      !Number.isInteger(wordStart) ||
      !Number.isInteger(wordEnd) ||
      wordStart < 0 ||
      wordEnd <= wordStart ||
      wordEnd > words.length
    )
      throw new Error("The handwriting source word range is invalid.");
    const first = firstByWord.get(wordStart);
    const end = endByWord.get(wordEnd);
    if (first === undefined || end === undefined || first >= end)
      throw new Error(
        "Joined handwriting must remain together; this range cuts through an ink segment.",
      );
    const lineWords = scanWords(line);
    if (
      lineWords.length !== wordEnd - wordStart ||
      lineWords.some((word, index) => word !== words[wordStart + index])
    )
      throw new Error(
        "The lettering does not match the handwriting at this source occurrence.",
      );
    const key = `${wordStart}:${wordEnd}`;
    const cached = layouts.get(key);
    if (cached) return cached;
    const firstPosition = positions[first];
    const lastPosition = positions[end - 1];
    const lastRegion = regions[end - 1];
    if (!firstPosition || !lastPosition || !lastRegion)
      throw new Error("A handwriting region is unavailable.");
    let top = Number.POSITIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;
    for (let index = first; index < end; index++) {
      const position = positions[index];
      const region = regions[index];
      if (!position || !region) continue;
      top = Math.min(top, position.y);
      bottom = Math.max(bottom, position.y + region.height);
    }
    const layout = {
      first,
      end,
      x: firstPosition.x,
      y: top,
      width: lastPosition.x + lastRegion.width - firstPosition.x,
      height: bottom - top,
    };
    if (layouts.size >= MAX_LAYOUTS) {
      const oldest = layouts.keys().next().value;
      if (oldest !== undefined) layouts.delete(oldest);
    }
    layouts.set(key, layout);
    return layout;
  };

  const tintedImage = (fillStyle: CanvasRenderingContext2D["fillStyle"]) => {
    if (!tintCanvas) {
      tintCanvas = document.createElement("canvas");
      tintCanvas.width = scan.image.width;
      tintCanvas.height = scan.image.height;
      tintContext = tintCanvas.getContext("2d");
    }
    if (!tintContext)
      throw new Error(
        "This browser could not prepare the handwriting ink canvas.",
      );
    if (tint !== fillStyle) {
      tintContext.clearRect(0, 0, tintCanvas.width, tintCanvas.height);
      tintContext.globalCompositeOperation = "source-over";
      tintContext.drawImage(image, 0, 0);
      tintContext.globalCompositeOperation = "source-in";
      tintContext.fillStyle = fillStyle;
      tintContext.fillRect(0, 0, tintCanvas.width, tintCanvas.height);
      tintContext.globalCompositeOperation = "source-over";
      tint = fillStyle;
    }
    return tintCanvas;
  };

  const measureLine: ScaleTypography["measureLine"] = (line, sizeMm, range) => {
    const scale = checkSize(sizeMm);
    const layout = layoutFor(line, range);
    return {
      widthMm: layout.width * scale,
      heightMm: layout.height * scale + sizeMm * LEADING_EM,
    };
  };
  return {
    family: scan.name,
    engine: "scan",
    supportedFeatures: [],
    segments,
    hasGlyph: (candidate) => scanMatchesText(scan, candidate),
    shape() {
      throw new Error(
        "Scanned handwriting contains raster ink, not font outlines. Use its measured ink renderer.",
      );
    },
    measure: (line, sizeMm, range) => measureLine(line, sizeMm, range).widthMm,
    measureLine,
    draw(context, line, sizeMm, centerXmm, centerYmm, range) {
      const scale = checkSize(sizeMm);
      const layout = layoutFor(line, range);
      if (!Number.isFinite(centerXmm) || !Number.isFinite(centerYmm))
        throw new RangeError("Handwriting drawing coordinates must be finite.");
      const source = tintedImage(context.fillStyle);
      const left = centerXmm - (layout.width * scale) / 2;
      const top = centerYmm - (layout.height * scale) / 2;
      for (let index = layout.first; index < layout.end; index++) {
        const region = regions[index];
        const position = positions[index];
        if (!region || !position) continue;
        context.drawImage(
          source,
          region.x,
          region.y,
          region.width,
          region.height,
          left + (position.x - layout.x) * scale,
          top + (position.y - layout.y) * scale,
          region.width * scale,
          region.height * scale,
        );
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      image.src = "";
      if (tintCanvas) tintCanvas.width = tintCanvas.height = 0;
      tintCanvas = undefined;
      tintContext = undefined;
      layouts.clear();
    },
  };
}
