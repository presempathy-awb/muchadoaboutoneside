export const WORKSHEET_PHOTO_MAX_BYTES = 15 * 1024 * 1024;
export const WORKSHEET_PHOTO_MAX_DATA_URL_BYTES = 2 * 1024 * 1024;
export const WORKSHEET_PHOTO_MAX_SIDE_PX = 1800;

export interface PhotoPoint {
  x: number;
  y: number;
}

export interface NormalizedWorksheetImage {
  dataUrl: string;
  pixelWidth: number;
  pixelHeight: number;
}

export function clampFinite(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

export function fitImageDimensions(
  width: number,
  height: number,
  maxSide = WORKSHEET_PHOTO_MAX_SIDE_PX,
) {
  if (
    !(width > 0) ||
    !(height > 0) ||
    !(maxSide > 0) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isFinite(maxSide)
  ) {
    throw new Error("The image dimensions are not valid.");
  }
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function pointDistance(first: PhotoPoint, second: PhotoPoint) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

export function calibrationMmPerPixel(
  first: PhotoPoint,
  second: PhotoPoint,
  knownLengthMm: number,
) {
  const pixels = pointDistance(first, second);
  if (
    !(pixels > 0) ||
    !Number.isFinite(pixels) ||
    !(knownLengthMm > 0) ||
    !Number.isFinite(knownLengthMm)
  ) {
    return undefined;
  }
  return knownLengthMm / pixels;
}

export function measurementMm(
  first: PhotoPoint,
  second: PhotoPoint,
  mmPerPixel: number,
) {
  if (!(mmPerPixel > 0) || !Number.isFinite(mmPerPixel)) return undefined;
  const millimetres = pointDistance(first, second) * mmPerPixel;
  return Number.isFinite(millimetres) && millimetres > 0
    ? millimetres
    : undefined;
}

export function approximateFontSizePt(xHeightMm: number) {
  if (!(xHeightMm > 0) || !Number.isFinite(xHeightMm)) return undefined;
  return (xHeightMm * 72 * 2) / 25.4;
}

export function dataUrlByteLength(dataUrl: string) {
  return new TextEncoder().encode(dataUrl).byteLength;
}

function isAcceptedImage(file: File) {
  return ["image/jpeg", "image/png", "image/webp"].includes(file.type);
}

async function decodeImage(file: File): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  close?: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;
    await image.decode();
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function renderToCanvas(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot prepare the image.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(
    source,
    0,
    0,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height,
  );
  return canvas;
}

export async function normalizeWorksheetImage(
  file: File,
): Promise<NormalizedWorksheetImage> {
  if (!isAcceptedImage(file)) {
    throw new Error("Choose a PNG, JPEG, or WebP image.");
  }
  if (file.size > WORKSHEET_PHOTO_MAX_BYTES) {
    throw new Error("Choose an image no larger than 15 MB.");
  }

  let decoded: Awaited<ReturnType<typeof decodeImage>>;
  try {
    decoded = await decodeImage(file);
  } catch {
    throw new Error(
      "That image could not be read. Try another PNG, JPEG, or WebP.",
    );
  }

  try {
    let dimensions = fitImageDimensions(decoded.width, decoded.height);
    let canvas = renderToCanvas(
      decoded.source,
      decoded.width,
      decoded.height,
      dimensions.width,
      dimensions.height,
    );

    let dataUrl =
      file.type === "image/png"
        ? canvas.toDataURL("image/png")
        : canvas.toDataURL("image/jpeg", 0.88);
    if (dataUrlByteLength(dataUrl) <= WORKSHEET_PHOTO_MAX_DATA_URL_BYTES) {
      return { dataUrl, pixelWidth: canvas.width, pixelHeight: canvas.height };
    }

    const qualities = [0.86, 0.76, 0.66, 0.56, 0.46];
    for (let pass = 0; pass < 5; pass += 1) {
      for (const quality of qualities) {
        dataUrl = canvas.toDataURL("image/jpeg", quality);
        if (dataUrlByteLength(dataUrl) <= WORKSHEET_PHOTO_MAX_DATA_URL_BYTES) {
          return {
            dataUrl,
            pixelWidth: canvas.width,
            pixelHeight: canvas.height,
          };
        }
      }
      dimensions = {
        width: Math.max(1, Math.round(canvas.width * 0.82)),
        height: Math.max(1, Math.round(canvas.height * 0.82)),
      };
      canvas = renderToCanvas(
        canvas,
        canvas.width,
        canvas.height,
        dimensions.width,
        dimensions.height,
      );
    }
    throw new Error(
      "The image is too detailed to store locally. Try a smaller crop.",
    );
  } finally {
    decoded.close?.();
  }
}
