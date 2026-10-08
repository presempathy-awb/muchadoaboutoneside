import { ScanText } from "lucide-react";
import { type PointerEvent, useEffect, useRef, useState } from "react";
import {
  parseWorksheetVisionMeasurements,
  type WorksheetVisionMeasurements,
} from "../../../shared/worksheet-vision";
import type { CalligraphyHelpContext } from "../../lib/calligraphy-help";
import {
  approximateFontSizePt,
  calibrationMmPerPixel,
  clampFinite,
  measurementMm,
  normalizeWorksheetImage,
  type PhotoPoint,
  pointDistance,
} from "../../lib/worksheet-photo";
import type { WorksheetPhoto } from "../../lib/worksheet-store";
import { WorksheetFontCreator } from "./worksheet-font-creator";
import { WorksheetGlyphJobs } from "./worksheet-glyph-jobs";

export type WorksheetPhotoSection = "reference" | "sizing" | "font";

export interface WorksheetPhotoPanelProps {
  photo: WorksheetPhoto | undefined;
  onChange: (photo: WorksheetPhoto | undefined) => void;
  onApplyMeasurements: (values: {
    xHeightMm?: number;
    fontSizePt?: number;
    writingScale?: number;
  }) => void;
  onApplySuggestion: (values: WorksheetVisionMeasurements) => Promise<boolean>;
  cockpit?: boolean;
  section?: WorksheetPhotoSection;
  initialSection?: WorksheetPhotoSection;
  onSectionChange?: (section: WorksheetPhotoSection) => void;
  onImportFont?: (file?: File) => void;
  onHelp?: (context: CalligraphyHelpContext) => void;
}

type ToolMode = "known-length" | "x-height";

function parsedNumber(value: string) {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) ? parsed : undefined;
}

