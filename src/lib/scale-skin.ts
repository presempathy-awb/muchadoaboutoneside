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
import { planScaleAtlases, type ScaleAtlasPlan } from "./scale-atlas";
import { drawScalePlate } from "./scale-plate-canvas";
import type { ScaleTypography } from "./scale-typography";
import { transitionProgress } from "./scene-transition";

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
  setReducedMotion(enabled: boolean): void;
  /** Hidden viewers commit queued updates without waiting for animation frames. */
  setVisible(visible: boolean): void;
  setModelScale(factor: number): void;
  getMeshes(): readonly Mesh[];
  dispose(): void;
}

interface ScaleSkinOptions {
  onCommit?: (preview: ScalePreview, atlasPlan: ScaleAtlasPlan) => void;
  onError?: (preview: ScalePreview, error: unknown) => void;
}

/** Lettered faces share aspect-aware atlases; plain tops and edges use two draws. */
export function createScaleSkin(
  scene: Scene,
  modelRoot: TransformNode | null,
  options: ScaleSkinOptions = {},
): ScaleSkinController {
  interface SkinResources {
    meshes: Mesh[];
    materials: PBRMaterial[];
    textures: DynamicTexture[];
    canvases: HTMLCanvasElement[];
  }
  let current: (SkinResources & { atlasPlan: ScaleAtlasPlan }) | null = null;
  let retiring: SkinResources | null = null;
  let currentPreview: ScalePreview | null = null;
  let pendingPreview: ScalePreview | null = null;
  let wireframe = false;
  let reducedMotion = false;
  let visible = true;
  let disposed = false;
  let coordinateScale = 1;
  let fadeStarted = 0;
  const fadeDuration = 320;
  let fadeDeadline: ReturnType<typeof setTimeout> | undefined;
  const clear = (resources: SkinResources | null) => {
    if (!resources) return;
    for (const mesh of resources.meshes) mesh.dispose();
    for (const material of resources.materials) material.dispose();
    for (const texture of resources.textures) texture.dispose();
    for (const canvas of resources.canvases) canvas.width = canvas.height = 0;
  };
  const opacity = (resources: SkinResources | null, value: number) => {
    for (const mesh of resources?.meshes ?? []) mesh.visibility = value;
  };
  const settle = () => {
    if (fadeDeadline !== undefined) {
      clearTimeout(fadeDeadline);
      fadeDeadline = undefined;
    }
    clear(retiring);
    retiring = null;
    opacity(current, 1);
  };
  const observer = scene.onBeforeRenderObservable.add(() => {
    if (!retiring) return;
    const amount = transitionProgress(
      fadeStarted,
      performance.now(),
      fadeDuration,
    );
    opacity(current, amount);
    opacity(retiring, 1 - amount);
    if (amount === 1) {
      settle();
      flushPending();
    }
  });
  const build = ({
    study,
    lettering,
    design,
    fontFamily,
    typography,
  }: ScalePreview) => {
    const meshes: Mesh[] = [];
    const materials: PBRMaterial[] = [];
    const textures: DynamicTexture[] = [];
    const canvases: HTMLCanvasElement[] = [];
    const resources = { meshes, materials, textures, canvases };
    const makeMaterial = (name: string) => {
      const material = new PBRMaterial(name, scene);
      materials.push(material);
      const woodPlates =
        design.buildMethod === "wood" || design.buildMethod === "hybrid";
      material.metallic = woodPlates ? 0 : 0.62;
      material.roughness = woodPlates ? 0.88 : 0.46;
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
      const sameStudy = currentPreview?.study === study;
      const sameLayout =
        currentPreview?.lettering === lettering &&
        currentPreview?.design.showLettering === design.showLettering &&
        (currentPreview?.design.letteringQuality ?? "crisp") ===
          (design.letteringQuality ?? "crisp");
      const reusable =
        sameStudy &&
        (sameLayout ||
          name === "scale-sidewalls" ||
          name === "scale-print-substrate" ||
          name === "scale-wood-substrate")
          ? current?.meshes.find((mesh) => mesh.name === name)
          : undefined;
      // Babylon reference-counts the shared immutable vertex/index buffers.
      // Font/ink changes therefore need not recompute unchanged geometry normals.
      const mesh = new Mesh(name, scene);
      meshes.push(mesh);
      if (reusable?.geometry) reusable.geometry.applyToMesh(mesh);
      else foilVertexData({ positions, indices, uvs }).applyToMesh(mesh);
      mesh.visibility = 1;
      mesh.parent = modelRoot;
      // Source vertices already carry physical resizing. The archival glTF root
      // also scales its hardware, so compensate for that parent transform here.
      mesh.scaling.setAll(coordinateScale);
      mesh.material = material;
      mesh.isPickable = false;
      return mesh;
    };
    const existingTextures = new Set(scene.textures);
    const plan = planScaleAtlases(
      study,
      lettering,
      design.showLettering,
      scene.getEngine().getCaps().maxTextureSize,
      { quality: design.letteringQuality },
    );
    try {
      const placements = new Map(
        lettering.placements.map((item) => [item.plateId, item]),
      );
      const plates = new Map(study.plates.map((plate) => [plate.id, plate]));
      const edgePositions: number[] = [];
      const edgeIndices: number[] = [];
      for (const plate of study.plates) {
        const offset = edgePositions.length / 3;
        edgePositions.push(...plate.edgePositions);
        edgeIndices.push(...plate.edgeIndices.map((vertex) => vertex + offset));
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
              (slot.y + (plate.uvs[uv + 1] ?? 0) * slot.height) / atlas.height,
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
        meshFor(`scales-lettered-${index}`, positions, indices, uvs, material);
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
      if (study.sourceGeometry) {
        const printSubstrate = study.modelId === "maquette";
        const substrateName = printSubstrate
          ? "scale-print-substrate"
          : "scale-wood-substrate";
        const material = makeMaterial(substrateName);
        material.metallic = 0;
        material.roughness = printSubstrate ? 0.85 : 0.95;
        material.albedoColor = Color3.FromHexString(
          printSubstrate ? "#afa99c" : "#65503c",
        );
        meshFor(
          substrateName,
          study.sourceGeometry.positions,
          study.sourceGeometry.indices,
          [],
          material,
        );
      }
    } catch (error) {
      clear(resources);
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
    return { ...resources, atlasPlan: plan };
  };
  const commit = (preview: ScalePreview) => {
    const previous = currentPreview;
    const unchanged =
      previous &&
      previous.study === preview.study &&
      previous.lettering === preview.lettering &&
      previous.typography === preview.typography &&
      previous.fontFamily === preview.fontFamily &&
      previous.design.buildMethod === preview.design.buildMethod &&
      previous.design.plateColor === preview.design.plateColor &&
      previous.design.inkColor === preview.design.inkColor &&
      previous.design.marginMm === preview.design.marginMm &&
      previous.design.showLettering === preview.design.showLettering &&
      (previous.design.letteringQuality ?? "crisp") ===
        (preview.design.letteringQuality ?? "crisp");
    if (!unchanged) {
      const candidate = build(preview);
      retiring = current;
      current = candidate;
      coordinateScale =
        preview.study.modelId === "maquette"
          ? 1
          : 1 / (preview.study.modelScale ?? 1);
      for (const group of [current, retiring])
        for (const mesh of group?.meshes ?? [])
          mesh.scaling.setAll(coordinateScale);
      if (reducedMotion || !visible || !retiring) settle();
      else {
        fadeStarted = performance.now();
        opacity(current, 0);
        // A background document can stop receiving animation frames while its
        // canvas still intersects the viewport. The fade must not hold the
        // latest complete preview hostage to the next render notification.
        fadeDeadline = setTimeout(() => {
          fadeDeadline = undefined;
          if (disposed || scene.isDisposed) return;
          settle();
          flushPending();
        }, fadeDuration);
      }
    }
    currentPreview = preview;
    if (current) options.onCommit?.(preview, current.atlasPlan);
  };
  const flushPending = () => {
    if (disposed || scene.isDisposed || retiring || !pendingPreview) return;
    const preview = pendingPreview;
    pendingPreview = null;
    try {
      commit(preview);
    } catch (error) {
      options.onError?.(preview, error);
    }
  };
  return {
    update(preview) {
      if (disposed || scene.isDisposed) return;
      if (retiring) {
        // Keep the in-flight pair visually continuous. One lightweight pending
        // request is replaced by newer input; no third skin is prepared yet.
        pendingPreview = preview;
        return;
      }
      pendingPreview = null;
      commit(preview);
    },
    setWireframe(enabled) {
      wireframe = enabled;
      for (const group of [current, retiring])
        for (const material of group?.materials ?? [])
          material.wireframe = enabled;
    },
    setReducedMotion(enabled) {
      reducedMotion = enabled;
      if (enabled) {
        settle();
        flushPending();
      }
    },
    setVisible(enabled) {
      if (disposed || scene.isDisposed) return;
      visible = enabled;
      if (!visible) {
        settle();
        flushPending();
      }
    },
    setModelScale(factor) {
      if (!Number.isFinite(factor) || factor <= 0) return;
      coordinateScale = 1 / factor;
      for (const group of [current, retiring])
        for (const mesh of group?.meshes ?? [])
          mesh.scaling.setAll(coordinateScale);
    },
    getMeshes() {
      return current?.meshes ?? [];
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      pendingPreview = null;
      scene.onBeforeRenderObservable.remove(observer);
      settle();
      clear(current);
      current = null;
      currentPreview = null;
    },
  };
}
