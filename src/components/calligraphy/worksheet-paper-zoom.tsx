import { Scan, X } from "lucide-react";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import type { WorksheetLayout } from "../../../shared/worksheet";
import type { WorksheetFont } from "../../lib/worksheet-fonts";
import type { WorksheetSnapshot } from "../../lib/worksheet-store";
import { WorksheetPreview } from "./worksheet-preview";
import "../../calligraphy-zoom.css";

/** Inspect the same measured sheet in a native focus-trapping dialog. */
export function WorksheetPaperZoom({
  snapshot,
  layout,
  lines,
  font,
  children,
  triggerClassName,
}: {
  snapshot: WorksheetSnapshot;
  layout: WorksheetLayout;
  lines: string[];
  font?: WorksheetFont;
  children?: ReactNode;
  triggerClassName?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [zoom, setZoom] = useState(100);
  const [open, setOpen] = useState(false);
  const hasCustomTrigger = children !== undefined;

  function openDialog() {
    setZoom(100);
    setOpen(true);
    dialog.current?.showModal();
  }

  function closeDialog() {
    dialog.current?.close();
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={
          [
            "ck-paper-trigger",
            hasCustomTrigger ? "ck-paper-trigger--surface" : undefined,
            triggerClassName,
          ]
            .filter(Boolean)
            .join(" ") || undefined
        }
        aria-label={hasCustomTrigger ? "Enlarge paper preview" : undefined}
        onClick={openDialog}
      >
        {hasCustomTrigger ? (
          children
        ) : (
          <>
            <Scan size={17} aria-hidden="true" /> Zoom paper
          </>
        )}
      </button>
      <dialog
        ref={dialog}
        className="ck-paper-dialog"
        aria-label="Paper zoom"
        onClose={() => {
          setOpen(false);
          trigger.current?.focus();
        }}
      >
        <header>
          <h2>Your sheet, up close</h2>
          <label>
            <span>Preview zoom · {zoom}%</span>
            <input
              type="range"
              min="50"
              max="250"
              step="10"
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
            />
          </label>
          <button type="button" onClick={() => setZoom(100)}>
            Fit sheet
          </button>
          <button type="button" onClick={closeDialog}>
            <X size={18} aria-hidden="true" /> Close zoom
          </button>
        </header>
        <div className="ck-zoom-viewport">
          <div
            className="ck-zoom-sheet"
            style={{
              aspectRatio: `${layout.widthMm} / ${layout.heightMm}`,
              width: `min(${zoom}cqw, calc(${zoom}cqh * ${layout.widthMm / layout.heightMm}))`,
            }}
          >
            {open && (
              <WorksheetPreview
                snapshot={snapshot}
                layout={layout}
                lines={lines}
                font={font}
              />
            )}
          </div>
        </div>
        <p>Preview zoom changes only this view. Print at Actual size / 100%.</p>
      </dialog>
    </>
  );
}
