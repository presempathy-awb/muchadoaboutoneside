import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
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
import type { FoilSkinController } from "./foil-skin";
import { inscriptionView } from "./inscription-view";

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
  setReadingView(enabled: boolean): void;
  resetCamera(): void;
  resize(): void;
  dispose(): void;
}

interface CreateSculptureSceneOptions {
  onSelectPart?: (part: SculpturePart | null) => void;
  edition?: "construction" | "inscription";
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
  let disposed = false;
  let foilSkin: FoilSkinController | null = null;
  let showLettering = true;
  let showSeams = false;
  let wireframe = false;
  let readingView = false;
  const foilEdition = options.edition === "inscription";
  const coveredStructure = new Set<string>(["ribs", "slats", "spine", "head"]);
  const partVisible = (part: string) =>
    !hiddenParts.has(part) && !(foilEdition && coveredStructure.has(part));
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

  const fitCamera = (meshes: AbstractMesh[]) => {
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
    fittedTarget = minimum.add(maximum).scale(0.5);
    const size = maximum.subtract(minimum);
    fittedRadius = Math.max(size.x, size.y, size.z) * 1.42;
    camera.target.copyFrom(fittedTarget);
    camera.radius = fittedRadius;
    camera.lowerRadiusLimit = fittedRadius * 0.18;
    camera.upperRadiusLimit = fittedRadius * 3.2;
    camera.minZ = Math.max(0.1, fittedRadius / 1_000);
    camera.maxZ = fittedRadius * 8;
  };

  const applyCameraView = () => {
    camera.inertialAlphaOffset = 0;
    camera.inertialBetaOffset = 0;
    camera.inertialRadiusOffset = 0;
    camera.inertialPanningX = 0;
    camera.inertialPanningY = 0;
    if (readingView && foilSkin) {
      const view = inscriptionView(foilSkin.getReadingMesh());
      camera.lowerRadiusLimit = 8;
      camera.target.copyFrom(view.target);
      camera.setPosition(view.position);
    } else {
      camera.lowerRadiusLimit = fittedRadius * 0.18;
      camera.alpha = START_ALPHA;
      camera.beta = START_BETA;
      camera.radius = fittedRadius;
      camera.target.copyFrom(fittedTarget);
    }
  };

  scene.onPointerObservable.add((pointerInfo) => {
    if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return;
    const part = partForMesh(pointerInfo.pickInfo?.pickedMesh ?? null);
    options.onSelectPart?.(part);
  });

  scene.onBeforeRenderObservable.add(() => {
    if (autoRotate) camera.alpha += engine.getDeltaTime() * 0.00012;
  });

  const render = () => {
    if (!disposed) scene.render();
  };
  engine.runRenderLoop(render);
  const visibilityObserver =
    typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver((entries) => {
          if (disposed) return;
          if (entries.some((entry) => entry.isIntersecting))
            engine.runRenderLoop(render);
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
    if (foilEdition) {
      const { createFoilSkin } = await import("./foil-skin");
      if (disposed) return;
      foilSkin = await createFoilSkin(scene, meshes[0] ?? null);
      if (disposed || !foilSkin) return;
      for (const [part, partMeshes] of meshesByPart) {
        if (!coveredStructure.has(part)) {
          for (const mesh of partMeshes)
            mesh.material = foilSkin.detailMaterial;
        }
      }
      foilSkin.setLettering(showLettering);
      foilSkin.setSeams(showSeams);
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
      for (const [part, meshes] of meshesByPart) {
        for (const mesh of meshes) mesh.setEnabled(partVisible(part));
      }
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
    },
    setLettering(visible) {
      showLettering = visible;
      foilSkin?.setLettering(visible);
    },
    setSeams(visible) {
      showSeams = visible;
      foilSkin?.setSeams(visible);
    },
    setReadingView(enabled) {
      readingView = foilEdition && enabled;
      applyCameraView();
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
      camera.detachControl();
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
    },
  };
}
