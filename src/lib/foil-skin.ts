import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { FABRICATION_GEOMETRY_OPTIONS } from "../../shared/fabrication";
import { INSCRIPTION_LAYOUT as layout } from "../../shared/poem";
import { generateFoilGeometry } from "./foil-geometry";
import { makeStudioReflection } from "./studio-reflection";

let outlinedMaster: Promise<HTMLImageElement> | undefined;

function loadOutlinedMaster() {
  outlinedMaster ??= new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
      outlinedMaster = undefined;
      reject(
        new Error("The outlined inscription artwork could not be loaded."),
      );
    };
    image.src = "/fabrication/laser/marking-master.svg";
  });
  return outlinedMaster;
}

export interface FoilSkinController {
  detailMaterial: PBRMaterial;
  setLettering(visible: boolean): void;
  setSeams(visible: boolean): void;
  setWireframe(enabled: boolean): void;
}

export async function createFoilSkin(
  scene: Scene,
  modelRoot: TransformNode | null,
): Promise<FoilSkinController | null> {
  const artwork = await loadOutlinedMaster();
  if (scene.isDisposed) return null;
  const geometry = generateFoilGeometry(FABRICATION_GEOMETRY_OPTIONS);
  const canvas = document.createElement("canvas");
  // The outlined master and atlas each rasterize at most 4096 × 1024.
  // The vector download retains the full lettering detail.
  canvas.width = Math.min(4096, scene.getEngine().getCaps().maxTextureSize);
  canvas.height = canvas.width / 4;
  const context = canvas.getContext("2d");
  if (!context)
    throw new Error("The browser could not prepare the lettering canvas.");
  const texture = new DynamicTexture(
    "endless-poem-uv-atlas",
    canvas,
    scene,
    true,
    Texture.TRILINEAR_SAMPLINGMODE,
  );
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.CLAMP_ADDRESSMODE;
  texture.vScale = -1;
  texture.vOffset = 1;
  context.scale(canvas.width / layout.width, canvas.height / layout.height);

  let showLettering = true;
  let showSeams = false;
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
    texture.update(false);
  };
  drawAtlas();

  scene.environmentTexture = makeStudioReflection(scene);
  scene.environmentIntensity = 0.9;
  const foil = new PBRMaterial("marked-aluminum-foil", scene);
  foil.albedoColor = Color3.White();
  foil.albedoTexture = texture;
  foil.metallic = 0.78;
  foil.roughness = 0.28;
  foil.backFaceCulling = false;
  foil.environmentIntensity = 1.15;

  const details = foil.clone("foil-covered-details");
  details.albedoTexture = null;
  details.roughness = 0.4;
  const applyGeometry = (
    name: string,
    data: { positions: number[]; indices: number[]; uvs: number[] },
  ) => {
    const mesh = new Mesh(name, scene);
    const vertexData = new VertexData();
    vertexData.positions = data.positions;
    vertexData.indices = data.indices;
    vertexData.uvs = data.uvs;
    const normals: number[] = [];
    VertexData.ComputeNormals(data.positions, data.indices, normals);
    vertexData.normals = normals;
    vertexData.applyToMesh(mesh);
    mesh.parent = modelRoot;
    mesh.material = foil;
    mesh.isPickable = false;
    return mesh;
  };
  applyGeometry("continuous-foil-body-and-head", geometry);
  applyGeometry("foil-lower-jaw", geometry.jawGeometry);

  return {
    detailMaterial: details,
    setLettering(visible) {
      showLettering = visible;
      drawAtlas();
    },
    setSeams(visible) {
      showSeams = visible;
      drawAtlas();
    },
    setWireframe(enabled) {
      foil.wireframe = enabled;
      details.wireframe = enabled;
    },
  };
}
