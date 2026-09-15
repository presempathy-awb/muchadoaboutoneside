import { Ruler } from "lucide-react";
import { useId, useState } from "react";
import {
  DIMENSIONS,
  type DimensionUnit,
  formatDimension,
} from "../../shared/dimensions";
import "../dimensions.css";

export function DimensionsOverview({ compact = false }: { compact?: boolean }) {
  const [unit, setUnit] = useState<DimensionUnit>("mm");
  const titleId = useId();
  const value = (mm: number) => formatDimension(mm, unit);

  return (
    <section
      className={`dimensions-overview${compact ? " is-compact" : ""}`}
      aria-labelledby={titleId}
    >
      <header className="dimensions-heading">
        <div>
          <span className="eyebrow">
            <Ruler size={16} aria-hidden="true" /> SIZE & SCALE
          </span>
          <h2 id={titleId}>Know the size before you start.</h2>
          <p>
            Three different working sizes. Measurements below describe the
            object or sheet, before packaging.
          </p>
        </div>
        <fieldset className="dimension-units">
          <legend>Display units</legend>
          {(["mm", "in"] as const).map((option) => (
            <button
              type="button"
              key={option}
              aria-pressed={unit === option}
              onClick={() => setUnit(option)}
            >
              {option === "mm" ? "Millimetres" : "Inches"}
            </button>
          ))}
        </fieldset>
      </header>
      <div className="dimension-grid">
        <article className="dimension-card dimension-card-primary">
          <span className="dimension-label">01 / SMALL EDITION</span>
          <h3>Printed maquette</h3>
          <p className="dimension-hero">
            {value(DIMENSIONS.maquette.height)} <span>{unit} tall</span>
          </p>
          <dl>
            <div>
              <dt>Width</dt>
              <dd>
                {value(DIMENSIONS.maquette.width)} {unit}
              </dd>
            </div>
            <div>
              <dt>Depth</dt>
              <dd>
                {value(DIMENSIONS.maquette.depth)} {unit}
              </dd>
            </div>
          </dl>
          <p className="dimension-note">
            Includes the integrated base. Use the matching 180 mm foil kit;
            measure the finished wrapped piece before packing.
          </p>
        </article>
        <article className="dimension-card">
          <span className="dimension-label">02 / HAND-LETTERING</span>
          <h3>Paper masters</h3>
          <p className="dimension-hero">
            {value(DIMENSIONS.paper.width)}{" "}
            <span>
              × {value(DIMENSIONS.paper.height)} {unit}
            </span>
          </p>
          <p className="dimension-detail">US Letter · landscape</p>
          <p className="dimension-note">
            Print at 100% / actual size. The scale bar must measure 100 mm (3.94
            in). Keep originals flat for mailing.
          </p>
        </article>
        <article className="dimension-card">
          <span className="dimension-label">03 / ORIGINAL STUDY</span>
          <h3>Large sculpture</h3>
          <p className="dimension-hero">
            {value(DIMENSIONS.sculpture.height)} <span>{unit} tall</span>
          </p>
          <dl>
            <div>
              <dt>Width</dt>
              <dd>
                {value(DIMENSIONS.sculpture.width)} {unit}
              </dd>
            </div>
            <div>
              <dt>Depth</dt>
              <dd>
                {value(DIMENSIONS.sculpture.depth)} {unit}
              </dd>
            </div>
          </dl>
          <p className="dimension-note">
            Original construction-model dimensions, recorded in inches. Measure
            the actual prepared wood and backing for the scale plates, then
            record the finished clad size and remaining jaw/crossing clearance.
            Added layers and overlaps need their own measurements.
          </p>
        </article>
      </div>
      {!compact && (
        <p className="dimension-footnote">
          The maquette is a separate printable interpretation with its own base
          and foil patterns. Do not resize one edition’s kit to fit the other.
          Package dimensions and shipping weight are measured after protection
          is added.
        </p>
      )}
    </section>
  );
}
