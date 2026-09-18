import { ArrowLeft, ArrowRight } from "lucide-react";
import type { ScaleDesign } from "../../shared/scale-design";
import {
  captureScaleShapeVersion,
  type ScaleShapeVersion,
} from "../../shared/scale-history";
import {
  matchingScaleVersionPreset,
  SCALE_VERSION_PRESETS,
} from "../../shared/scale-versions";

export function ScaleVersionBrowser({
  design,
  history,
  historyError,
  onPreset,
  onHistory,
}: {
  design: ScaleDesign;
  history: ScaleShapeVersion[];
  historyError: string;
  onPreset: (id: string) => void;
  onHistory: (version: ScaleShapeVersion) => void;
}) {
  const preset = matchingScaleVersionPreset(design);
  const presetIndex = SCALE_VERSION_PRESETS.findIndex(
    (version) => version.id === preset?.id,
  );
  const currentShape = captureScaleShapeVersion(design, "Current").id;
  const historyIndex = history.findIndex(
    (version) => version.id === currentShape,
  );
  function hopPreset(direction: number) {
    const index =
      presetIndex === -1
        ? direction > 0
          ? 0
          : SCALE_VERSION_PRESETS.length - 1
        : (presetIndex + direction + SCALE_VERSION_PRESETS.length) %
          SCALE_VERSION_PRESETS.length;
    const next = SCALE_VERSION_PRESETS[index];
    if (next) onPreset(next.id);
  }
  function hopHistory(direction: number) {
    const index =
      historyIndex === -1
        ? direction > 0
          ? 0
          : history.length - 1
        : (historyIndex + direction + history.length) % history.length;
    const next = history[index];
    if (next) onHistory(next);
  }
  return (
    <div className="scales-version-browser">
      <div className="scales-version-title">
        <div>
          <span className="scales-eyebrow">EXPLORE THE VERSIONS</span>
          <h2>Find a form to work with</h2>
        </div>
        <span className="scales-version-count">
          {SCALE_VERSION_PRESETS.length} starting shapes
        </span>
      </div>
      <div className="scales-version-navigation">
        <button
          type="button"
          onClick={() => hopPreset(-1)}
          aria-label="Previous starting shape"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Previous</span>
        </button>
        <label className="scales-field" htmlFor="scales-starting-shape">
          Editing shape
          <select
            id="scales-starting-shape"
            value={preset?.id ?? ""}
            onChange={(event) => {
              if (event.target.value) onPreset(event.target.value);
            }}
          >
            <option value="" disabled>
              Custom shape
            </option>
            {SCALE_VERSION_PRESETS.map((version) => (
              <option key={version.id} value={version.id}>
                {version.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => hopPreset(1)}
          aria-label="Next starting shape"
        >
          <span>Next</span>
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
      <p className="scales-version-description">
        {preset?.description ??
          "Your own combination of model, size, scales, and layers."}
      </p>
      <p className="scales-help">
        Starting shapes set the model, scale pattern, and material layers. Your
        words, font, colors, and notes stay with you.
      </p>
      <div className="scales-shape-history">
        <div className="scales-history-heading">
          <span>Recently viewable shapes</span>
          {history.length > 1 && (
            <div className="scales-button-group">
              <button
                type="button"
                onClick={() => hopHistory(-1)}
                aria-label="Previous recently viewable shape"
              >
                <ArrowLeft size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => hopHistory(1)}
                aria-label="Next recently viewable shape"
              >
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
        {history.length ? (
          <nav
            className="scales-history-list"
            aria-label="Recently viewable shapes"
          >
            {history.map((version) => (
              <button
                type="button"
                key={version.id}
                aria-pressed={version.id === currentShape}
                onClick={() => onHistory(version)}
              >
                {version.label}
              </button>
            ))}
          </nav>
        ) : (
          <p className="scales-help">
            Shapes appear here after their 3D preview succeeds. Up to eight stay
            in this browser.
          </p>
        )}
        {history.length > 0 && (
          <p className="scales-help">
            Return to a shape while keeping your current words, font, colors,
            and notes. Up to eight successful shapes stay in this browser.
          </p>
        )}
        {historyError && (
          <p className="scales-error" role="status">
            {historyError}
          </p>
        )}
      </div>
    </div>
  );
}
