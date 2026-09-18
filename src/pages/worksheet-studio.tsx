import { Link } from "@tanstack/react-router";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { WorksheetEditor } from "@/components/calligraphy/worksheet-editor";
import { WorksheetFontTools } from "@/components/calligraphy/worksheet-font-tools";
import { WorksheetPhotoPanel } from "@/components/calligraphy/worksheet-photo";
import { WorksheetPreview } from "@/components/calligraphy/worksheet-preview";
import { WorksheetTechniques } from "@/components/calligraphy/worksheet-techniques";
import {
  createWorksheetComparisonPdf,
  createWorksheetPdf,
  importWorksheetPdf,
  validateWorksheetTextFit,
  worksheetTextPages,
} from "@/lib/worksheet-export";
import { loadWorksheetFont, type WorksheetFont } from "@/lib/worksheet-fonts";
import {
  getWorksheetSession,
  parseWorksheetSnapshot,
  serializeWorksheetSnapshot,
  type WorksheetSession,
  type WorksheetSnapshot,
} from "@/lib/worksheet-store";
import { POEM_VERSIONS } from "../../shared/poem";
import { draftSource } from "../../shared/poem-drafts";
import {
  DEFAULT_WORKSHEET_SETTINGS,
  getWorksheetLayout,
  normalizeWorksheetSettings,
  type WorksheetSettings,
} from "../../shared/worksheet";
import { WORKSHEET_FONT_CATALOG } from "../../shared/worksheet-font-catalog";
import "../worksheet-studio.css";

function NumberField({
  label,
  value,
  min,
  max,
  step = "any",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number | "any";
  onChange: (value: number) => boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setDraft(String(value));
    input.current?.setCustomValidity("");
  }, [value]);
  return (
    <label className="ws-field">
      <span>{label}</span>
      <input
        ref={input}
        type="number"
        min={min}
        max={max}
        step={step}
        required
        value={draft}
        onChange={(event) => {
          const target = event.currentTarget;
          target.setCustomValidity("");
          setDraft(target.value);
          if (
            target.value !== "" &&
            target.validity.valid &&
            !onChange(Number(target.value))
          )
            target.setCustomValidity(
              "These settings do not fit the page. Adjust this value.",
            );
        }}
        onBlur={() => {
          if (input.current && !input.current.validity.valid) {
            setDraft(String(value));
            input.current.setCustomValidity("");
          }
        }}
      />
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="ws-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function downloadBlob(content: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export default function WorksheetStudio() {
  const [session, setSession] = useState<WorksheetSession>();
  useEffect(() => {
    setSession(getWorksheetSession());
  }, []);
  return (
    <div className="ws-studio">
      <header className="ws-heading">
        <Link className="ws-back" to="/calligraphy">
          ← Lettering guide
        </Link>
        <span className="ws-kicker">Your paper. Your hand. Your pace.</span>
        <h1>
          A little structure.
          <br />
          <em>Room for your own hand.</em>
        </h1>
        <p>
          Build a calligraphy sheet, try your words, and keep what works. Start
          with 24 simple lines—or make the page entirely your own.
        </p>
      </header>
      {session ? (
        <StudioWorkspace session={session} />
      ) : (
        <p role="status">Opening your practice desk…</p>
      )}
      <WorksheetTechniques />
    </div>
  );
}

