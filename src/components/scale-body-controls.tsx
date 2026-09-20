import { useState } from "react";
import type { ScaleStudySettings } from "../../shared/scale-study";

export function ScaleBodyControls({
  settings,
  onChange,
}: {
  settings: ScaleStudySettings;
  onChange: (patch: Partial<ScaleStudySettings>) => void;
}) {
  const [linked, setLinked] = useState(
    () => settings.bodyWidthScale === settings.bodyDepthScale,
  );
  function change(axis: "bodyWidthScale" | "bodyDepthScale", value: number) {
    onChange(
      linked
        ? { bodyWidthScale: value, bodyDepthScale: value }
        : { [axis]: value },
    );
  }
  return (
    <section
      className="scales-body-controls"
      aria-labelledby="scales-body-title"
    >
      <h3 id="scales-body-title">Tube girth</h3>
      <label className="scales-toggle" htmlFor="scales-body-linked">
        <input
          id="scales-body-linked"
          type="checkbox"
          checked={linked}
          onChange={(event) => {
            const next = event.currentTarget.checked;
            setLinked(next);
            if (next) {
              onChange({ bodyDepthScale: settings.bodyWidthScale });
            }
          }}
        />
        Link body width and depth
      </label>
      {(
        [
          ["bodyWidthScale", "scales-body-width", "Body width"],
          ["bodyDepthScale", "scales-body-depth", "Body depth"],
        ] as const
      ).map(([axis, id, label]) => {
        const value = settings[axis];
        const display = `${Math.round(value * 100)}% of the original cross-section`;
        return (
          <div className="scale-range-field" key={axis}>
            <label htmlFor={id}>
              {label} <output htmlFor={id}>{Math.round(value * 100)}%</output>
            </label>
            <input
              id={id}
              type="range"
              min={0.5}
              max={2}
              step={0.01}
              value={value}
              aria-valuetext={display}
              onChange={(event) =>
                change(axis, Number(event.currentTarget.value))
              }
            />
          </div>
        );
      })}
      <button
        id="scales-body-reset"
        className="scales-body-reset"
        type="button"
        onClick={() => onChange({ bodyWidthScale: 1, bodyDepthScale: 1 })}
      >
        Reset body proportions
      </button>
      <p className="scales-help">
        Adjust the local tube cross-section around the backbone. The backbone
        path and base stay fixed; material layers and lettering keep their
        entered physical size. Plates and words remap locally without AI. Use
        raised plate depth below to add bulk to the scales themselves.
      </p>
    </section>
  );
}
