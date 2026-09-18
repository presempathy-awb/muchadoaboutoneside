import {
  lazy,
  type RefObject,
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { usePoemVersion } from "@/lib/poem-version";
import type { CalligraphyScan } from "../../shared/calligraphy-scan";
import {
  DEFAULT_POEM_VERSION_ID,
  isPoemVersionId,
  type PoemVersion,
} from "../../shared/poem";
import { draftSource, parseDraft } from "../../shared/poem-drafts";
import { poemVersionSaveError } from "../../shared/poem-library";
import "../poem-version-controls.css";

const ScanImport = lazy(() =>
  import("@/components/calligraphy-scan-import").then((module) => ({
    default: module.CalligraphyScanImport,
  })),
);

const ORIGINAL_PROTECTION =
  "The Canonical and Extended originals cannot be deleted.";

export function PoemVersionNameField({
  name,
  error,
  errorId,
  attempt,
  inputRef,
  disabled,
  onChange,
}: {
  name: string;
  error?: string;
  errorId: string;
  attempt: number;
  inputRef?: RefObject<HTMLInputElement | null>;
  disabled?: boolean;
  onChange(name: string): void;
}) {
  return (
    <label className="poem-version-field poem-version-name">
      <span>Version name</span>
      <input
        ref={inputRef}
        value={name}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-errormessage={error ? errorId : undefined}
        title={error || "Use a new, unique name to save a copy."}
        data-invalid-attempt={error ? attempt % 2 : undefined}
        autoComplete="off"
      />
    </label>
  );
}

export function PoemVersionControls({
  text,
  onLoad,
  disabled = false,
  loadSelected = true,
  onScanImported,
}: {
  text: string;
  onLoad(text: string, version: PoemVersion): void;
  disabled?: boolean;
  loadSelected?: boolean;
  onScanImported?(scan: CalligraphyScan): void;
}) {
  const {
    base,
    versions,
    setVersionId,
    ready,
    error: libraryError,
    saveVersion,
    deleteVersion,
  } = usePoemVersion();
  const [name, setName] = useState(base.label);
  const [calligrapher, setCalligrapher] = useState(
    base.calligrapher ?? "Jill Winters",
  );
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const errorId = `${id}-error`;
  const protectionId = `${id}-protected`;
  const unavailable = disabled || busy || !ready;
  const protectedOriginal = isPoemVersionId(base.id);
  const calligraphers = [
    ...new Set([
      "Jill Winters",
      ...versions.flatMap((version) =>
        version.calligrapher ? [version.calligrapher] : [],
      ),
    ]),
  ];

  // biome-ignore lint/correctness/useExhaustiveDependencies: Selecting a different version resets this form even if its display metadata matches.
  useEffect(() => {
    setName(base.label);
    setCalligrapher(base.calligrapher ?? "Jill Winters");
    setError(undefined);
    setConfirmDelete(false);
    // A completed scan selects its new poem version. Keep its result panel
    // mounted so the user can download the handwriting backup.
  }, [base.id, base.label, base.calligrapher]);

  function reject(message: string) {
    setError(message);
    setAttempt((current) => current + 1);
    setNotice("");
    nameRef.current?.focus();
  }

  function validate() {
    const message = poemVersionSaveError(
      { name, text, baseId: base.id, calligrapher },
      versions,
      base,
    );
    if (message) reject(message);
    return !message;
  }

  async function save() {
    if (!validate()) return;
    setBusy(true);
    setError(undefined);
    try {
      const saved = await saveVersion({
        name,
        text,
        baseId: base.id,
        calligrapher,
        calligraphyScanId:
          parseDraft(text).loop === base.loop
            ? base.calligraphyScanId
            : undefined,
      });
      setImporting(false);
      let notice = `Saved “${saved.label}” in this browser.`;
      try {
        onLoad(draftSource(saved), saved);
      } catch (cause) {
        notice += ` The saved wording could not be loaded into this editor: ${cause instanceof Error ? cause.message : "Please try loading it again."}`;
      }
      setNotice(notice);
    } catch (cause) {
      reject(
        cause instanceof Error
          ? cause.message
          : "This version could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (protectedOriginal) return;
    setBusy(true);
    setError(undefined);
    try {
      await deleteVersion(base.id);
      const fallback = versions.find(
        (version) => version.id === DEFAULT_POEM_VERSION_ID,
      );
      if (fallback) onLoad(draftSource(fallback), fallback);
      setConfirmDelete(false);
      setImporting(false);
      setNotice(`Deleted “${base.label}”.`);
    } catch (cause) {
      reject(
        cause instanceof Error
          ? cause.message
          : "This version could not be deleted.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function importScan(scan: CalligraphyScan) {
    const input = {
      name: scan.name,
      text: scan.text,
      baseId: base.id,
      calligrapher: scan.calligrapher,
      calligraphyScanId: scan.id,
    };
    const message = poemVersionSaveError(input, versions, base);
    if (message) throw new Error(message);
    setBusy(true);
    try {
      const saved = await saveVersion(input);
      let notice = `Saved “${saved.label}” and its calligraphy scan in this browser.`;
      try {
        onLoad(draftSource(saved), saved);
        onScanImported?.(scan);
      } catch (cause) {
        // Both records are already durable. A preview/editor failure must not
        // reject this callback and make the importer delete the linked scan.
        notice += ` The saved handwriting could not be loaded into this editor: ${cause instanceof Error ? cause.message : "Please try loading it again."}`;
      }
      setNotice(notice);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="poem-version-controls" aria-label="Poem versions">
      <div className="poem-version-fields">
        <label className="poem-version-field">
          <span>Load poem version</span>
          <select
            value={base.id}
            disabled={unavailable}
            onChange={(event) => {
              const selected = versions.find(
                (version) => version.id === event.target.value,
              );
              if (!selected) return;
              setImporting(false);
              setVersionId(selected.id);
              onLoad(draftSource(selected), selected);
              setNotice(`Loaded “${selected.label}”.`);
            }}
          >
            {versions.map((version) => (
              <option key={version.id} value={version.id}>
                {version.label} · {version.lines.length} lines
              </option>
            ))}
          </select>
        </label>
        <PoemVersionNameField
          name={name}
          error={error}
          errorId={errorId}
          attempt={attempt}
          inputRef={nameRef}
          disabled={unavailable}
          onChange={(value) => {
            setName(value);
            setError(undefined);
            setNotice("");
          }}
        />
        <label className="poem-version-field">
          <span>Calligrapher</span>
          <input
            value={calligrapher}
            disabled={unavailable}
            list={`${id}-calligraphers`}
            onChange={(event) => setCalligrapher(event.target.value)}
          />
          <datalist id={`${id}-calligraphers`}>
            {calligraphers.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>
      </div>
      <div className="poem-version-actions">
        {loadSelected && (
          <button
            type="button"
            disabled={unavailable}
            onClick={() => {
              setImporting(false);
              onLoad(draftSource(base), base);
              setNotice(`Loaded “${base.label}”.`);
            }}
          >
            Load selected wording
          </button>
        )}
        <button
          type="button"
          disabled={unavailable}
          onClick={() => void save()}
        >
          {busy ? "Working…" : "Save version"}
        </button>
        <span title={protectedOriginal ? ORIGINAL_PROTECTION : undefined}>
          <button
            type="button"
            disabled={unavailable || protectedOriginal}
            aria-describedby={protectedOriginal ? protectionId : undefined}
            onClick={() => setConfirmDelete(true)}
          >
            Delete version
          </button>
        </span>
        <button
          type="button"
          disabled={unavailable}
          aria-expanded={importing}
          onClick={() => {
            setImporting((current) => !current);
          }}
        >
          {importing ? "Close scan import" : "Import calligraphy scan"}
        </button>
      </div>
      <p className="poem-version-help">
        Save a copy under a new, unique name. Named versions stay in this
        browser.
        {protectedOriginal && (
          <span id={protectionId}> {ORIGINAL_PROTECTION}</span>
        )}
      </p>
      {error && (
        <p id={errorId} className="poem-version-error" role="alert">
          {error}
        </p>
      )}
      {libraryError && (
        <p className="poem-version-error" role="alert">
          {libraryError}
        </p>
      )}
      {notice && (
        <p className="poem-version-notice" role="status">
          {notice}
        </p>
      )}
      {confirmDelete && !protectedOriginal && (
        <fieldset
          className="poem-version-confirm"
          aria-label="Confirm version deletion"
        >
          <p>Delete “{base.label}” from this browser?</p>
          <button
            type="button"
            disabled={unavailable}
            onClick={() => void remove()}
          >
            Confirm delete
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmDelete(false)}
          >
            Cancel
          </button>
        </fieldset>
      )}
      {importing && (
        <Suspense fallback={<p role="status">Opening scan import…</p>}>
          <ScanImport
            text={text}
            name={name}
            calligrapher={calligrapher}
            validateName={(input) =>
              poemVersionSaveError(
                { ...input, baseId: base.id },
                versions,
                base,
              )
            }
            onImported={importScan}
          />
        </Suspense>
      )}
    </section>
  );
}
