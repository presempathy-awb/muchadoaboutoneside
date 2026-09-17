import { type PointerEvent, useEffect, useRef, useState } from "react";
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

interface WorksheetPhotoPanelProps {
  photo: WorksheetPhoto | undefined;
  onChange: (photo: WorksheetPhoto | undefined) => void;
  onApplyMeasurements: (values: {
    xHeightMm?: number;
    fontSizePt?: number;
    writingScale?: number;
  }) => void;
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
}: WorksheetPhotoPanelProps) {
  const [mode, setMode] = useState<ToolMode>("known-length");
  const [points, setPoints] = useState<PhotoPoint[]>([]);
  const [knownLength, setKnownLength] = useState("100");
  const [mmPerPixel, setMmPerPixel] = useState<number>();
  const [measuredXHeight, setMeasuredXHeight] = useState<number>();
  const [writingScale, setWritingScale] = useState("");
  const [error, setError] = useState("");
  const [isPreparing, setIsPreparing] = useState(false);
  const importSequence = useRef(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: A loaded template can replace the image without remounting this panel.
  useEffect(() => {
    setPoints([]);
    setMmPerPixel(undefined);
    setMeasuredXHeight(undefined);
  }, [photo?.dataUrl]);

  useEffect(
    () => () => {
      importSequence.current += 1;
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

  const selectedPixels =
    points[0] && points[1] ? pointDistance(points[0], points[1]) : undefined;

  return (
    <section className="ws-photo" aria-labelledby="ws-photo-title">
      <div className="ws-photo__heading">
        <h3 id="ws-photo-title">Photo reference</h3>
        <p>
          Import a local photo to size a handwritten sample. It stays in this
          browser; re-encoding strips camera metadata and nothing is uploaded.
        </p>
      </div>

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

      {photo && (
        <>
          <figure className="ws-photo__figure">
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
              {mode === "known-length" ? "Calibrate photo" : "Measure x-height"}
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
                Measured x-height: {measuredXHeight.toFixed(2)} mm · approximate
                type size {approximateFontSizePt(measuredXHeight)?.toFixed(1)}{" "}
                pt
              </output>
            )}
          </fieldset>

          <fieldset className="ws-photo__placement">
            <legend>Reference placement</legend>
            <label htmlFor="ws-photo-width">
              Printed width (mm)
              <input
                id="ws-photo-width"
                type="number"
                min="0.1"
                max="5000"
                step="0.1"
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
                step="0.1"
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
                step="0.1"
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
              Use 1 when the worksheet text and your sample look the same size;
              adjust by eye, or leave blank when uncertain.
            </small>
            <button type="button" onClick={applyMeasurements}>
              Apply measurements to worksheet
            </button>
          </div>

          <aside className="ws-photo__accuracy">
            <strong>For a useful measurement</strong>
            <p>
              Put a ruler in the same plane as the writing, keep the page flat,
              and photograph it straight on. Perspective and curled paper reduce
              accuracy. Resizing does not perform OCR or identify the writing
              font; the point-size result is only a typographic estimate from
              x-height.
            </p>
          </aside>

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
        </>
      )}

      {error && (
        <p className="ws-photo__error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
