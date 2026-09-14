import { Constants } from "@babylonjs/core/Engines/constants";
import { RawCubeTexture } from "@babylonjs/core/Materials/Textures/rawCubeTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { Scene } from "@babylonjs/core/scene";

export function makeStudioReflection(scene: Scene) {
  const size = 64;
  const faces = Array.from({ length: 6 }, (_, face) => {
    const bytes = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / (size - 1),
          v = y / (size - 1);
        const softbox = Math.exp(
          -((u - 0.3) ** 2 / 0.05 + (v - 0.35) ** 2 / 0.22),
        );
        const tone = Math.min(
          1,
          0.17 + 0.4 * (1 - v) + softbox * (face % 2 ? 0.48 : 0.8),
        );
        const offset = (y * size + x) * 4;
        bytes[offset] = Math.round(tone * 245);
        bytes[offset + 1] = Math.round(tone * 248);
        bytes[offset + 2] = Math.round(tone * 240);
        bytes[offset + 3] = 255;
      }
    }
    return bytes;
  });
  const reflection = new RawCubeTexture(
    scene,
    faces,
    size,
    Constants.TEXTUREFORMAT_RGBA,
    Constants.TEXTURETYPE_UNSIGNED_BYTE,
    true,
    false,
    Texture.TRILINEAR_SAMPLINGMODE,
  );
  reflection.name = "procedural-gallery-reflection";
  reflection.gammaSpace = false;
  return reflection;
}
