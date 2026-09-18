import { useEffect, useId, useRef, useState } from "react";
import {
  type CalligraphyScan,
  type CalligraphyScanSummary,
  MAX_SCAN_TEXT_LENGTH,
  validateCalligraphyScan,
} from "../../shared/calligraphy-scan";
import {
  analyzeCalligraphyFile,
  exportCalligraphyScan,
  importCalligraphyScanBackup,
  type ScanImportPreview,
  type ScanImportSettings,
} from "../lib/calligraphy-scan-import";
import {
  deleteCalligraphyScan,
  getCalligraphyScan,
  listCalligraphyScans,
  saveCalligraphyScan,
  subscribeCalligraphyScans,
} from "../lib/calligraphy-scan-store";
import "../calligraphy-scan.css";

export interface CalligraphyScanImportProps {
  text: string;
  name: string;
  calligrapher: string;
  onImported: (scan: CalligraphyScan) => void | Promise<void>;
  validateName?: (input: {
    name: string;
    text: string;
    calligrapher: string;
  }) => string | undefined;
}

const DEFAULT_CROP = { left: 0, top: 0, right: 100, bottom: 100 };

function message(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The handwriting could not be saved.";
}

function downloadScan(scan: CalligraphyScan) {
  const url = URL.createObjectURL(exportCalligraphyScan(scan));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${scan.name.replace(/[^a-z\d-]+/giu, "-")}-handwriting.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function SavedHandwritingManager({ disabled }: { disabled: boolean }) {
  const [opened, setOpened] = useState(false);
  const [scans, setScans] = useState<CalligraphyScanSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string>();
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!opened) return;
    let active = true;
    let revision = 0;
    async function reload() {
      const current = ++revision;
      setLoading(true);
      try {
        const catalogue = await listCalligraphyScans();
        if (active && current === revision) {
          setScans(catalogue);
          setError("");
        }
      } catch (caught) {
        if (active && current === revision) setError(message(caught));
      } finally {
        if (active && current === revision) setLoading(false);
      }
    }
    void reload();
    const unsubscribe = subscribeCalligraphyScans(() => void reload());
    return () => {
      active = false;
      unsubscribe();
    };
  }, [opened]);

  async function backup(id: string) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const scan = await getCalligraphyScan(id);
      if (!scan)
        throw new Error("This handwriting is no longer in the local library.");
      if (mounted.current) {
        downloadScan(scan);
        setStatus(`Downloaded a backup of “${scan.name}”.`);
      }
    } catch (caught) {
      if (mounted.current) setError(message(caught));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function remove(id: string) {
    if (confirmId !== id) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await deleteCalligraphyScan(id);
      if (mounted.current) {
        setConfirmId(undefined);
        setStatus(
          "Removed the local handwriting face. Your poem text versions remain saved.",
        );
      }
    } catch (caught) {
      if (mounted.current) setError(message(caught));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function restore(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    setStatus("");
    setConfirmId(undefined);
    try {
      const scan = await importCalligraphyScanBackup(file);
      if (!mounted.current) return;
      await saveCalligraphyScan(scan);
      if (mounted.current)
        setStatus(
          `Restored “${scan.name}” with its original handwriting ID. Existing study links can use it again; no poem version was created.`,
        );
    } catch (caught) {
      if (mounted.current) setError(message(caught));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <details
      className="scan-library"
      onToggle={(event) => setOpened(event.currentTarget.open)}
    >
      <summary>Saved handwriting · backups and storage</summary>
      {opened && (
        <div>
          <p>
            These handwriting faces are private to this browser. Keep a JSON
            backup before removing one. The library holds up to 20 faces and 128
            MB.
          </p>
          <label>
            Restore a handwriting backup
            <input
              type="file"
              accept="application/json,.json"
              disabled={disabled || busy}
              onChange={(event) => {
                void restore(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <small>
              Restores the original face ID for existing studies. It does not
              create or change a poem text version.
            </small>
          </label>
          {loading && (
            <p role="status">Reading the local handwriting library…</p>
          )}
          {!loading && !scans.length && !error && (
            <p>No handwriting faces are saved in this browser.</p>
          )}
          <ul className="scan-library-list">
            {scans.map((scan) => (
              <li key={scan.id}>
                <strong>{scan.name}</strong>
                <small>
                  By {scan.calligrapher} · {scan.createdAt.slice(0, 10)}
                </small>
                <div className="scan-import-actions">
                  <button
                    type="button"
                    disabled={disabled || busy}
                    onClick={() => void backup(scan.id)}
                  >
                    Download backup
                  </button>
                  <button
                    type="button"
                    disabled={disabled || busy}
                    onClick={() => {
                      setConfirmId(scan.id);
                      setStatus("");
                    }}
                  >
                    Remove face…
                  </button>
                </div>
                {confirmId === scan.id && (
                  <div className="scan-remove-confirm">
                    <p>
                      Remove “{scan.name}” from this browser? Poem text versions
                      stay saved. Studies using this face will need its backup
                      restored or another lettering face selected. Public
                      gallery originals are unchanged.
                    </p>
                    <button
                      type="button"
                      disabled={disabled || busy}
                      onClick={() => void remove(scan.id)}
                    >
                      Confirm removal
                    </button>{" "}
                    <button
                      type="button"
                      disabled={disabled || busy}
                      onClick={() => setConfirmId(undefined)}
                    >
                      Keep face
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {error && (
            <p className="scan-import-error" role="alert">
              {error}
            </p>
          )}
          {status && <p role="status">{status}</p>}
        </div>
      )}
    </details>
  );
}

export function CalligraphyScanImport({
  text: initialText,
  name: initialName,
  calligrapher: initialCalligrapher,
  onImported,
  validateName,
}: CalligraphyScanImportProps) {
  const id = useId();
  const [opened, setOpened] = useState(true);
  const [text, setText] = useState(initialText);
  const [name, setName] = useState(initialName);
  const [calligrapher, setCalligrapher] = useState(initialCalligrapher);
  const [file, setFile] = useState<File>();
  const [rotation, setRotation] = useState(0);
  const [threshold, setThreshold] = useState(210);
  const [crop, setCrop] = useState(DEFAULT_CROP);
  const [manualLines, setManualLines] = useState(false);
  const [lineDividers, setLineDividers] = useState("");
  const [preview, setPreview] = useState<ScanImportPreview>();
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState("");
  const nameInput = useRef<HTMLInputElement | null>(null);
  const [saved, setSaved] = useState<CalligraphyScan>();
  const abort = useRef<AbortController | undefined>(undefined);
  const mounted = useRef(true);
  const generation = useRef(0);

  useEffect(() => {
    if (!nameError || saving) return;
    nameInput.current?.setCustomValidity(nameError);
    nameInput.current?.focus();
    nameInput.current?.reportValidity();
  }, [nameError, saving]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
      abort.current?.abort();
    };
  }, []);

  function invalidate() {
    generation.current++;
    abort.current?.abort();
    setBusy(false);
    setPreview(undefined);
    setReviewed(false);
    setError("");
    setSaved(undefined);
  }

  async function chooseFile(selected?: File) {
    invalidate();
    setFile(undefined);
    setRotation(0);
    setThreshold(210);
    setCrop(DEFAULT_CROP);
    setManualLines(false);
    setLineDividers("");
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith(".json")) {
      setFile(selected);
      return;
    }
    const current = generation.current;
    setBusy(true);
    try {
      const scan = await importCalligraphyScanBackup(selected);
      if (!mounted.current || current !== generation.current) return;
      const originalBytes = Uint8Array.from(
        atob(scan.original.dataUrl.split(",")[1] ?? ""),
        (char) => char.charCodeAt(0),
      );
      setFile(
        new File([originalBytes], scan.original.name, {
          type: scan.original.type,
        }),
      );
      setText(scan.text);
      setName(scan.name);
      setCalligrapher(scan.calligrapher);
      setPreview({
        algorithmVersion: scan.algorithmVersion,
        original: scan.original,
        image: scan.image,
        analysis: {
          segments: scan.segments,
          lines: [],
          emHeightPx: scan.emHeightPx,
          warnings: [
            "Backup restored. Review the numbered regions before saving a new copy. Adjusting the image will analyze the original again.",
          ],
        },
      });
    } catch (caught) {
      if (mounted.current && current === generation.current)
        setError(message(caught));
    } finally {
      if (mounted.current && current === generation.current) setBusy(false);
    }
  }

  async function analyze() {
    if (!file) {
      setError("Choose a photographed or scanned poem first.");
      return;
    }
    invalidate();
    if (!text.trim()) {
      setError("Enter the exact typed transcription first.");
      return;
    }
    const lineCuts = manualLines
      ? lineDividers
          .split(/[\s,]+/u)
          .filter(Boolean)
          .map(Number)
      : undefined;
    if (lineCuts?.some((cut) => !Number.isInteger(cut))) {
      setError(
        "Enter line divider positions as whole pixels, separated by commas.",
      );
      return;
    }
    const settings: ScanImportSettings = {
      text,
      rotation,
      threshold,
      crop,
      lineCuts,
    };
    const controller = new AbortController();
    abort.current = controller;
    const current = generation.current;
    setBusy(true);
    try {
      const result = await analyzeCalligraphyFile(
        file,
        settings,
        controller.signal,
      );
      if (mounted.current && current === generation.current) setPreview(result);
    } catch (caught) {
      if (
        mounted.current &&
        current === generation.current &&
        !(caught instanceof DOMException && caught.name === "AbortError")
      )
        setError(message(caught));
    } finally {
      if (mounted.current && current === generation.current) setBusy(false);
    }
  }

  async function save() {
    if (!preview || preview.analysis.error || !reviewed || saving) return;
    const invalidName = validateName?.({
      name: name.trim(),
      text,
      calligrapher: calligrapher.trim(),
    });
    if (invalidName) {
      setNameError(invalidName);
      nameInput.current?.setCustomValidity(invalidName);
      nameInput.current?.focus();
      nameInput.current?.reportValidity();
      return;
    }
    setNameError("");
    nameInput.current?.setCustomValidity("");
    setSaving(true);
    setError("");
    let storedId: string | undefined;
    try {
      const scan = validateCalligraphyScan({
        version: 1,
        id: `scan-${crypto.randomUUID()}`,
        name: name.trim(),
        calligrapher: calligrapher.trim(),
        text,
        createdAt: new Date().toISOString(),
        algorithmVersion: preview.algorithmVersion,
        original: preview.original,
        image: preview.image,
        emHeightPx: preview.analysis.emHeightPx,
        segments: preview.analysis.segments,
        confirmed: true,
      });
      await saveCalligraphyScan(scan);
      storedId = scan.id;
      if (!mounted.current) {
        await deleteCalligraphyScan(scan.id);
        return;
      }
      await onImported(scan);
      if (mounted.current) {
        setSaved(scan);
        setReviewed(false);
      }
    } catch (caught) {
      let detail = message(caught);
      if (storedId) {
        try {
          await deleteCalligraphyScan(storedId);
        } catch (cleanupError) {
          detail += ` The unused scan could not be removed: ${message(cleanupError)}`;
        }
      }
      if (mounted.current) {
        setError(detail);
        const invalid = validateName?.({
          name: name.trim(),
          text,
          calligrapher: calligrapher.trim(),
        });
        if (invalid) {
          setNameError(invalid);
          nameInput.current?.focus();
        }
      }
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  function download() {
    if (!saved) return;
    downloadScan(saved);
  }

  const regions = preview?.analysis.segments ?? [];
  return (
    <section className="scan-import">
      <button
        type="button"
        aria-expanded={opened}
        aria-controls={`${id}-panel`}
        disabled={saving}
        onClick={() => {
          if (opened) invalidate();
          setOpened(!opened);
        }}
      >
        {opened ? "Close handwriting import" : "Import handwritten poem"}
      </button>
      {opened && (
        <div id={`${id}-panel`} className="scan-import-panel">
          <p>
            Choose a PNG or JPEG photograph and type its exact words. Processing
            stays in this browser, with no AI or text recognition. Joined
            strokes and each written occurrence stay together; this face works
            only with this poem.
          </p>
          <SavedHandwritingManager disabled={saving} />
          <fieldset disabled={saving}>
            <legend>Poem and original</legend>
            <label>
              Poem name
              <input
                ref={nameInput}
                required
                maxLength={80}
                value={name}
                aria-invalid={!!nameError}
                aria-describedby={nameError ? `${id}-name-error` : undefined}
                className={nameError ? "scan-invalid" : undefined}
                title={nameError || undefined}
                onChange={(event) => {
                  setName(event.target.value);
                  setNameError("");
                  event.currentTarget.setCustomValidity("");
                  setSaved(undefined);
                }}
              />
              {nameError && (
                <span
                  id={`${id}-name-error`}
                  className="scan-import-error"
                  role="alert"
                >
                  {nameError}
                </span>
              )}
            </label>
            <label>
              Calligrapher
              <input
                required
                maxLength={80}
                list={`${id}-calligraphers`}
                value={calligrapher}
                onChange={(event) => {
                  setCalligrapher(event.target.value);
                  setSaved(undefined);
                }}
              />
            </label>
            <datalist id={`${id}-calligraphers`}>
              <option value="Jill Winters" />
            </datalist>
            <label>
              Original image or handwriting backup
              <input
                type="file"
                accept="image/png,image/jpeg,.png,.jpg,.jpeg,.json"
                onChange={(event) => {
                  void chooseFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
            <small>
              PNG/JPEG: up to 12 MB and 24 million pixels (12,000 per side).
              Original file bytes are retained in your local library and JSON
              backup. JSON backups: up to 48 MB.
            </small>
            {file && <p className="scan-file-name">{file.name}</p>}
            <label>
              Exact typed transcription
              <textarea
                required
                rows={8}
                maxLength={MAX_SCAN_TEXT_LENGTH}
                value={text}
                onChange={(event) => {
                  invalidate();
                  setText(event.target.value);
                }}
              />
            </label>
            <small>
              Match every word, capital and punctuation mark. Use one typed line
              per handwritten line; blank stanza lines are allowed. The app
              cannot verify the spelling in the photograph.
            </small>
          </fieldset>
          <fieldset disabled={saving || !file}>
            <legend>Separate ink from paper</legend>
            <div className="scan-import-adjustments">
              <label>
                Rotation (degrees)
                <input
                  type="number"
                  min={-180}
                  max={180}
                  step={0.5}
                  value={rotation}
                  onChange={(event) => {
                    invalidate();
                    setRotation(Number(event.target.value));
                  }}
                />
              </label>
              <label>
                Ink threshold
                <input
                  type="range"
                  min={30}
                  max={250}
                  value={threshold}
                  onChange={(event) => {
                    invalidate();
                    setThreshold(Number(event.target.value));
                  }}
                />
                <output>{threshold}</output>
              </label>
              {(Object.keys(crop) as Array<keyof typeof crop>).map((edge) => (
                <label key={edge}>
                  Crop {edge} (%)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={crop[edge]}
                    onChange={(event) => {
                      invalidate();
                      setCrop({ ...crop, [edge]: Number(event.target.value) });
                    }}
                  />
                </label>
              ))}
            </div>
            <small>
              Crop coordinates refer to the rotated image. Raise the threshold
              to include lighter ink; lower it to remove paper shadows. Check
              fine strokes and punctuation in the preview.
            </small>
            <label className="scan-checkbox">
              <input
                type="checkbox"
                checked={manualLines}
                onChange={(event) => {
                  invalidate();
                  setManualLines(event.target.checked);
                }}
              />
              Set line dividers manually
            </label>
            {manualLines && (
              <label>
                Divider positions from top of cropped image (pixels)
                <input
                  value={lineDividers}
                  placeholder="120, 245, 370"
                  onChange={(event) => {
                    invalidate();
                    setLineDividers(event.target.value);
                  }}
                />
                <small>
                  Use one divider between each pair of written lines. A divider
                  that crosses a connected stroke is rejected.
                </small>
              </label>
            )}
            <div className="scan-import-actions">
              <button
                type="button"
                disabled={busy || !file || !text.trim()}
                onClick={() => void analyze()}
              >
                Analyze handwriting
              </button>
              {busy && (
                <button type="button" onClick={invalidate}>
                  Cancel processing
                </button>
              )}
            </div>
          </fieldset>
          {busy && <p role="status">Processing the image locally…</p>}
          {error && (
            <p className="scan-import-error" role="alert">
              {error}
            </p>
          )}
          {preview && (
            <div className="scan-import-review">
              <p>
                Ink preview: {preview.image.width} × {preview.image.height}{" "}
                pixels. Numbers follow reading order.
              </p>
              <svg
                className="scan-import-preview"
                viewBox={`0 0 ${preview.image.width} ${preview.image.height}`}
                role="img"
                aria-label="Extracted handwriting with numbered text regions"
              >
                <title>
                  Review every handwriting region against its typed text
                </title>
                <image
                  href={preview.image.dataUrl}
                  width={preview.image.width}
                  height={preview.image.height}
                />
                {(regions.length
                  ? regions
                  : preview.analysis.lines.map((line) => ({
                      x: 0,
                      y: line.y,
                      width: preview.image.width,
                      height: line.height,
                      wordStart: line.y,
                    }))
                ).map((region, index) => (
                  <g key={`${region.wordStart}-${region.y}`}>
                    <rect
                      x={region.x}
                      y={region.y}
                      width={region.width}
                      height={region.height}
                    />
                    <text
                      x={region.x + 2}
                      y={
                        region.y +
                        Math.min(
                          region.height,
                          Math.max(12, preview.image.width / 60),
                        )
                      }
                      fontSize={Math.max(12, preview.image.width / 60)}
                    >
                      {index + 1}
                    </text>
                  </g>
                ))}
              </svg>
              <details>
                <summary>Compare with unchanged original</summary>
                <img
                  src={preview.original.dataUrl}
                  alt="The unchanged original handwriting"
                />
              </details>
              {preview.analysis.error && (
                <p className="scan-import-error" role="alert">
                  {preview.analysis.error}
                </p>
              )}
              {preview.analysis.warnings.map((warning) => (
                <p key={warning} className="scan-import-warning">
                  {warning}
                </p>
              ))}
              <ol className="scan-region-list">
                {regions.map((region) => (
                  <li key={region.wordStart}>
                    <span>{region.text}</span>
                    <small>
                      Written line {region.lineIndex + 1}
                      {region.wordEnd - region.wordStart > 1
                        ? " · kept as one joined group"
                        : ""}
                    </small>
                  </li>
                ))}
              </ol>
              <label className="scan-checkbox">
                <input
                  type="checkbox"
                  disabled={saving || !!preview.analysis.error}
                  checked={reviewed}
                  onChange={(event) => setReviewed(event.target.checked)}
                />
                I compared every numbered region with the original. The typed
                words are exact, reading order is correct, and no strokes or
                punctuation are missing.
              </label>
              <button
                type="button"
                disabled={
                  saving ||
                  !reviewed ||
                  !!preview.analysis.error ||
                  !name.trim() ||
                  !calligrapher.trim()
                }
                onClick={() => void save()}
              >
                {saving ? "Saving handwriting…" : "Save poem and handwriting"}
              </button>
            </div>
          )}
          {saved && (
            <div role="status">
              <p>
                Saved “{saved.name}” with handwriting by {saved.calligrapher} in
                this browser.
              </p>
              <button type="button" onClick={download}>
                Download handwriting backup
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
