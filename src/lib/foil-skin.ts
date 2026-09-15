import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { FABRICATION_GEOMETRY_OPTIONS } from "../../shared/fabrication";
import { FABRICATION_DOWNLOADS } from "../../shared/fabrication-downloads";
import { INSCRIPTION_LAYOUT as layout } from "../../shared/poem";
import { generateFoilGeometry } from "./foil-geometry";
import { foilVertexData } from "./foil-mesh";
import { makeStudioReflection } from "./studio-reflection";

const outlinedMasters = new Map<string, Promise<HTMLImageElement>>();

function loadOutlinedMaster(path: string) {
  const cached = outlinedMasters.get(path);
  if (cached) return cached;
  const request = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
      outlinedMasters.delete(path);
      reject(
        new Error("The outlined inscription artwork could not be loaded."),
      );
    };
    image.src = path;
  });
  outlinedMasters.set(path, request);
  return request;
}

export interface FoilSkinController {
  detailMaterial: PBRMaterial;
  getReadingMesh(): Mesh;
  setLettering(visible: boolean): void;
  setSeams(visible: boolean): void;
  setWireframe(enabled: boolean): void;
}

export async function createFoilSkin(
  scene: Scene,
  modelRoot: TransformNode | null,
): Promise<FoilSkinController | null> {
  const [bodyArtwork, jawArtwork] = await Promise.all([
    loadOutlinedMaster(FABRICATION_DOWNLOADS.bodyMaster),
    loadOutlinedMaster(FABRICATION_DOWNLOADS.jawMaster),
  ]);
  if (scene.isDisposed) return null;
  const geometry = generateFoilGeometry(FABRICATION_GEOMETRY_OPTIONS);
  let showLettering = true;
  let showSeams = false;
  const createAtlas = (
    name: string,
    artwork: HTMLImageElement,
    maxWidth: number,
  ) => {
    const canvas = document.createElement("canvas");
    const caps = scene.getEngine().getCaps();
    // Preserve the full UV chart for close reading when the GPU supports it.
    canvas.width = Math.min(maxWidth, caps.maxTextureSize);
    canvas.height = canvas.width * (layout.height / layout.width);
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("The browser could not prepare the lettering canvas.");
    const texture = new DynamicTexture(
      `${name}-poem-uv-atlas`,
      canvas,
      scene,
      true,
      Texture.TRILINEAR_SAMPLINGMODE,
    );
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.CLAMP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = Math.max(1, caps.maxAnisotropy);
    context.scale(canvas.width / layout.width, canvas.height / layout.height);

    const drawAtlas = () => {
      context.fillStyle = "#d9dcd8";
      context.fillRect(0, 0, layout.width, layout.height);
      if (showLettering) {
        context.drawImage(artwork, 0, 0, layout.width, layout.height);
      }
      if (showSeams) {
        context.setLineDash([12, 14]);
        context.lineWidth = 5;
        context.strokeStyle = "#bd6546";
        context.strokeRect(18, 65, 8192 - 36, 2048 - 130);
        context.beginPath();
        context.moveTo(8192 / 2, 65);
        context.lineTo(8192 / 2, 2048 - 65);
        context.stroke();
        context.setLineDash([]);
      }
      // The laser projection uses SVG top-left coordinates directly: v=0 is top.
      texture.update(false);
    };
    drawAtlas();
    return { texture, drawAtlas };
  };
  const bodyAtlas = createAtlas("body", bodyArtwork, layout.width);
  const jawAtlas = createAtlas("jaw", jawArtwork, 4096);
  const drawAtlases = () => {
    bodyAtlas.drawAtlas();
    jawAtlas.drawAtlas();
  };

  scene.environmentTexture = makeStudioReflection(scene);
  scene.environmentIntensity = 0.9;
  const foil = new PBRMaterial("marked-aluminum-foil", scene);
  foil.albedoColor = Color3.White();
  foil.albedoTexture = bodyAtlas.texture;
  foil.metallic = 0.55;
  foil.roughness = 0.55;
  foil.backFaceCulling = false;
  foil.environmentIntensity = 0.75;
  const jawFoil = foil.clone("marked-jaw-foil");
  jawFoil.albedoTexture = jawAtlas.texture;

  const details = foil.clone("foil-covered-details");
  details.albedoTexture = null;
  details.roughness = 0.4;
  const applyGeometry = (
    name: string,
    data: { positions: number[]; indices: number[]; uvs: number[] },
    material: PBRMaterial,
  ) => {
    const mesh = new Mesh(name, scene);
    foilVertexData(data).applyToMesh(mesh);
    mesh.parent = modelRoot;
    mesh.material = material;
    mesh.isPickable = false;
    return mesh;
  };
  const readingMesh = applyGeometry(
    "continuous-foil-body-and-head",
    geometry,
    foil,
  );
  applyGeometry("foil-lower-jaw", geometry.jawGeometry, jawFoil);

  return {
    detailMaterial: details,
    getReadingMesh() {
      return readingMesh;
    },
    setLettering(visible) {
      if (showLettering === visible) return;
      showLettering = visible;
      drawAtlases();
    },
    setSeams(visible) {
      if (showSeams === visible) return;
      showSeams = visible;
      drawAtlases();
    },
    setWireframe(enabled) {
      foil.wireframe = enabled;
      jawFoil.wireframe = enabled;
      details.wireframe = enabled;
    },
  };
}
