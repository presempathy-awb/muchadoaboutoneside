import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import type { ScaleDesign } from "../../shared/scale-design";
import type { ScaleLetteringResult } from "../../shared/scale-lettering";
import type { ScaleStudy } from "../../shared/scale-study";
import { foilVertexData } from "./foil-mesh";
import { planScaleAtlases } from "./scale-atlas";
import { drawScalePlate } from "./scale-plate-canvas";
import type { ScaleTypography } from "./scale-typography";

export interface ScalePreview {
  study: ScaleStudy;
  lettering: ScaleLetteringResult;
  design: ScaleDesign;
  fontFamily: string;
  typography?: ScaleTypography;
}

export interface ScaleSkinController {
  update(preview: ScalePreview): void;
  setWireframe(enabled: boolean): void;
  dispose(): void;
}

/** Lettered faces share aspect-aware atlases; plain tops and edges use two draws. */
export function createScaleSkin(
  scene: Scene,
  modelRoot: TransformNode | null,
): ScaleSkinController {
  const meshes: Mesh[] = [];
  const materials: PBRMaterial[] = [];
  const textures: DynamicTexture[] = [];
  const canvases: HTMLCanvasElement[] = [];
  let wireframe = false;
  let disposed = false;
  let coordinateScale = 1;
  const clear = () => {
    for (const mesh of meshes) mesh.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
    for (const canvas of canvases) canvas.width = canvas.height = 0;
    meshes.length = materials.length = textures.length = canvases.length = 0;
  };
  const makeMaterial = (name: string) => {
    const material = new PBRMaterial(name, scene);
    materials.push(material);
    material.metallic = 0.62;
    material.roughness = 0.46;
    material.backFaceCulling = false;
    material.wireframe = wireframe;
    return material;
  };
  const meshFor = (
    name: string,
    positions: number[],
    indices: number[],
    uvs: number[],
    material: PBRMaterial,
  ) => {
    const mesh = new Mesh(name, scene);
    meshes.push(mesh);
    foilVertexData({ positions, indices, uvs }).applyToMesh(mesh);
    mesh.parent = modelRoot;
    // Source vertices already carry physical resizing. The archival glTF root
    // also scales its hardware, so compensate for that parent transform here.
    mesh.scaling.setAll(coordinateScale);
    mesh.material = material;
    mesh.isPickable = false;
    return mesh;
  };
  return {
    update({ study, lettering, design, fontFamily, typography }) {
      if (disposed || scene.isDisposed) return;
      clear();
      coordinateScale =
        study.modelId === "maquette" ? 1 : 1 / (study.modelScale ?? 1);
      const existingTextures = new Set(scene.textures);
      try {
        const placements = new Map(
          lettering.placements.map((item) => [item.plateId, item]),
        );
        const plates = new Map(study.plates.map((plate) => [plate.id, plate]));
        const plan = planScaleAtlases(
          study,
          lettering,
          design.showLettering,
          scene.getEngine().getCaps().maxTextureSize,
        );
        const edgePositions: number[] = [];
        const edgeIndices: number[] = [];
        for (const plate of study.plates) {
          const offset = edgePositions.length / 3;
          edgePositions.push(...plate.edgePositions);
          edgeIndices.push(
            ...plate.edgeIndices.map((vertex) => vertex + offset),
          );
        }
        for (const [index, atlas] of plan.atlases.entries()) {
          const canvas = document.createElement("canvas");
          canvases.push(canvas);
          canvas.width = atlas.width;
          canvas.height = atlas.height;
          const context = canvas.getContext("2d");
          if (!context)
            throw new Error("The browser could not draw scale lettering.");
          const positions: number[] = [];
          const indices: number[] = [];
          const uvs: number[] = [];
          context.fillStyle = design.plateColor;
          context.fillRect(0, 0, atlas.width, atlas.height);
          for (const slot of atlas.slots) {
            const plate = plates.get(slot.plateId);
            if (!plate)
              throw new Error("The scale lettering refers to a missing plate.");
            drawScalePlate(
              context,
              plate,
              placements.get(plate.id),
              design,
              fontFamily,
              slot,
              typography,
            );
            const offset = positions.length / 3;
            positions.push(...plate.positions);
            indices.push(...plate.indices.map((vertex) => vertex + offset));
            for (let uv = 0; uv < plate.uvs.length; uv += 2) {
              uvs.push(
                (slot.x + (plate.uvs[uv] ?? 0) * slot.width) / atlas.width,
                (slot.y + (plate.uvs[uv + 1] ?? 0) * slot.height) /
                  atlas.height,
              );
            }
          }
          const texture = new DynamicTexture(
            `scale-atlas-${index}`,
            canvas,
            scene,
            true,
            Texture.TRILINEAR_SAMPLINGMODE,
          );
          textures.push(texture);
          texture.wrapU = texture.wrapV = Texture.CLAMP_ADDRESSMODE;
          texture.anisotropicFilteringLevel = Math.max(
            1,
            scene.getEngine().getCaps().maxAnisotropy,
          );
          texture.update(false);
          const material = makeMaterial(`scale-tops-${index}`);
          material.albedoColor = Color3.White();
          material.albedoTexture = texture;
          meshFor(
            `scales-lettered-${index}`,
            positions,
            indices,
            uvs,
            material,
          );
        }
        if (plan.plainPlateIds.length) {
          const positions: number[] = [];
          const indices: number[] = [];
          for (const id of plan.plainPlateIds) {
            const plate = plates.get(id);
            if (!plate)
              throw new Error("The scale preview refers to a missing plate.");
            const offset = positions.length / 3;
            positions.push(...plate.positions);
            indices.push(...plate.indices.map((vertex) => vertex + offset));
          }
          const material = makeMaterial("scale-plain-tops");
          material.albedoColor = Color3.FromHexString(design.plateColor);
          meshFor("scales-plain", positions, indices, [], material);
        }
        if (edgeIndices.length) {
          const material = makeMaterial("scale-sidewalls");
          material.albedoColor = Color3.FromHexString(design.plateColor).scale(
            0.68,
          );
          meshFor("scale-sidewalls", edgePositions, edgeIndices, [], material);
        }
        if (study.modelId === "maquette" && study.sourceGeometry) {
          const material = makeMaterial("scale-print-substrate");
          material.metallic = 0;
          material.roughness = 0.85;
          material.albedoColor = Color3.FromHexString("#afa99c");
          meshFor(
            "scale-print-substrate",
            study.sourceGeometry.positions,
            study.sourceGeometry.indices,
            [],
            material,
          );
        }
      } catch (error) {
        clear();
        // A failed DynamicTexture constructor can register itself before throwing.
        for (const texture of [...scene.textures]) {
          if (
            !existingTextures.has(texture) &&
            texture.name.startsWith("scale-atlas-")
          )
            texture.dispose();
        }
        throw error;
      }
    },
    setWireframe(enabled) {
      wireframe = enabled;
      for (const material of materials) material.wireframe = enabled;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clear();
    },
  };
}
