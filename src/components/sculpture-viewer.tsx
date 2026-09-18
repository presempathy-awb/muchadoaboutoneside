import { useEffect, useId, useRef, useState } from "react";
import { CANONICAL_POEM, type PoemVersion } from "../../shared/poem";
import {
  matchingCalligraphyFaces,
  useCalligraphyFaces,
} from "../lib/calligraphy-faces";
import type { ScaleAtlasPlan } from "../lib/scale-atlas";
import type { ScalePreview } from "../lib/scale-skin";
import type { ScaleTypography } from "../lib/scale-typography";
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
  /** Exact committed preview and the atlas plan built with this device's limits. */
  onScalePreviewReady?: (
    preview: ScalePreview,
    atlasPlan: ScaleAtlasPlan,
  ) => void;
  onScalePreviewError?: (
    preview: ScalePreview | undefined,
    message: string,
  ) => void;
}

type ViewerStatus = "loading" | "ready" | "error";

const INSCRIPTION_FACE_KEY = "muchado.inscription-face.v1:";

function savedInscriptionFace(poemId: string) {
  try {
    const saved = localStorage.getItem(`${INSCRIPTION_FACE_KEY}${poemId}`);
    return saved && /^[\w-]{1,160}$/.test(saved) ? saved : "auto";
  } catch {
    return "auto";
  }
}

