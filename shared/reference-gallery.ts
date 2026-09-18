import manifest from "../public/references/manifest.json";

/** The manifest and original bytes travel together in every site release. */
export const REFERENCE_GALLERY = manifest;
export const REFERENCE_IMAGES = manifest.images;
export const REFERENCE_MANIFEST_PATH = "/references/manifest.json";

export function referenceFileSize(bytes: number): string {
  return bytes < 1_000_000
    ? `${Math.round(bytes / 1_000)} kB`
    : `${(bytes / 1_000_000).toFixed(2)} MB`;
}
