import { useState } from "react";
import {
  createSheetLayout,
  createSheetPdf,
  DEFAULT_SHEET_SETTINGS,
  PAPER_SIZES,
  type SheetSettings,
  sheetFilename,
} from "../../../shared/copperplate-sheet";

const defaultFields = {
  lineCount: String(DEFAULT_SHEET_SETTINGS.lineCount),
  marginMm: String(DEFAULT_SHEET_SETTINGS.marginMm),
  lineWidthPt: String(DEFAULT_SHEET_SETTINGS.lineWidthPt),
  darkness: String(DEFAULT_SHEET_SETTINGS.darkness),
};

export function CopperplateMaker() {
  const [fields, setFields] = useState(defaultFields);
  const [paper, setPaper] = useState(DEFAULT_SHEET_SETTINGS.paper);
  const [orientation, setOrientation] = useState(
    DEFAULT_SHEET_SETTINGS.orientation,
  );
  const [downloadError, setDownloadError] = useState("");
  const settings: SheetSettings = {
    paper,
    orientation,
    lineCount:
      fields.lineCount.trim() === "" ? Number.NaN : Number(fields.lineCount),
    marginMm:
      fields.marginMm.trim() === "" ? Number.NaN : Number(fields.marginMm),
    lineWidthPt:
      fields.lineWidthPt.trim() === ""
        ? Number.NaN
        : Number(fields.lineWidthPt),
    darkness: Number(fields.darkness),
  };
  let layout: ReturnType<typeof createSheetLayout> | undefined;
  let error = "";
  try {
    layout = createSheetLayout(settings);
  } catch (cause) {
    error =
      cause instanceof Error ? cause.message : "Check the sheet settings.";
  }

  function updateField(name: keyof typeof fields, value: string) {
    setFields((previous) => ({ ...previous, [name]: value }));
    setDownloadError("");
  }

  function download() {
    try {
      const blob = new Blob([createSheetPdf(settings)], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = sheetFilename(settings);
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setDownloadError("");
    } catch {
      setDownloadError("The PDF could not be created. Please try again.");
    }
  }

  return (
    <section className="copperplate-maker" aria-labelledby="copperplate-title">
      <header className="copperplate-heading">
        <span className="copperplate-kicker">A little room to practice</span>
        <h1 id="copperplate-title">Copperplate practice sheets</h1>
        <p>
          Just evenly spaced horizontal lines. Set up your page, download the
          PDF, and put pen to paper.
        </p>
      </header>

      <div className="copperplate-workspace">
        <form
          className="copperplate-controls"
          onSubmit={(event) => {
            event.preventDefault();
            if (layout) download();
          }}
        >
          <h2>Your sheet</h2>
          <label htmlFor="copperplate-lines">Horizontal lines</label>
          <input
            id="copperplate-lines"
            type="number"
            min="2"
            max="100"
            step="1"
            required
            value={fields.lineCount}
            onChange={(event) => updateField("lineCount", event.target.value)}
            aria-describedby="copperplate-lines-hint"
          />
          <small id="copperplate-lines-hint">
            2–100 lines, spaced evenly between the margins.
          </small>

          <div className="copperplate-field-pair">
            <div>
              <label htmlFor="copperplate-paper">Paper size</label>
              <select
                id="copperplate-paper"
                value={paper}
                onChange={(event) =>
                  setPaper(event.target.value as SheetSettings["paper"])
                }
              >
                {Object.entries(PAPER_SIZES).map(([value, size]) => (
                  <option value={value} key={value}>
                    {size.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="copperplate-orientation">Orientation</label>
              <select
                id="copperplate-orientation"
                value={orientation}
                onChange={(event) =>
                  setOrientation(
                    event.target.value as SheetSettings["orientation"],
                  )
                }
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
          </div>

          <div className="copperplate-field-pair">
            <div>
              <label htmlFor="copperplate-margin">Margins (mm)</label>
              <input
                id="copperplate-margin"
                type="number"
                min="5"
                max="50"
                step="any"
                required
                value={fields.marginMm}
                onChange={(event) =>
                  updateField("marginMm", event.target.value)
                }
              />
            </div>
            <div>
              <label htmlFor="copperplate-weight">Line weight (pt)</label>
              <input
                id="copperplate-weight"
                type="number"
                min="0.1"
                max="2"
                step="any"
                required
                value={fields.lineWidthPt}
                onChange={(event) =>
                  updateField("lineWidthPt", event.target.value)
                }
              />
            </div>
          </div>

          <label htmlFor="copperplate-darkness">
            Line darkness <span>{fields.darkness}%</span>
          </label>
          <input
            id="copperplate-darkness"
            type="range"
            min="10"
            max="100"
            step="1"
            value={fields.darkness}
            onChange={(event) => updateField("darkness", event.target.value)}
          />
          <div className="copperplate-range-labels" aria-hidden="true">
            <span>Light gray</span>
            <span>Black</span>
          </div>

          {error && (
            <p className="copperplate-error" role="alert">
              {error}
            </p>
          )}
          {downloadError && (
            <p className="copperplate-error" role="alert">
              {downloadError}
            </p>
          )}
          <button
            className="copperplate-download"
            type="submit"
            disabled={!layout}
          >
            Download PDF
          </button>
          <button
            className="copperplate-reset"
            type="button"
            onClick={() => {
              setFields(defaultFields);
              setPaper(DEFAULT_SHEET_SETTINGS.paper);
              setOrientation(DEFAULT_SHEET_SETTINGS.orientation);
              setDownloadError("");
            }}
          >
            Reset to 24 lines
          </button>
          <p className="copperplate-print-note">
            Print at <strong>Actual size / 100%</strong> on the selected paper
            size. The PDF contains only the lines on one page.
          </p>
        </form>

        <figure className="copperplate-preview">
          <figcaption>
            <strong>Sheet preview</strong>
            <span aria-live="polite">
              {layout
                ? `${settings.lineCount} lines · ${layout.spacingMm.toFixed(2)} mm apart`
                : "Check your settings to preview the sheet"}
            </span>
          </figcaption>
          {layout ? (
            <svg
              className="copperplate-paper"
              viewBox={`0 0 ${layout.widthMm} ${layout.heightMm}`}
              role="img"
              aria-labelledby="copperplate-preview-title"
            >
              <title id="copperplate-preview-title">
                {`${settings.lineCount} evenly spaced horizontal lines on ${PAPER_SIZES[paper].label} paper, ${orientation}`}
              </title>
              <rect
                width={layout.widthMm}
                height={layout.heightMm}
                fill="white"
              />
              <g
                stroke={`rgb(${255 * (1 - settings.darkness / 100)} ${255 * (1 - settings.darkness / 100)} ${255 * (1 - settings.darkness / 100)})`}
                strokeWidth={(settings.lineWidthPt * 25.4) / 72}
              >
                {layout.lineYsMm.map((y) => (
                  <line
                    key={y}
                    x1={layout.x1Mm}
                    x2={layout.x2Mm}
                    y1={y}
                    y2={y}
                  />
                ))}
              </g>
            </svg>
          ) : (
            <div className="copperplate-preview-empty">
              Enter valid settings to see your page.
            </div>
          )}
          <p>One clean page, ready for your own Copperplate.</p>
        </figure>
      </div>
    </section>
  );
}
