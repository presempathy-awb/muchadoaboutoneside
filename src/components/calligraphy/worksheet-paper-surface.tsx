import { File, Layers } from "lucide-react";
import type { ReactNode } from "react";
import type { WorksheetSettings } from "../../../shared/worksheet";
import {
  PAPER_SURFACE_LABELS,
  paperSurface,
  paperSurfaceNote,
} from "../../lib/worksheet-paper-surface";

/** Show paper material choices beside the preview without printing a simulated background. */
export function WorksheetPaperSurface({
  settings,
  onChange,
  compact = false,
}: {
  settings: WorksheetSettings;
  onChange: (patch: Partial<WorksheetSettings>) => boolean;
  compact?: boolean;
}): ReactNode {
  const surface = paperSurface(settings.paperName);
  return (
    <fieldset className="ws-surface-control">
      <legend>Paper on your desk</legend>
      {compact && (
        <label className="ck-mobile-surface">
          <span className="ws-sr-only">Preview paper surface</span>
          <select
            value={surface}
            onChange={(event) => {
              const value = event.currentTarget.value;
              if (
                value === "printer" ||
                value === "vellum" ||
                value === "smooth" ||
                value === "dark"
              )
                onChange({
                  paperName: paperSurfaceNote(settings.paperName, value),
                });
            }}
          >
            {Object.entries(PAPER_SURFACE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="ws-size-actions">
        <button
          type="button"
          aria-pressed={surface === "printer"}
          onClick={() =>
            onChange({
              paperName: paperSurfaceNote(settings.paperName, "printer"),
            })
          }
        >
          <File size={17} aria-hidden="true" /> Printer paper
        </button>
        <button
          type="button"
          aria-pressed={surface === "vellum"}
          onClick={() =>
            onChange({
              paperName: paperSurfaceNote(settings.paperName, "vellum"),
            })
          }
        >
          <Layers size={17} aria-hidden="true" /> Vellum / tracing
        </button>
      </div>
      <p className="ws-hint">
        {surface === "vellum"
          ? "A translucent writing sheet over your guides. This preview suggests the surface; print backgrounds stay white."
          : surface === "dark"
            ? "Opaque stock makes an underlay harder to see. Test light ink on your actual paper."
            : surface === "smooth"
              ? "A smooth writing surface. Check your paper's coating and test the ink before starting."
              : "An ordinary white sheet, ready for your printer. The preview keeps its physical proportions."}
      </p>
    </fieldset>
  );
}