function StudioWorkspace({ session }: { session: WorksheetSession }) {
  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const status = useSyncExternalStore(
    session.subscribeStatus,
    session.getStatus,
    session.getStatus,
  );
  const { settings } = snapshot;
  const deferredText = useDeferredValue(snapshot.text);
  const deferredSnapshot = useMemo(
    () => ({ ...snapshot, text: deferredText }),
    [snapshot, deferredText],
  );
  const [loadedFont, setLoadedFont] = useState<{
    source: WorksheetSnapshot;
    font: WorksheetFont;
  }>();
  const [fontError, setFontError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const [templateName, setTemplateName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [includeTemplate, setIncludeTemplate] = useState(false);
  const [pending, setPending] = useState<{
    title: string;
    label?: string;
    action: () => void;
  }>();
  const form = useRef<HTMLFormElement>(null);
  const fontImportSequence = useRef(0);
  const needFont = Boolean(snapshot.text || settings.textEnabled);
  const customFontName = snapshot.customFont?.name;
  const customFontData = snapshot.customFont?.dataUrl;
  const fontSnapshot = useMemo(
    () => ({
      version: 1 as const,
      settings: {
        ...DEFAULT_WORKSHEET_SETTINGS,
        fontId: settings.fontId,
        shapingEngine: settings.shapingEngine,
      },
      text: "",
      ...(customFontName && customFontData
        ? { customFont: { name: customFontName, dataUrl: customFontData } }
        : {}),
    }),
    [settings.fontId, settings.shapingEngine, customFontName, customFontData],
  );
  const font =
    loadedFont?.source === fontSnapshot ? loadedFont.font : undefined;

  useEffect(() => {
    let active = true;
    setLoadedFont(undefined);
    setFontError("");
    if (needFont)
      loadWorksheetFont(fontSnapshot)
        .then((loaded) => {
          if (active) setLoadedFont({ source: fontSnapshot, font: loaded });
        })
        .catch((cause: unknown) => {
          if (active)
            setFontError(
              cause instanceof Error
                ? cause.message
                : "This font could not be loaded.",
            );
        });
    return () => {
      active = false;
    };
  }, [needFont, fontSnapshot]);

  const layout = useMemo(() => getWorksheetLayout(settings), [settings]);
  const measured = useMemo(() => {
    if (!font) return undefined;
    try {
      const model = worksheetTextPages(deferredSnapshot, font);
      let error = "";
      if (settings.textEnabled) {
        try {
          validateWorksheetTextFit(deferredSnapshot, model);
        } catch (cause) {
          error =
            cause instanceof Error
              ? cause.message
              : "The text does not fit this sheet.";
        }
      }
      return { model, error };
    } catch (cause) {
      return {
        model: undefined,
        error:
          cause instanceof Error
            ? cause.message
            : "The text could not be measured.",
      };
    }
  }, [deferredSnapshot, font, settings.textEnabled]);
  const model = measured?.model;
  const pages =
    model?.pages ??
    Array.from({ length: settings.pageCount }, () => [] as string[]);
  const selectedPage = Math.min(page, Math.max(0, pages.length - 1));
  const templates = session.listTemplates();
  const ready = status.storage !== "loading";
  const textFitError = measured?.error || fontError;
  const overflow = model?.estimate.overflow;
  const measuringText = deferredText !== snapshot.text;

  function update(patch: Partial<WorksheetSettings>) {
    try {
      const next = normalizeWorksheetSettings({
        ...session.getSnapshot().settings,
        ...patch,
      });
      getWorksheetLayout(next);
      session.updateSettings(next);
      setError("");
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Check the page settings.",
      );
      return false;
    }
  }

  function applyPreset(mode: WorksheetSettings["mode"], ratio = 1.5) {
    update(
      mode === "plain"
        ? { mode, spacingMode: "count", lineCount: 24, slantEnabled: false }
        : mode === "grid"
          ? { mode, spacingMode: "fixed", spacingMm: 5, slantEnabled: false }
          : {
              mode,
              xHeightMm: 5,
              ascenderRatio: ratio,
              descenderRatio: ratio,
              rowGapMm: 5,
              slantEnabled: true,
              slantAngle: mode === "italic" ? 80 : 55,
            },
    );
  }

  async function exportPdf() {
    if (!form.current?.reportValidity()) return;
    setBusy(true);
    setError("");
    try {
      const bytes = await createWorksheetPdf(session.getSnapshot(), {
        includeTemplate,
      });
      downloadBlob(
        bytes,
        `calligraphy-${settings.mode}-${includeTemplate ? "editable" : "print"}.pdf`,
        "application/pdf",
      );
      setNotice("Your PDF is ready. Print at Actual size / 100%.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The PDF could not be created.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function exportFontComparison() {
    if (!form.current?.reportValidity()) return;
    setBusy(true);
    setError("");
    try {
      const source = session.getSnapshot();
      const comparisonSource: WorksheetSnapshot = {
        ...source,
        settings: { ...source.settings, fontFeatures: "" },
      };
      const entries = await Promise.all(
        WORKSHEET_FONT_CATALOG.map(async (entry) => ({
          label: `${entry.name} · ${(source.settings.textXHeightMm).toFixed(1)} mm lowercase height`,
          font: await loadWorksheetFont({
            ...comparisonSource,
            settings: { ...comparisonSource.settings, fontId: entry.id },
          }),
        })),
      );
      const bytes = await createWorksheetComparisonPdf(
        comparisonSource,
        entries,
      );
      downloadBlob(
        bytes,
        "calligraphy-six-font-comparison.pdf",
        "application/pdf",
      );
      setNotice(
        "Your six-font comparison is ready. Every page uses the same physical lowercase height.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The font comparison could not be created.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function printSheets() {
    if (!form.current?.reportValidity()) return;
    if (
      settings.textEnabled &&
      (overflow || textFitError || !font || measuringText)
    ) {
      setError(
        textFitError || "Fit the text to the selected sheets before printing.",
      );
      return;
    }
    await document.fonts.ready;
    // The preview and print DOM must still describe the current draft after
    // awaiting fonts; a remote tab may have edited it in the meantime.
    if (session.getSnapshot() !== snapshot) {
      setError(
        "Your draft changed while preparing the print. Please print again.",
      );
      return;
    }
    window.print();
  }

  async function importTemplate(file?: File) {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setError("Choose a template smaller than 15 MB.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const imported = file.name.toLowerCase().endsWith(".pdf")
        ? await importWorksheetPdf(new Uint8Array(await file.arrayBuffer()))
        : parseWorksheetSnapshot(JSON.parse(await file.text()));
      setPending({
        title: `Replace this draft with “${file.name}”? Save your current draft as a named template first if you want to keep it.`,
        action: () => {
          session.load(imported);
          setNotice(
            "Template loaded. A custom font omitted from an editable PDF must be selected again.",
          );
        },
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "This file is not a valid studio template.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function importFont(file?: File) {
    if (!file) return;
    if (!/\.(ttf|otf)$/i.test(file.name) || file.size > 2 * 1024 * 1024) {
      setError("Choose a TTF or OTF font smaller than 2 MB.");
      return;
    }
    const request = ++fontImportSequence.current;
    const reader = new FileReader();
    reader.onerror = () => {
      if (request === fontImportSequence.current)
        setError("The font file could not be read.");
    };
    reader.onload = () => {
      if (request !== fontImportSequence.current) return;
      try {
        const type = /\.otf$/i.test(file.name) ? "otf" : "ttf";
        session.setCustomFont({
          name: file.name,
          // Browsers may report an empty or generic MIME type for a local font.
          // The font parser still verifies its contents before rendering.
          dataUrl: String(reader.result).replace(
            /^data:[^;]*;base64,/,
            `data:font/${type};base64,`,
          ),
        });
        update({ fontId: "custom" });
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "The font file is invalid.",
        );
      }
    };
    reader.readAsDataURL(file);
  }

  function saveNamedTemplate() {
    try {
      const name = templateName.trim();
      if (!name) {
        setError("Give this template a name first.");
        return;
      }
      const id = session.saveTemplate(name);
      setTemplateId(id);
      setNotice(
        `Created “${name}”. The save status above shows when it is stored.`,
      );
      setError("");
      void navigator.storage?.persist?.().catch(() => false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The template could not be saved.",
      );
    }
  }

  return (
    <>
      <div className="ws-status-bar">
        <span
          className={`ws-storage ws-storage-${status.storage}`}
          role="status"
        >
          {status.message}
        </span>
        <span>Private to this browser · no account needed</span>
      </div>
      <fieldset className="ws-presets">
        <legend className="ws-sr-only">Guide presets</legend>
        <button
          type="button"
          onClick={() => applyPreset("plain")}
          disabled={!ready}
        >
          24 plain lines
        </button>
        <button
          type="button"
          onClick={() => applyPreset("copperplate", 1.5)}
          disabled={!ready}
        >
          Copperplate 3:2:3
        </button>
        <button
          type="button"
          onClick={() => applyPreset("copperplate", 2)}
          disabled={!ready}
        >
          Copperplate 2:1:2
        </button>
        <button
          type="button"
          onClick={() => applyPreset("italic", 1)}
          disabled={!ready}
        >
          Italic
        </button>
        <button
          type="button"
          onClick={() => applyPreset("grid")}
          disabled={!ready}
        >
          5 mm grid
        </button>
      </fieldset>
      {error && (
        <p className="ws-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="ws-notice" role="status">
          {notice}
        </p>
      )}
      {pending && (
        <div className="ws-confirm" role="alert">
          <p>{pending.title}</p>
          <button
            type="button"
            onClick={() => {
              try {
                pending.action();
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "This action could not be completed.",
                );
              }
              setPending(undefined);
            }}
          >
            {pending.label ?? "Replace draft"}
          </button>
          <button type="button" onClick={() => setPending(undefined)}>
            Cancel
          </button>
        </div>
      )}
      <div className="ws-desk">
        <form
          ref={form}
          className="ws-controls"
          onSubmit={(event) => event.preventDefault()}
        >
          <fieldset disabled={!ready || busy}>
            <details open>
              <summary>Paper & spacing</summary>
              <div className="ws-detail-body">
                <div className="ws-pair">
                  <label className="ws-field">
                    <span>Paper size</span>
                    <select
                      value={settings.paper}
                      onChange={(event) =>
                        update({
                          paper: event.target
                            .value as WorksheetSettings["paper"],
                        })
                      }
                    >
                      <option value="letter">US Letter</option>
                      <option value="a4">A4</option>
                      <option value="a5">A5</option>
                      <option value="legal">US Legal</option>
                      <option value="custom">Custom</option>
                    </select>
                  </label>
                  <label className="ws-field">
                    <span>Orientation</span>
                    <select
                      value={settings.orientation}
                      onChange={(event) =>
                        update({
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
                      label="Paper width (mm)"
                      value={settings.customWidthMm}
                      min={50}
                      max={600}
                      onChange={(customWidthMm) => update({ customWidthMm })}
                    />
                    <NumberField
                      label="Paper height (mm)"
                      value={settings.customHeightMm}
                      min={50}
                      max={600}
                      onChange={(customHeightMm) => update({ customHeightMm })}
                    />
                  </div>
                )}
                <p className="ws-hint">
                  {layout.widthMm.toFixed(1)} × {layout.heightMm.toFixed(1)} mm
                  · {(layout.widthMm / 25.4).toFixed(2)} ×{" "}
                  {(layout.heightMm / 25.4).toFixed(2)} in
                </p>
                <div className="ws-pair">
                  {(["Top", "Bottom", "Left", "Right"] as const).map((side) => {
                    const key = `margin${side}Mm` as const;
                    return (
                      <NumberField
                        key={key}
                        label={`${side} margin (mm)`}
                        value={settings[key]}
                        min={0}
                        max={200}
                        onChange={(value) => update({ [key]: value })}
                      />
                    );
                  })}
                </div>
                <label className="ws-field">
                  <span>Guide style</span>
                  <select
                    value={settings.mode}
                    onChange={(event) =>
                      update({
                        mode: event.target.value as WorksheetSettings["mode"],
                      })
                    }
                  >
                    <option value="plain">Plain horizontal lines</option>
                    <option value="copperplate">Copperplate zones</option>
                    <option value="italic">Italic zones</option>
                    <option value="grid">Square grid</option>
                  </select>
                </label>
                {settings.mode === "plain" || settings.mode === "grid" ? (
                  <>
                    <label className="ws-field">
                      <span>Space lines by</span>
                      <select
                        value={settings.spacingMode}
                        onChange={(event) =>
                          update({
                            spacingMode: event.target
                              .value as WorksheetSettings["spacingMode"],
                          })
                        }
                      >
                        <option value="count">
                          Number of horizontal lines
                        </option>
                        <option value="fixed">Exact distance</option>
                      </select>
                    </label>
                    {settings.spacingMode === "count" ? (
                      <NumberField
                        label="Horizontal lines"
                        value={settings.lineCount}
                        min={2}
                        max={100}
                        step={1}
                        onChange={(lineCount) => update({ lineCount })}
                      />
                    ) : (
                      <NumberField
                        label="Line spacing (mm)"
                        value={settings.spacingMm}
                        min={0.5}
                        max={100}
                        onChange={(spacingMm) => update({ spacingMm })}
                      />
                    )}
                  </>
                ) : (
                  <>
                    <NumberField
                      label="X-height / letter body (mm)"
                      value={settings.xHeightMm}
                      min={0.5}
                      max={50}
                      onChange={(xHeightMm) => update({ xHeightMm })}
                    />
                    <div className="ws-pair">
                      <NumberField
                        label="Upper zone × x-height"
                        value={settings.ascenderRatio}
                        min={0}
                        max={5}
                        onChange={(ascenderRatio) => update({ ascenderRatio })}
                      />
                      <NumberField
                        label="Lower zone × x-height"
                        value={settings.descenderRatio}
                        min={0}
                        max={5}
                        onChange={(descenderRatio) =>
                          update({ descenderRatio })
                        }
                      />
                    </div>
                    <NumberField
                      label="Gap between writing rows (mm)"
                      value={settings.rowGapMm}
                      min={0}
                      max={100}
                      onChange={(rowGapMm) => update({ rowGapMm })}
                    />
                    <p className="ws-hint">
                      Each writing row has ascender, waist, baseline, and
                      descender guides. The page fits{" "}
                      {layout.baselineYsMm.length} complete rows.
                    </p>
                  </>
                )}
                <NumberField
                  label="Sheets to print"
                  value={settings.pageCount}
                  min={1}
                  max={20}
                  step={1}
                  onChange={(pageCount) => update({ pageCount })}
                />
                <Toggle
                  label="25 mm print calibration bar"
                  checked={settings.calibrationMark}
                  onChange={(calibrationMark) => update({ calibrationMark })}
                />
              </div>
            </details>
            <details>
              <summary>Line appearance & slants</summary>
              <div className="ws-detail-body">
                <Toggle
                  label="Print guide lines"
                  checked={settings.guidesEnabled}
                  onChange={(guidesEnabled) => update({ guidesEnabled })}
                />
                <div className="ws-pair">
                  <label className="ws-field">
                    <span>Guide color</span>
                    <input
                      type="color"
                      value={settings.lineColor}
                      onChange={(event) =>
                        update({ lineColor: event.target.value })
                      }
                    />
                  </label>
                  <NumberField
                    label="Line width (pt)"
                    value={settings.lineWidthPt}
                    min={0.05}
                    max={10}
                    onChange={(lineWidthPt) => update({ lineWidthPt })}
                  />
                </div>
                <label className="ws-field">
                  <span>Line pattern</span>
                  <select
                    value={settings.lineStyle}
                    onChange={(event) =>
                      update({
                        lineStyle: event.target
                          .value as WorksheetSettings["lineStyle"],
                      })
                    }
                  >
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                  </select>
                </label>
                <Toggle
                  label="Add slant guides"
                  checked={settings.slantEnabled}
                  onChange={(slantEnabled) => update({ slantEnabled })}
                />
                {settings.slantEnabled && (
                  <>
                    <div className="ws-pair">
                      <NumberField
                        label="Slant from horizontal (°)"
                        value={settings.slantAngle}
                        min={1}
                        max={89}
                        onChange={(slantAngle) => update({ slantAngle })}
                      />
                      <NumberField
                        label="Slant spacing (mm)"
                        value={settings.slantSpacingMm}
                        min={1}
                        max={100}
                        onChange={(slantSpacingMm) =>
                          update({ slantSpacingMm })
                        }
                      />
                    </div>
                    <div className="ws-pair">
                      <label className="ws-field">
                        <span>Slant color</span>
                        <input
                          type="color"
                          value={settings.slantColor}
                          onChange={(event) =>
                            update({ slantColor: event.target.value })
                          }
                        />
                      </label>
                      <NumberField
                        label="Slant width (pt)"
                        value={settings.slantWidthPt}
                        min={0.05}
                        max={10}
                        onChange={(slantWidthPt) => update({ slantWidthPt })}
                      />
                    </div>
                  </>
                )}
              </div>
            </details>
            <details>
              <summary>Example lettering</summary>
              <div className="ws-detail-body">
                <Toggle
                  label="Print example text"
                  checked={settings.textEnabled}
                  onChange={(textEnabled) => update({ textEnabled })}
                />
                <p className="ws-hint">
                  Write or load words in the box beside the page. Keep this off
                  for a blank practice sheet.
                </p>
                <WorksheetFontTools
                  settings={settings}
                  font={font}
                  customFontName={snapshot.customFont?.name}
                  onChange={(patch) => {
                    update(patch);
                  }}
                  onImportFont={(file) => {
                    void importFont(file);
                  }}
                  onInsertGlyph={(glyph) => {
                    session.setText(`${session.getSnapshot().text}${glyph}`);
                    setNotice(
                      `Added “${glyph}” to the end of your practice text.`,
                    );
                  }}
                />
                <div className="ws-pair">
                  <label className="ws-field">
                    <span>Text color</span>
                    <input
                      type="color"
                      value={settings.textColor}
                      onChange={(event) =>
                        update({ textColor: event.target.value })
                      }
                    />
                  </label>
                </div>
                <label className="ws-field">
                  <span>
                    Text opacity · {Math.round(settings.textOpacity * 100)}%
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.textOpacity}
                    onChange={(event) =>
                      update({ textOpacity: Number(event.target.value) })
                    }
                  />
                </label>
                <label className="ws-field">
                  <span>Alignment</span>
                  <select
                    value={settings.textAlign}
                    onChange={(event) =>
                      update({
                        textAlign: event.target
                          .value as WorksheetSettings["textAlign"],
                      })
                    }
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </label>
                <div className="ws-pair">
                  <NumberField
                    label="Extra letter gap (mm)"
                    value={settings.letterSpacingMm}
                    min={0}
                    max={50}
                    onChange={(letterSpacingMm) => update({ letterSpacingMm })}
                  />
                  <NumberField
                    label="Extra word gap (mm)"
                    value={settings.wordSpacingMm}
                    min={0}
                    max={100}
                    onChange={(wordSpacingMm) => update({ wordSpacingMm })}
                  />
                </div>
                <NumberField
                  label="Writing width multiplier"
                  value={settings.writingScale}
                  min={0.1}
                  max={10}
                  step={0.05}
                  onChange={(writingScale) => update({ writingScale })}
                />
                <p className="ws-hint">
                  1 = the selected font. Increase this if your handwriting runs
                  wider. This adjusts the layout estimate and the printed
                  example’s width.
                </p>
                <Toggle
                  label="Repeat text to fill the sheets"
                  checked={settings.textRepeat}
                  onChange={(textRepeat) => update({ textRepeat })}
                />
              </div>
            </details>
            <details>
              <summary>Paper, ink & tools</summary>
              <div className="ws-detail-body">
                {(
                  [
                    ["paperName", "Paper brand / type"],
                    ["paperWeight", "Paper weight / finish"],
                    ["nib", "Nib / pen"],
                    ["holder", "Holder / brush"],
                    ["ink", "Ink / color / dilution"],
                  ] as const
                ).map(([key, label]) => (
                  <label className="ws-field" key={key}>
                    <span>{label}</span>
                    <input
                      type="text"
                      maxLength={120}
                      value={settings[key]}
                      placeholder={
                        key === "paperName"
                          ? "e.g. translucent drafting vellum"
                          : undefined
                      }
                      onChange={(event) =>
                        update({ [key]: event.target.value })
                      }
                    />
                  </label>
                ))}
                <label className="ws-field">
                  <span>Notes & test results</span>
                  <textarea
                    rows={4}
                    maxLength={2000}
                    value={settings.notes}
                    placeholder="Handedness, nib angle, feathering, dry time, eraser test…"
                    onChange={(event) => update({ notes: event.target.value })}
                  />
                </label>
                <p className="ws-hint">
                  Saved with your template. Materials notes are not printed on
                  your practice sheet.
                </p>
              </div>
            </details>
          </fieldset>
        </form>
        <div className="ws-stage">
          <div className="ws-preview-top">
            <div>
              <span className="ws-kicker">Live paper preview</span>
              <strong>
                {layout.baselineYsMm.length} writing rows ·{" "}
                {layout.widthMm.toFixed(1)} × {layout.heightMm.toFixed(1)} mm
              </strong>
            </div>
            <div className="ws-page-nav">
              <button
                type="button"
                aria-label="Previous preview page"
                disabled={selectedPage === 0}
                onClick={() => setPage(selectedPage - 1)}
              >
                ←
              </button>
              <span>
                {selectedPage + 1} / {pages.length}
              </span>
              <button
                type="button"
                aria-label="Next preview page"
                disabled={selectedPage >= pages.length - 1}
                onClick={() => setPage(selectedPage + 1)}
              >
                →
              </button>
            </div>
          </div>
          <div className="ws-preview-mat">
            <WorksheetPreview
              snapshot={deferredSnapshot}
              layout={layout}
              lines={pages[selectedPage] ?? []}
              font={font}
            />
          </div>
          {model && model.warnings.length > 0 && (
            <aside className="ws-ink-warnings" aria-live="polite">
              <strong>Check the flourishes before printing</strong>
              <ul>
                {model.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </aside>
          )}
          {snapshot.photo && !snapshot.photo.print && (
            <p className="ws-hint">
              The photo is a screen reference only. It will not be printed.
            </p>
          )}
          <div className="ws-output">
            <button
              className="ws-primary"
              type="button"
              disabled={
                !ready ||
                busy ||
                (settings.textEnabled &&
                  (Boolean(textFitError) || !font || Boolean(overflow)))
              }
              onClick={() => void exportPdf()}
            >
              {busy ? "Preparing…" : "Download PDF"}
            </button>
            <button
              type="button"
              disabled={
                !ready ||
                busy ||
                (settings.textEnabled &&
                  (measuringText ||
                    Boolean(textFitError) ||
                    !font ||
                    Boolean(overflow)))
              }
              onClick={() => void printSheets()}
            >
              Print sheets
            </button>
            <button
              type="button"
              disabled={!ready || busy}
              onClick={() => void exportFontComparison()}
            >
              {busy ? "Preparing…" : "Download six-font comparison"}
            </button>
            <label className="ws-toggle">
              <input
                type="checkbox"
                checked={includeTemplate}
                onChange={(event) => setIncludeTemplate(event.target.checked)}
              />
              <span>Include an editable template in the PDF</span>
            </label>
          </div>
          <p className="ws-hint">
            Print at 100% / Actual size, with headers and footers off.{" "}
            {includeTemplate
              ? "This PDF will also contain your editable text, settings, and materials notes. Photo and original font files are omitted."
              : "A normal PDF contains only what you choose to print."}
          </p>
          <section className="ws-text-panel" aria-labelledby="ws-text-title">
            <div className="ws-panel-heading">
              <h2 id="ws-text-title">Words to practice</h2>
              <label>
                <span className="ws-sr-only">Load example text</span>
                <select
                  value=""
                  disabled={!ready}
                  onChange={(event) => {
                    const selected = event.target.value;
                    const wording = POEM_VERSIONS.find(
                      (item) => item.id === selected,
                    );
                    const text =
                      selected === "alphabet"
                        ? "abcdefghijklmnopqrstuvwxyz\nABCDEFGHIJKLMNOPQRSTUVWXYZ\n0123456789"
                        : wording
                          ? draftSource(wording)
                          : "";
                    if (!selected) return;
                    const action = () => {
                      session.setText(text);
                      setNotice(
                        "Practice text updated. Turn on Print example text to include it on the sheet.",
                      );
                    };
                    if (snapshot.text)
                      setPending({
                        title:
                          "Replace the practice text? Save a named template first to keep the current wording.",
                        action,
                      });
                    else action();
                  }}
                >
                  <option value="">Load text…</option>
                  <option value="canonical">Original poem</option>
                  <option value="extended">Extended poem</option>
                  <option value="alphabet">Alphabet & numbers</option>
                  <option value="blank">Empty text</option>
                </select>
              </label>
            </div>
            <WorksheetEditor session={session} />
            <div className="ws-estimate" aria-live="polite">
              {textFitError && <p className="ws-error">{textFitError}</p>}
              {model ? (
                <>
                  <strong>
                    {model.estimate.lineCount} estimated lines ·{" "}
                    {model.estimate.pagesNeeded}{" "}
                    {model.estimate.pagesNeeded === 1 ? "sheet" : "sheets"}
                  </strong>
                  <span>
                    {model.estimate.rowsPerPage} writing rows per sheet. Manual
                    line breaks are kept; long lines wrap.
                  </span>
                  {overflow && (
                    <button
                      type="button"
                      onClick={() =>
                        update({
                          pageCount: Math.min(20, model.estimate.pagesNeeded),
                        })
                      }
                    >
                      Set sheets to fit text
                      {model.estimate.pagesNeeded > 20 ? " (20 maximum)" : ""}
                    </button>
                  )}
                </>
              ) : !textFitError ? (
                <p>
                  {needFont
                    ? "Measuring your font…"
                    : "Add text to estimate writing lines and sheets. The editor starts empty."}
                </p>
              ) : null}
            </div>
          </section>
          <details className="ws-photo-panel">
            <summary>Photo reference & size calibration</summary>
            <WorksheetPhotoPanel
              photo={snapshot.photo}
              onChange={(photo) => {
                try {
                  session.setPhoto(photo);
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "The photo could not be saved.",
                  );
                }
              }}
              onApplyMeasurements={(values) => {
                if (update(values))
                  setNotice(
                    "Photo measurements applied. Check the physical scale with a ruler on a test print.",
                  );
              }}
            />
          </details>
          <details className="ws-library" open>
            <summary>Your saved templates</summary>
            <div className="ws-detail-body">
              <div className="ws-save-row">
                <label className="ws-field">
                  <span>New template name</span>
                  <input
                    type="text"
                    maxLength={80}
                    placeholder="e.g. vellum · blue ink · 5 mm"
                    value={templateName}
                    onChange={(event) => setTemplateName(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  disabled={!ready || busy}
                  onClick={saveNamedTemplate}
                >
                  Save a copy
                </button>
              </div>
              <div className="ws-save-row">
                <label className="ws-field">
                  <span>Saved in this browser</span>
                  <select
                    value={templateId}
                    onChange={(event) => setTemplateId(event.target.value)}
                  >
                    <option value="">Choose a template…</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!templateId || !ready || busy}
                  onClick={() => {
                    const template = templates.find(
                      (item) => item.id === templateId,
                    );
                    if (template)
                      setPending({
                        title: `Load “${template.name}” and replace this draft?`,
                        action: () => {
                          session.load(template.snapshot);
                          setTemplateName(template.name);
                        },
                      });
                  }}
                >
                  Load
                </button>
                <button
                  type="button"
                  disabled={!templateId || !ready || busy}
                  onClick={() => {
                    const template = templates.find(
                      (item) => item.id === templateId,
                    );
                    if (template)
                      setPending({
                        title: `Delete saved template “${template.name}”? Your current draft stays as it is.`,
                        label: "Delete template",
                        action: () => {
                          session.deleteTemplate(template.id);
                          setTemplateId("");
                        },
                      });
                  }}
                >
                  Delete
                </button>
              </div>
              <div className="ws-backup-actions">
                <button
                  type="button"
                  disabled={!ready}
                  onClick={() => {
                    try {
                      downloadBlob(
                        serializeWorksheetSnapshot(session.getSnapshot()),
                        "my-calligraphy.calligraphy.json",
                        "application/json",
                      );
                    } catch (cause) {
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Backup failed.",
                      );
                    }
                  }}
                >
                  Export digital backup
                </button>
                <label className="ws-file">
                  Import template / editable PDF
                  <input
                    type="file"
                    accept=".json,.pdf,application/json,application/pdf"
                    disabled={!ready || busy}
                    onChange={(event) => {
                      void importTemplate(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
              <p className="ws-hint">
                Digital backups include your draft, settings, materials notes,
                photo, and uploaded font. Keep them private when needed. Import
                accepts studio JSON backups and studio PDFs exported with an
                editable template; other PDFs cannot recover these settings.
              </p>
              <p className="ws-hint">
                Autosave works for every visitor in this browser. Clearing site
                data removes browser copies; export a backup to keep your work
                or move it to another device.
              </p>
              <button
                className="ws-text-button"
                type="button"
                onClick={() =>
                  setPending({
                    title:
                      "Start a fresh 24-line landscape sheet? Save a named template first to keep this draft.",
                    action: () =>
                      session.load({
                        version: 1,
                        settings: DEFAULT_WORKSHEET_SETTINGS,
                        text: "",
                      }),
                  })
                }
              >
                Start a fresh sheet
              </button>
            </div>
          </details>
        </div>
      </div>
      <style media="print">{`@page { size: ${layout.widthMm}mm ${layout.heightMm}mm; margin: 0; }`}</style>
      <div className="ws-print-pages" aria-hidden="true">
        {Array.from({ length: pages.length }, (_, index) => index + 1).map(
          (pageNumber) => (
            <div
              className="ws-print-sheet"
              key={pageNumber}
              style={{
                width: `${layout.widthMm}mm`,
                height: `${layout.heightMm}mm`,
              }}
            >
              <WorksheetPreview
                snapshot={deferredSnapshot}
                layout={layout}
                lines={pages[pageNumber - 1] ?? []}
                font={font}
                printed
              />
            </div>
          ),
        )}
      </div>
    </>
  );
}
