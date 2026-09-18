import { useEffect, useId, useRef, useState } from "react";
import type { PoemVersion } from "../../shared/poem";
import type { ScalePreview } from "../lib/scale-skin";
import {
  createSculptureScene,
  SCULPTURE_ASSET_URL,
  type SculptureSceneController,
} from "../lib/sculpture-scene";

export interface SculptureViewerProps {
  className?: string;
  edition?: "construction" | "inscription" | "scales";
  scalePreview?: ScalePreview;
  showLettering?: boolean;
  showSeams?: boolean;
  /** Wording drawn on the foil; defaults to the canonical inscription. */
  poemVersion?: PoemVersion;
  readingView?: boolean;
  selectedPart?: string | null;
  hiddenParts?: string[];
  wireframe?: boolean;
  autoRotate?: boolean;
  resetKey?: number;
  onSelectPart?: (id: string | null) => void;
}

type ViewerStatus = "loading" | "ready" | "error";

export default function SculptureViewer({
  className,
  edition = "construction",
  showLettering = true,
  showSeams = false,
  poemVersion,
  scalePreview,
  readingView = false,
  selectedPart = null,
  hiddenParts = [],
  wireframe = false,
  autoRotate = false,
  resetKey = 0,
  onSelectPart,
}: SculptureViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<SculptureSceneController | null>(null);
  const onSelectPartRef = useRef(onSelectPart);
  const previousResetKey = useRef(resetKey);
  const instructionsId = useId();
  const [status, setStatus] = useState<ViewerStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    onSelectPartRef.current = onSelectPart;
  }, [onSelectPart]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let active = true;
    setStatus("loading");
    setErrorMessage("");

    try {
      const controller = createSculptureScene(canvas, {
        edition,
        onSelectPart: (part) => {
          controllerRef.current?.setSelectedPart(part);
          onSelectPartRef.current?.(part);
        },
      });
      controllerRef.current = controller;

      const resize = () => controller.resize();
      const observer =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(resize);
      if (observer) observer.observe(canvas);
      else window.addEventListener("resize", resize);

      controller.ready.then(
        () => {
          if (active) setStatus("ready");
        },
        (error: unknown) => {
          if (!active) return;
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "The model could not be loaded.",
          );
          setStatus("error");
        },
      );

      return () => {
        active = false;
        observer?.disconnect();
        window.removeEventListener("resize", resize);
        controller.dispose();
        if (controllerRef.current === controller) controllerRef.current = null;
      };
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The 3D viewer could not start.",
      );
      setStatus("error");
    }
  }, [edition]);

  useEffect(() => {
    if (edition === "scales" && scalePreview) {
      try {
        controllerRef.current?.setScalePreview(scalePreview);
      } catch (error) {
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "The scales could not be updated.",
        );
      }
    }
  }, [scalePreview, edition]);

  useEffect(() => {
    controllerRef.current?.setSelectedPart(selectedPart);
  }, [selectedPart]);

  useEffect(() => {
    controllerRef.current?.setHiddenParts(hiddenParts);
  }, [hiddenParts]);

  useEffect(() => {
    controllerRef.current?.setWireframe(wireframe);
  }, [wireframe]);

  useEffect(() => {
    if (edition === "inscription")
      controllerRef.current?.setLettering(showLettering);
  }, [showLettering, edition]);

  useEffect(() => {
    if (edition === "inscription") controllerRef.current?.setSeams(showSeams);
  }, [showSeams, edition]);

  useEffect(() => {
    if (edition === "inscription" && poemVersion)
      controllerRef.current?.setPoemVersion(poemVersion);
  }, [poemVersion, edition]);

  useEffect(() => {
    controllerRef.current?.setAutoRotate(autoRotate && !prefersReducedMotion);
  }, [autoRotate, prefersReducedMotion]);

  useEffect(() => {
    if (edition === "inscription")
      controllerRef.current?.setReadingView(readingView);
  }, [readingView, edition]);

  useEffect(() => {
    if (previousResetKey.current === resetKey) return;
    previousResetKey.current = resetKey;
    controllerRef.current?.resetCamera();
  }, [resetKey]);

  const classes = ["relative isolate overflow-hidden bg-[#e8e5dc]", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <canvas
        ref={canvasRef}
        className="block size-full min-h-[28rem] touch-none cursor-grab outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-amber-800 focus-visible:ring-inset"
        aria-label={
          edition === "scales"
            ? "Interactive 3D calligraphy scale study with raised polygonal plates"
            : edition === "inscription"
              ? "Interactive 3D foil inscription edition of Much Ado About One Side"
              : "Interactive 3D model of the Much Ado About One Side snake sculpture"
        }
        aria-describedby={instructionsId}
        tabIndex={0}
      />

      <p id={instructionsId} className="sr-only">
        Drag to orbit the sculpture; scroll or pinch to zoom.
        {onSelectPart && " Select a piece to inspect it."}
      </p>

      {status === "loading" && (
        <div
          className="pointer-events-none absolute inset-0 grid place-items-center bg-[#e8e5dc]/80 text-sm font-medium text-stone-700"
          role="status"
        >
          Loading the sculpture…
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 grid place-items-center bg-[#e8e5dc] p-8 text-center">
          <div className="max-w-sm text-stone-800" role="alert">
            <p className="font-semibold">
              The 3D sculpture could not be displayed.
            </p>
            <p className="mt-2 text-sm text-stone-600">{errorMessage}</p>
            <a
              className="mt-5 inline-flex rounded-full border border-stone-500 px-4 py-2 text-sm font-medium transition-colors hover:bg-stone-800 hover:text-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-800"
              href={SCULPTURE_ASSET_URL}
              download="snake_build.glb"
            >
              Download the 3D model
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
