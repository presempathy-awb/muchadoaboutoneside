import { ArrowLeftRight, ArrowUpDown, RotateCcw } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import type { WorksheetSettings } from "../../../shared/worksheet";
import type { WorksheetFont } from "../../lib/worksheet-fonts";

/** Adjust physical lettering height and horizontal width without scaling the paper. */
export function WorksheetLetteringSize({
  settings,
  font: selectedFont,
  onChange,
}: {
  settings: WorksheetSettings;
  font?: WorksheetFont;
  onChange: (patch: Partial<WorksheetSettings>) => boolean;
}): ReactNode {
  const font = selectedFont?.baseFont ?? selectedFont;
  const height =
    settings.fontSizeMode === "xheight" || !font
      ? settings.textXHeightMm
      : (((font.resolveSizePt(settings) * 25.4) / 72) * font.xHeightUnits) /
        font.unitsPerEm;
  const specimen = useMemo(() => {
    if (!font) return undefined;
    try {
      return { run: font.shape("Ag flourish", settings) };
    } catch {
      return {
        error: "The lettering close-up could not be shaped with this font.",
      };
    }
  }, [font, settings]);
  const run = specimen?.run;
  const bounds = run?.inkBoundsMm;
  const padding = Math.max(0.5, (bounds?.height ?? 0) * 0.1);
  return (
    <fieldset className="ws-lettering-size">
      <legend>Shape your lettering</legend>
      {run &&
        bounds &&
        bounds.width > 0 &&
        bounds.height > 0 &&
        run.glyphs.every((glyph) => glyph.path !== undefined) && (
          <figure className="ws-lettering-closeup">
            <svg
              viewBox={`${bounds.xMin - padding} ${-bounds.yMax - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label="Ag flourish in your selected lettering style"
            >
              {run.glyphs.map((glyph) =>
                glyph.path ? (
                  <path
                    key={`${glyph.id}-${glyph.cluster}-${glyph.xMm}`}
                    d={glyph.path}
                    transform={`translate(${glyph.xMm} ${-glyph.yMm}) scale(${run.pathScaleMm * run.writingScale} ${-run.pathScaleMm})`}
                  />
                ) : null,
              )}
            </svg>
            <figcaption>
              Enlarged lettering · fitted to this panel, not actual print size
            </figcaption>
          </figure>
        )}
      {specimen?.error && (
        <p className="ws-font-warning" role="status">
          {specimen.error}
        </p>
      )}
      <div className="ws-size-controls">
        <label className="ws-field">
          <span className="ws-size-label">
            <ArrowUpDown size={17} aria-hidden="true" /> Lowercase height ·{" "}
            {font || settings.fontSizeMode === "xheight"
              ? `${height.toFixed(1)} mm`
              : "loading font…"}
          </span>
          <input
            type="range"
            min={Math.min(0.5, height)}
            max={Math.max(20, height)}
            step={0.1}
            value={height}
            aria-valuetext={`${height.toFixed(1)} millimetres`}
            onChange={(event) =>
              onChange({
                fontSizeMode: "xheight",
                textXHeightMm: Number(event.target.value),
              })
            }
          />
        </label>
        <label className="ws-field">
          <span className="ws-size-label">
            <ArrowLeftRight size={17} aria-hidden="true" /> Lettering width ·{" "}
            {Math.round(settings.writingScale * 100)}%
          </span>
          <input
            type="range"
            min={Math.min(0.25, settings.writingScale)}
            max={Math.max(3, settings.writingScale)}
            step={0.05}
            value={settings.writingScale}
            aria-valuetext={`${Math.round(settings.writingScale * 100)} percent`}
            onChange={(event) =>
              onChange({ writingScale: Number(event.target.value) })
            }
          />
        </label>
      </div>
      <div className="ws-size-actions">
        <button
          type="button"
          onClick={() =>
            onChange({
              fontSizeMode: "xheight",
              textXHeightMm: settings.xHeightMm,
            })
          }
        >
          Match guide height
        </button>
        <button type="button" onClick={() => onChange({ writingScale: 1 })}>
          <RotateCcw size={15} aria-hidden="true" /> Natural width
        </button>
      </div>
      <p className="ws-hint">
        Height sizes the letterforms; width stretches them sideways. Both update
        measured spacing and the PDF. Fine size and spacing controls are in
        Lettering options.
      </p>
    </fieldset>
  );
}
