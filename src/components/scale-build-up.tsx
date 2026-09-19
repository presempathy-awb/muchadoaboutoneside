import { useId, useMemo, useState } from "react";
import {
  normalizeScaleBuildUp,
  normalizeScaleModelScale,
  SCALE_BUILD_UP_FIELDS,
  type ScaleBounds,
  type ScaleBuildUp,
  SOURCE_SCALE_SECTIONS,
  scaleSectionMeasurements,
  scaleStudyBoundsComparison,
} from "../../shared/scale-measurements";
import {
  type ScaleModelId,
  scaledModelDimensions,
} from "../../shared/scale-models";
import type { ScaleStudy } from "../../shared/scale-study";
import "../scale-build-up.css";

interface ScaleBuildUpPanelProps {
  layers: ScaleBuildUp;
  onChange: (layers: ScaleBuildUp) => void;
  study: ScaleStudy | null;
  reliefInches: number;
  modelScale?: number;
  bodyWidthScale?: number;
  bodyDepthScale?: number;
  modelId?: ScaleModelId;
  pending?: boolean;
}

const widestSection = SOURCE_SCALE_SECTIONS.reduce((widest, section) =>
  section.radiusUInches + section.radiusVInches >
  widest.radiusUInches + widest.radiusVInches
    ? section
    : widest,
);

