import type { ScaleLetteringResult } from "../../shared/scale-lettering";
import type { ScaleStudy } from "../../shared/scale-study";

export const SCALE_ATLAS_TARGET_PIXELS_PER_EM = 24;
export const SCALE_ATLAS_READABLE_PIXELS_PER_EM = 12;
export const SCALE_ATLAS_MAX_PIXELS = 16 * 1024 * 1024;
export const SCALE_ATLAS_MAX_COUNT = 23;
const PADDING = 4;

export interface ScaleAtlasSlot {
  plateId: string;
  /** Content rectangle in top-left canvas coordinates, excluding padding. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScaleAtlas {
  width: number;
  height: number;
  slots: ScaleAtlasSlot[];
}

export interface ScaleAtlasPlan {
  atlases: ScaleAtlas[];
  plainPlateIds: string[];
  totalPixels: number;
  minPixelsPerEm: number | null;
  readable: boolean;
}

interface Face {
  plateId: string;
  widthEm: number;
  heightEm: number;
}

function nextPowerOfTwo(value: number) {
  return 2 ** Math.ceil(Math.log2(Math.max(1, value)));
}

/** Deterministic shelf packing; each face keeps its physical aspect ratio. */
function pack(faces: Face[], pixelsPerEm: number, size: number) {
  const rectangles = faces
    .map((face) => {
      const density = Math.min(
        pixelsPerEm,
        (size - 2 * PADDING) / Math.max(face.widthEm, face.heightEm),
      );
      return {
        ...face,
        width: Math.min(
          size - 2 * PADDING,
          Math.max(2, Math.ceil(face.widthEm * density)),
        ),
        height: Math.min(
          size - 2 * PADDING,
          Math.max(2, Math.ceil(face.heightEm * density)),
        ),
      };
    })
    .sort((a, b) => b.height - a.height || b.width - a.width);
  const pages: {
    shelves: { x: number; y: number; height: number }[];
    width: number;
    height: number;
    slots: ScaleAtlasSlot[];
  }[] = [];
  let minimum = Number.POSITIVE_INFINITY;
  for (const rectangle of rectangles) {
    const width = rectangle.width + 2 * PADDING;
    const height = rectangle.height + 2 * PADDING;
    let page = pages.find(
      (candidate) =>
        candidate.shelves.some(
          (shelf) => shelf.height >= height && shelf.x + width <= size,
        ) || candidate.height + height <= size,
    );
    if (!page) {
      if (pages.length >= SCALE_ATLAS_MAX_COUNT) return null;
      page = { shelves: [], width: 0, height: 0, slots: [] };
      pages.push(page);
    }
    let shelf = page.shelves.find(
      (candidate) => candidate.height >= height && candidate.x + width <= size,
    );
    if (!shelf) {
      shelf = { x: 0, y: page.height, height };
      page.shelves.push(shelf);
      page.height += height;
    }
    page.slots.push({
      plateId: rectangle.plateId,
      x: shelf.x + PADDING,
      y: shelf.y + PADDING,
      width: rectangle.width,
      height: rectangle.height,
    });
    shelf.x += width;
    page.width = Math.max(page.width, shelf.x);
    minimum = Math.min(
      minimum,
      rectangle.width / rectangle.widthEm,
      rectangle.height / rectangle.heightEm,
    );
  }
  // Power-of-two pages also avoid implicit canvas resizing on WebGL 1 engines.
  const atlases = pages.map((page) => ({
    width: nextPowerOfTwo(page.width),
    height: nextPowerOfTwo(page.height),
    slots: page.slots,
  }));
  const totalPixels = atlases.reduce(
    (sum, atlas) => sum + atlas.width * atlas.height,
    0,
  );
  if (totalPixels > SCALE_ATLAS_MAX_PIXELS) return null;
  return { atlases, totalPixels, minPixelsPerEm: minimum };
}

/**
 * Reserve texels only for lettered faces. Budget includes <=16M base texels
 * (less than 22M with mipmaps) and leaves two draws for plain tops and edges.
 * Quality reports the actual lowest density, including long-face GPU limits.
 */
export function planScaleAtlases(
  study: ScaleStudy,
  lettering: ScaleLetteringResult,
  showLettering: boolean,
  maxTextureSize = 2048,
): ScaleAtlasPlan {
  const placements = new Map(
    lettering.placements
      .filter((placement) => showLettering && placement.lines.some(Boolean))
      .map((placement) => [placement.plateId, placement]),
  );
  const plainPlateIds: string[] = [];
  const faces: Face[] = [];
  for (const plate of study.plates) {
    const placement = placements.get(plate.id);
    if (!placement) {
      plainPlateIds.push(plate.id);
      continue;
    }
    const widthEm = (plate.widthInches * 25.4) / placement.fontSizeMm;
    const heightEm = (plate.heightInches * 25.4) / placement.fontSizeMm;
    if (
      !Number.isFinite(widthEm) ||
      !Number.isFinite(heightEm) ||
      widthEm <= 0 ||
      heightEm <= 0
    )
      throw new Error("Scale lettering needs finite, positive dimensions.");
    faces.push({ plateId: plate.id, widthEm, heightEm });
  }
  if (!faces.length)
    return {
      atlases: [],
      plainPlateIds,
      totalPixels: 0,
      minPixelsPerEm: null,
      readable: true,
    };
  if (!Number.isFinite(maxTextureSize) || maxTextureSize < 16)
    throw new Error("This graphics device cannot draw scale lettering.");
  const size = 2 ** Math.floor(Math.log2(Math.min(2048, maxTextureSize)));
  // Bounded retries reduce density only when page count or memory requires it.
  let pixelsPerEm = SCALE_ATLAS_TARGET_PIXELS_PER_EM;
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const packed = pack(faces, pixelsPerEm, size);
    if (packed)
      return {
        ...packed,
        plainPlateIds,
        readable: packed.minPixelsPerEm >= SCALE_ATLAS_READABLE_PIXELS_PER_EM,
      };
    // Always try the readability threshold before falling below it.
    pixelsPerEm =
      pixelsPerEm > SCALE_ATLAS_READABLE_PIXELS_PER_EM
        ? Math.max(SCALE_ATLAS_READABLE_PIXELS_PER_EM, pixelsPerEm * 0.75)
        : pixelsPerEm * 0.75;
  }
  throw new Error("This graphics device cannot fit the scale lettering.");
}
