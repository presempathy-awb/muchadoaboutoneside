import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import "@babylonjs/core/Culling/ray";
import { Engine } from "@babylonjs/core/Engines/engine";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Scene } from "@babylonjs/core/scene";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import { CANONICAL_POEM, type PoemVersion } from "../../shared/poem";
import type { FoilSkinController } from "./foil-skin";
import { inscriptionView } from "./inscription-view";
import type { ScaleAtlasPlan } from "./scale-atlas";
import type { ScalePreview, ScaleSkinController } from "./scale-skin";
import type { ScaleTypography } from "./scale-typography";
import {
  applyHardwareOpacity,
  type CameraPose,
  hardwareForBounds,
  hardwareScaleTarget,
  interpolateCameraPose,
  sameCameraPose,
  transitionProgress,
} from "./scene-transition";

export const SCULPTURE_ASSET_URL = "/api/assets/snake_build.glb";

export const SCULPTURE_PARTS = [
  "ribs",
  "slats",
  "spine",
  "head",
  "eyes",
  "fangs",
  "base",
] as const;

export type SculpturePart = (typeof SCULPTURE_PARTS)[number];

export interface SculptureSceneController {
  readonly ready: Promise<void>;
  setAutoRotate(enabled: boolean): void;
  setHiddenParts(parts: readonly string[]): void;
  setSelectedPart(part: string | null): void;
  setWireframe(enabled: boolean): void;
  setLettering(visible: boolean): void;
  setSeams(visible: boolean): void;
  /** Transfers a scan renderer to this viewer; do not share it with another view. */
  setPoemVersion(
    version: PoemVersion,
    typography?: ScaleTypography,
  ): Promise<void>;
  cancelPendingPoemVersion(): void;
  setReadingView(enabled: boolean): void;
  setScalePreview(preview: ScalePreview): void;
  setReducedMotion(enabled: boolean): void;
  resetCamera(): void;
  resize(): void;
  dispose(): void;
}

interface CreateSculptureSceneOptions {
  onSelectPart?: (part: SculpturePart | null) => void;
  onScalePreviewReady?: (
    preview: ScalePreview,
    atlasPlan: ScaleAtlasPlan,
  ) => void;
  onScalePreviewError?: (preview: ScalePreview, message: string) => void;
  edition?: "construction" | "inscription" | "scales";
}

const PART_COLORS: Record<SculpturePart, string> = {
  ribs: "#dcc48c",
  slats: "#c9a468",
  spine: "#8f6a42",
  head: "#dcc48c",
  eyes: "#241b16",
  fangs: "#f0e8d6",
  base: "#cdb27f",
};

const START_ALPHA = -Math.PI / 2.4;
const START_BETA = Math.PI / 2.7;

function partForMesh(mesh: AbstractMesh | null): SculpturePart | null {
  let candidate = mesh;

  while (candidate) {
    const searchableName = `${candidate.name} ${candidate.id}`.toLowerCase();
    const part = SCULPTURE_PARTS.find((name) => searchableName.includes(name));
    if (part) return part;
    candidate = candidate.parent as AbstractMesh | null;
  }

  return null;
}

function materialForPart(scene: Scene, part: SculpturePart): StandardMaterial {
  const material = new StandardMaterial(`snake-${part}-material`, scene);
  const color = Color3.FromHexString(PART_COLORS[part]);
  material.diffuseColor = color;
  material.ambientColor = color.scale(0.18);
  material.specularColor = new Color3(0.12, 0.1, 0.08);
  material.specularPower = part === "eyes" ? 96 : 24;
  material.roughness = part === "eyes" ? 0.28 : 0.72;
  return material;
}