export function ScaleBuildUpPanel({
  layers,
  onChange,
  study,
  reliefInches,
  modelScale = 1,
  bodyWidthScale = 1,
  bodyDepthScale = 1,
  modelId = "archival",
  pending = false,
}: ScaleBuildUpPanelProps) {
  const id = useId();
  const [sectionId, setSectionId] = useState(widestSection.id);
  const [unit, setUnit] = useState<"in" | "mm">("in");
  const stages = useMemo(
    () =>
      scaleSectionMeasurements(
        sectionId,
        layers,
        reliefInches,
        modelScale,
        bodyWidthScale,
        bodyDepthScale,
      ),
    [
      sectionId,
      layers,
      reliefInches,
      modelScale,
      bodyWidthScale,
      bodyDepthScale,
    ],
  );
  const bounds = useMemo(
    () =>
      study && study.modelId === modelId
        ? scaleStudyBoundsComparison(study)
        : null,
    [study, modelId],
  );
  const baseline = stages[0];
  const outer = stages.at(-1);
  if (!baseline || !outer) return null;
  const factor = unit === "mm" ? 25.4 : 1;
  const value = (inches: number) =>
    (inches * factor).toLocaleString(undefined, {
      minimumFractionDigits: unit === "in" ? 2 : 1,
      maximumFractionDigits: unit === "in" ? 2 : 1,
    });
  const dimensions = (item: ScaleBounds) =>
    `${value(item.width)} W × ${value(item.height)} H × ${value(item.depth)} D ${unit}`;
  const diagramScale = Math.min(
    280 / outer.widthInches,
    140 / outer.depthInches,
  );
  const addedGirth = outer.girthInches - baseline.girthInches;
  const appliedModelScale = normalizeScaleModelScale(modelScale);

  return (
    <section className="scale-build-up" aria-labelledby={`${id}-title`}>
      <div className="scale-build-up-heading">
        <div>
          <p className="scale-build-up-eyebrow">Layers & dimensions</p>
          <h2 id={`${id}-title`}>How much girth do the scales add?</h2>
        </div>
        <label>
          Display units
          <select
            value={unit}
            onChange={(event) =>
              setUnit(event.target.value === "mm" ? "mm" : "in")
            }
          >
            <option value="in">Inches</option>
            <option value="mm">Millimeters</option>
          </select>
        </label>
      </div>
      <p>
        Start with the{" "}
        {modelId === "maquette"
          ? "separate solid print maquette"
          : "archival construction model"}{" "}
        at the selected{" "}
        {(appliedModelScale * 100).toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })}
        % size, then add only layers that it does not already include. These are
        editable allowances; the photographs do not establish their thicknesses
        or an as-built girth.
      </p>

      <fieldset className="scale-build-up-inputs">
        <legend>Additional thickness on each side</legend>
        {SCALE_BUILD_UP_FIELDS.map(({ key, label, unit: inputUnit, max }) => (
          <label key={key}>
            <span>
              {label} <small>({inputUnit})</small>
            </span>
            <input
              type="number"
              min={0}
              max={max}
              step={inputUnit === "in" ? 0.05 : 0.001}
              value={layers[key]}
              onChange={(event) => {
                const next = event.target.valueAsNumber;
                if (Number.isFinite(next)) {
                  onChange(normalizeScaleBuildUp({ ...layers, [key]: next }));
                }
              }}
            />
          </label>
        ))}
      </fieldset>
      <p className="scale-build-up-note">
        The starting 1 in support is the earlier visual study’s unmeasured
        allowance. The 0.127 mm metal is a proposal. Zeroes mean no allowance
        entered, not a confirmed absence. Local overlap applies only where
        sheets stack; this preview spreads it uniformly as an envelope estimate.
        Raised scale height is controlled above, separately from these layers.
      </p>
      <p className="scale-build-up-note">
        Model size changes the underlying form; stock thickness, adhesive,
        metal, and raised scale height keep their entered physical sizes. For
        wood construction with printed spacers or adapters, enter only the added
        thickness here. Measure each mating joint and test a small fitting
        before making the full set. These envelope estimates are planning
        dimensions, not tested fabrication files.
      </p>

      {modelId === "archival" ? (
        <>
          <label className="scale-build-up-section-picker">
            Compare at this source section
            <select
              value={sectionId}
              onChange={(event) => setSectionId(event.target.value)}
            >
              {SOURCE_SCALE_SECTIONS.map((section) => (
                <option value={section.id} key={section.id}>
                  {section.label}
                </option>
              ))}
            </select>
          </label>

          <div className="scale-build-up-summary">
            <figure>
              <svg
                viewBox="0 0 340 200"
                role="img"
                aria-labelledby={`${id}-diagram-title ${id}-diagram-description`}
              >
                <title id={`${id}-diagram-title`}>
                  Local cross-section before and after added layers
                </title>
                <desc id={`${id}-diagram-description`}>
                  The dark inner ellipse represents the archival modeled section
                  at the selected size; the amber outer ellipse shows the
                  estimated maximum build-up. Both use the same scale in this
                  section’s local axes.
                </desc>
                {[...stages].reverse().map((stage) => (
                  <ellipse
                    key={stage.id}
                    cx={170}
                    cy={100}
                    rx={(stage.widthInches * diagramScale) / 2}
                    ry={(stage.depthInches * diagramScale) / 2}
                    className={
                      stage.id === "source"
                        ? "scale-build-up-original"
                        : "scale-build-up-layer"
                    }
                  />
                ))}
              </svg>
              <figcaption>
                Dark: resized modeled section · amber: physical layer envelopes
              </figcaption>
            </figure>
            <dl>
              <div>
                <dt>Estimated width / depth increase</dt>
                <dd>
                  +{value(outer.widthInches - baseline.widthInches)} {unit}
                </dd>
              </div>
              <div>
                <dt>Estimated girth increase</dt>
                <dd>
                  +{value(addedGirth)} {unit}{" "}
                  <small>
                    ({((addedGirth / baseline.girthInches) * 100).toFixed(1)}%)
                  </small>
                </dd>
              </div>
              <div>
                <dt>Modeled section → maximum envelope girth</dt>
                <dd>
                  {value(baseline.girthInches)} → {value(outer.girthInches)}{" "}
                  {unit}
                </dd>
              </div>
            </dl>
          </div>

          <section
            className="scale-build-up-table-scroll"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users must be able to scroll this wide table.
            tabIndex={0}
            aria-label="Layer-by-layer section dimensions"
          >
            <table>
              <caption>
                Local section dimensions after each added layer ({unit})
              </caption>
              <thead>
                <tr>
                  <th scope="col">Stage</th>
                  <th scope="col">Added / side</th>
                  <th scope="col">Total / side</th>
                  <th scope="col">Width U</th>
                  <th scope="col">Depth V</th>
                  <th scope="col">Girth</th>
                </tr>
              </thead>
              <tbody>
                {stages.map((stage) => (
                  <tr key={stage.id}>
                    <th scope="row">{stage.label}</th>
                    <td>{value(stage.addedRadialInches)}</td>
                    <td>{value(stage.totalRadialInches)}</td>
                    <td>{value(stage.widthInches)}</td>
                    <td>{value(stage.depthInches)}</td>
                    <td>{value(stage.girthInches)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <p className="scale-build-up-note">
            Width U and depth V follow the selected ring’s local axes, not the
            whole sculpture’s orientation. Girth integrates an ellipse fitted to
            its two source semiaxes, adjusted by the body proportions before
            adding the listed physical allowances. The maximum raised face
            height overstates sections with shorter scales or local clearance
            adjustments. Gaps, steps, fasteners, and edge details make a real
            tape measurement different; check those on the physical work.
          </p>
        </>
      ) : (
        <p className="scale-build-up-note">
          This preview deforms the source maquette mesh while retaining its
          joined crossings and integrated plinth. Its cross-sections differ from
          the archival ribs, so the archival ellipse and girth table do not
          apply. Compare the measured mesh bounds below, then check local girth
          and printed joint fit on the physical model.
        </p>
      )}

      <details>
        <summary>
          Compare historical source and generated preview dimensions
        </summary>
        <dl className="scale-build-up-bounds">
          <div>
            <dt>
              {modelId === "maquette"
                ? "Original solid print maquette, including plinth"
                : "Archived construction model, including base"}
            </dt>
            <dd>{dimensions(scaledModelDimensions(modelId, 1))}</dd>
          </div>
          <div>
            <dt>
              {modelId === "maquette"
                ? "Historical print source at selected size, before body changes"
                : "Historical archive at selected size, before body changes"}
            </dt>
            <dd>
              {dimensions(scaledModelDimensions(modelId, appliedModelScale))}
            </dd>
          </div>
          <div>
            <dt>
              {modelId === "maquette"
                ? "Generated maquette preview with body changes, before layers"
                : "Generated body and jaw with body changes, before layers"}
            </dt>
            <dd>
              {bounds?.source
                ? dimensions(bounds.source)
                : "Model dimensions pending"}
              {pending && bounds?.source ? " · previous result, updating" : ""}
            </dd>
          </div>
          <div>
            <dt>Rendered scale plates and their sidewalls</dt>
            <dd>
              {bounds?.scales
                ? dimensions(bounds.scales)
                : "Scale dimensions pending"}
              {pending && bounds?.scales ? " · previous result, updating" : ""}
            </dd>
          </div>
        </dl>
        {modelId === "archival" ? (
          <p className="scale-build-up-note">
            These last two values are world-axis bounds of sampled cladding
            geometry, including the separate jaw. They exclude the base, eyes,
            fangs, and other hardware. Plate gaps can omit source extrema, so
            they are not a shipping size or a whole-sculpture growth
            measurement. Adding twice a layer thickness to the full sculpture
            height would misrepresent its curved shape and unchanged base. A
            resized archival construction model is not the separately generated
            solid print maquette; those models have different geometry.
          </p>
        ) : (
          <p className="scale-build-up-note">
            Generated mesh bounds describe the current deformed preview; the
            original STL is unchanged. Plate bounds include only cladding and
            sidewalls. These dimensions do not certify fabrication, wall
            thickness, joint fit, or a shipping envelope. Check the proposed
            printed or wood construction physically before building.
          </p>
        )}
      </details>
    </section>
  );
}
