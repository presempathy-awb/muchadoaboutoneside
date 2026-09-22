import { Link } from "@tanstack/react-router";
import {
  Download,
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  Upload,
} from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { PoemVersionControls } from "@/components/poem-version-controls";
import { ScaleBodyControls } from "@/components/scale-body-controls";
import { ScaleBuildUpPanel } from "@/components/scale-build-up";
import { ScalePlateProof } from "@/components/scale-plate-proof";
import { ScaleReferenceComparison } from "@/components/scale-reference-comparison";
import { ScaleShapeControls } from "@/components/scale-shape-controls";
import { ScaleVersionBrowser } from "@/components/scale-version-browser";
import {
  matchingCalligraphyFaces,
  useCalligraphyFaces,
} from "@/lib/calligraphy-faces";
import { usePoemVersion } from "@/lib/poem-version";
import type { ScaleAtlasPlan } from "@/lib/scale-atlas";
import {
  measureScaleLetteringPhysicalFit,
  measureScaleLetteringVisibilityMetrics,
  measureScanInkVisibility,
  type ScanInkVisibility,
} from "@/lib/scale-lettering-visibility";
import { scalePreviewReadiness } from "@/lib/scale-preview-readiness";
import { searchScaleSizeForText } from "@/lib/scale-size-search";
import type { ScalePreview } from "@/lib/scale-skin";
import type { ScaleTypography } from "@/lib/scale-typography";
import { createScaleTypographyResources } from "@/lib/scale-typography-resources";
import { useScaleStudy } from "@/lib/use-scale-study";
import type { CalligraphyScan } from "../../shared/calligraphy-scan";
import { evaluateLetteringVisibility } from "../../shared/lettering-visibility";
import type { PoemVersion } from "../../shared/poem";
import { draftSource } from "../../shared/poem-drafts";
import {
  DEFAULT_SCALE_DESIGN,
  MAX_SCALE_DESIGN_BYTES,
  normalizeScaleDesign,
  type ScaleDesign,
} from "../../shared/scale-design";
import {
  applyScaleShapeVersion,
  captureScaleShapeVersion,
  parseScaleShapeHistory,
  rememberScaleShapeVersion,
  SCALE_HISTORY_STORAGE_KEY,
  type ScaleShapeVersion,
} from "../../shared/scale-history";
import {
  allocateScaleLettering,
  fillScaleLettering,
} from "../../shared/scale-lettering";
import { scaleStudyBoundsComparison } from "../../shared/scale-measurements";
import {
  modelScaleForHeight,
  SCALE_MODELS,
  scaledModelDimensions,
} from "../../shared/scale-models";
import {
  MAX_SCALE_STUDY_FILE_BYTES,
  parseScaleStudyFile,
  scaleStudyFile,
} from "../../shared/scale-scan-file";
import {
  applyDefaultScalePlateLayout,
  mergeScaleStudySettings,
  type ScalePlate,
  type ScaleStudySettings,
  usesRetiredHomepagePlateLayout,
} from "../../shared/scale-study";
import {
  applyScaleVersionPreset,
  matchingScaleVersionPreset,
  resizeScaleDesign,
  SCALE_VERSION_PRESETS,
  scaleDensityStatus,
  setScaleDensityMode,
  updateScaleDensity,
} from "../../shared/scale-versions";
import {
  isWorksheetBundledFontId,
  WORKSHEET_FONT_CATALOG,
} from "../../shared/worksheet-font-catalog";
import "../scales.css";

const SculptureViewer = lazy(() => import("@/components/sculpture-viewer"));
const ScalePoemEditor = lazy(() => import("@/components/scale-poem-editor"));
const STORAGE_KEY = "muchado.scale-study.v1";
const MAX_DESIGN_BYTES = MAX_SCALE_DESIGN_BYTES;
const EMPTY_PLATES: ScalePlate[] = [];

export function initialScaleDraft(stored: string | null) {
  try {
    if (stored && stored.length <= MAX_DESIGN_BYTES) {
      const design = normalizeScaleDesign(JSON.parse(stored));
      return {
        design: usesRetiredHomepagePlateLayout(design.geometry)
          ? {
              ...design,
              geometry: applyDefaultScalePlateLayout(design.geometry),
            }
          : design,
        saved: true,
      };
    }
  } catch {
    /* An unreadable draft does not stop the studio opening. */
  }
  return { design: DEFAULT_SCALE_DESIGN, saved: false };
}

function readInitialDraft() {
  try {
    return initialScaleDraft(localStorage.getItem(STORAGE_KEY));
  } catch {
    return initialScaleDraft(null);
  }
}

export function seedFreshScaleDraft(
  current: ScaleDesign,
  initial: ScaleDesign,
  poem: PoemVersion,
) {
  // An edit made while the poem library loads takes precedence over seeding.
  return current === initial
    ? {
        ...current,
        text: draftSource(poem),
        calligraphyFaceId: poem.calligraphyScanId ?? "auto",
      }
    : current;
}

function initialHistory(): ScaleShapeVersion[] {
  try {
    return parseScaleShapeHistory(
      localStorage.getItem(SCALE_HISTORY_STORAGE_KEY),
    );
  } catch {
    return [];
  }
}

function useDebounced<T>(value: T): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), 180);
    return () => window.clearTimeout(timer);
  }, [value]);
  return settled;
}

