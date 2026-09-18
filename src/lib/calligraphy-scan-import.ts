import {
  type CalligraphyScan,
  MAX_SCAN_FILE_BYTES,
  MAX_SCAN_JSON_BYTES,
  type ScanAnalysis,
  validateCalligraphyScan,
} from "../../shared/calligraphy-scan";
import { verifyCalligraphyScanOriginal } from "./calligraphy-scan-store";

export interface ScanImportSettings {
  text: string;
  rotation: number;
  threshold: number;
  crop: { left: number; top: number; right: number; bottom: number };
  lineCuts?: number[];
}

export interface ScanImportPreview {
  algorithmVersion: string;
  original: CalligraphyScan["original"];
  image: CalligraphyScan["image"];
  analysis: ScanAnalysis;
}

export function analyzeCalligraphyFile(
  file: File,
  settings: ScanImportSettings,
  signal: AbortSignal,
): Promise<ScanImportPreview> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Scan cancelled", "AbortError"));
      return;
    }
    if (!file.size || file.size > MAX_SCAN_FILE_BYTES) {
      reject(
        new Error(
          "Choose a PNG or JPEG file up to 12 MB and 24 million pixels.",
        ),
      );
      return;
    }
    if (
      typeof Worker === "undefined" ||
      typeof OffscreenCanvas === "undefined" ||
      typeof createImageBitmap === "undefined"
    ) {
      reject(
        new Error(
          "This browser cannot process handwriting locally. Use a browser with image workers and offscreen canvas support.",
        ),
      );
      return;
    }
    const worker = new Worker(
      new URL("./calligraphy-scan.worker.ts", import.meta.url),
      { type: "module" },
    );
    const cleanup = () => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      worker.terminate();
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Scan cancelled", "AbortError"));
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          "Image processing took too long. Try a smaller image or a tighter crop.",
        ),
      );
    }, 30_000);
    signal.addEventListener("abort", abort, { once: true });
    worker.onerror = () => {
      cleanup();
      reject(
        new Error("The image worker failed. Try a smaller PNG or JPEG image."),
      );
    };
    worker.onmessageerror = () => {
      cleanup();
      reject(new Error("The processed handwriting could not be read."));
    };
    worker.onmessage = (
      event: MessageEvent<{ preview?: ScanImportPreview; error?: string }>,
    ) => {
      cleanup();
      if (event.data.preview) resolve(event.data.preview);
      else
        reject(
          new Error(
            event.data.error ?? "The handwriting could not be processed.",
          ),
        );
    };
    worker.postMessage({ file, settings });
  });
}

export function exportCalligraphyScan(scan: CalligraphyScan): Blob {
  return new Blob([JSON.stringify(validateCalligraphyScan(scan), null, 2)], {
    type: "application/json",
  });
}

/** Portable backups retain original bytes; verify their digest before accepting one. */
export async function importCalligraphyScanBackup(
  file: File,
): Promise<CalligraphyScan> {
  if (!file.size || file.size > MAX_SCAN_JSON_BYTES)
    throw new Error("Handwriting backups must be smaller than 48 MB.");
  let input: unknown;
  try {
    input = JSON.parse(await file.text());
  } catch {
    throw new Error("This file is not a valid handwriting JSON backup.");
  }
  const scan = validateCalligraphyScan(input);
  await verifyCalligraphyScanOriginal(scan);
  const ink = Uint8Array.from(
    atob(scan.image.dataUrl.split(",")[1] ?? ""),
    (char) => char.charCodeAt(0),
  );
  const bitmap = await createImageBitmap(
    new Blob([ink], { type: "image/png" }),
  );
  try {
    if (
      bitmap.width !== scan.image.width ||
      bitmap.height !== scan.image.height
    )
      throw new Error("The backup image dimensions do not match.");
  } finally {
    bitmap.close();
  }
  return scan;
}