function InscriptionFaceControls({
  controller,
  version,
}: {
  controller: SculptureSceneController | null;
  version: PoemVersion;
}) {
  const library = useCalligraphyFaces();
  const matching = matchingCalligraphyFaces(library.faces, version.loop);
  const [selection, setSelection] = useState(() => ({
    poemId: version.id,
    faceId: savedInscriptionFace(version.id),
  }));
  const choice =
    selection.poemId === version.id
      ? selection.faceId
      : savedInscriptionFace(version.id);
  const face =
    choice === "auto"
      ? (matching.find((item) => item.id === version.calligraphyScanId) ??
        matching[0])
      : matching.find((item) => item.id === choice);
  const faceId = face?.id;
  const [pending, setPending] = useState(false);
  const [faceError, setFaceError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [shown, setShown] = useState<{ text: string; label: string }>();
  const [retry, setRetry] = useState(0);
  const selectId = useId();

  useEffect(() => {
    let active = true;
    const cancel = () => {
      active = false;
      controller?.cancelPendingPoemVersion();
    };
    if (!controller || (choice !== "font" && !library.ready)) return cancel;
    setFaceError("");
    if (choice !== "font" && library.error) {
      setFaceError(library.error);
      setPending(false);
      return cancel;
    }
    if (choice !== "auto" && choice !== "font" && !faceId) {
      setFaceError(
        "That saved handwriting is unavailable or does not match these exact words. Select matching handwriting or generated script.",
      );
      setPending(false);
      return cancel;
    }
    setPending(true);
    void retry;
    void (async () => {
      let loaded: ScaleTypography | undefined;
      try {
        let label = "Generated script";
        if (faceId && choice !== "font") {
          const [{ getCalligraphyScan }, { loadScannedScaleTypography }] =
            await Promise.all([
              import("../lib/calligraphy-scan-store"),
              import("../lib/scanned-scale-typography"),
            ]);
          if (!active) return;
          const scan = await getCalligraphyScan(faceId);
          if (!active) return;
          if (!scan)
            throw new Error(
              "This saved handwriting is no longer available. Choose another face or generated script.",
            );
          loaded = await loadScannedScaleTypography(scan, version.loop);
          label = `${scan.name} · ${scan.calligrapher}`;
        }
        if (!active) {
          loaded?.dispose?.();
          return;
        }
        // The controller owns submitted ink until it is replaced or disposed.
        const submitted = loaded;
        loaded = undefined;
        await controller.setPoemVersion(version, submitted);
        if (active) setShown({ text: version.loop, label });
      } catch (error) {
        loaded?.dispose?.();
        if (active)
          setFaceError(
            error instanceof Error
              ? error.message
              : "This handwriting could not be shown.",
          );
      } finally {
        if (active) setPending(false);
      }
    })();
    return cancel;
  }, [
    controller,
    choice,
    faceId,
    library.ready,
    library.error,
    version,
    retry,
  ]);

  const unavailable = choice !== "auto" && choice !== "font" && !face;
  return (
    <div className="absolute top-3 left-3 z-10 max-w-[min(28rem,calc(100%-1.5rem))] rounded-lg bg-stone-50/95 p-3 text-sm text-stone-900 shadow">
      <label className="block font-medium" htmlFor={selectId}>
        Inscription lettering
      </label>
      <select
        id={selectId}
        className="mt-1 max-w-full rounded border border-stone-400 bg-white px-2 py-1"
        value={choice}
        onChange={(event) => {
          const faceId = event.currentTarget.value;
          setSelection({ poemId: version.id, faceId });
          try {
            localStorage.setItem(
              `${INSCRIPTION_FACE_KEY}${version.id}`,
              faceId,
            );
            setStorageError("");
          } catch {
            setStorageError(
              "This lettering choice could not be saved in this browser.",
            );
          }
        }}
      >
        <option value="auto">Automatic · prefer matching handwriting</option>
        {matching.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name} · {item.calligrapher}
          </option>
        ))}
        {unavailable && (
          <option value={choice}>Unavailable saved handwriting</option>
        )}
        <option value="font">Generated script</option>
      </select>
      {pending || (!library.ready && choice !== "font") ? (
        <p className="mt-1 text-xs" role="status">
          Loading lettering; the current view stays visible.
        </p>
      ) : (
        shown && (
          <p className="mt-1 text-xs">
            Showing {shown.label}
            {shown.text !== version.loop ? " for the previous wording" : ""}.
          </p>
        )
      )}
      {choice === "auto" && library.ready && !face && !library.error && (
        <p className="mt-1 text-xs">
          No saved handwriting matches this wording. Generated script is used.
        </p>
      )}
      {faceError && (
        <div className="mt-2 text-xs text-amber-950" role="alert">
          <p>The last working inscription remains visible. {faceError}</p>
          <button
            type="button"
            className="mt-1 underline"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry lettering
          </button>
        </div>
      )}
      {storageError && (
        <p className="mt-1 text-xs" role="alert">
          {storageError}
        </p>
      )}
      <p className="mt-1 text-xs text-stone-600">
        Saved handwriting changes this preview. Fabrication downloads keep their
        published artwork.
      </p>
    </div>
  );
}

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
  onScalePreviewReady,
  onScalePreviewError,
}: SculptureViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<SculptureSceneController | null>(null);
  const onSelectPartRef = useRef(onSelectPart);
  const onScalePreviewReadyRef = useRef(onScalePreviewReady);
  const onScalePreviewErrorRef = useRef(onScalePreviewError);
  const scalePreviewRef = useRef(scalePreview);
  const previousResetKey = useRef(resetKey);
  const instructionsId = useId();
  const [status, setStatus] = useState<ViewerStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [updateError, setUpdateError] = useState("");
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    onSelectPartRef.current = onSelectPart;
  }, [onSelectPart]);

  useEffect(() => {
    onScalePreviewReadyRef.current = onScalePreviewReady;
    onScalePreviewErrorRef.current = onScalePreviewError;
    scalePreviewRef.current = scalePreview;
  }, [onScalePreviewReady, onScalePreviewError, scalePreview]);

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
        onScalePreviewReady: (preview, atlasPlan) => {
          if (!active) return;
          setUpdateError("");
          setErrorMessage("");
          setStatus("ready");
          onScalePreviewReadyRef.current?.(preview, atlasPlan);
        },
        onScalePreviewError: (preview, message) => {
          if (!active) return;
          setUpdateError(message);
          onScalePreviewErrorRef.current?.(preview, message);
        },
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
          const message =
            error instanceof Error
              ? error.message
              : "The model could not be loaded.";
          setErrorMessage(message);
          onScalePreviewErrorRef.current?.(scalePreviewRef.current, message);
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
      const message =
        error instanceof Error
          ? error.message
          : "The 3D viewer could not start.";
      setErrorMessage(message);
      onScalePreviewErrorRef.current?.(scalePreviewRef.current, message);
      setStatus("error");
    }
  }, [edition]);

  useEffect(() => {
    if (edition === "scales" && scalePreview) {
      try {
        controllerRef.current?.setScalePreview(scalePreview);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "The scales could not be updated.";
        setUpdateError(message);
        onScalePreviewErrorRef.current?.(scalePreview, message);
      }
    }
  }, [scalePreview, edition]);

  useEffect(() => {
    // Switching edition replaces the controller, so reapply unchanged controls too.
    void edition;
    const controller = controllerRef.current;
    controller?.setSelectedPart(selectedPart);
    controller?.setHiddenParts(hiddenParts);
    controller?.setWireframe(wireframe);
    controller?.setReducedMotion(prefersReducedMotion);
    controller?.setAutoRotate(autoRotate && !prefersReducedMotion);
  }, [
    selectedPart,
    hiddenParts,
    wireframe,
    autoRotate,
    prefersReducedMotion,
    edition,
  ]);

  useEffect(() => {
    if (edition === "inscription")
      controllerRef.current?.setLettering(showLettering);
  }, [showLettering, edition]);

  useEffect(() => {
    if (edition === "inscription") controllerRef.current?.setSeams(showSeams);
  }, [showSeams, edition]);

  useEffect(() => {
    if (edition === "inscription")
      controllerRef.current?.setReadingView(readingView);
  }, [readingView, edition]);

  useEffect(() => {
    if (previousResetKey.current === resetKey) return;
    previousResetKey.current = resetKey;
    controllerRef.current?.resetCamera();
  }, [resetKey]);

  const retryScalePreview = () => {
    if (!scalePreview || !controllerRef.current) return;
    try {
      controllerRef.current.setScalePreview(scalePreview);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The scales could not be updated.";
      setUpdateError(message);
      onScalePreviewErrorRef.current?.(scalePreview, message);
    }
  };

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

      {edition === "inscription" && (
        <InscriptionFaceControls
          controller={status === "ready" ? controllerRef.current : null}
          version={poemVersion ?? CANONICAL_POEM}
        />
      )}

      {status === "loading" && (
        <div
          className="pointer-events-none absolute inset-0 grid place-items-center bg-[#e8e5dc]/80 text-sm font-medium text-stone-700"
          role="status"
        >
          Loading the sculpture…
        </div>
      )}

      {updateError && status === "ready" && (
        <div
          className="absolute inset-x-4 bottom-4 rounded-lg bg-amber-50/95 p-3 text-sm text-amber-950 shadow"
          role="alert"
        >
          <p>The previous working view is still shown. {updateError}</p>
          <button
            type="button"
            onClick={retryScalePreview}
            className="mt-2 rounded border border-amber-800 px-3 py-1 font-semibold focus-visible:outline focus-visible:outline-2"
          >
            Retry update
          </button>
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
