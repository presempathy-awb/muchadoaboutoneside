import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import "@babylonjs/core/Culling/ray";
import { Engine } from "@babylonjs/core/Engines/engine";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import { useEffect, useRef, useState } from "react";
import { makeStudioReflection } from "@/lib/studio-reflection";
import { FABRICATION_DOWNLOADS } from "../../shared/fabrication-downloads";

export default function FabricationPreview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setShouldLoad(true);
        observer.disconnect();
      },
      { rootMargin: "240px" },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !shouldLoad) return;
    if (!Engine.isSupported()) {
      setStatus("error");
      return;
    }

    let disposed = false;
    let engine: Engine;
    try {
      engine = new Engine(canvas, true, {
        adaptToDeviceRatio: true,
        antialias: true,
        preserveDrawingBuffer: false,
        stencil: true,
      });
    } catch {
      setStatus("error");
      return;
    }
    const scene = new Scene(engine);
    scene.clearColor = Color4.FromHexString("#d9d8d3ff");
    scene.environmentTexture = makeStudioReflection(scene);
    scene.environmentIntensity = 0.9;

    const camera = new ArcRotateCamera(
      "maquette-camera",
      -Math.PI / 2.35,
      Math.PI / 2.55,
      0.27,
      new Vector3(0, 0.09, 0),
      scene,
    );
    camera.attachControl(canvas, true);
    camera.lowerBetaLimit = 0.15;
    camera.upperBetaLimit = Math.PI - 0.15;
    camera.lowerRadiusLimit = 0.045;
    camera.upperRadiusLimit = 0.52;
    camera.minZ = 0.0001;
    camera.maxZ = 10;
    camera.wheelDeltaPercentage = 0.015;
    camera.useNaturalPinchZoom = true;

    const light = new HemisphericLight(
      "maquette-light",
      new Vector3(-0.4, 1, -0.2),
      scene,
    );
    light.diffuse = Color3.FromHexString("#fffaf0");
    light.groundColor = Color3.FromHexString("#786f65");
    light.intensity = 1.7;

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

    void SceneLoader.ImportMeshAsync(
      "",
      "",
      FABRICATION_DOWNLOADS.smallModel,
      scene,
    )
      .then(({ meshes }) => {
        if (disposed) return;
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
          for (const texture of mesh.material?.getActiveTextures() ?? []) {
            // Keep the narrow physical lettering clear on receding foil faces.
            texture.anisotropicFilteringLevel = 16;
          }
          mesh.computeWorldMatrix(true);
          const bounds = mesh.getBoundingInfo().boundingBox;
          minimum = Vector3.Minimize(minimum, bounds.minimumWorld);
          maximum = Vector3.Maximize(maximum, bounds.maximumWorld);
          foundBounds = true;
        }
        if (foundBounds) {
          const size = maximum.subtract(minimum);
          const radius = Math.max(size.x, size.y, size.z) * 1.45;
          camera.target.copyFrom(minimum.add(maximum).scale(0.5));
          camera.radius = radius;
          camera.lowerRadiusLimit = radius * 0.35;
          camera.upperRadiusLimit = radius * 3;
          camera.minZ = Math.max(radius / 1_000, 0.0001);
          camera.maxZ = Math.max(radius * 10, 1);
        }
        setStatus("ready");
      })
      .catch(() => {
        if (!disposed) setStatus("error");
      });

    const resize = () => engine.resize();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    if (observer) observer.observe(canvas);
    else window.addEventListener("resize", resize);

    return () => {
      disposed = true;
      visibilityObserver?.disconnect();
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      camera.detachControl();
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
    };
  }, [shouldLoad]);

  return (
    <div className="maquette-preview" ref={containerRef}>
      <canvas
        ref={canvasRef}
        aria-label="Interactive preview of the 180 millimetre model covered in marked foil"
        tabIndex={0}
      />
      {status === "loading" && (
        <span className="maquette-status" role="status">
          {shouldLoad
            ? "Preparing the foil-covered model…"
            : "Foil-covered model preview below…"}
        </span>
      )}
      {status === "error" && (
        <span className="maquette-status" role="alert">
          Preview unavailable. The foil model and printable STL remain available
          below.
        </span>
      )}
      <span className="maquette-orbit">DRAG TO ORBIT · SCROLL TO ZOOM</span>
    </div>
  );
}