export function createSculptureScene(
  canvas: HTMLCanvasElement,
  options: CreateSculptureSceneOptions = {},
): SculptureSceneController {
  if (!Engine.isSupported()) {
    throw new Error("This browser does not support the WebGL viewer.");
  }

  const engine = new Engine(canvas, true, {
    adaptToDeviceRatio: true,
    antialias: true,
    preserveDrawingBuffer: false,
    stencil: true,
  });
  const scene = new Scene(engine);
  scene.clearColor = Color4.FromHexString("#e8e5dcff");
  scene.ambientColor = new Color3(0.22, 0.2, 0.17);

  const camera = new ArcRotateCamera(
    "sculpture-camera",
    START_ALPHA,
    START_BETA,
    420,
    new Vector3(0, 103, 0),
    scene,
  );
  camera.attachControl(canvas, true);
  camera.lowerBetaLimit = 0.12;
  camera.upperBetaLimit = Math.PI - 0.12;
  camera.lowerRadiusLimit = 20;
  camera.upperRadiusLimit = 1_200;
  camera.minZ = 0.1;
  camera.maxZ = 3_000;
  camera.panningSensibility = 80;
  camera.wheelDeltaPercentage = 0.01;
  camera.useNaturalPinchZoom = true;

  const fill = new HemisphericLight(
    "gallery-fill",
    new Vector3(0.1, 1, 0.25),
    scene,
  );
  fill.diffuse = Color3.FromHexString("#fff8e9");
  fill.groundColor = Color3.FromHexString("#7d6e60");
  fill.intensity = 1.35;

  const key = new DirectionalLight(
    "gallery-key",
    new Vector3(-0.65, -1, 0.45),
    scene,
  );
  key.position = new Vector3(180, 280, -180);
  key.diffuse = Color3.FromHexString("#fff0d6");
  key.intensity = 2.1;

  const meshesByPart = new Map<SculpturePart, AbstractMesh[]>();
  const materialsByPart = new Map<SculpturePart, StandardMaterial>();
  let selectedPart: string | null = null;
  let hiddenParts = new Set<string>();
  let autoRotate = false;
  let reducedMotion = false;
  let cameraTransition: {
    from: CameraPose;
    to: CameraPose;
    started: number;
  } | null = null;
  let sourceScale = 1;
  let hardwareOpacity = 1;
  let hardwareTransition: { from: number; to: number; started: number } | null =
    null;
  let sourceTransition: { from: number; to: number; started: number } | null =
    null;
  let disposed = false;
  // The observer may report hidden before the lazy scale skin finishes loading.
  let visible = true;
  let foilSkin: FoilSkinController | null = null;
  let scaleSkin: ScaleSkinController | null = null;
  let scalePreview: ScalePreview | undefined;
  let requestedScalePreview: ScalePreview | undefined;
  let sourceRoot: AbstractMesh | null = null;
  let originalRootScale = Vector3.One();
  let framedScaleStudy: ScalePreview["study"] | null = null;
  let showLettering = true;
  let showSeams = false;
  let poemVersion: PoemVersion = CANONICAL_POEM;
  let inscriptionRequest = 0;
  let wireframe = false;
  let readingView = false;
  const foilEdition = options.edition === "inscription";
  const scaleEdition = options.edition === "scales";
  const coveredStructure = new Set<string>(["ribs", "slats", "spine", "head"]);
  const partAllowed = (part: string) =>
    !hiddenParts.has(part) &&
    !((foilEdition || scaleEdition) && coveredStructure.has(part));
  const partVisible = (part: string) =>
    !(scaleEdition && scalePreview?.study.modelId === "maquette") &&
    partAllowed(part);
  const updateHardwareOpacity = (opacity: number) => {
    hardwareOpacity = opacity;
    applyHardwareOpacity(meshesByPart, partAllowed, opacity);
  };
  let fittedTarget = new Vector3(0, 103, 0);
  let fittedRadius = 420;

  for (const part of SCULPTURE_PARTS) {
    meshesByPart.set(part, []);
    materialsByPart.set(part, materialForPart(scene, part));
  }

  const updateSelection = () => {
    for (const [part, material] of materialsByPart) {
      material.emissiveColor =
        part === selectedPart
          ? Color3.FromHexString("#5c3b1d").scale(0.24)
          : Color3.Black();
    }
  };

  const cameraPose = (): CameraPose => ({
    alpha: camera.alpha,
    beta: camera.beta,
    radius: camera.radius,
    target: [camera.target.x, camera.target.y, camera.target.z],
  });
  const applyPose = (pose: CameraPose) => {
    camera.alpha = pose.alpha;
    camera.beta = pose.beta;
    camera.radius = pose.radius;
    camera.target.set(...pose.target);
  };
  const clearInertia = () => {
    camera.inertialAlphaOffset = camera.inertialBetaOffset = 0;
    camera.inertialRadiusOffset =
      camera.inertialPanningX =
      camera.inertialPanningY =
        0;
  };
  const moveCamera = (to: CameraPose, animate: boolean) => {
    // Density/font changes with unchanged bounds must not stop an orbit, zoom
    // inertia, or an existing animation already heading to the same framing.
    if (sameCameraPose(to, cameraTransition?.to ?? cameraPose())) return;
    clearInertia();
    if (!animate || reducedMotion || !visible) {
      cameraTransition = null;
      applyPose(to);
    } else
      cameraTransition = { from: cameraPose(), to, started: performance.now() };
  };
  const updateSourceScale = (factor: number) => {
    sourceScale = factor;
    sourceRoot?.scaling.copyFrom(originalRootScale.scale(factor));
    scaleSkin?.setModelScale(factor);
  };
  const fitCamera = (
    meshes: readonly AbstractMesh[],
    animate = false,
    preserveView = false,
  ) => {
    let minimum = new Vector3(
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
    );
    let maximum = new Vector3(
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    );
    let foundBounds = false;

    for (const mesh of meshes) {
      if (!mesh.getTotalVertices || mesh.getTotalVertices() === 0) continue;
      mesh.computeWorldMatrix(true);
      const bounds = mesh.getBoundingInfo().boundingBox;
      minimum = Vector3.Minimize(minimum, bounds.minimumWorld);
      maximum = Vector3.Maximize(maximum, bounds.maximumWorld);
      foundBounds = true;
    }

    if (!foundBounds) return;
    const oldTarget = fittedTarget;
    const oldRadius = fittedRadius;
    fittedTarget = minimum.add(maximum).scale(0.5);
    const size = maximum.subtract(minimum);
    fittedRadius = Math.max(size.x, size.y, size.z) * 1.42;
    const ratio = fittedRadius / oldRadius;
    const view = cameraTransition?.to ?? cameraPose();
    const target = preserveView
      ? fittedTarget.add(
          Vector3.FromArray(view.target).subtract(oldTarget).scale(ratio),
        )
      : fittedTarget;
    const radius = preserveView ? view.radius * ratio : fittedRadius;
    // Keep the whole animated path inside the clipping and interaction limits.
    camera.lowerRadiusLimit = Math.min(
      camera.radius,
      radius,
      fittedRadius * 0.18,
    );
    camera.upperRadiusLimit = Math.max(
      camera.radius,
      radius,
      fittedRadius * 3.2,
    );
    camera.minZ = Math.max(0.0001, Math.min(oldRadius, fittedRadius) / 1_000);
    camera.maxZ = Math.max(oldRadius, fittedRadius) * 8;
    moveCamera(
      { ...cameraPose(), radius, target: [target.x, target.y, target.z] },
      animate,
    );
  };

  const applyCameraView = () => {
    clearInertia();
    cameraTransition = null;
    if (readingView && foilSkin) {
      const view = inscriptionView(foilSkin.getReadingMesh());
      camera.lowerRadiusLimit = 8;
      camera.upVector = view.up;
      camera.target.copyFrom(view.target);
      camera.setPosition(view.position);
    } else {
      camera.lowerRadiusLimit = fittedRadius * 0.18;
      camera.upVector = Vector3.Up();
      moveCamera(
        {
          alpha: START_ALPHA,
          beta: START_BETA,
          radius: fittedRadius,
          target: [fittedTarget.x, fittedTarget.y, fittedTarget.z],
        },
        true,
      );
    }
  };

  const applyScalePreview = (
    preview: ScalePreview,
    atlasPlan: ScaleAtlasPlan,
  ) => {
    if (!scaleSkin || !sourceRoot) return;
    scalePreview = preview;
    // This callback runs only after a skin commits, never for a queued request.
    const previousSourceScale = sourceScale;
    const previousModel = framedScaleStudy?.modelId;
    const changedStudy = framedScaleStudy !== scalePreview.study;
    const committedAt = performance.now();
    if (previousModel && previousModel !== scalePreview.study.modelId) {
      // The skin scheduler has finished the prior fade before this commit.
      // Set its exact hardware endpoint before repositioning an incoming root.
      hardwareTransition = null;
      updateHardwareOpacity(previousModel === "archival" ? 1 : 0);
    }
    const target = hardwareScaleTarget(
      previousModel,
      scalePreview.study.modelId,
      sourceScale,
      scalePreview.study.modelScale ?? 1,
    );
    const factor = target.factor;
    // Only an archival→archival resize can visibly scale the hardware. Leaving
    // it keeps the old factor; entering positions it before the fade from zero.
    updateSourceScale(changedStudy ? factor : sourceScale);
    if (changedStudy && hardwareOpacity !== target.opacity) {
      if (previousModel && !reducedMotion && visible) {
        hardwareTransition = {
          from: hardwareOpacity,
          to: target.opacity,
          started: committedAt,
        };
      } else {
        hardwareTransition = null;
        updateHardwareOpacity(target.opacity);
      }
    }
    updateHardwareOpacity(hardwareOpacity);
    if (changedStudy) {
      // Exclude fading-out skins when measuring the new model's bounds.
      const hardware = hardwareForBounds(meshesByPart, partVisible);
      fitCamera(
        [...scaleSkin.getMeshes(), ...hardware],
        Boolean(framedScaleStudy),
        previousModel === scalePreview.study.modelId,
      );
      framedScaleStudy = scalePreview.study;
    }
    if (
      changedStudy &&
      target.animate &&
      !reducedMotion &&
      visible &&
      previousSourceScale !== factor
    ) {
      sourceTransition = {
        from: previousSourceScale,
        to: factor,
        started: performance.now(),
      };
      updateSourceScale(previousSourceScale);
    } else if (changedStudy) sourceTransition = null;
    options.onScalePreviewReady?.(scalePreview, atlasPlan);
  };

  const cancelCameraTransition = () => {
    cameraTransition = null;
  };
  canvas.addEventListener("pointerdown", cancelCameraTransition);
  canvas.addEventListener("wheel", cancelCameraTransition, { passive: true });
  canvas.addEventListener("keydown", cancelCameraTransition);
  scene.onPointerObservable.add((pointerInfo) => {
    if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return;
    const part = partForMesh(pointerInfo.pickInfo?.pickedMesh ?? null);
    options.onSelectPart?.(part);
  });

  scene.onBeforeRenderObservable.add(() => {
    const now = performance.now();
    if (cameraTransition) {
      const amount = transitionProgress(cameraTransition.started, now, 420);
      applyPose(
        interpolateCameraPose(
          cameraTransition.from,
          cameraTransition.to,
          amount,
        ),
      );
      if (amount === 1) cameraTransition = null;
    } else if (autoRotate && !reducedMotion)
      camera.alpha += Math.min(engine.getDeltaTime(), 64) * 0.00012;
    if (hardwareTransition) {
      const amount = transitionProgress(hardwareTransition.started, now, 320);
      updateHardwareOpacity(
        hardwareTransition.from +
          (hardwareTransition.to - hardwareTransition.from) * amount,
      );
      if (amount === 1) hardwareTransition = null;
    }
    if (sourceTransition) {
      const amount = transitionProgress(sourceTransition.started, now, 320);
      updateSourceScale(
        sourceTransition.from +
          (sourceTransition.to - sourceTransition.from) * amount,
      );
      if (amount === 1) sourceTransition = null;
    }
  });

  const render = () => {
    if (!disposed) scene.render();
  };
  const settleSceneTransitions = () => {
    if (cameraTransition) {
      applyPose(cameraTransition.to);
      cameraTransition = null;
    }
    if (hardwareTransition) {
      updateHardwareOpacity(hardwareTransition.to);
      hardwareTransition = null;
    }
    if (sourceTransition) {
      updateSourceScale(sourceTransition.to);
      sourceTransition = null;
    }
  };
  engine.runRenderLoop(render);
  const visibilityObserver =
    typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver((entries) => {
          if (disposed) return;
          visible = entries.some((entry) => entry.isIntersecting);
          if (!visible) settleSceneTransitions();
          // Completing a hidden fade can commit the latest queued proof. It
          // must not depend on the render loop that is about to be stopped.
          scaleSkin?.setVisible(visible);
          if (visible) engine.runRenderLoop(render);
          else engine.stopRenderLoop(render);
        });
  visibilityObserver?.observe(canvas);

  const ready = SceneLoader.ImportMeshAsync(
    "",
    "/api/assets/",
    "snake_build.glb",
    scene,
  ).then(async ({ meshes }) => {
    if (disposed) return;

    for (const mesh of meshes) {
      const part = partForMesh(mesh);
      if (!part) continue;
      meshesByPart.get(part)?.push(mesh);
      mesh.material = materialsByPart.get(part) ?? null;
      mesh.isPickable = true;
      mesh.useVertexColors = false;
      mesh.setEnabled(partVisible(part));
    }
    fitCamera(meshes);
    updateSelection();
    if (scaleEdition) {
      const [{ createScaleSkin }, { makeStudioReflection }] = await Promise.all(
        [import("./scale-skin"), import("./studio-reflection")],
      );
      if (disposed) return;
      scene.environmentTexture = makeStudioReflection(scene);
      scene.environmentIntensity = 0.85;
      sourceRoot = meshes[0] ?? null;
      originalRootScale = sourceRoot?.scaling.clone() ?? Vector3.One();
      scaleSkin = createScaleSkin(scene, meshes[0] ?? null, {
        onCommit: applyScalePreview,
        onError: (preview, error) =>
          options.onScalePreviewError?.(
            preview,
            error instanceof Error
              ? error.message
              : "The scales could not be updated.",
          ),
      });
      scaleSkin.setWireframe(wireframe);
      scaleSkin.setReducedMotion(reducedMotion);
      scaleSkin.setVisible(visible);
      if (requestedScalePreview) scaleSkin.update(requestedScalePreview);
    }
    if (foilEdition) {
      const { createFoilSkin } = await import("./foil-skin");
      if (disposed) return;
      foilSkin = await createFoilSkin(scene, meshes[0] ?? null, poemVersion);
      if (disposed || !foilSkin) return;
      for (const [part, partMeshes] of meshesByPart) {
        if (!coveredStructure.has(part)) {
          for (const mesh of partMeshes)
            mesh.material = foilSkin.detailMaterial;
        }
      }
      foilSkin.setLettering(showLettering);
      foilSkin.setSeams(showSeams);
      await foilSkin.setPoemVersion(poemVersion);
      foilSkin.setWireframe(wireframe);
      if (readingView) applyCameraView();
    }
  });

  return {
    ready,
    setAutoRotate(enabled) {
      autoRotate = enabled;
    },
    setHiddenParts(parts) {
      hiddenParts = new Set(parts);
      updateHardwareOpacity(scaleEdition ? hardwareOpacity : 1);
    },
    setSelectedPart(part) {
      selectedPart = part;
      updateSelection();
    },
    setWireframe(enabled) {
      wireframe = enabled;
      for (const material of materialsByPart.values())
        material.wireframe = enabled;
      foilSkin?.setWireframe(enabled);
      scaleSkin?.setWireframe(enabled);
    },
    setLettering(visible) {
      showLettering = visible;
      foilSkin?.setLettering(visible);
    },
    setSeams(visible) {
      showSeams = visible;
      foilSkin?.setSeams(visible);
    },
    async setPoemVersion(version, typography) {
      const request = ++inscriptionRequest;
      poemVersion = version;
      try {
        await ready;
        if (disposed || request !== inscriptionRequest || !foilSkin) {
          typography?.dispose?.();
          return;
        }
        await foilSkin.setPoemVersion(version, typography);
      } catch (error) {
        typography?.dispose?.();
        throw error;
      }
    },
    cancelPendingPoemVersion() {
      inscriptionRequest++;
      foilSkin?.cancelPendingPoemVersion();
    },
    setReadingView(enabled) {
      readingView = foilEdition && enabled;
      applyCameraView();
    },
    setScalePreview(preview) {
      requestedScalePreview = preview;
      scaleSkin?.update(preview);
    },
    setReducedMotion(enabled) {
      reducedMotion = enabled;
      scaleSkin?.setReducedMotion(enabled);
      if (enabled) settleSceneTransitions();
    },
    resetCamera() {
      readingView = false;
      applyCameraView();
    },
    resize() {
      engine.resize();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      visibilityObserver?.disconnect();
      cameraTransition = sourceTransition = hardwareTransition = null;
      requestedScalePreview = undefined;
      canvas.removeEventListener("pointerdown", cancelCameraTransition);
      canvas.removeEventListener("wheel", cancelCameraTransition);
      canvas.removeEventListener("keydown", cancelCameraTransition);
      camera.detachControl();
      engine.stopRenderLoop();
      scaleSkin?.dispose();
      foilSkin?.dispose();
      scene.dispose();
      engine.dispose();
    },
  };
}
