import type { WorksheetBundledFontId } from "../../shared/worksheet-font-catalog";
import { worksheetFontDefinition } from "../../shared/worksheet-font-catalog";

const MAX_PREVIEW_FONT_BYTES = 2 * 1024 * 1024;

const previewSources: Record<WorksheetBundledFontId, () => Promise<string>> = {
  "great-vibes": () =>
    import(
      "@fontsource/great-vibes/files/great-vibes-latin-400-normal.woff2?url"
    ).then((module) => module.default),
  "pinyon-script": () =>
    import(
      "@fontsource/pinyon-script/files/pinyon-script-latin-400-normal.woff2?url"
    ).then((module) => module.default),
  "imperial-script": () =>
    import(
      "@fontsource/imperial-script/files/imperial-script-latin-400-normal.woff2?url"
    ).then((module) => module.default),
  italianno: () =>
    import(
      "@fontsource/italianno/files/italianno-latin-400-normal.woff2?url"
    ).then((module) => module.default),
  "herr-von-muellerhoff": () =>
    import(
      "@fontsource/herr-von-muellerhoff/files/herr-von-muellerhoff-latin-400-normal.woff2?url"
    ).then((module) => module.default),
  "mrs-saint-delafield": () =>
    import(
      "@fontsource/mrs-saint-delafield/files/mrs-saint-delafield-latin-400-normal.woff2?url"
    ).then((module) => module.default),
};

const previewCache = new Map<WorksheetBundledFontId, Promise<string>>();

async function loadPreview(id: WorksheetBundledFontId): Promise<string> {
  const definition = worksheetFontDefinition(id);
  if (
    typeof document === "undefined" ||
    typeof FontFace === "undefined" ||
    !document.fonts
  ) {
    return definition.family;
  }

  const source = await previewSources[id]();
  const sourceUrl = new URL(source, document.baseURI);
  if (sourceUrl.origin !== location.origin) {
    throw new Error("Worksheet font previews must load from this site.");
  }
  const response = await fetch(sourceUrl, { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(`The ${definition.name} preview could not be loaded.`);
  }
  const declaredLength = Number(response.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_PREVIEW_FONT_BYTES
  ) {
    throw new Error(
      `The ${definition.name} preview is larger than the 2 MB limit.`,
    );
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_PREVIEW_FONT_BYTES) {
    throw new Error(
      `The ${definition.name} preview is larger than the 2 MB limit.`,
    );
  }

  const face = new FontFace(definition.previewFamily, bytes, {
    display: "swap",
    style: "normal",
    weight: "400",
  });
  await face.load();
  document.fonts.add(face);
  return definition.previewFamily;
}

/** Lazily loads a small Latin-only WOFF2 for a font-picker sample. */
export function loadWorksheetFontPreview(
  id: WorksheetBundledFontId,
): Promise<string> {
  const cached = previewCache.get(id);
  if (cached) return cached;
  const loading = loadPreview(id);
  previewCache.set(id, loading);
  loading.catch(() => previewCache.delete(id));
  return loading;
}
