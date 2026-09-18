import {
  inspectScanImageHeader,
  MAX_SCAN_FILE_BYTES,
  MAX_SCAN_PIXELS,
  MAX_SCAN_SOURCE_PIXELS,
  MAX_SCAN_SOURCE_SIDE,
  SCAN_ALGORITHM_VERSION,
  segmentCalligraphyMask,
} from "../../shared/calligraphy-scan";
import type {
  ScanImportPreview,
  ScanImportSettings,
} from "./calligraphy-scan-import";

function base64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 0x8000)
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + 0x8000)));
  return btoa(chunks.join(""));
}

async function processFile(
  file: File,
  settings: ScanImportSettings,
): Promise<ScanImportPreview> {
  if (!file.size || file.size > MAX_SCAN_FILE_BYTES)
    throw new Error("Choose an image smaller than 12 MB.");
  if (
    !Number.isFinite(settings.rotation) ||
    Math.abs(settings.rotation) > 180 ||
    !Number.isFinite(settings.threshold) ||
    settings.threshold < 1 ||
    settings.threshold > 254
  )
    throw new Error("Rotation or threshold is invalid.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const header = inspectScanImageHeader(bytes);
  const bitmap = await createImageBitmap(
    new Blob([bytes], { type: header.type }),
    {
      imageOrientation: "from-image",
      colorSpaceConversion: "none",
      premultiplyAlpha: "none",
    },
  );
  try {
    if (
      !bitmap.width ||
      !bitmap.height ||
      bitmap.width * bitmap.height > MAX_SCAN_SOURCE_PIXELS ||
      bitmap.width > MAX_SCAN_SOURCE_SIDE ||
      bitmap.height > MAX_SCAN_SOURCE_SIDE
    )
      throw new Error(
        "Decoded image exceeds 24 million pixels or 12,000 pixels on one side.",
      );
    const angle = (settings.rotation * Math.PI) / 180;
    const rawWidth = Math.ceil(
      Math.abs(bitmap.width * Math.cos(angle)) +
        Math.abs(bitmap.height * Math.sin(angle)),
    );
    const rawHeight = Math.ceil(
      Math.abs(bitmap.width * Math.sin(angle)) +
        Math.abs(bitmap.height * Math.cos(angle)),
    );
    const scale = Math.min(
      1,
      Math.sqrt(MAX_SCAN_PIXELS / (rawWidth * rawHeight)),
      4096 / rawWidth,
      4096 / rawHeight,
    );
    const rotated = new OffscreenCanvas(
      Math.max(1, Math.floor(rawWidth * scale)),
      Math.max(1, Math.floor(rawHeight * scale)),
    );
    const rotationContext = rotated.getContext("2d");
    if (!rotationContext)
      throw new Error("A local image canvas could not be allocated.");
    rotationContext.fillStyle = "white";
    rotationContext.fillRect(0, 0, rotated.width, rotated.height);
    rotationContext.translate(rotated.width / 2, rotated.height / 2);
    rotationContext.rotate(angle);
    rotationContext.scale(scale, scale);
    rotationContext.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
    const { left, top, right, bottom } = settings.crop;
    if (
      [left, top, right, bottom].some(
        (n) => !Number.isFinite(n) || n < 0 || n > 100,
      ) ||
      left >= right ||
      top >= bottom
    )
      throw new Error("Crop edges must enclose a nonempty area (0–100%).");
    const x = Math.floor((rotated.width * left) / 100);
    const y = Math.floor((rotated.height * top) / 100);
    const width = Math.max(1, Math.floor((rotated.width * right) / 100) - x);
    const height = Math.max(1, Math.floor((rotated.height * bottom) / 100) - y);
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context)
      throw new Error("A local image canvas could not be allocated.");
    context.drawImage(rotated, x, y, width, height, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height);
    const mask = new Uint8Array(width * height);
    for (let i = 0; i < mask.length; i++) {
      const offset = i * 4;
      const luminance =
        ((pixels.data[offset] ?? 255) * 77 +
          (pixels.data[offset + 1] ?? 255) * 150 +
          (pixels.data[offset + 2] ?? 255) * 29) >>
        8;
      mask[i] = luminance < settings.threshold ? 1 : 0;
      pixels.data[offset + 3] = mask[i]
        ? Math.min(
            255,
            Math.round(
              ((settings.threshold - luminance) * 255) /
                Math.max(1, settings.threshold - 40),
            ),
          )
        : 0;
    }
    const analysis = segmentCalligraphyMask(
      mask,
      width,
      height,
      settings.text,
      settings.lineCuts,
    );
    context.putImageData(pixels, 0, 0);
    const inkBlob = await canvas.convertToBlob({ type: "image/png" });
    const digest = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
    return {
      algorithmVersion: SCAN_ALGORITHM_VERSION,
      original: {
        name: file.name,
        type: header.type,
        bytes: bytes.length,
        sha256: digest,
        dataUrl: `data:${header.type};base64,${base64(bytes)}`,
      },
      image: {
        width,
        height,
        dataUrl: `data:image/png;base64,${base64(new Uint8Array(await inkBlob.arrayBuffer()))}`,
      },
      analysis,
    };
  } finally {
    bitmap.close();
  }
}

self.onmessage = (
  event: MessageEvent<{ file: File; settings: ScanImportSettings }>,
) => {
  void processFile(event.data.file, event.data.settings).then(
    (preview) => self.postMessage({ preview }),
    (error: unknown) =>
      self.postMessage({
        error:
          error instanceof Error
            ? error.message
            : "Could not decode this image. Choose a valid PNG or JPEG.",
      }),
  );
};
