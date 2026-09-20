import {
  DEFAULT_SCALE_SHAPE,
  fitScalePlateBounds,
  scalePlateOutline,
} from "../../shared/scale-shape";
import type { ScaleStudySettings } from "../../shared/scale-study";
import { DEFAULT_SCALE_STUDY_SETTINGS } from "../../shared/scale-study";

const SHAPES = [
  ["clipped", "Wood plates"],
  ["rectangle", "Rectangle"],
  ["diamond", "Diamond"],
  ["legacy", "Original"],
] as const;

function ShapeRange({
  id,
  label,
  value,
  min,
  max,
  step,
  display,
  disabled = false,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
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
        disabled={disabled}
        aria-valuetext={display}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </div>
  );
}

export function ScaleShapeControls({
  settings,
  unit,
  onChange,
}: {
  settings: ScaleStudySettings;
  unit: "in" | "mm";
  onChange: (patch: Partial<ScaleStudySettings>) => void;
}) {
  const followingCell = settings.plateAspect === 0;
  const covering = settings.plateFit === "cover";
  const factor = unit === "mm" ? 25.4 : 1;
  return (
    <section
      className="scales-control-card scales-shape-card"
      aria-labelledby="scales-outline-title"
    >
      <div className="scales-section-heading">
        <span>OUTLINE & PROPORTIONS</span>
        <h2 id="scales-outline-title">Scale shape</h2>
      </div>
      <fieldset
        className="scales-coverage-options"
        aria-label="Plate coverage layout"
      >
        <legend>Fit the surface</legend>
        {(
          [
            ["cover", "Close-set coverage"],
            ["inset", "Inset plates"],
          ] as const
        ).map(([plateFit, label]) => (
          <label key={plateFit} htmlFor={`scales-plate-fit-${plateFit}`}>
            <input
              id={`scales-plate-fit-${plateFit}`}
              type="radio"
              name="scales-plate-fit"
              value={plateFit}
              checked={settings.plateFit === plateFit}
              onChange={() => onChange({ plateFit })}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <p className="scales-help">
        {covering
          ? "Coverage balances courses within your requested plate budget and fills each cell. The width / height ratio is an approximate physical target; bends and integer course counts can change individual faces."
          : "Inset plates fit the selected physical ratio inside each surface cell. This preserves the earlier layout; narrow or wide ratios can leave large gaps."}
      </p>
      <fieldset className="scales-shape-options" aria-label="Plate outline">
        {SHAPES.map(([plateShape, label]) => {
          const outline = scalePlateOutline(
            {
              ...settings,
              plateShape:
                plateShape === "legacy" && settings.modelId === "maquette"
                  ? "rectangle"
                  : plateShape,
              plateTaper: plateShape === "legacy" ? 0 : settings.plateTaper,
            },
            () => 0.5,
          );
          const footprint = fitScalePlateBounds(
            { u0: 0, u1: 1, v0: 0, v1: 1 },
            80,
            64,
            settings.plateAspect,
          );
          return (
            <button
              key={plateShape}
              id={`scales-shape-${plateShape}`}
              type="button"
              aria-pressed={settings.plateShape === plateShape}
              onClick={() => onChange({ plateShape })}
            >
              <svg viewBox="0 0 100 80" aria-hidden="true" focusable="false">
                <polygon
                  points={outline
                    .map(
                      ([x, y]) =>
                        `${10 + (footprint.u0 + x * (footprint.u1 - footprint.u0)) * 80},${8 + (footprint.v0 + y * (footprint.v1 - footprint.v0)) * 64}`,
                    )
                    .join(" ")}
                />
              </svg>
              <span>{label}</span>
            </button>
          );
        })}
      </fieldset>
      <ShapeRange
        id="scales-plate-aspect"
        label={
          covering ? "Target plate width / height" : "Plate width / height"
        }
        value={
          followingCell ? DEFAULT_SCALE_SHAPE.plateAspect : settings.plateAspect
        }
        min={0.5}
        max={2.5}
        step={0.05}
        disabled={followingCell}
        display={
          followingCell
            ? covering
              ? "automatically balanced courses"
              : "follows each surface cell"
            : `${settings.plateAspect.toFixed(2)} : 1`
        }
        onChange={(plateAspect) => onChange({ plateAspect })}
      />
      <label className="scales-toggle" htmlFor="scales-plate-follow-cell">
        <input
          id="scales-plate-follow-cell"
          type="checkbox"
          checked={followingCell}
          onChange={(event) =>
            onChange({
              plateAspect: event.currentTarget.checked
                ? 0
                : DEFAULT_SCALE_SHAPE.plateAspect,
            })
          }
        />
        {covering
          ? "Use automatic course proportions"
          : "Follow the surface cell proportions"}
      </label>
      <ShapeRange
        id="scales-corner-cut"
        label="Corner cuts"
        value={settings.cornerCut}
        min={0}
        max={0.3}
        step={0.01}
        display={`${Math.round(settings.cornerCut * 100)}%`}
        disabled={settings.plateShape !== "clipped"}
        onChange={(cornerCut) => onChange({ cornerCut })}
      />
      <ShapeRange
        id="scales-plate-taper"
        label="Top / bottom taper"
        value={settings.plateTaper}
        min={-0.4}
        max={0.4}
        step={0.01}
        display={
          settings.plateTaper === 0
            ? "straight sides"
            : `${Math.round(Math.abs(settings.plateTaper) * 100)}% inset per side · ${settings.plateTaper > 0 ? "top" : "bottom"}`
        }
        disabled={
          settings.plateShape !== "clipped" &&
          settings.plateShape !== "rectangle"
        }
        onChange={(plateTaper) => onChange({ plateTaper })}
      />
      <ShapeRange
        id="scales-shape-relief"
        label="Raised plate depth / bulk"
        value={settings.relief * factor}
        min={0}
        max={6 * factor}
        step={unit === "mm" ? 0.1 : 0.005}
        display={`${settings.relief.toFixed(2)} in / ${(settings.relief * 25.4).toFixed(1)} mm`}
        onChange={(relief) => onChange({ relief: relief / factor })}
      />
      <ShapeRange
        id="scales-shape-variation"
        label="Irregularity"
        value={settings.variation}
        min={0}
        max={1}
        step={0.05}
        display={`${Math.round(settings.variation * 100)}%`}
        onChange={(variation) => onChange({ variation })}
      />
      <button
        id="scales-reference-shape"
        type="button"
        className="scales-reference-shape"
        onClick={() =>
          onChange({
            ...DEFAULT_SCALE_SHAPE,
            gap: DEFAULT_SCALE_STUDY_SETTINGS.gap,
            variation: DEFAULT_SCALE_STUDY_SETTINGS.variation,
            columns: DEFAULT_SCALE_STUDY_SETTINGS.columns,
            rows: DEFAULT_SCALE_STUDY_SETTINGS.rows,
          })
        }
      >
        Apply photo-reference plates
      </button>
      <p className="scales-help">
        The photographs suggest chunky short rectangles and trapezoids with
        clipped corners. The starting 1.25 : 1 ratio is an adjustable visual
        interpretation of those faces; the photographs are not calibrated
        measurements. Changing the shape remaps your lettering. The reference
        button applies close-set staggered coverage and reference density, gap,
        and irregularity. It keeps your body proportions, physical size, depth,
        layers, font, and words.
      </p>
      <p className="scales-help">
        Raised depth controls the generated plate relief; it is not a uniform
        stock-thickness measurement. Curved areas may need less relief to keep
        their geometry valid.
      </p>
      <p className="scales-help">
        Words are fitted in reading order using measured letters and each
        plate’s safe writing area. Recalculation happens locally without AI.
      </p>
      <p className="scales-help">
        Smaller corner cuts, taper, and gaps leave more of the body covered.
        Diamonds and large corner cuts intentionally expose more underneath.
      </p>
    </section>
  );
}