async function downloadDesign(design: ScaleDesign, scanId?: string) {
  const choice = design.calligraphyFaceId ?? "auto";
  const selectedId =
    choice === "auto" ? scanId : choice === "font" ? undefined : choice;
  const scan = selectedId
    ? await (await import("@/lib/calligraphy-scan-store")).getCalligraphyScan(
        selectedId,
      )
    : undefined;
  if (selectedId && !scan)
    throw new Error(
      "Restore the original scan before exporting this handwriting.",
    );
  const blob = new Blob(
    [JSON.stringify(scaleStudyFile(design, scan), null, 2)],
    {
      type: "application/json",
    },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "muchado-scale-study.json";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  display = String(value),
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  display?: string;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="scale-range-field">
      <label htmlFor={id}>
        {label} <output htmlFor={id}>{display}</output>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={display}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

export default function Scales({
  presentation = "studio",
}: {
  presentation?: "home" | "studio";
} = {}) {
  const { base: selectedPoem, ready: poemReady } = usePoemVersion();
  const [initialDraft] = useState(readInitialDraft);
  const [design, setDesign] = useState<ScaleDesign>(initialDraft.design);
  const [draftReady, setDraftReady] = useState(
    presentation !== "home" || initialDraft.saved,
  );
  useEffect(() => {
    if (draftReady || !poemReady) return;
    setDesign((current) =>
      seedFreshScaleDraft(current, initialDraft.design, selectedPoem),
    );
    setDraftReady(true);
  }, [draftReady, poemReady, initialDraft.design, selectedPoem]);
  const [saveStatus, setSaveStatus] = useState("Saving this browser’s draft…");
  const [saveFailed, setSaveFailed] = useState(false);
  const [importError, setImportError] = useState("");
  const [loadedFont, setLoadedFont] = useState<{
    request: object;
    typography: ScaleTypography;
  } | null>(null);
  const typographyResources = useRef<ReturnType<
    typeof createScaleTypographyResources
  > | null>(null);
  const resolvingFont = useRef<ScaleTypography | null>(null);
  useEffect(() => {
    const owner = createScaleTypographyResources();
    typographyResources.current = owner;
    return () => {
      owner.dispose();
      typographyResources.current = null;
      resolvingFont.current = null;
    };
  }, []);
  const [fontUploadError, setFontUploadError] = useState("");
  const [fontFeaturesInput, setFontFeaturesInput] = useState(
    design.fontFeatures,
  );
  const [fontFeaturesError, setFontFeaturesError] = useState("");
  const [fontUploading, setFontUploading] = useState(false);
  const fontUploadRequest = useRef(0);
  const fontInputRef = useRef<HTMLInputElement>(null);
  const [sizeUnit, setSizeUnit] = useState<"in" | "mm">("in");
  const [heightInput, setHeightInput] = useState("");
  const [heightError, setHeightError] = useState("");
  const [fitStatus, setFitStatus] = useState("");
  const [fitting, setFitting] = useState(false);
  const [fitState, setFitState] = useState("idle");
  const fitRequest = useRef<AbortController | null>(null);
  const [fontError, setFontError] = useState("");
  const [fontRetry, setFontRetry] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [selectedPlateId, setSelectedPlateId] = useState("body-0-0");
  const [shapeHistory, setShapeHistory] = useState(initialHistory);
  const [historyError, setHistoryError] = useState("");
  const [scalePreview, setScalePreview] = useState<ScalePreview>();
  const [committedPreview, setCommittedPreview] = useState<{
    preview: ScalePreview;
    atlasPlan: ScaleAtlasPlan;
  }>();
  const renderedPreview = committedPreview?.preview;
  const scanVisibility = useRef(
    new WeakMap<
      ScaleTypography,
      { scan: CalligraphyScan; ink?: ScanInkVisibility }
    >(),
  );
  const [previewError, setPreviewError] = useState("");
  const handlePreviewReady = useCallback(
    (preview: ScalePreview, atlasPlan: ScaleAtlasPlan) => {
      setCommittedPreview({ preview, atlasPlan });
      setPreviewError("");
    },
    [],
  );
  const handlePreviewError = useCallback(
    (_preview: ScalePreview | undefined, message: string) => {
      setPreviewError(message);
    },
    [],
  );
  const importRef = useRef<HTMLInputElement>(null);
  const calligraphy = useCalligraphyFaces();
  const matchingFaces = useMemo(
    () => matchingCalligraphyFaces(calligraphy.faces, design.text),
    [calligraphy.faces, design.text],
  );
  const facePreference = design.calligraphyFaceId ?? "auto";
  const selectedFace =
    facePreference === "auto"
      ? matchingFaces[0]
      : matchingFaces.find((face) => face.id === facePreference);
  const missingFace =
    facePreference !== "auto" && facePreference !== "font" && !selectedFace;
  const exportWaiting =
    facePreference !== "font" &&
    (!calligraphy.ready || Boolean(calligraphy.error));

  useEffect(() => {
    try {
      localStorage.setItem(
        SCALE_HISTORY_STORAGE_KEY,
        JSON.stringify(shapeHistory),
      );
      setHistoryError("");
    } catch {
      setHistoryError(
        "Recent shapes work for this visit, but browser saving failed. Download your study to keep it.",
      );
    }
  }, [shapeHistory]);

  useEffect(
    () => () => {
      fontUploadRequest.current += 1;
    },
    [],
  );
  useEffect(() => {
    setFontFeaturesInput(design.fontFeatures);
    setFontFeaturesError("");
  }, [design.fontFeatures]);

  useEffect(() => {
    if (!draftReady) return;
    setSaveStatus("Saving this browser’s draft…");
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(design));
        setSaveFailed(false);
        setSaveStatus("Draft saved in this browser");
      } catch {
        setSaveFailed(true);
        setSaveStatus(
          "Browser saving failed. Download the study to keep a copy.",
        );
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [design, draftReady]);

  const customFontName = design.customFont?.name;
  const customFontDataUrl = design.customFont?.dataUrl;
  const fontRequest = useMemo(
    () => ({
      fontId: design.fontId,
      customFont:
        customFontName && customFontDataUrl
          ? { name: customFontName, dataUrl: customFontDataUrl }
          : undefined,
      shapingEngine: design.shapingEngine,
      fontFeatures: design.fontFeatures,
      scanId: selectedFace?.id,
      scanText: selectedFace?.text ?? "",
      missingFace,
      scansReady: calligraphy.ready,
    }),
    [
      design.fontId,
      customFontName,
      customFontDataUrl,
      design.shapingEngine,
      design.fontFeatures,
      selectedFace?.id,
      selectedFace?.text,
      missingFace,
      calligraphy.ready,
    ],
  );
  const settledFontRequest = useDebounced(fontRequest);
  const typography =
    loadedFont?.request === settledFontRequest &&
    settledFontRequest === fontRequest
      ? loadedFont.typography
      : undefined;
  const fontFamily =
    typography?.family ?? renderedPreview?.fontFamily ?? "serif";
  useEffect(() => {
    let active = true;
    void fontRetry;
    setFontError("");
    if (!settledFontRequest.scansReady) return;
    const load = async (): Promise<{
      typography: ScaleTypography;
      scan?: CalligraphyScan;
      ink?: ScanInkVisibility;
    }> => {
      if (settledFontRequest.missingFace)
        throw new Error(
          "This handwriting is unavailable or its original transcription no longer matches. Restore the original wording, import its scan, or choose another face.",
        );
      if (settledFontRequest.scanId) {
        const [{ getCalligraphyScan }, { loadScannedScaleTypography }] =
          await Promise.all([
            import("@/lib/calligraphy-scan-store"),
            import("@/lib/scanned-scale-typography"),
          ]);
        const scan = await getCalligraphyScan(settledFontRequest.scanId);
        if (!scan)
          throw new Error(
            "The selected scan is no longer saved in this browser. Import its saved scan file to restore it.",
          );
        const scanTypography = await loadScannedScaleTypography(
          scan,
          settledFontRequest.scanText,
        );
        const ink = await measureScanInkVisibility(scan);
        return { typography: scanTypography, scan, ink };
      }
      const { loadScaleTypography } = await import("@/lib/scale-typography");
      return { typography: await loadScaleTypography(settledFontRequest) };
    };
    void load().then(
      (loaded) => {
        if (active && typographyResources.current) {
          // Hold the result even before React commits the queued state update.
          if (loaded.scan)
            scanVisibility.current.set(loaded.typography, {
              scan: loaded.scan,
              ink: loaded.ink,
            });
          resolvingFont.current = loaded.typography;
          typographyResources.current.own(loaded.typography);
          setLoadedFont({
            request: settledFontRequest,
            typography: loaded.typography,
          });
        } else loaded.typography.dispose?.();
      },
      (error: unknown) => {
        if (active)
          setFontError(
            error instanceof Error
              ? error.message
              : "This font could not load.",
          );
      },
    );
    return () => {
      active = false;
    };
  }, [settledFontRequest, fontRetry]);

  useEffect(() => {
    void design;
    void typography;
    return () => {
      if (fitRequest.current) {
        fitRequest.current.abort();
        fitRequest.current = null;
        setFitting(false);
        setFitState("cancelled");
        setFitStatus(
          "Settings changed. Start a new size search when you are ready.",
        );
      }
    };
  }, [design, typography]);

  const sourceHeightInches = SCALE_MODELS[design.geometry.modelId].heightInches;
  const targetDimensions = scaledModelDimensions(
    design.geometry.modelId,
    design.geometry.modelScale,
  );
  const sizeFactor = sizeUnit === "mm" ? 25.4 : 1;
  const sizeStep = sizeUnit === "mm" ? 1 : 0.1;
  const sizeValue = (inches: number) =>
    (inches * sizeFactor).toLocaleString(undefined, {
      maximumFractionDigits: sizeUnit === "mm" ? 1 : 2,
    });
  const targetHeightInches = sourceHeightInches * design.geometry.modelScale;
  useEffect(() => {
    setHeightError("");
    setHeightInput(
      (targetHeightInches * (sizeUnit === "mm" ? 25.4 : 1)).toFixed(2),
    );
  }, [targetHeightInches, sizeUnit]);

  const geometryRequest = useMemo(
    () => ({ geometry: design.geometry, layers: design.layers }),
    [design.geometry, design.layers],
  );
  const geometryInput = useDebounced(geometryRequest);
  const geometry = useScaleStudy(geometryInput);
  const candidateStudy = geometry.study;
  const candidatePlates = candidateStudy?.plates ?? EMPTY_PLATES;
  const previewGeometry = geometry.snapshot ?? geometryInput;
  const layoutRequest = useMemo(
    () => ({
      text: design.text,
      fontSizeMm: design.fontSizeMm,
      minFontSizeMm: design.minFontSizeMm,
      marginMm: design.marginMm,
      autoFit: design.autoFit,
    }),
    [
      design.text,
      design.fontSizeMm,
      design.minFontSizeMm,
      design.marginMm,
      design.autoFit,
    ],
  );
  const settledLayout = useDebounced(layoutRequest);
  const layout = useMemo(() => {
    try {
      if (
        !design.showLettering ||
        !/\S/u.test(settledLayout.text) ||
        !typography
      )
        return {
          lettering: {
            placements: [],
            unplacedText: /\S/u.test(settledLayout.text)
              ? settledLayout.text
              : "",
            placedWordCount: 0,
            totalWordCount: settledLayout.text.match(/\S+/gu)?.length ?? 0,
          },
          error: "",
        };
      const options = {
        ...settledLayout,
        measure: typography.measure,
        measureLine: typography.measureLine,
        segments: typography.segments,
      };
      const lettering = settledLayout.autoFit
        ? fillScaleLettering(candidatePlates, settledLayout.text, options)
        : allocateScaleLettering(candidatePlates, settledLayout.text, options);
      return { lettering, error: "" };
    } catch (error) {
      return {
        lettering: {
          placements: [],
          unplacedText: settledLayout.text,
          placedWordCount: 0,
          totalWordCount: settledLayout.text.match(/\S+/gu)?.length ?? 0,
        },
        error:
          error instanceof Error
            ? error.message
            : "Lettering could not be mapped.",
      };
    }
  }, [settledLayout, candidatePlates, typography, design.showLettering]);
  const fontLoading = !typography && !fontError;
  const geometryPending =
    geometryInput !== geometryRequest || geometry.computing;
  const readiness = scalePreviewReadiness({
    text: design.text,
    showLettering: design.showLettering,
    hasGeometry: Boolean(candidateStudy),
    geometryPending,
    geometryError: geometry.error,
    layoutPending: settledLayout !== layoutRequest,
    hasTypography: Boolean(typography),
    fontError,
    layoutError: layout.error,
  });
  const mappingPending = readiness.pending;
  // Render metadata excludes planning-only fields so notes and build method
  // changes do not rebuild the GPU skin or interrupt a transition.
  const candidateDesign = useMemo<ScaleDesign>(
    () => ({
      schema: 1,
      geometry: previewGeometry.geometry,
      layers: previewGeometry.layers,
      buildMethod: "wood",
      notes: "",
      customFont: design.customFont,
      shapingEngine: design.shapingEngine,
      fontFeatures: design.fontFeatures,
      ...settledLayout,
      fontId: design.fontId,
      calligraphyFaceId: design.calligraphyFaceId,
      inkColor: design.inkColor,
      plateColor: design.plateColor,
      showLettering: design.showLettering,
      letteringQuality: design.letteringQuality,
    }),
    [
      previewGeometry,
      settledLayout,
      design.fontId,
      design.calligraphyFaceId,
      design.inkColor,
      design.plateColor,
      design.showLettering,
      design.letteringQuality,
      design.customFont,
      design.shapingEngine,
      design.fontFeatures,
    ],
  );
  const candidatePreview = useMemo<ScalePreview | undefined>(
    () =>
      candidateStudy && readiness.ready
        ? {
            study: candidateStudy,
            lettering: layout.lettering,
            design: candidateDesign,
            fontFamily: typography?.family ?? "serif",
            typography,
          }
        : undefined,
    [
      candidateStudy,
      typography,
      readiness.ready,
      layout.lettering,
      candidateDesign,
    ],
  );
  // Never pass a half-ready preview to the renderer: geometry, lettering,
  // colors and typography travel together until a complete replacement exists.
  useEffect(() => {
    if (candidatePreview) {
      setPreviewError("");
      setScalePreview(candidatePreview);
    }
  }, [candidatePreview]);
  useEffect(() => {
    // A queued 3D update and the flat proof can still use earlier handwriting.
    // Release it only after both have moved to a complete replacement.
    typographyResources.current?.retain([
      resolvingFont.current,
      loadedFont?.typography,
      candidatePreview?.typography,
      scalePreview?.typography,
      renderedPreview?.typography,
    ]);
  }, [loadedFont, candidatePreview, scalePreview, renderedPreview]);
  const updating =
    !previewError &&
    (mappingPending ||
      Boolean(candidatePreview && candidatePreview !== renderedPreview));
  const previewBlocked = readiness.blocked || Boolean(previewError);
  const study = renderedPreview?.study;
  const committedBounds = useMemo(
    () => (study ? scaleStudyBoundsComparison(study) : null),
    [study],
  );
  const plates = study?.plates ?? EMPTY_PLATES;
  const displayedLettering = renderedPreview?.lettering;
  const displayedDesign = renderedPreview?.design;
  const densityStatus = scaleDensityStatus(design);

  useEffect(() => {
    if (
      !candidatePreview ||
      renderedPreview !== candidatePreview ||
      mappingPending ||
      previewBlocked
    )
      return;
    const timer = window.setTimeout(() => {
      const preset = matchingScaleVersionPreset(design);
      const isPrint = design.geometry.modelId === "maquette";
      const height =
        SCALE_MODELS[design.geometry.modelId].heightInches *
        design.geometry.modelScale;
      const label =
        preset?.name ??
        `${isPrint ? "Print" : "Wood"} · ${(height * (isPrint ? 25.4 : 1)).toFixed(1)} ${isPrint ? "mm" : "in"} · ${candidatePreview.study.plates.length} plates`;
      const version = captureScaleShapeVersion(design, label);
      setShapeHistory((current) => rememberScaleShapeVersion(current, version));
    }, 850);
    return () => window.clearTimeout(timer);
  }, [
    candidatePreview,
    renderedPreview,
    mappingPending,
    previewBlocked,
    design,
  ]);

  const atlasPlan = committedPreview?.atlasPlan;
  const visibility = useMemo(() => {
    if (!renderedPreview) return null;
    const {
      design: shown,
      lettering,
      study: shownStudy,
      typography: shownTypography,
    } = renderedPreview;
    const original = shownTypography
      ? scanVisibility.current.get(shownTypography)
      : undefined;
    const metrics = shownTypography
      ? measureScaleLetteringVisibilityMetrics(
          shownTypography,
          lettering.placements,
          original?.scan,
          original?.ink,
        )
      : {};
    const verticalPixels = atlasPlan?.minVerticalPixelsPerEm;
    return evaluateLetteringVisibility({
      text: shown.text,
      physical: shownTypography
        ? measureScaleLetteringPhysicalFit(
            shownStudy.plates,
            lettering,
            shownTypography,
            shown.marginMm,
          )
        : undefined,
      colors: { ink: shown.inkColor, paper: shown.plateColor },
      texture: {
        inkHeightPx:
          verticalPixels && metrics.inkHeightEm
            ? verticalPixels * metrics.inkHeightEm
            : undefined,
        xHeightPx:
          verticalPixels && metrics.xHeightEm
            ? verticalPixels * metrics.xHeightEm
            : undefined,
      },
      source: {
        kind: shownTypography?.engine === "scan" ? "scan" : "vector",
        inkHeightPx: metrics.sourceInkHeightPx,
      },
    });
  }, [renderedPreview, atlasPlan]);
  const letteredPlates = plates.filter((plate) =>
    displayedLettering?.placements.some(
      (placement) =>
        placement.plateId === plate.id && placement.lines.length > 0,
    ),
  );
  const proofPlates = letteredPlates.length ? letteredPlates : plates;
  const selectedPlate =
    proofPlates.find((plate) => plate.id === selectedPlateId) ?? proofPlates[0];
  const selectedProofIndex = proofPlates.findIndex(
    (plate) => plate.id === selectedPlate?.id,
  );
  function stepProof(direction: number) {
    const next =
      proofPlates[
        (selectedProofIndex + direction + proofPlates.length) %
          proofPlates.length
      ];
    if (next) setSelectedPlateId(next.id);
  }
  const selectedPlacement = displayedLettering?.placements.find(
    (placement) => placement.plateId === selectedPlate?.id,
  );
  const letteredSizes =
    displayedLettering?.placements
      .filter((placement) => placement.lines.length > 0)
      .map((placement) => placement.fontSizeMm) ?? [];
  const actualSizeMin =
    letteredSizes.length > 0 ? Math.min(...letteredSizes) : undefined;
  const actualSizeMax =
    letteredSizes.length > 0 ? Math.max(...letteredSizes) : undefined;
  const actualSizeLabel =
    actualSizeMin === undefined
      ? "—"
      : actualSizeMax !== undefined && actualSizeMax - actualSizeMin >= 1
        ? `${actualSizeMin.toFixed(0)}–${actualSizeMax.toFixed(0)}`
        : actualSizeMin.toFixed(1);
  const usedPlates =
    displayedLettering?.placements.filter(
      (placement) => placement.lines.length > 0,
    ).length ?? 0;

  function updateDesign(patch: Partial<ScaleDesign>) {
    setDesign((current) => {
      const normalized = normalizeScaleDesign({ ...current, ...patch });
      const sameGeometry = Object.entries(normalized.geometry).every(
        ([key, value]) =>
          current.geometry[key as keyof ScaleStudySettings] === value,
      );
      return {
        ...normalized,
        geometry: sameGeometry ? current.geometry : normalized.geometry,
        layers: patch.layers ? normalized.layers : current.layers,
        customFont: patch.customFont
          ? normalized.customFont
          : current.customFont,
      };
    });
  }

  function updateGeometry(patch: Partial<ScaleStudySettings>) {
    setDesign((current) => {
      const base =
        patch.columns !== undefined || patch.rows !== undefined
          ? updateScaleDensity(current, {
              columns: patch.columns ?? current.geometry.columns,
              rows: patch.rows ?? current.geometry.rows,
            })
          : current;
      const normalized = normalizeScaleDesign({
        ...base,
        geometry: {
          ...base.geometry,
          ...patch,
          ...(patch.modelId === "maquette"
            ? { surfaceMode: "conforming" }
            : {}),
        },
      });
      return {
        ...normalized,
        geometry: mergeScaleStudySettings(
          current.geometry,
          normalized.geometry,
        ),
        layers: current.layers,
        customFont: current.customFont,
      };
    });
  }

  function applyHeight() {
    const value = Number(heightInput);
    const min = sourceHeightInches * 0.02 * sizeFactor;
    const max = sourceHeightInches * 30 * sizeFactor;
    if (
      !heightInput.trim() ||
      !Number.isFinite(value) ||
      value < min ||
      value > max
    ) {
      setHeightError(
        `Enter a height from ${min.toFixed(2)} to ${max.toFixed(2)} ${sizeUnit}.`,
      );
      return;
    }
    setHeightError("");
    setDesign((current) =>
      resizeScaleDesign(
        current,
        modelScaleForHeight(current.geometry.modelId, value / sizeFactor),
      ),
    );
  }

  function stepHeight(direction: number) {
    setHeightError("");
    setDesign((current) =>
      resizeScaleDesign(
        current,
        modelScaleForHeight(
          current.geometry.modelId,
          (SCALE_MODELS[current.geometry.modelId].heightInches *
            current.geometry.modelScale *
            sizeFactor +
            direction * sizeStep) /
            sizeFactor,
        ),
      ),
    );
  }

  async function fitSize() {
    if (!typography || !design.text.trim()) return;
    fitRequest.current?.abort();
    const controller = new AbortController();
    fitRequest.current = controller;
    setFitting(true);
    setFitState("searching");
    setFitStatus(
      "Testing larger sizes with your current type and scale pattern…",
    );
    try {
      const result = await searchScaleSizeForText(design, typography, {
        signal: controller.signal,
        onTrial: (trial) => {
          if (!controller.signal.aborted)
            setFitStatus(
              `Testing ${(sourceHeightInches * trial.modelScale * sizeFactor).toFixed(1)} ${sizeUnit}: ${trial.placedWordCount} of ${trial.totalWordCount} words placed.`,
            );
        },
      });
      if (controller.signal.aborted || fitRequest.current !== controller)
        return;
      fitRequest.current = null;
      setFitStatus(result.reason);
      setFitState(result.status);
      if (result.status === "fit" && result.candidate)
        setDesign(result.candidate);
    } catch (error) {
      if (!controller.signal.aborted) {
        setFitState("error");
        setFitStatus(
          error instanceof Error
            ? error.message
            : "Size search could not finish. Your previous size is kept.",
        );
      }
    } finally {
      if (fitRequest.current === controller || fitRequest.current === null) {
        fitRequest.current = null;
        setFitting(false);
      }
    }
  }

  function cancelFontUpload() {
    fontUploadRequest.current += 1;
    setFontUploading(false);
  }

  function applyFontFeatures() {
    try {
      const normalized = normalizeScaleDesign({
        ...design,
        fontFeatures: fontFeaturesInput,
      });
      setFontFeaturesError("");
      setFontFeaturesInput(normalized.fontFeatures);
      updateDesign({ fontFeatures: normalized.fontFeatures });
    } catch (error) {
      setFontFeaturesError(
        error instanceof Error
          ? error.message
          : "Those font features could not be applied.",
      );
    }
  }

  async function uploadFont(file: File | undefined) {
    if (!file) return;
    const request = ++fontUploadRequest.current;
    setFontUploading(true);
    setFontUploadError("");
    try {
      if (!/\.(ttf|otf)$/i.test(file.name))
        throw new Error("Choose a TTF or OTF font file.");
      if (file.size === 0 || file.size > 2 * 1024 * 1024)
        throw new Error("Choose a nonempty font file up to 2 MB.");
      const { validateWorksheetSfnt } = await import("@/lib/worksheet-fonts");
      const bytes = new Uint8Array(await file.arrayBuffer());
      validateWorksheetSfnt(bytes);
      let binary = "";
      for (let start = 0; start < bytes.length; start += 32768)
        binary += String.fromCharCode(...bytes.subarray(start, start + 32768));
      const customFont = {
        name: file.name.slice(0, 100),
        dataUrl: `data:font/${/\.otf$/i.test(file.name) ? "otf" : "ttf"};base64,${btoa(binary)}`,
      };
      if (request === fontUploadRequest.current)
        updateDesign({
          customFont,
          fontId: "custom",
          calligraphyFaceId: "font",
        });
    } catch (error) {
      if (request === fontUploadRequest.current)
        setFontUploadError(
          error instanceof Error
            ? error.message
            : "This font could not be imported.",
        );
    } finally {
      if (request === fontUploadRequest.current) setFontUploading(false);
    }
  }

  async function importDesign(file: File | undefined) {
    if (!file) return;
    cancelFontUpload();
    setImportError("");
    try {
      if (file.size > MAX_SCALE_STUDY_FILE_BYTES)
        throw new Error(
          "This study exceeds the supported size, including its original scan.",
        );
      const imported = parseScaleStudyFile(JSON.parse(await file.text()));
      if (imported.scan) {
        const { saveCalligraphyScan } = await import(
          "@/lib/calligraphy-scan-store"
        );
        await saveCalligraphyScan(imported.scan);
      }
      setDesign(imported.design);
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : "This study could not be opened.",
      );
    }
  }

  return (
    <div className={`scales-page scales-${presentation}`}>
      <header className="scales-intro">
        <div>
          <p className="scales-eyebrow">
            MUCH ADO ABOUT ONE SIDE / SURFACE STUDY
          </p>
          <h1>
            A sculpture for <em>every word.</em>
          </h1>
          <p className="scales-lede">
            Choose a form, set its size, and find room for the poem. Inspect the
            original lettering as the scales follow the sculpture.
          </p>
        </div>
        <nav aria-label="Related studios" className="scales-page-links">
          <Link to="/foil">Foil edition ↗</Link>
          <Link to="/references">Reference photographs ↗</Link>
          <Link to="/calligraphy/practice">Paper &amp; practice studio ↗</Link>
        </nav>
      </header>

      <div
        className="scales-workbench"
        data-testid="scales-workbench"
        data-preview-ready={Boolean(
          renderedPreview && !updating && !previewBlocked,
        )}
        data-font-id={renderedPreview?.design.fontId}
        data-model-scale={renderedPreview?.design.geometry.modelScale}
        data-body-width={renderedPreview?.design.geometry.bodyWidthScale}
        data-body-depth={renderedPreview?.design.geometry.bodyDepthScale}
        data-geometry-source={geometry.cacheHit ? "cache" : "built"}
        data-plate-shape={renderedPreview?.design.geometry.plateShape}
        data-plate-fit={renderedPreview?.design.geometry.plateFit}
        data-source-triangles={
          renderedPreview?.study.sourceGeometry
            ? renderedPreview.study.sourceGeometry.indices.length / 3
            : 0
        }
        data-plate-aspect={renderedPreview?.design.geometry.plateAspect}
        data-plate-fingerprint={renderedPreview?.study.plates[0]?.positions
          .slice(0, 24)
          .map((value) => value.toFixed(5))
          .join(",")}
        data-fit-state={fitState}
      >
        <div className="scales-display-column">
          <section
            className="scales-model-card"
            aria-label="Interactive scale study"
          >
            <ScaleVersionBrowser
              design={design}
              history={shapeHistory}
              historyError={historyError}
              onPreset={(id) =>
                setDesign((current) => applyScaleVersionPreset(current, id))
              }
              onHistory={(version) =>
                setDesign((current) => applyScaleShapeVersion(current, version))
              }
            />
            <div className="scales-model-heading">
              <span>01 / THE SCULPTURE</span>
              <span aria-live="polite">
                {previewBlocked
                  ? "Edit needs attention"
                  : updating
                    ? "Remapping…"
                    : `${plates.length} individual plates`}
              </span>
            </div>
            <Suspense
              fallback={
                <div className="scales-model-loading" role="status">
                  Preparing the 3D scales…
                </div>
              }
            >
              {scalePreview ? (
                <SculptureViewer
                  className="scales-model"
                  edition="scales"
                  scalePreview={scalePreview}
                  onScalePreviewReady={handlePreviewReady}
                  onScalePreviewError={handlePreviewError}
                  autoRotate={autoRotate}
                  wireframe={wireframe}
                  resetKey={resetKey}
                />
              ) : (
                <div className="scales-model-loading" role="status">
                  {geometry.error
                    ? "The scale model is not ready."
                    : "Building the curved scale surfaces…"}
                </div>
              )}
            </Suspense>
            <div className="scales-camera-bar">
              <span>Drag to orbit · Scroll or pinch to zoom</span>
              <div className="scales-button-group">
                <button
                  type="button"
                  className="scales-font-shortcut"
                  onClick={() => {
                    const panel = document.querySelector<HTMLDetailsElement>(
                      ".scales-lettering-disclosure",
                    );
                    if (panel) {
                      panel.open = true;
                      panel.querySelector("summary")?.focus();
                      panel.scrollIntoView({ block: "start" });
                    }
                  }}
                >
                  Font &amp; words ↓
                </button>
                <button
                  type="button"
                  aria-pressed={autoRotate}
                  onClick={() => setAutoRotate((value) => !value)}
                >
                  {autoRotate ? (
                    <Pause size={14} aria-hidden="true" />
                  ) : (
                    <Play size={14} aria-hidden="true" />
                  )}
                  {autoRotate ? "Pause" : "Turn"}
                </button>
                <button
                  type="button"
                  aria-pressed={wireframe}
                  onClick={() => setWireframe((value) => !value)}
                >
                  Wireframe
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAutoRotate(false);
                    setResetKey((value) => value + 1);
                  }}
                >
                  <RotateCcw size={14} aria-hidden="true" /> Reset view
                </button>
              </div>
            </div>
          </section>
          <p className="scales-preview-status" role="status">
            {renderedPreview
              ? `${updating || previewBlocked ? "Keeping the last viewable version. " : ""}The 3D view, fit counts, and face proof show ${renderedPreview.study.modelId === "maquette" ? "the print maquette" : "the archival model"} at ${(renderedPreview.design.geometry.modelScale * 100).toFixed(1)}%.${updating ? " Your latest settings are remapping." : ""}`
              : "Your first complete preview is preparing. Shapes are remembered after they display successfully."}
          </p>
          <div className="scales-stats" aria-live="polite" aria-atomic="true">
            <div>
              <strong>
                {displayedLettering?.placedWordCount ?? "—"}
                <small> / {displayedLettering?.totalWordCount ?? "—"}</small>
              </strong>
              <span>
                {displayedLettering
                  ? displayedDesign?.showLettering
                    ? "words placed in shown version"
                    : "lettering hidden · fitting paused"
                  : "fit awaiting complete preview"}
              </span>
            </div>
            <div>
              <strong>
                {usedPlates}
                <small> / {plates.length}</small>
              </strong>
              <span>faces lettered</span>
            </div>
            <div>
              <strong>
                {actualSizeLabel}
                <small> mm</small>
              </strong>
              <span>type size on lettered faces · not x-height</span>
            </div>
          </div>
          <p className="scales-model-note">
            {displayedDesign?.geometry.modelId === "maquette"
              ? "These plates follow connected surface charts from the actual printable maquette. Its integrated base and joined parts come from that print mesh."
              : "Curved plates follow the archived model’s changing cross-section. The layer allowance adds outward build-up beyond that model; it does not assume the archived model is a bare frame. The reference shows irregular, stepped wooden faces, but provides no measured layer thicknesses."}
          </p>
          {geometry.error && (
            <p className="scales-error" role="alert">
              {geometry.error}
              {study
                ? " The last successful model is still shown."
                : " Choose a starting shape or adjust the settings."}{" "}
              <button type="button" onClick={geometry.retry}>
                Retry geometry
              </button>
            </p>
          )}
          {geometry.error && (
            <button
              type="button"
              className="scales-thin-layers"
              onClick={() => {
                setDesign((current) =>
                  normalizeScaleDesign({
                    ...current,
                    layers: {
                      supportInches: 0,
                      backingInches: 0,
                      adhesiveMm: 0,
                      metalMm: 0.127,
                      finishMm: 0,
                      overlapMm: 0,
                    },
                    geometry: { ...current.geometry, relief: 1 / 25.4 },
                  }),
                );
              }}
            >
              Use thin prototype layers · 0.127 mm metal + 1 mm relief
            </button>
          )}
          {geometry.fallback && (
            <p className="scales-model-note">
              This browser cannot run the scale builder in the background. Model
              updates may briefly pause the page.
            </p>
          )}
          {!!study?.unletterablePlateCount && (
            <p className="scales-quality-note" role="status">
              {study.unletterablePlateCount} curved faces remain unlettered
              because their shape varies too much for a reliable physical
              lettering estimate. Try enlarging the model or reducing the layer
              thickness and relief. Those faces remain visible for planning.
            </p>
          )}
          {!!study?.adjustedReliefCount && (
            <p className="scales-quality-note" role="status">
              Curvature reduces the local relief on {study.adjustedReliefCount}{" "}
              plates to keep their geometry valid. Their actual height can be
              smaller than your requested relief.
            </p>
          )}
          {visibility && (
            <details
              className="scales-visibility"
              data-testid="scales-visibility"
              data-status={visibility.status}
            >
              <summary>
                Lettering checks ·{" "}
                {visibility.status === "empty"
                  ? "add wording"
                  : visibility.status === "needs-attention"
                    ? "needs attention"
                    : visibility.status === "meets-targets"
                      ? "measured targets met"
                      : "measurements incomplete"}
              </summary>
              <p>{visibility.summary}</p>
              <p>
                Checks describe the displayed version using local geometry, ink,
                and color measurements. Screen projection and stroke width
                remain unmeasured; inspect a face below.
              </p>
              {atlasPlan?.qualityLimited && (
                <p>
                  The device’s texture budget limits the requested detail. The
                  face proof draws directly from the original lettering.
                </p>
              )}
              <ul>
                {visibility.checks.map((check) => (
                  <li
                    key={check.id}
                    data-check={check.id}
                    data-check-status={check.status}
                  >
                    <strong>
                      {check.label}: {check.status.replaceAll("-", " ")}
                    </strong>
                    <br />
                    {check.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {atlasPlan && !atlasPlan.readable && (
            <p className="scales-quality-note" role="status">
              The displayed 3D textures provide{" "}
              {atlasPlan.minPixelsPerEm?.toFixed(1)} pixels per em. Small
              lettering may look soft. Use the face proof for closer inspection,
              or increase the type size. Changing texture detail preserves every
              original stroke.
            </p>
          )}
          {layout.error && (
            <p className="scales-error" role="alert">
              {layout.error}
              {design.showLettering && (
                <button
                  type="button"
                  onClick={() => updateDesign({ showLettering: false })}
                >
                  View shape without lettering
                </button>
              )}
            </p>
          )}
          {displayedDesign?.showLettering &&
            displayedLettering?.unplacedText && (
              <section
                className="scales-overflow"
                aria-labelledby="scales-overflow-title"
              >
                <h2 id="scales-overflow-title">Some words still need a home</h2>
                <p>
                  Try a smaller type size or margin, or fewer, larger plates.
                  Every unplaced word is kept below.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setDesign((current) =>
                      resizeScaleDesign(
                        current,
                        Math.min(30, current.geometry.modelScale * 1.1),
                      ),
                    )
                  }
                >
                  Make the sculpture 10% larger
                </button>
                <details>
                  <summary>
                    Read{" "}
                    {displayedLettering.totalWordCount -
                      displayedLettering.placedWordCount}{" "}
                    unplaced words
                  </summary>
                  <p>{displayedLettering.unplacedText}</p>
                </details>
              </section>
            )}

          <details
            className="scales-disclosure scales-material-disclosure"
            open={presentation === "studio"}
          >
            <summary>Material layers & girth</summary>
            <ScaleBuildUpPanel
              layers={design.layers}
              onChange={(layers) => updateDesign({ layers })}
              study={study ?? null}
              reliefInches={design.geometry.relief}
              pending={updating || previewBlocked}
              modelId={design.geometry.modelId}
              modelScale={design.geometry.modelScale}
              bodyWidthScale={design.geometry.bodyWidthScale}
              bodyDepthScale={design.geometry.bodyDepthScale}
            />
          </details>

          {selectedPlate && displayedDesign && renderedPreview && (
            <section
              className="scales-proof-card"
              aria-labelledby="scales-proof-title"
            >
              <div className="scales-section-heading">
                <span>02 / ONE FACE, UP CLOSE</span>
                <h2 id="scales-proof-title">Check the lettering</h2>
              </div>
              <label className="scales-field" htmlFor="scales-proof-plate">
                {letteredPlates.length ? "Lettered face" : "Face"}
                <select
                  id="scales-proof-plate"
                  value={selectedPlate.id}
                  onChange={(event) => setSelectedPlateId(event.target.value)}
                >
                  {proofPlates.map((plate) => (
                    <option key={plate.id} value={plate.id}>
                      {plate.surface === "body" ? "Body" : "Jaw"} · row{" "}
                      {plate.row + 1}, plate {plate.column + 1}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset
                className="scales-proof-navigation"
                aria-label="Browse lettered faces"
              >
                <button
                  type="button"
                  disabled={proofPlates.length < 2}
                  onClick={() => stepProof(-1)}
                >
                  ← Previous face
                </button>
                <span>
                  {selectedProofIndex + 1} / {proofPlates.length}
                </span>
                <button
                  type="button"
                  disabled={proofPlates.length < 2}
                  onClick={() => stepProof(1)}
                >
                  Next face →
                </button>
              </fieldset>
              <ScalePlateProof
                plate={selectedPlate}
                placement={selectedPlacement}
                design={displayedDesign}
                family={renderedPreview.fontFamily}
                typography={renderedPreview.typography}
              />
              <p className="scales-proof-dimensions">
                Approx. source-model width × height:{" "}
                {selectedPlate.widthInches.toFixed(2)} ×{" "}
                {selectedPlate.heightInches.toFixed(2)} in
                {" · "}
                {(selectedPlate.widthInches * 25.4).toFixed(1)} ×{" "}
                {(selectedPlate.heightInches * 25.4).toFixed(1)} mm
              </p>
              <p className="scales-proof-dimensions">
                This face’s modeled relief:{" "}
                {selectedPlate.appliedReliefInches.toFixed(2)} in
                {" · "}
                {(selectedPlate.appliedReliefInches * 25.4).toFixed(1)} mm
              </p>
              <p className="scales-help">
                The dashed area keeps letters away from edges. This is a
                face-layout proof, not a cutting pattern. Curved faces,
                attachment points, and crossing clearances need measurements and
                a physical test fit.{" "}
                <Link to="/instructions" hash="large-sculpture">
                  Read the plate preparation, paper-template, attachment, and
                  clearance guide.
                </Link>
              </p>
              <p className="scales-plate-words">
                {selectedPlacement?.lines.join(" ") ||
                  "No words on this face yet."}
              </p>
            </section>
          )}
        </div>

        <aside
          className="scales-controls"
          aria-label="Design your scales and lettering"
        >
          <section
            className="scales-control-card scales-size-card"
            aria-labelledby="scales-size-title"
          >
            <div className="scales-section-heading">
              <span>REAL SIZE, REAL MATERIAL</span>
              <h2 id="scales-size-title">Size the sculpture</h2>
            </div>
            <label className="scales-field" htmlFor="scales-model-source">
              Source model · open a starting shape
              <select
                id="scales-model-source"
                value={design.geometry.modelId}
                onChange={(event) => {
                  const modelId = event.currentTarget.value;
                  const preset = SCALE_VERSION_PRESETS.find(
                    (item) => item.geometry.modelId === modelId,
                  );
                  if (preset)
                    setDesign((current) =>
                      applyScaleVersionPreset(current, preset.id),
                    );
                }}
              >
                <option value="archival">Archived wooden sculpture</option>
                <option value="maquette">
                  Actual printable 180 mm maquette
                </option>
              </select>
            </label>
            <p className="scales-help">
              Switching sources loads a tested starting size, scale pattern, and
              layer stack for that model. Your lettering and notes stay.
            </p>
            <div className="scales-size-inputs">
              <label className="scales-field" htmlFor="scales-height">
                Target model height
                <input
                  id="scales-height"
                  type="number"
                  min={
                    sourceHeightInches * 0.02 * (sizeUnit === "mm" ? 25.4 : 1)
                  }
                  max={sourceHeightInches * 30 * (sizeUnit === "mm" ? 25.4 : 1)}
                  step={sizeStep}
                  aria-invalid={Boolean(heightError)}
                  aria-describedby={
                    heightError ? "scales-height-error" : "scales-height-help"
                  }
                  value={heightInput}
                  onChange={(event) => {
                    setHeightInput(event.target.value);
                    setHeightError("");
                  }}
                  onBlur={applyHeight}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      applyHeight();
                    }
                  }}
                />
              </label>
              <label className="scales-field" htmlFor="scales-size-unit">
                Units
                <select
                  id="scales-size-unit"
                  value={sizeUnit}
                  onChange={(event) => {
                    setHeightError("");
                    setSizeUnit(event.target.value === "mm" ? "mm" : "in");
                  }}
                >
                  <option value="in">inches</option>
                  <option value="mm">mm</option>
                </select>
              </label>
            </div>
            {heightError && (
              <p className="scales-error" id="scales-height-error" role="alert">
                {heightError}
              </p>
            )}
            <fieldset
              className="scales-height-steps"
              aria-label="Fine height adjustment"
            >
              <button
                type="button"
                aria-label={`Decrease height by ${sizeStep} ${sizeUnit}`}
                onClick={() => stepHeight(-1)}
              >
                − {sizeStep} {sizeUnit}
              </button>
              <button
                type="button"
                aria-label={`Increase height by ${sizeStep} ${sizeUnit}`}
                onClick={() => stepHeight(1)}
              >
                + {sizeStep} {sizeUnit}
              </button>
            </fieldset>
            <p id="scales-height-help" className="scales-help">
              Enter an exact height and press Enter, or use the fine
              adjustments.
            </p>
            <RangeField
              label="Overall size"
              value={Math.log2(design.geometry.modelScale)}
              min={Math.log2(0.02)}
              max={Math.log2(30)}
              step={0.002}
              display={`${sizeValue(targetHeightInches)} ${sizeUnit} high · ${(design.geometry.modelScale * 100).toFixed(1)}%`}
              onChange={(value) =>
                setDesign((current) => resizeScaleDesign(current, 2 ** value))
              }
            />
            <ScaleBodyControls
              settings={design.geometry}
              onChange={updateGeometry}
            />
            <dl
              className="scales-size-dimensions"
              aria-label="Historical source dimensions at overall size, including base or plinth"
            >
              <div>
                <dt>Width</dt>
                <dd>
                  {sizeValue(targetDimensions.width)} <small>{sizeUnit}</small>
                </dd>
              </div>
              <div>
                <dt>Height</dt>
                <dd>
                  {sizeValue(targetDimensions.height)} <small>{sizeUnit}</small>
                </dd>
              </div>
              <div>
                <dt>Depth</dt>
                <dd>
                  {sizeValue(targetDimensions.depth)} <small>{sizeUnit}</small>
                </dd>
              </div>
            </dl>
            <p className="scales-help">
              Historical source dimensions at the selected overall size,
              including its{" "}
              {design.geometry.modelId === "archival" ? "base" : "plinth"},
              before body-girth adjustments, added layers, and raised plates.
              Compare the body and clad body measurements below the viewer.
            </p>
            {committedBounds?.scales && (
              <p className="scales-help" data-testid="scales-clad-size">
                <strong>
                  {renderedPreview?.study.modelId === "archival"
                    ? "Body + jaw plates, excluding base"
                    : "Generated print cladding"}
                  :
                </strong>{" "}
                {sizeValue(committedBounds.scales.width)} W ×{" "}
                {sizeValue(committedBounds.scales.height)} H ×{" "}
                {sizeValue(committedBounds.scales.depth)} D {sizeUnit}.
                {updating || previewBlocked
                  ? " Previous completed preview; updating."
                  : ""}
              </p>
            )}
            <div className="scales-size-fit">
              <button
                type="button"
                disabled={
                  fitting ||
                  !typography ||
                  !design.text.trim() ||
                  !design.showLettering
                }
                onClick={() => void fitSize()}
              >
                {fitting ? "Finding a size…" : "Enlarge until the words fit"}
              </button>
              {fitting && (
                <button
                  type="button"
                  onClick={() => {
                    fitRequest.current?.abort();
                    fitRequest.current = null;
                    setFitting(false);
                    setFitState("cancelled");
                    setFitStatus(
                      "Size search cancelled. Your size is unchanged.",
                    );
                  }}
                >
                  Cancel search
                </button>
              )}
              {fitStatus && (
                <p className="scales-help" role="status">
                  {fitStatus}
                </p>
              )}
              <p className="scales-help">
                Tests larger forms with your current lettering and density
                settings. Applies a tested fit only; your type size stays
                unchanged.
              </p>
            </div>
            <details
              className="scales-size-notes"
              open={presentation === "studio"}
            >
              <summary>Source & construction notes</summary>
              <p className="scales-help">
                {design.geometry.modelId === "maquette"
                  ? "This source is the actual printable maquette and its connected surface charts."
                  : "This source is the archived 206.3-inch model, including its base."}{" "}
                Target height scales the source before added layers. Metal,
                backing, adhesive, relief, and lettering keep their real sizes;
                review those allowances before making a small model.
              </p>
              <label className="scales-field" htmlFor="scales-build-method">
                Build method
                <select
                  id="scales-build-method"
                  value={design.buildMethod}
                  onChange={(event) =>
                    updateDesign({
                      buildMethod:
                        event.target.value === "printed"
                          ? "printed"
                          : event.target.value === "hybrid"
                            ? "hybrid"
                            : "wood",
                    })
                  }
                >
                  <option value="wood">Wood construction</option>
                  <option value="printed">3D-printed construction</option>
                  <option value="hybrid">Wood + printed parts</option>
                </select>
              </label>
              <p className="scales-help">
                {design.buildMethod === "wood"
                  ? "Record the wood blocks, slats, and support that extend beyond the chosen model."
                  : design.buildMethod === "printed"
                    ? "Record printed wall thickness, supports, joining clearances, and the printer/material settings you intend to test."
                    : "Record which parts are wood or printed and how their joining surfaces, fasteners, and spacers meet."}{" "}
                The build method is a planning note; it does not generate
                structural joints or certify fit.
              </p>
              <label className="scales-field" htmlFor="scales-build-notes">
                Materials, tools & joining notes
                <textarea
                  id="scales-build-notes"
                  rows={4}
                  maxLength={4000}
                  value={design.notes}
                  placeholder="Wood / filament, actual stock thickness, nib or marking tool, spacers, fasteners, adhesive, clearance tests…"
                  onChange={(event) =>
                    updateDesign({ notes: event.target.value })
                  }
                />
              </label>
            </details>
          </section>

          <ScaleShapeControls
            settings={design.geometry}
            unit={sizeUnit}
            onChange={updateGeometry}
          />
          <ScaleReferenceComparison
            study={renderedPreview?.study ?? null}
            pending={updating || previewBlocked}
          />

          <details
            className="scales-disclosure scales-lettering-disclosure"
            open={presentation === "studio"}
          >
            <summary>Words & handwriting</summary>
            <section
              className="scales-control-card scales-lettering-card"
              aria-labelledby="scales-lettering-title"
            >
              <div className="scales-section-heading">
                <span>YOUR HAND, YOUR WORDS</span>
                <h2 id="scales-lettering-title">Letter the surface</h2>
              </div>
              <label className="scales-field" htmlFor="scales-font">
                Calligraphy font
                <select
                  id="scales-font"
                  value={
                    facePreference === "font" ? design.fontId : facePreference
                  }
                  onChange={(event) => {
                    cancelFontUpload();
                    const next = event.target.value;
                    if (
                      next === "auto" ||
                      calligraphy.faces.some((face) => face.id === next)
                    ) {
                      updateDesign({ calligraphyFaceId: next });
                      return;
                    }
                    if (
                      isWorksheetBundledFontId(next) ||
                      next === "serif" ||
                      next === "sans" ||
                      next === "mono" ||
                      next === "custom"
                    )
                      updateDesign({ fontId: next, calligraphyFaceId: "font" });
                  }}
                >
                  <option value="auto">
                    Prefer original calligraphy · automatic
                  </option>
                  {matchingFaces.map((face) => (
                    <option key={face.id} value={face.id}>
                      {face.calligrapher} · {face.name} · scanned ink
                    </option>
                  ))}
                  {missingFace && (
                    <option value={facePreference}>
                      Saved scan · unavailable for this text
                    </option>
                  )}
                  <option value="serif">Classic serif</option>
                  <option value="sans">Clean sans serif</option>
                  <option value="mono">Monospaced</option>
                  {design.customFont && (
                    <option value="custom">
                      Uploaded · {design.customFont.name}
                    </option>
                  )}
                  {WORKSHEET_FONT_CATALOG.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </label>
              {selectedFace ? (
                <p className="scales-help">
                  Original ink by {selectedFace.calligrapher}. Each source
                  occurrence keeps its own strokes and proportions; placement
                  recalculates with the model.
                </p>
              ) : (
                <div
                  className="scales-font-sample"
                  style={{
                    fontFamily,
                    color: design.inkColor,
                  }}
                  aria-hidden="true"
                >
                  The shape of a line
                </div>
              )}
              {calligraphy.error && (
                <p className="scales-error" role="alert">
                  {calligraphy.error}
                </p>
              )}
              {facePreference === "auto" &&
                calligraphy.ready &&
                !selectedFace && (
                  <p className="scales-help">
                    No saved scan matches this exact wording yet. Using the
                    selected font until matching calligraphy is imported.
                  </p>
                )}
              {fontLoading && (
                <p className="scales-help" role="status">
                  Loading the selected font and exact shaping metrics…
                </p>
              )}
              {fontError && (
                <p className="scales-error" role="alert">
                  {fontError} Lettering fit is paused until the selected font is
                  available.{" "}
                  <button
                    type="button"
                    onClick={() => setFontRetry((value) => value + 1)}
                  >
                    Retry font
                  </button>
                  {design.showLettering && /\S/u.test(design.text) && (
                    <button
                      type="button"
                      onClick={() => updateDesign({ showLettering: false })}
                    >
                      View shape without lettering
                    </button>
                  )}
                </p>
              )}
              <div className="scales-font-upload">
                <button
                  type="button"
                  disabled={fontUploading}
                  onClick={() => fontInputRef.current?.click()}
                >
                  <Upload size={14} aria-hidden="true" />
                  {fontUploading ? "Checking font…" : "Upload a TTF or OTF"}
                </button>
                <input
                  ref={fontInputRef}
                  className="scales-file-input"
                  type="file"
                  accept=".ttf,.otf,font/ttf,font/otf"
                  aria-label="Upload custom font"
                  onChange={(event) => {
                    void uploadFont(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
                <p className="scales-help">
                  Up to 2 MB. Your font stays in this browser and in exported
                  study files. Use a font you have permission to use.
                </p>
              </div>
              {fontUploadError && (
                <p className="scales-error" role="alert">
                  {fontUploadError}
                </p>
              )}
              <label className="scales-field" htmlFor="scales-shaping">
                Text shaping
                <select
                  id="scales-shaping"
                  value={design.shapingEngine}
                  disabled={Boolean(selectedFace)}
                  onChange={(event) =>
                    updateDesign({
                      shapingEngine:
                        event.target.value === "harfbuzz"
                          ? "harfbuzz"
                          : "fontkit",
                    })
                  }
                >
                  <option value="fontkit">
                    Fontkit · standard and uploaded fonts
                  </option>
                  <option value="harfbuzz">
                    HarfBuzz · embedded script and uploaded fonts
                  </option>
                </select>
              </label>
              <label className="scales-field" htmlFor="scales-features">
                OpenType features
                <input
                  id="scales-features"
                  type="text"
                  maxLength={256}
                  value={fontFeaturesInput}
                  disabled={Boolean(selectedFace)}
                  placeholder="liga, kern, calt"
                  onChange={(event) => setFontFeaturesInput(event.target.value)}
                  onBlur={applyFontFeatures}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") applyFontFeatures();
                  }}
                  aria-invalid={Boolean(fontFeaturesError)}
                  aria-describedby={
                    fontFeaturesError ? "scales-features-error" : undefined
                  }
                />
              </label>
              {fontFeaturesError && (
                <p
                  id="scales-features-error"
                  className="scales-error"
                  role="alert"
                >
                  {fontFeaturesError} The last applied feature settings remain
                  active.
                </p>
              )}
              <p className="scales-help">
                Press Enter or leave the field to apply.{" "}
                {typography?.supportedFeatures.length
                  ? `Available in this font: ${typography.supportedFeatures.join(", ")}`
                  : "Feature support depends on the font. Leave empty for its defaults."}
              </p>
              <PoemVersionControls
                text={design.text}
                onLoad={(text, poem) =>
                  updateDesign({
                    text,
                    calligraphyFaceId: poem.calligraphyScanId ?? "auto",
                  })
                }
                onScanImported={(scan) =>
                  updateDesign({ text: scan.text, calligraphyFaceId: scan.id })
                }
              />
              <div className="scales-field">
                <span>Words to place</span>
                <Suspense
                  fallback={<p role="status">Opening the poem editor…</p>}
                >
                  <ScalePoemEditor
                    value={design.text}
                    onChange={(text) => updateDesign({ text })}
                  />
                </Suspense>
              </div>
              <p id="scales-text-help" className="scales-help">
                Complete words flow in row order around the body, then the jaw.
                Line breaks are reflowed to each face.{" "}
                {design.text.length.toLocaleString()} / 20,000 characters.
              </p>
              <div className="scales-color-row">
                <label htmlFor="scales-ink">
                  <input
                    id="scales-ink"
                    type="color"
                    value={design.inkColor}
                    onChange={(event) =>
                      updateDesign({ inkColor: event.target.value })
                    }
                  />
                  <span>Ink color</span>
                </label>
                <label htmlFor="scales-metal">
                  <input
                    id="scales-metal"
                    type="color"
                    value={design.plateColor}
                    onChange={(event) =>
                      updateDesign({ plateColor: event.target.value })
                    }
                  />
                  <span>Plate color</span>
                </label>
              </div>
              <label
                className="scales-field"
                htmlFor="scales-lettering-quality"
              >
                3D lettering detail
                <select
                  id="scales-lettering-quality"
                  value={design.letteringQuality ?? "crisp"}
                  onChange={(event) =>
                    updateDesign({
                      letteringQuality:
                        event.target.value === "balanced"
                          ? "balanced"
                          : "crisp",
                    })
                  }
                >
                  <option value="crisp">
                    Crisp · more detail where lettering appears
                  </option>
                  <option value="balanced">
                    Balanced · lower texture detail
                  </option>
                </select>
              </label>
              <p className="scales-help">
                Both settings preserve the original strokes. Inspect individual
                faces in the proof for closer detail.
              </p>
              <label className="scales-check">
                <input
                  type="checkbox"
                  checked={design.showLettering}
                  onChange={(event) =>
                    updateDesign({ showLettering: event.target.checked })
                  }
                />
                Show lettering on the plates
              </label>
              <RangeField
                label="Requested type size"
                value={design.fontSizeMm}
                min={2}
                max={80}
                step={0.5}
                display={`${design.fontSizeMm.toFixed(1)} mm`}
                onChange={(fontSizeMm) => updateDesign({ fontSizeMm })}
              />
              <RangeField
                label="Extra edge margin"
                value={design.marginMm}
                min={0}
                max={20}
                step={0.25}
                display={`${design.marginMm.toFixed(2)} mm`}
                onChange={(marginMm) => updateDesign({ marginMm })}
              />
              <label className="scales-check">
                <input
                  type="checkbox"
                  checked={design.autoFit}
                  onChange={(event) =>
                    updateDesign({ autoFit: event.target.checked })
                  }
                />
                Auto-fit the full text
              </label>
              {design.autoFit && (
                <RangeField
                  label="Smallest permitted type"
                  value={design.minFontSizeMm}
                  min={2}
                  max={design.fontSizeMm}
                  step={0.5}
                  display={`${design.minFontSizeMm.toFixed(1)} mm`}
                  onChange={(minFontSizeMm) => updateDesign({ minFontSizeMm })}
                />
              )}
              <p className="scales-help">
                Auto-fit puts about one word on each plate, as large as that
                plate allows, so writing spreads around the sculpture. Empty
                leftover plates repeat that wording in reverse, flipped, and
                wrap again if plates are still empty. A plate whose unused width
                is more than twice its ink also draws the same word again,
                flipped. It will not go below your minimum. Turn auto-fit off to
                keep an exact requested size on fewer faces. A script font
                previews the composition; hand lettering and swashes still need
                a practice test.
              </p>
            </section>
          </details>

          <details
            className="scales-disclosure scales-shape-disclosure"
            open={presentation === "studio"}
          >
            <summary>Scale pattern & density</summary>
            <section
              className="scales-control-card scales-shape-card"
              aria-labelledby="scales-shape-title"
            >
              <div className="scales-section-heading">
                <span>SHAPE &amp; RHYTHM</span>
                <h2 id="scales-shape-title">Build the scales</h2>
              </div>
              <label className="scales-field" htmlFor="scales-surface-mode">
                How plates follow the form
                <select
                  id="scales-surface-mode"
                  value={design.geometry.surfaceMode}
                  onChange={(event) =>
                    updateGeometry({
                      surfaceMode:
                        event.target.value === "planar"
                          ? "planar"
                          : "conforming",
                    })
                  }
                >
                  <option value="conforming">
                    Curved · follow the body and girth
                  </option>
                  <option
                    value="planar"
                    disabled={design.geometry.modelId === "maquette"}
                  >
                    Flat facets · archival comparison
                  </option>
                </select>
              </label>
              <label className="scales-field" htmlFor="scales-density-mode">
                When the sculpture changes size
                <select
                  id="scales-density-mode"
                  value={design.densityMode ?? "fixed"}
                  onChange={(event) =>
                    setDesign((current) =>
                      setScaleDensityMode(
                        current,
                        event.target.value === "adaptive"
                          ? "adaptive"
                          : "fixed",
                      ),
                    )
                  }
                >
                  <option value="fixed">Keep the same scale pattern</option>
                  <option value="adaptive">
                    Adapt the number of scales to the size
                  </option>
                </select>
              </label>
              <p className="scales-help">
                Adaptive density uses this shape as a reference: larger forms
                gain scales and smaller forms lose them to keep their size
                similar. Moving a density slider sets a new reference. Real
                stock thickness and lettering sizes remain under your control.
              </p>
              {densityStatus.limited && (
                <p className="scales-quality-note" role="status">
                  Adaptive density reached the preview limit. This size
                  requested {densityStatus.requestedColumns} ×{" "}
                  {densityStatus.requestedRows} cells; the bounded pattern below
                  keeps the preview manageable.
                </p>
              )}
              <RangeField
                label={
                  design.geometry.plateFit === "cover"
                    ? "Plate budget · lengthwise target"
                    : design.geometry.modelId === "maquette"
                      ? "Target lengthwise density"
                      : "Plates around the body loop"
                }
                value={design.geometry.columns}
                min={4}
                max={240}
                onChange={(columns) =>
                  setDesign((current) =>
                    updateScaleDensity(current, { columns }),
                  )
                }
              />
              <RangeField
                label={
                  design.geometry.plateFit === "cover"
                    ? "Plate budget · crosswise target"
                    : design.geometry.modelId === "maquette"
                      ? "Target crosswise density"
                      : "Rows across each surface"
                }
                value={design.geometry.rows}
                min={2}
                max={Math.min(12, Math.floor(600 / design.geometry.columns))}
                onChange={(rows) =>
                  setDesign((current) => updateScaleDensity(current, { rows }))
                }
              />
              {design.geometry.plateFit === "cover" && (
                <p className="scales-help">
                  Covering layout balances these targets into closely fitted
                  courses. The {design.geometry.columns} ×{" "}
                  {design.geometry.rows} budget guides the layout; curved
                  regions and separate surfaces can change the actual count.
                  {study
                    ? ` Completed preview: ${study.plates.length} plates.`
                    : ""}
                </p>
              )}
              <RangeField
                label="Space between plates"
                value={design.geometry.gap}
                min={0}
                max={0.3}
                step={0.01}
                display={`${Math.round(design.geometry.gap * 100)}% of a cell`}
                onChange={(gap) => updateGeometry({ gap })}
              />
              <RangeField
                label="Raised relief"
                value={design.geometry.relief * sizeFactor}
                min={0}
                max={6 * sizeFactor}
                step={sizeUnit === "mm" ? 0.1 : 0.005}
                display={`${design.geometry.relief.toFixed(2)} in / ${(design.geometry.relief * 25.4).toFixed(1)} mm`}
                onChange={(relief) =>
                  updateGeometry({ relief: relief / sizeFactor })
                }
              />
              <RangeField
                label="Irregularity"
                value={design.geometry.variation}
                min={0}
                max={1}
                step={0.05}
                display={`${Math.round(design.geometry.variation * 100)}%`}
                onChange={(variation) => updateGeometry({ variation })}
              />
              <div className="scales-seed-row">
                <label className="scales-field" htmlFor="scales-seed">
                  Pattern seed
                  <input
                    id="scales-seed"
                    type="number"
                    min={0}
                    max={0xffff_ffff}
                    step={1}
                    value={design.geometry.seed}
                    onChange={(event) =>
                      updateGeometry({ seed: event.target.valueAsNumber })
                    }
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const values = new Uint32Array(1);
                    crypto.getRandomValues(values);
                    updateGeometry({ seed: values[0] ?? 1 });
                  }}
                >
                  <Shuffle size={15} aria-hidden="true" /> New pattern
                </button>
              </div>
              <p className="scales-help">
                The seed makes the same irregular pattern repeatable.{" "}
                {design.geometry.modelId === "maquette"
                  ? "Print-mesh charts and sharp creases add seams; density is a target, not a fixed piece count. Its plates always conform to that mesh."
                  : "The jaw uses a proportional number of plates for its shorter loop."}{" "}
                Geometry and layer changes rebuild the faces in the background
                and map the words again.
              </p>
            </section>
          </details>

          <details
            className="scales-disclosure scales-save-disclosure"
            open={presentation === "studio"}
          >
            <summary>Save & restore study</summary>
            <section
              className="scales-control-card scales-save-card"
              aria-labelledby="scales-save-title"
            >
              <div className="scales-section-heading">
                <span>KEEP THE STUDY</span>
                <h2 id="scales-save-title">Return to this idea</h2>
              </div>
              <p
                className={saveFailed ? "scales-error" : "scales-save-status"}
                role="status"
              >
                {saveStatus}
              </p>
              <p className="scales-help">
                This draft belongs to this browser. Download a study file to
                move it to another device or keep a durable backup.
              </p>
              <div className="scales-save-actions">
                <button
                  type="button"
                  disabled={exportWaiting}
                  title={
                    exportWaiting
                      ? "Wait for the handwriting library before exporting a complete study."
                      : undefined
                  }
                  onClick={() => {
                    setImportError("");
                    void downloadDesign(design, selectedFace?.id).catch(
                      (error: unknown) =>
                        setImportError(
                          error instanceof Error
                            ? error.message
                            : "This study could not be exported.",
                        ),
                    );
                  }}
                >
                  <Download size={16} aria-hidden="true" /> Save study
                </button>
                <button
                  type="button"
                  onClick={() => importRef.current?.click()}
                >
                  <Upload size={16} aria-hidden="true" /> Load study
                </button>
                <input
                  ref={importRef}
                  type="file"
                  accept=".json,application/json"
                  aria-label="Load scale study JSON"
                  className="scales-file-input"
                  onChange={(event) => {
                    void importDesign(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </div>
              {importError && (
                <p className="scales-error" role="alert">
                  {importError}
                </p>
              )}
              <p className="scales-help">
                JSON includes the source model, size, layer assumptions, build
                notes, text, font, colors, and fit settings. Uploaded fonts are
                embedded. Your reference photographs are available separately in
                the <Link to="/references">reference library</Link>.
              </p>
            </section>
          </details>
        </aside>
      </div>
    </div>
  );
}
