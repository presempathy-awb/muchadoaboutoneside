import {
  MAX_SCAN_PIXELS,
  MAX_SCAN_SOURCE_PIXELS,
  MAX_SCAN_SOURCE_SIDE,
} from "./calligraphy-scan";

export interface ScanCropPercent {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ScanCropGeometry {
  rotatedWidth: number;
  rotatedHeight: number;
  crop: { x: number; y: number; width: number; height: number };
  width: number;
  height: number;
  scale: number;
  /** Canvas affine transform from decoded, EXIF-oriented source pixels. */
  transform: [number, number, number, number, number, number];
}

const MAX_ANALYSIS_SIDE = 4096;

function snapAxis(value: number): number {
  if (Math.abs(value) < 1e-12) return 0;
  if (Math.abs(Math.abs(value) - 1) < 1e-12) return Math.sign(value);
  return value;
}

function clamp(value: number, maximum: number): number {
  return Math.min(maximum, Math.max(0, value));
}

/**
 * Crop in the full rotated image's coordinate system before reducing resolution.
 * Only the selected region is allocated; rotation's full bounds are numbers only.
 * Source dimensions must come from the decoded bitmap after EXIF orientation.
 */
export function planScanCrop(
  sourceWidth: number,
  sourceHeight: number,
  rotation: number,
  crop: ScanCropPercent,
): ScanCropGeometry {
  if (
    !Number.isInteger(sourceWidth) ||
    !Number.isInteger(sourceHeight) ||
    sourceWidth < 1 ||
    sourceHeight < 1 ||
    sourceWidth > MAX_SCAN_SOURCE_SIDE ||
    sourceHeight > MAX_SCAN_SOURCE_SIDE ||
    sourceWidth * sourceHeight > MAX_SCAN_SOURCE_PIXELS
  )
    throw new Error(
      "Decoded image exceeds 24 million pixels or 12,000 pixels on one side.",
    );
  if (!Number.isFinite(rotation) || Math.abs(rotation) > 180)
    throw new Error("Rotation must be between -180 and 180 degrees.");
  if (
    !crop ||
    [crop.left, crop.top, crop.right, crop.bottom].some(
      (edge) => !Number.isFinite(edge) || edge < 0 || edge > 100,
    ) ||
    crop.left >= crop.right ||
    crop.top >= crop.bottom
  )
    throw new Error("Crop edges must enclose a nonempty area (0–100%).");

  const angle = (rotation * Math.PI) / 180;
  const cosine = snapAxis(Math.cos(angle));
  const sine = snapAxis(Math.sin(angle));
  const rotatedWidth = Math.ceil(
    Math.abs(sourceWidth * cosine) + Math.abs(sourceHeight * sine),
  );
  const rotatedHeight = Math.ceil(
    Math.abs(sourceWidth * sine) + Math.abs(sourceHeight * cosine),
  );
  // Round outward so selecting a sliver never loses its last source pixel.
  const x = clamp(Math.floor((rotatedWidth * crop.left) / 100), rotatedWidth);
  const y = clamp(Math.floor((rotatedHeight * crop.top) / 100), rotatedHeight);
  const right = clamp(
    Math.ceil((rotatedWidth * crop.right) / 100),
    rotatedWidth,
  );
  const bottom = clamp(
    Math.ceil((rotatedHeight * crop.bottom) / 100),
    rotatedHeight,
  );
  const cropWidth = right - x;
  const cropHeight = bottom - y;
  if (cropWidth < 1 || cropHeight < 1)
    throw new Error("The selected crop contains no pixels.");
  const requestedScale = Math.min(
    1,
    Math.sqrt(MAX_SCAN_PIXELS / (cropWidth * cropHeight)),
    MAX_ANALYSIS_SIDE / cropWidth,
    MAX_ANALYSIS_SIDE / cropHeight,
  );
  const width = Math.max(1, Math.floor(cropWidth * requestedScale));
  const height = Math.max(1, Math.floor(cropHeight * requestedScale));
  // Fit both integer output dimensions with one scale; retain aspect ratio.
  const scale = Math.min(width / cropWidth, height / cropHeight);
  const paddingX = (width - cropWidth * scale) / 2;
  const paddingY = (height - cropHeight * scale) / 2;
  return {
    rotatedWidth,
    rotatedHeight,
    crop: { x, y, width: cropWidth, height: cropHeight },
    width,
    height,
    scale,
    transform: [
      cosine * scale,
      sine * scale,
      -sine * scale,
      cosine * scale,
      paddingX +
        scale *
          (rotatedWidth / 2 -
            x -
            (cosine * sourceWidth) / 2 +
            (sine * sourceHeight) / 2),
      paddingY +
        scale *
          (rotatedHeight / 2 -
            y -
            (sine * sourceWidth) / 2 -
            (cosine * sourceHeight) / 2),
    ],
  };
}