export function WorksheetPhotoPanel({
  photo,
  onChange,
  onApplyMeasurements,
  onApplySuggestion,
  cockpit = false,
  section,
  initialSection = "reference",
  onSectionChange,
  onImportFont,
  onHelp,
}: WorksheetPhotoPanelProps) {
  const [localSection, setLocalSection] = useState<WorksheetPhotoSection>(
    section ?? initialSection,
  );
  const activeSection = section ?? localSection;
  const panel = useRef<HTMLElement>(null);
  const focusSection = useRef<WorksheetPhotoSection | undefined>(undefined);
  useEffect(() => {
    if (focusSection.current !== activeSection) return;
    focusSection.current = undefined;
    panel.current
      ?.querySelector<HTMLButtonElement>(
        `.ws-photo__sections button[data-section="${activeSection}"]`,
      )
      ?.focus();
  }, [activeSection]);
  const [mode, setMode] = useState<ToolMode>("known-length");
  const [points, setPoints] = useState<PhotoPoint[]>([]);
  const [knownLength, setKnownLength] = useState("100");
  const [mmPerPixel, setMmPerPixel] = useState<number>();
  const [measuredXHeight, setMeasuredXHeight] = useState<number>();
  const [writingScale, setWritingScale] = useState("");
  const [error, setError] = useState("");
  const [isPreparing, setIsPreparing] = useState(false);
  const importSequence = useRef(0);
  const analysisController = useRef<AbortController | undefined>(undefined);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [capabilityError, setCapabilityError] = useState(false);
  const analyzeButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const applyButton = useRef<HTMLButtonElement>(null);
  const returnToAnalyze = useRef(false);
  const returnToApply = useRef(false);
  const [aiModels, setAiModels] = useState<string[]>([]);
  const [aiModel, setAiModel] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [suggestion, setSuggestion] = useState<WorksheetVisionMeasurements>();
  useEffect(() => {
    if (isAnalyzing) cancelButton.current?.focus();
  }, [isAnalyzing]);
  useEffect(() => {
    if (returnToApply.current && !isApplying && suggestion) {
      returnToApply.current = false;
      applyButton.current?.focus();
    }
    if (returnToAnalyze.current && !isApplying && !isAnalyzing && !suggestion) {
      returnToAnalyze.current = false;
      analyzeButton.current?.focus();
    }
  }, [isApplying, isAnalyzing, suggestion]);

  useEffect(() => {
    let active = true;
    fetch("/api/worksheet/vision")
      .then(async (response) => {
        if (!response.ok) throw new Error("capability_unavailable");
        const capability = await response.json();
        if (!active) return;
        const models = Array.isArray(capability?.models)
          ? capability.models.filter(
              (model: unknown): model is string => typeof model === "string",
            )
          : [];
        setAiModels(models);
        setAiModel(models[0] ?? "");
        setAiAvailable(capability?.available === true && models.length > 0);
      })
      .catch(() => {
        if (active) setCapabilityError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: A loaded template can replace the image without remounting this panel.
  useEffect(() => {
    setPoints([]);
    setMmPerPixel(undefined);
    setMeasuredXHeight(undefined);
    setSuggestion(undefined);
    analysisController.current?.abort();
    setIsAnalyzing(false);
  }, [photo?.dataUrl]);

  useEffect(
    () => () => {
      importSequence.current += 1;
      analysisController.current?.abort();
    },
    [],
  );

  function updatePhoto(values: Partial<WorksheetPhoto>) {
    if (photo) onChange({ ...photo, ...values });
  }

  async function importImage(file: File | undefined) {
    if (!file) return;
    const request = importSequence.current + 1;
    importSequence.current = request;
    setIsPreparing(true);
    setError("");
    try {
      const image = await normalizeWorksheetImage(file);
      if (request !== importSequence.current) return;
      onChange({
        ...image,
        widthMm: 150,
        xMm: 15,
        yMm: 15,
        opacity: 0.25,
        rotation: 0,
        print: false,
      });
    } catch (cause) {
      if (request !== importSequence.current) return;
      setError(
        cause instanceof Error
          ? cause.message
          : "The image could not be prepared.",
      );
    } finally {
      if (request === importSequence.current) setIsPreparing(false);
    }
  }

  function selectPoint(event: PointerEvent<SVGSVGElement>) {
    if (!photo) return;
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return;
    const selected = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse(),
    );
    const point = {
      x: clampFinite(selected.x, 0, photo.pixelWidth),
      y: clampFinite(selected.y, 0, photo.pixelHeight),
    };
    setPoints((previous) =>
      previous.length >= 2 ? [point] : [...previous, point],
    );
    setMeasuredXHeight(undefined);
    setError("");
  }

  function useSelectedMeasurement() {
    const first = points[0];
    const second = points[1];
    if (!photo || !first || !second) {
      setError("Select two points on the photo first.");
      return;
    }

    if (mode === "known-length") {
      const lengthMm = parsedNumber(knownLength);
      const calibration =
        lengthMm === undefined || lengthMm < 1 || lengthMm > 1000
          ? undefined
          : calibrationMmPerPixel(first, second, lengthMm);
      if (!calibration) {
        setError(
          "Enter a positive known length and select two different points.",
        );
        return;
      }
      const calibratedWidthMm = photo.pixelWidth * calibration;
      if (calibratedWidthMm < 0.1 || calibratedWidthMm > 5000) {
        setError(
          "That calibration would make the photo an unsupported physical size. Check the endpoints and known distance.",
        );
        return;
      }
      setMmPerPixel(calibration);
      setSuggestion(undefined);
      analysisController.current?.abort();
      setMeasuredXHeight(undefined);
      updatePhoto({ widthMm: calibratedWidthMm });
      setPoints([]);
      setMode("x-height");
      setError("");
      return;
    }

    if (!mmPerPixel) {
      setError("Calibrate a known length before measuring x-height.");
      return;
    }
    const xHeight = measurementMm(first, second, mmPerPixel);
    if (!xHeight) {
      setError("Select two different points across the letter x-height.");
      return;
    }
    setMeasuredXHeight(xHeight);
    setError("");
  }

  function applyMeasurements() {
    const factor = parsedNumber(writingScale);
    const values: {
      xHeightMm?: number;
      fontSizePt?: number;
      writingScale?: number;
    } = {};
    if (
      writingScale.trim() &&
      (factor === undefined || factor < 0.25 || factor > 4)
    ) {
      setError(
        "Enter a handwriting size factor from 0.25 to 4, or leave it blank.",
      );
      return;
    }
    if (measuredXHeight) {
      values.xHeightMm = measuredXHeight;
      values.fontSizePt = approximateFontSizePt(measuredXHeight);
    }
    if (factor && factor >= 0.25 && factor <= 4) values.writingScale = factor;
    if (Object.keys(values).length === 0) {
      setError("Measure an x-height or enter a handwriting size factor first.");
      return;
    }
    onApplyMeasurements(values);
    setError("");
  }

  async function analyzePhoto() {
    if (!photo || !mmPerPixel) return;
    analysisController.current?.abort();
    const controller = new AbortController();
    analysisController.current = controller;
    setIsAnalyzing(true);
    setError("");
    setSuggestion(undefined);
    try {
      const parts = photo.dataUrl.split(",");
      const mime = photo.dataUrl.startsWith("data:image/png;")
        ? "image/png"
        : "image/jpeg";
      const image = await normalizeWorksheetImage(
        new File(
          [Uint8Array.from(atob(parts[1] ?? ""), (c) => c.charCodeAt(0))],
          "sizing-image",
          { type: mime },
        ),
        960,
      );
      if (controller.signal.aborted) return;
      const response = await fetch("/api/worksheet/vision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(190_000),
        ]),
        body: JSON.stringify({
          dataUrl: image.dataUrl,
          pixelWidth: image.pixelWidth,
          pixelHeight: image.pixelHeight,
          mmPerPixel: (mmPerPixel * photo.pixelWidth) / image.pixelWidth,
          model: aiModel,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Photo analysis is unavailable.",
        );
      if (!controller.signal.aborted)
        setSuggestion(parseWorksheetVisionMeasurements(result));
    } catch (cause) {
      if (!controller.signal.aborted) returnToAnalyze.current = true;
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "The photo could not be analyzed.",
        );
    } finally {
      if (analysisController.current === controller) setIsAnalyzing(false);
    }
  }

  async function applySuggestion() {
    if (!suggestion) return;
    returnToApply.current = true;
    setIsApplying(true);
    try {
      if (await onApplySuggestion(suggestion)) {
        returnToApply.current = false;
        setSuggestion(undefined);
        returnToAnalyze.current = true;
      } else setError("Sizing was not applied. Check the draft and try again.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Sizing could not be applied. Keep your current draft and try again.",
      );
    } finally {
      setIsApplying(false);
    }
  }

  const selectedPixels =
    points[0] && points[1] ? pointDistance(points[0], points[1]) : undefined;

  function selectSection(next: WorksheetPhotoSection): void {
    focusSection.current = next;
    if (section === undefined) setLocalSection(next);
    onSectionChange?.(next);
  }

  const photoUpload = (
    <>
      <label className="ws-photo__file-label" htmlFor="ws-photo-file">
        {isPreparing
          ? "Preparing image…"
          : photo
            ? "Replace photo"
            : "Import photo"}
      </label>
      <input
        className="ws-photo__file"
        id="ws-photo-file"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={isPreparing}
        onChange={(event) => {
          void importImage(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
        aria-describedby="ws-photo-file-help"
      />
      <small id="ws-photo-file-help">
        PNG, JPEG, or WebP, up to 15 MB. Stored locally at no more than 1,800 px
        and 2 MB.
      </small>
    </>
  );

  return (
    <section ref={panel} className="ws-photo" aria-labelledby="ws-photo-title">
      <div className="ws-photo__heading">
        <h3 id="ws-photo-title">Photo reference</h3>
        <p>
          Import a photo to size a handwritten sample. Re-encoding strips camera
          metadata. It stays in this browser unless you send it for photo sizing
          or include it in letter rounds below.
        </p>
      </div>

      {(!cockpit || activeSection !== "font") && photoUpload}

      {cockpit && (
        <nav
          className="ck-subnav ws-photo__sections"
          aria-label="Photo workspace"
        >
          <button
            type="button"
            data-section="reference"
            aria-pressed={activeSection === "reference"}
            onClick={() => selectSection("reference")}
          >
            Reference
          </button>
          <button
            type="button"
            data-section="sizing"
            aria-pressed={activeSection === "sizing"}
            onClick={() => selectSection("sizing")}
          >
            Sizing
          </button>
          <button
            className="ws-primary"
            type="button"
            data-section="font"
            aria-pressed={activeSection === "font"}
            onClick={() => selectSection("font")}
          >
            Create a font
          </button>
        </nav>
      )}

      {photo && (
        <>
          <figure
            className="ws-photo__figure"
            hidden={cockpit && activeSection === "font"}
          >
            <svg
              className="ws-photo__preview"
              viewBox={`0 0 ${photo.pixelWidth} ${photo.pixelHeight}`}
              role="img"
              aria-label="Imported handwriting reference; tap or click to place measurement endpoints"
              onPointerDown={selectPoint}
            >
              <image
                href={photo.dataUrl}
                width={photo.pixelWidth}
                height={photo.pixelHeight}
              />
              {points.length === 2 && (
                <line
                  className="ws-photo__measure-line"
                  x1={points[0]?.x}
                  y1={points[0]?.y}
                  x2={points[1]?.x}
                  y2={points[1]?.y}
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {points.map((point, index) => (
                <circle
                  className="ws-photo__measure-point"
                  key={`${point.x}-${point.y}`}
                  cx={point.x}
                  cy={point.y}
                  r={Math.max(photo.pixelWidth, photo.pixelHeight) / 90}
                  aria-label={`Measurement point ${index + 1}`}
                />
              ))}
            </svg>
            <figcaption>
              {points.length < 2
                ? `Select endpoint ${points.length + 1} of 2.`
                : `${selectedPixels?.toFixed(1)} px selected.`}
              {
                " Measurements use the unrotated image; rotation only changes the printed reference."
              }
            </figcaption>
          </figure>

          <div
            className="ws-photo__section"
            hidden={cockpit && activeSection !== "sizing"}
          >
            <fieldset className="ws-photo__tools">
              <legend>Measurement tool</legend>
              <label>
                <input
                  type="radio"
                  name="ws-photo-tool"
                  value="known-length"
                  checked={mode === "known-length"}
                  onChange={() => {
                    setMode("known-length");
                    setPoints([]);
                  }}
                />
                Known length
              </label>
              <label>
                <input
                  type="radio"
                  name="ws-photo-tool"
                  value="x-height"
                  checked={mode === "x-height"}
                  onChange={() => {
                    setMode("x-height");
                    setPoints([]);
                  }}
                />
                Letter x-height
              </label>

              {mode === "known-length" ? (
                <label htmlFor="ws-photo-known-length">
                  Known distance (mm)
                  <input
                    id="ws-photo-known-length"
                    type="number"
                    inputMode="decimal"
                    min="1"
                    max="1000"
                    step="0.1"
                    value={knownLength}
                    onChange={(event) => setKnownLength(event.target.value)}
                  />
                </label>
              ) : (
                <p className="ws-photo__tool-note">
                  {mmPerPixel
                    ? "Select from the baseline to the top of a representative lowercase letter."
                    : "First use Known length to calibrate the photo."}
                </p>
              )}
              <button type="button" onClick={useSelectedMeasurement}>
                {mode === "known-length"
                  ? "Calibrate photo"
                  : "Measure x-height"}
              </button>
              <button type="button" onClick={() => setPoints([])}>
                Clear points
              </button>
              {mmPerPixel && (
                <output className="ws-photo__result">
                  Calibrated: {(1 / mmPerPixel).toFixed(2)} px/mm
                </output>
              )}
              {measuredXHeight && (
                <output className="ws-photo__result">
                  Measured x-height: {measuredXHeight.toFixed(2)} mm ·
                  approximate type size{" "}
                  {approximateFontSizePt(measuredXHeight)?.toFixed(1)} pt
                </output>
              )}
            </fieldset>

            <section className="ws-photo-ai" aria-label="AI photo sizing">
              <h4>
                <ScanText size={21} aria-hidden="true" /> Let the photo suggest
                your sizing
              </h4>
              <p>
                First calibrate a known length. This action sends only the
                prepared image and its scale to the selected vision model. The
                app does not save the upload on the server. Suggestions are
                estimates; inspect them before applying.
              </p>
              {aiAvailable && (
                <label>
                  Photo sizing model
                  <select
                    value={aiModel}
                    disabled={isAnalyzing || isApplying}
                    onChange={(event) => {
                      setAiModel(event.target.value);
                      setSuggestion(undefined);
                    }}
                  >
                    {aiModels.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                ref={analyzeButton}
                type="button"
                disabled={
                  !aiAvailable || !mmPerPixel || isAnalyzing || isApplying
                }
                onClick={() => {
                  void analyzePhoto();
                }}
              >
                {isAnalyzing ? "Measuring letters and rows…" : "Analyze photo"}
              </button>
              <p className="ws-hint" role="status">
                {capabilityError
                  ? "The photo sizing service could not be checked. Reload to retry, or measure manually."
                  : !aiAvailable
                    ? "Photo AI is not enabled on this server. Manual measurements still work."
                    : !mmPerPixel
                      ? "Calibrate the known length above to enable analysis."
                      : isAnalyzing
                        ? "Analysis can take up to three minutes. You can cancel at any time."
                        : "Use a straight-on sample with clear lowercase letters and at least two text rows."}
              </p>
              {isAnalyzing && (
                <button
                  ref={cancelButton}
                  type="button"
                  onClick={() => {
                    analysisController.current?.abort();
                    setIsAnalyzing(false);
                    returnToAnalyze.current = true;
                  }}
                >
                  Cancel analysis
                </button>
              )}
              {suggestion && (
                <div className="ws-choice-effect" aria-live="polite">
                  <strong>
                    Review the suggested measurements · {suggestion.confidence}{" "}
                    confidence
                  </strong>
                  <dl>
                    <dt>Lowercase height</dt>
                    <dd>{suggestion.xHeightMm.toFixed(2)} mm</dd>
                    <dt>Baseline spacing</dt>
                    <dd>{suggestion.lineSpacingMm.toFixed(2)} mm</dd>
                    <dt>Typical letter width</dt>
                    <dd>{suggestion.letterWidthMm.toFixed(2)} mm</dd>
                  </dl>
                  <p>{suggestion.notes}</p>
                  <p>
                    Verify these estimates against your sample. Model confidence
                    does not guarantee accurate measurements. Apply sets plain
                    practice rows, physical letter height and width for the
                    selected font. Your words and paper stay in place.
                  </p>
                  <button
                    ref={applyButton}
                    type="button"
                    disabled={isApplying || suggestion.confidence === "low"}
                    onClick={() => {
                      void applySuggestion();
                    }}
                  >
                    {isApplying
                      ? "Matching the font…"
                      : "Apply sizing to plain practice rows"}
                  </button>
                  {suggestion.confidence === "low" && (
                    <p className="ws-hint">
                      Low-confidence measurements need a clearer crop or manual
                      measurement before applying.
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={isApplying}
                    onClick={() => {
                      returnToAnalyze.current = true;
                      setSuggestion(undefined);
                    }}
                  >
                    Keep current sizing
                  </button>
                </div>
              )}
            </section>
            <div className="ws-photo__apply">
              <label htmlFor="ws-photo-writing-scale">
                Handwriting size factor (optional)
                <input
                  id="ws-photo-writing-scale"
                  type="number"
                  inputMode="decimal"
                  min="0.25"
                  max="4"
                  step="0.05"
                  placeholder="1.00"
                  value={writingScale}
                  onChange={(event) => setWritingScale(event.target.value)}
                />
              </label>
              <small>
                Use 1 when the worksheet text and your sample look the same
                size; adjust by eye, or leave blank when uncertain.
              </small>
              <button type="button" onClick={applyMeasurements}>
                Apply measurements to worksheet
              </button>
            </div>

            <aside className="ws-photo__accuracy">
              <strong>For a useful measurement</strong>
              <p>
                Put a ruler in the same plane as the writing, keep the page
                flat, and photograph it straight on. Perspective and curled
                paper reduce accuracy. Resizing does not perform OCR or identify
                the writing font; the point-size result is only a typographic
                estimate from x-height.
              </p>
            </aside>
          </div>

          <div
            className="ws-photo__section"
            hidden={cockpit && activeSection !== "reference"}
          >
            <fieldset className="ws-photo__placement">
              <legend>Reference placement</legend>
              <label htmlFor="ws-photo-width">
                Printed width (mm)
                <input
                  id="ws-photo-width"
                  type="number"
                  min="0.1"
                  max="5000"
                  step="any"
                  value={Number(photo.widthMm.toFixed(2))}
                  onChange={(event) => {
                    const value = parsedNumber(event.target.value);
                    if (value !== undefined)
                      updatePhoto({ widthMm: clampFinite(value, 0.1, 5000) });
                  }}
                />
              </label>
              <label htmlFor="ws-photo-x">
                Left position (mm)
                <input
                  id="ws-photo-x"
                  type="number"
                  min="-5000"
                  max="5000"
                  step="any"
                  value={Number(photo.xMm.toFixed(2))}
                  onChange={(event) => {
                    const value = parsedNumber(event.target.value);
                    if (value !== undefined)
                      updatePhoto({ xMm: clampFinite(value, -5000, 5000) });
                  }}
                />
              </label>
              <label htmlFor="ws-photo-y">
                Top position (mm)
                <input
                  id="ws-photo-y"
                  type="number"
                  min="-5000"
                  max="5000"
                  step="any"
                  value={Number(photo.yMm.toFixed(2))}
                  onChange={(event) => {
                    const value = parsedNumber(event.target.value);
                    if (value !== undefined)
                      updatePhoto({ yMm: clampFinite(value, -5000, 5000) });
                  }}
                />
              </label>
              <label htmlFor="ws-photo-opacity">
                Reference opacity ({Math.round(photo.opacity * 100)}%)
                <input
                  id="ws-photo-opacity"
                  type="range"
                  min="5"
                  max="100"
                  step="1"
                  value={Math.round(photo.opacity * 100)}
                  onChange={(event) =>
                    updatePhoto({ opacity: Number(event.target.value) / 100 })
                  }
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={photo.print}
                  onChange={(event) =>
                    updatePhoto({ print: event.target.checked })
                  }
                />
                Include this reference in print and PDF
              </label>
              <button
                type="button"
                onClick={() =>
                  updatePhoto({
                    rotation: ((photo.rotation + 90) %
                      360) as WorksheetPhoto["rotation"],
                  })
                }
              >
                Rotate 90° (now {photo.rotation}°)
              </button>
            </fieldset>

            <button
              className="ws-photo__remove"
              type="button"
              onClick={() => {
                importSequence.current += 1;
                setIsPreparing(false);
                setError("");
                onChange(undefined);
              }}
            >
              Remove image
            </button>
          </div>
        </>
      )}

      {cockpit ? (
        <div className="ws-photo__section" hidden={activeSection !== "font"}>
          <WorksheetFontCreator
            onHelp={onHelp}
            hasPhoto={Boolean(photo)}
            isCalibrated={Boolean(mmPerPixel)}
            onOpenReference={() => selectSection("reference")}
            onOpenSizing={() => selectSection("sizing")}
            onImportFont={onImportFont}
            photoUpload={photoUpload}
            letterRounds={
              <WorksheetGlyphJobs
                photo={photo}
                mmPerPixel={mmPerPixel}
                onApplySuggestion={onApplySuggestion}
              />
            }
          />
        </div>
      ) : (
        <WorksheetGlyphJobs
          photo={photo}
          mmPerPixel={mmPerPixel}
          onApplySuggestion={onApplySuggestion}
        />
      )}
      {error && (
        <p className="ws-photo__error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
