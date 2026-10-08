import type { ReactNode } from "react";
import { WORKSHEET_PAPERS, worksheetPaperId } from "@/lib/worksheet-options";
import type {
  WorksheetLayout,
  WorksheetSettings,
} from "../../../shared/worksheet";
import { NumberField } from "./worksheet-number-field";

/** Set physical page dimensions and explain the resulting writing area. */
export function WorksheetPaperControls({
  settings,
  layout,
  onChange,
}: {
  settings: WorksheetSettings;
  layout: WorksheetLayout;
  onChange: (patch: Partial<WorksheetSettings>) => boolean;
}): ReactNode {
  return (
    <>
      <div className="ws-pair">
        <label className="ws-field">
          <span>Paper size</span>
          <select
            value={worksheetPaperId(settings)}
            onChange={(event) => {
              const choice = WORKSHEET_PAPERS.find(
                (item) => item.id === event.target.value,
              );
              onChange(choice?.settings ?? { paper: "custom" });
            }}
          >
            {WORKSHEET_PAPERS.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.label} · {choice.widthMm} × {choice.heightMm} mm
              </option>
            ))}
            <option value="custom">Custom dimensions</option>
          </select>
        </label>
        <label className="ws-field">
          <span>Orientation</span>
          <select
            value={settings.orientation}
            onChange={(event) =>
              onChange({
                orientation: event.target
                  .value as WorksheetSettings["orientation"],
              })
            }
          >
            <option value="landscape">Landscape</option>
            <option value="portrait">Portrait</option>
          </select>
        </label>
      </div>
      {settings.paper === "custom" && (
        <div className="ws-pair">
          <NumberField
            label="Paper side 1 (mm)"
            value={settings.customWidthMm}
            min={50}
            max={600}
            onChange={(customWidthMm) => onChange({ customWidthMm })}
          />
          <NumberField
            label="Paper side 2 (mm)"
            value={settings.customHeightMm}
            min={50}
            max={600}
            onChange={(customHeightMm) => onChange({ customHeightMm })}
          />
        </div>
      )}
      <div className="ws-choice-effect" aria-live="polite">
        <strong>
          {layout.widthMm.toFixed(1)} × {layout.heightMm.toFixed(1)} mm ·{" "}
          {(layout.widthMm / 25.4).toFixed(2)} ×{" "}
          {(layout.heightMm / 25.4).toFixed(2)} in
        </strong>
        <p>
          Writing area: {(layout.contentX2Mm - layout.contentX1Mm).toFixed(1)} ×{" "}
          {(layout.contentY2Mm - layout.contentY1Mm).toFixed(1)} mm.{" "}
          {layout.baselineYsMm.length} rows per sheet · {settings.pageCount}{" "}
          {settings.pageCount === 1 ? "sheet" : "sheets"}.
        </p>
        <p>
          {settings.mode === "plain" && settings.spacingMode === "count"
            ? "Your row count stays fixed: a taller writing area spreads the lines farther apart."
            : "Guide sizes stay fixed in millimetres: a taller writing area fits more complete rows."}{" "}
          A wider writing area fits longer words before wrapping.
        </p>
        <p>
          Match your printer’s supported paper and tray size. Print at 100%;
          “Fit to page” changes the physical guide size. Existing margins are
          kept.
        </p>
      </div>
    </>
  );
}
