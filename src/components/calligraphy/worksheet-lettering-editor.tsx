import { lazy, type ReactNode, Suspense, useState } from "react";
import type { WorksheetSession } from "@/lib/worksheet-store";
import type { WorksheetSettings } from "../../../shared/worksheet";
import { WorksheetEditor } from "./worksheet-editor";

const SpecialWords = lazy(() =>
  import("./worksheet-special-words")
    .then((module) => ({ default: module.WorksheetSpecialWords }))
    .catch(() => ({
      default: () => (
        <p role="status">
          Special lettering could not load. Edit words is still available.
          Reload to retry.
        </p>
      ),
    })),
);

/** Edit the same draft beside its printed calligraphy preview. */
export function WorksheetLetteringEditor({
  session,
  disabled,
  onLoadPoem,
  settings,
  text,
  onChange,
}: {
  session: WorksheetSession;
  disabled: boolean;
  onLoadPoem: () => void;
  settings: WorksheetSettings;
  text: string;
  onChange: (patch: Partial<WorksheetSettings>) => void;
}): ReactNode {
  const [special, setSpecial] = useState(false);
  return (
    <section className="ws-lettering-editor" aria-label="Words on your page">
      <div className="ws-panel-heading">
        <h3>Words on your page</h3>
        <button
          type="button"
          className="ws-text-button"
          disabled={disabled}
          onClick={onLoadPoem}
        >
          Load poem that fits
        </button>
      </div>
      <div className="ws-special-actions">
        <button
          type="button"
          className="ws-text-button"
          aria-pressed={!special}
          onClick={() => setSpecial(false)}
        >
          Edit words
        </button>
        <button
          type="button"
          className="ws-text-button"
          aria-pressed={special}
          onClick={() => setSpecial(true)}
        >
          Special words{settings.specialWords ? " · On" : ""}
        </button>
      </div>
      {special ? (
        <Suspense fallback={<p role="status">Opening special lettering…</p>}>
          <SpecialWords
            settings={settings}
            text={text}
            disabled={disabled}
            onChange={onChange}
          />
        </Suspense>
      ) : (
        <>
          <p className="ws-hint">
            Edit your poem below. “Load poem that fits” fills this sheet with
            complete lines. Hiding calligraphy keeps your words.
          </p>
          <WorksheetEditor session={session} />
        </>
      )}
    </section>
  );
}
