import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { FABRICATION_GEOMETRY_OPTIONS } from "../../shared/fabrication";
import { FABRICATION_DOWNLOADS } from "../../shared/fabrication-downloads";
import {
  type SurfaceId,
  type SurfaceLayout,
  surfaceRows,
} from "../../shared/inscription-layout";
import {
  CANONICAL_POEM,
  JAW_INSCRIPTION_LAYOUT,
  INSCRIPTION_LAYOUT as layout,
  type PoemVersion,
} from "../../shared/poem";
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

const SCRIPT_FONT = '"Great Vibes"';
let scriptFont: Promise<void> | undefined;

/** The substitute script is declared in foil.css; wait for it before drawing. */
function ensureScriptFont() {
  scriptFont ??=
    typeof document === "undefined" || !("fonts" in document)
      ? Promise.resolve()
      : Promise.all([
          document.fonts.load(`${layout.fontSize}px ${SCRIPT_FONT}`),
          document.fonts.load(
            `${JAW_INSCRIPTION_LAYOUT.fontSize}px ${SCRIPT_FONT}`,
          ),
        ]).then(
          () => undefined,
          () => undefined,
        );
  return scriptFont;
}

/**
 * Live preview of a wording that has no outlined master yet: the same rows the
 * generators lay out for it, fitted to the row width like SVG lengthAdjust.
 */
function drawLoopRows(
  context: CanvasRenderingContext2D,
  rowText: string,
  rows: SurfaceLayout,
) {
  if (!rowText || rows.rows === 0) return;
  context.fillStyle = "#17201c";
  context.font = `${rows.fontSize}px ${SCRIPT_FONT}, serif`;
  context.textBaseline = "alphabetic";
  const natural = context.measureText(rowText).width;
  if (!natural) return;
  const scaleX = rows.textWidth / natural;
  for (let index = 0; index < rows.rows; index += 1) {
    context.save();
    context.translate(rows.left, rows.firstBaseline + index * rows.rowSpacing);
    context.scale(scaleX, 1);
    context.fillText(rowText, 0, 0);
    context.restore();
  }
}

export interface FoilSkinController {
  detailMaterial: PBRMaterial;
  getReadingMesh(): Mesh;
  setLettering(visible: boolean): void;
  setSeams(visible: boolean): void;
  setWireframe(enabled: boolean): void;
  setPoemVersion(version: PoemVersion): void;
}

export async function createFoilSkin(
  scene: Scene,
  modelRoot: TransformNode | null,
  initialVersion: PoemVersion = CANONICAL_POEM,
): Promise<FoilSkinController | null> {
  const [bodyArtwork, jawArtwork] = await Promise.all([
    loadOutlinedMaster(FABRICATION_DOWNLOADS.bodyMaster),
    loadOutlinedMaster(FABRICATION_DOWNLOADS.jawMaster),
    initialVersion.fabricationArtwork ? undefined : ensureScriptFont(),
  ]);
  if (scene.isDisposed) return null;
  const geometry = generateFoilGeometry(FABRICATION_GEOMETRY_OPTIONS);
  let showLettering = true;
  let showSeams = false;
  let version = initialVersion;
  const createAtlas = (
    surface: SurfaceId,
    artwork: HTMLImageElement,
    maxWidth: number,
  ) => {
    const name = surface;
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
      if (showLettering && version.fabricationArtwork) {
        context.drawImage(artwork, 0, 0, layout.width, layout.height);
      } else if (showLettering) {
        const fitted = surfaceRows(surface, version);
        drawLoopRows(context, fitted.rowText, fitted.layout);
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
    setPoemVersion(next) {
      // A draft keeps its version id but changes the text.
      if (
        version.id === next.id &&
        version.loop === next.loop &&
        version.fabricationArtwork === next.fabricationArtwork
      )
        return;
      version = next;
      if (next.fabricationArtwork) {
        drawAtlases();
        return;
      }
      ensureScriptFont().then(() => {
        if (!scene.isDisposed && version.id === next.id) drawAtlases();
      });
    },
  };
}
