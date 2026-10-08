import type { ReactNode } from "react";
import type { WorksheetLayout } from "../../../shared/worksheet";

/** Paper metadata stays outside the canvas so changing controls cannot enlarge it. */
export function WorksheetPaperPane({
  layout,
  description,
  page,
  cockpit,
  children,
}: {
  layout: WorksheetLayout;
  description: string;
  page: { index: number; count: number; onChange: (index: number) => void };
  cockpit: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={cockpit ? "ck-paper-bay" : undefined}
      aria-label="Paper preview"
    >
      <div className="ws-preview-top" id="ws-preview">
        <div>
          <h2>Your practice sheet</h2>
          <p className="ws-hint">{description}</p>
          <strong>
            {layout.baselineYsMm.length} writing rows ·{" "}
            {layout.widthMm.toFixed(1)} × {layout.heightMm.toFixed(1)} mm
          </strong>
        </div>
        <div className="ws-page-nav">
          <button
            type="button"
            aria-label="Previous preview page"
            disabled={page.index === 0}
            onClick={() => page.onChange(page.index - 1)}
          >
            ←
          </button>
          <span aria-live="polite">
            Page {page.index + 1} of {page.count}
          </span>
          <button
            type="button"
            aria-label="Next preview page"
            disabled={page.index >= page.count - 1}
            onClick={() => page.onChange(page.index + 1)}
          >
            →
          </button>
        </div>
      </div>
      {children}
    </section>
  );
}
