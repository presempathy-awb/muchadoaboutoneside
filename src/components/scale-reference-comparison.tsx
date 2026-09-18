import { useId, useMemo, useState } from "react";
import {
  type ScaleBounds,
  scaleStudyBoundsComparison,
} from "../../shared/scale-measurements";
import { scalePlateProportions } from "../../shared/scale-proportions";
import type { ScaleStudy } from "../../shared/scale-study";
import "../scale-reference.css";

export function ScaleReferenceComparison({
  study,
  pending = false,
}: {
  study: ScaleStudy | null;
  pending?: boolean;
}) {
  const id = useId();
  const [unit, setUnit] = useState<"in" | "mm">("in");
  const bounds = useMemo(
    () => (study ? scaleStudyBoundsComparison(study) : null),
    [study],
  );
  const faces = useMemo(
    () => (study ? scalePlateProportions(study) : null),
    [study],
  );
  const measure = (value: number) =>
    (value * (unit === "mm" ? 25.4 : 1)).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  const dimensions = (value: ScaleBounds) =>
    `${measure(value.width)} W × ${measure(value.height)} H × ${measure(value.depth)} D ${unit}`;
  const ratio = (a: number, b: number) =>
    b > 0 ? `${(a / b).toFixed(2)} : 1` : "—";

  return (
    <section
      className="scales-control-card scales-reference-card"
      aria-labelledby={`${id}-title`}
    >
      <h2 id={`${id}-title`}>Compare with the wood plates</h2>
      <div className="scales-reference-photos">
        <figure>
          <a
            href="/references/iani-sculpture-video-reference-01.png"
            target="_blank"
            rel="noreferrer"
            aria-label="Open complete first reference screenshot"
          >
            <svg
              viewBox="805 1288 600 305"
              role="img"
              aria-label="Reference sculpture: thick wood plates with clipped corners"
            >
              <image
                href="/references/iani-sculpture-video-reference-01.png"
                width="1405"
                height="1760"
              />
            </svg>
          </a>
          <figcaption>Clipped corners & stepped edges</figcaption>
        </figure>
        <figure>
          <a
            href="/references/iani-sculpture-video-reference-02.png"
            target="_blank"
            rel="noreferrer"
            aria-label="Open complete second reference screenshot"
          >
            <svg
              viewBox="788 1260 600 300"
              role="img"
              aria-label="Reference sculpture: irregular short rectangles and trapezoids around the curved body"
            >
              <image
                href="/references/iani-sculpture-video-reference-02.png"
                width="1440"
                height="1719"
              />
            </svg>
          </a>
          <figcaption>Mixed sizes & staggered courses</figcaption>
        </figure>
      </div>
      <p className="scales-hint">
        The reference suggests mostly short rectangles and trapezoids, with
        visible depth. The new wood-plate shape starts at 1.3 width to height;
        corner cuts and taper keep it from looking like a grid of identical
        tiles.
      </p>
      <p className="scales-hint">
        Many near-facing plates look roughly 1.1–1.7 times as long as they are
        wide. This is a visual comparison affected by perspective, not a
        measured construction ratio.
      </p>
      {faces && (
        <dl
          className="scales-reference-metrics"
          data-testid="scale-face-proportions"
        >
          <div>
            <dt>Estimated face length / short edge, median</dt>
            <dd>{faces.medianAspect.toFixed(2)} : 1</dd>
          </div>
          <div>
            <dt>Middle half of estimated face ratios</dt>
            <dd>
              {faces.middleAspectRange[0].toFixed(2)}–
              {faces.middleAspectRange[1].toFixed(2)}
            </dd>
          </div>
          <div>
            <dt>Raised depth / short edge, median</dt>
            <dd>{(faces.medianReliefRatio * 100).toFixed(1)}%</dd>
          </div>
        </dl>
      )}
      {faces && (
        <p className="scales-hint">
          Ratios use the actual clipped face spans. Small fragments at bends
          count too; curved and distorted faces make these estimates. Raised
          depth excludes the supporting layers.
        </p>
      )}
      <div className="scales-reference-heading">
        <h3>
          {study?.modelId === "maquette"
            ? "Solid & clad dimensions"
            : "Body & clad dimensions"}
        </h3>
        <label>
          Units
          <select
            value={unit}
            onChange={(event) =>
              setUnit(event.target.value === "mm" ? "mm" : "in")
            }
          >
            <option value="in">in</option>
            <option value="mm">mm</option>
          </select>
        </label>
      </div>
      {bounds?.source && bounds.scales ? (
        <>
          <dl
            className="scales-reference-metrics"
            data-testid="scale-body-dimensions"
          >
            <div>
              <dt>
                {study?.modelId === "maquette"
                  ? "Bare print solid, including plinth"
                  : "Bare body + jaw, excluding base"}
              </dt>
              <dd>{dimensions(bounds.source)}</dd>
            </div>
            <div>
              <dt>Generated plates + sidewalls</dt>
              <dd>{dimensions(bounds.scales)}</dd>
            </div>
            <div>
              <dt>Width / depth · bare → clad</dt>
              <dd>
                {ratio(bounds.source.width, bounds.source.depth)} →{" "}
                {ratio(bounds.scales.width, bounds.scales.depth)}
              </dd>
            </div>
            <div>
              <dt>Depth · bare → clad</dt>
              <dd>
                {measure(bounds.source.depth)} → {measure(bounds.scales.depth)}{" "}
                {unit}{" "}
                <small>
                  (
                  {(
                    (bounds.scales.depth / bounds.source.depth - 1) *
                    100
                  ).toFixed(1)}
                  %)
                </small>
              </dd>
            </div>
          </dl>
          {pending && (
            <p role="status" className="scales-hint">
              Showing the previous completed shape while the next one is
              calculated.
            </p>
          )}
        </>
      ) : (
        <p className="scales-hint">
          Dimensions appear when the first shape is ready.
        </p>
      )}
      <p className="scales-hint">
        {study?.modelId === "maquette"
          ? "The print includes its integrated plinth. "
          : "The large square base is excluded here: its footprint made the full model look much wider and deeper in the size readout. "}
        These are bounds of the generated geometry. Gaps can miss an extreme
        point; this is not a shipping envelope or a tape-measured girth. The
        photos show only part of the body, so they cannot establish the full
        sculpture’s dimensions.
      </p>
    </section>
  );
}
