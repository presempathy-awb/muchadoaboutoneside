import { Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Download,
  Eye,
  EyeOff,
  Printer,
  WandSparkles,
} from "lucide-react";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  type CalligraphyChatHandle,
  CalligraphyChatStrip,
} from "@/components/calligraphy/calligraphy-chat-strip";
import {
  type CalligraphyTool,
  CalligraphyToolBar,
  CalligraphyWorkflow,
} from "@/components/calligraphy/calligraphy-cockpit";
import {
  CalligraphyDesk,
  useStudioDeskLayout,
} from "@/components/calligraphy/calligraphy-desk";
import {
  CalligraphyDisplayControls,
  useStudioDisplay,
} from "@/components/calligraphy/calligraphy-display-controls";
import { CalligraphyKnowledgeLibrary } from "@/components/calligraphy/calligraphy-knowledge-library";
import {
  CALLIGRAPHY_SECTIONS,
  CalligraphySubnav,
} from "@/components/calligraphy/calligraphy-subnav";
import { WorksheetAccountPanel } from "@/components/calligraphy/worksheet-account-panel";
import { WorksheetFontFinish } from "@/components/calligraphy/worksheet-font-finish";
import {
  WorksheetFontGallery,
  WorksheetFontPicker,
  WorksheetFontTools,
} from "@/components/calligraphy/worksheet-font-tools";
import { WorksheetLetteringEditor } from "@/components/calligraphy/worksheet-lettering-editor";
import { WorksheetLetteringSize } from "@/components/calligraphy/worksheet-lettering-size";
import { WorksheetMaterials } from "@/components/calligraphy/worksheet-materials";
import { NumberField } from "@/components/calligraphy/worksheet-number-field";
import { WorksheetPaperControls } from "@/components/calligraphy/worksheet-paper-controls";
import { WorksheetPaperPane } from "@/components/calligraphy/worksheet-paper-pane";
import { WorksheetPaperSurface } from "@/components/calligraphy/worksheet-paper-surface";
import { WorksheetPaperZoom } from "@/components/calligraphy/worksheet-paper-zoom";
import {
  WorksheetPhotoPanel,
  type WorksheetPhotoSection,
} from "@/components/calligraphy/worksheet-photo";
import { WorksheetPreview } from "@/components/calligraphy/worksheet-preview";
import { WorksheetTechniques } from "@/components/calligraphy/worksheet-techniques";
import { WorksheetWizard } from "@/components/calligraphy/worksheet-wizard";
import { PoemVersionControls } from "@/components/poem-version-controls";
import {
  type CalligraphyHelpContext,
  calligraphyJourneyHelp,
  calligraphyToolHelp,
} from "@/lib/calligraphy-help";
import {
  createWorksheetComparisonPdf,
  createWorksheetPdf,
  importWorksheetPdf,
  validateWorksheetTextFit,
  worksheetTextPages,
} from "@/lib/worksheet-export";
import { loadWorksheetFont, type WorksheetFont } from "@/lib/worksheet-fonts";
import { WORKSHEET_GUIDES } from "@/lib/worksheet-options";
import { worksheetPhotoSizing } from "@/lib/worksheet-photo-sizing";
import { worksheetPoemExcerpt } from "@/lib/worksheet-poem-excerpt";
import {
  getWorksheetSession,
  parseWorksheetSnapshot,
  serializeWorksheetSnapshot,
  type WorksheetSession,
  type WorksheetSnapshot,
} from "@/lib/worksheet-store";
import type { CalligraphyJourneyId } from "../../shared/calligraphy-journeys";
import {
  DEFAULT_WORKSHEET_SETTINGS,
  getWorksheetLayout,
  normalizeWorksheetSettings,
  type WorksheetSettings,
} from "../../shared/worksheet";
import { WORKSHEET_FONT_CATALOG } from "../../shared/worksheet-font-catalog";
import "../worksheet-studio.css";
import "../site-guide.css";

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

export default function WorksheetStudio({
  cockpit = false,
}: {
  cockpit?: boolean;
} = {}) {
  const [session, setSession] = useState<WorksheetSession>();
  const [wizard, setWizard] = useState(false);
  const [initialJourney, setInitialJourney] = useState<CalligraphyJourneyId>();
  const display = useStudioDisplay();
  const [fittedColumns, setFittedColumns] = useState(2);
  useEffect(() => {
    if (!cockpit) return;
    document.documentElement.dataset.studioTheme = display.theme;
    return () => {
      delete document.documentElement.dataset.studioTheme;
    };
  }, [cockpit, display.theme]);
  const wizardButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setSession(getWorksheetSession());
  }, []);
  useEffect(() => {
    if (cockpit)
      void import("@/lib/worksheet-font-previews")
        .then(({ loadWorksheetFontPreview }) =>
          loadWorksheetFontPreview("great-vibes"),
        )
        .catch((error: unknown) =>
          console.warn("Wordmark font unavailable", error),
        );
  }, [cockpit]);
  return (
    <div className={`ws-studio${cockpit ? " ck-studio" : ""}`}>
      {cockpit && (
        <a className="ck-skip" href="#ck-workspace">
          Skip to your workspace
        </a>
      )}
      <header className={cockpit ? "ws-heading ck-brand-header" : "ws-heading"}>
        {cockpit ? (
          <a
            className="ws-back"
            href="https://muchadoaboutoneside.com/calligraphy"
          >
            <ArrowLeft size={16} aria-hidden="true" /> Lettering guide
          </a>
        ) : (
          <Link className="ws-back" to="/calligraphy">
            <ArrowLeft size={16} aria-hidden="true" /> Lettering guide
          </Link>
        )}
        {cockpit ? (
          <h1 className="ck-wordmark">
            Hot Goddess <em>Hot Pen</em>
          </h1>
        ) : (
          <h1>
            Calligraphy <em>practice studio.</em>
          </h1>
        )}
        <p>
          Set your guides, add words if you like, then print a sheet that feels
          right for your hand.
        </p>
        {cockpit && (
          <CalligraphyDisplayControls
            display={display}
            fittedColumns={fittedColumns}
          />
        )}
        <button
          className="ws-wizard-launch"
          type="button"
          ref={wizardButton}
          disabled={!session}
          aria-pressed={wizard}
          aria-label="Wizard quiz mode"
          aria-describedby="ws-wizard-description"
          onClick={() => {
            setInitialJourney(undefined);
            setWizard((active) => !active);
          }}
        >
          <WandSparkles size={25} aria-hidden="true" />
          <span>
            <strong>Wizard quiz mode</strong>
            <small id="ws-wizard-description">
              {wizard
                ? "Return to the full studio"
                : "One question at a time. A sheet made for you."}
            </small>
          </span>
          <ArrowRight size={22} aria-hidden="true" />
        </button>
        {!wizard && !cockpit && (
          <nav className="ws-flow-links" aria-label="Practice studio sections">
            <a href="#ws-sheet-setup">Set up your sheet</a>
            <a href="#ws-lettering">Add lettering</a>
            <a href="#ws-preview">
              Preview & download <ArrowDown size={15} aria-hidden="true" />
            </a>
          </nav>
        )}
      </header>
      {session ? (
        <StudioWorkspace
          session={session}
          cockpit={cockpit}
          wizard={wizard}
          initialJourney={initialJourney}
          onStartWizard={(journey) => {
            setInitialJourney(journey);
            setWizard(true);
          }}
          columns={display.columns}
          onColumnsFit={setFittedColumns}
          onExitWizard={() => {
            setWizard(false);
            wizardButton.current?.focus();
          }}
        />
      ) : (
        <p role="status">Opening your practice desk…</p>
      )}
      {!wizard && !cockpit && <WorksheetTechniques />}
    </div>
  );
}

function StudioWorkspace({
  session,
  cockpit,
  wizard,
  initialJourney,
  onStartWizard,
  onExitWizard,
  columns,
  onColumnsFit,
}: {
  session: WorksheetSession;
  cockpit: boolean;
  wizard: boolean;
  initialJourney: CalligraphyJourneyId | undefined;
  onStartWizard: (journey: CalligraphyJourneyId) => void;
  onExitWizard: () => void;
  columns: number;
  onColumnsFit: (columns: number) => void;
}) {
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
  const { settings, photo, customFont } = snapshot;
  const deferredText = useDeferredValue(snapshot.text);
  const deferredSnapshot = useMemo(
    () => ({
      version: 1 as const,
      settings,
      photo,
      customFont,
      text: deferredText,
    }),
    [settings, photo, customFont, deferredText],
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
  const [tool, setTool] = useState<CalligraphyTool>("paper");
  const [toolSection, setToolSection] = useState(0);
  const assistantHelp = useRef<CalligraphyChatHandle>(null);
  const [wizardHelp, setWizardHelp] = useState<CalligraphyHelpContext>(() =>
    calligraphyJourneyHelp(initialJourney),
  );
  const [photoSection, setPhotoSection] =
    useState<WorksheetPhotoSection>("reference");
  const [paperFocus, setPaperFocus] = useState(false);
  const deskLayout = useStudioDeskLayout();
  const workspace = useRef<HTMLDivElement>(null);
  const moveToTool = useRef(false);
  const [toolFocusRequest, setToolFocusRequest] = useState(0);
  const selectTool = (next: CalligraphyTool) => {
    if (next === "library") {
      next = "templates";
      setToolSection(1);
    } else if (next !== tool) setToolSection(0);
    if (next === "font") setPhotoSection("font");
    if (next === "photo") setPhotoSection("reference");
    moveToTool.current = true;
    setToolFocusRequest((current) => current + 1);
    setTool(next);
    setPaperFocus(false);
    setNotice("");
  };
  useEffect(() => {
    if (!cockpit || paperFocus || toolFocusRequest === 0 || !moveToTool.current)
      return;
    const selector = ["paper", "size", "materials"].includes(tool)
      ? ".ws-controls details:not([hidden]) > summary"
      : (
          {
            script: ".ws-font-access legend",
            words: ".ws-text-panel :is(h2,h3)",
            photo: ".ws-photo-panel > summary",
            font: ".ws-photo-panel > summary",
            templates:
              toolSection === 0
                ? ".ws-presets legend"
                : ".ws-library > summary",
            library: ".ws-library > summary",
            flow: ".ck-workflow h2",
            learn: ".ck-knowledge h2",
            help: ".ck-help-bay h2",
            output: ".ck-output-bay h2",
          } as Partial<Record<CalligraphyTool, string>>
        )[tool];
    if (selector) {
      const target = Array.from(
        workspace.current?.querySelectorAll<HTMLElement>(selector) ?? [],
      ).find((element) => !element.closest("[hidden]"));
      if (target && target.tagName !== "SUMMARY")
        target.setAttribute("tabindex", "-1");
      target?.focus({ preventScroll: true });
      target
        ?.closest(
          ".ws-controls, .ws-font-access, .ws-photo-panel, .ws-text-panel, .ws-library, .ck-output-bay, .ck-workflow, .ck-help-bay, .ck-knowledge",
        )
        ?.scrollTo({ top: 0 });
    }
    moveToTool.current = false;
  }, [cockpit, tool, toolSection, paperFocus, toolFocusRequest]);
  const [templateName, setTemplateName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [includeTemplate, setIncludeTemplate] = useState(false);
  const [pending, setPending] = useState<{
    title: string;
    label?: string;
    action: () => void;
    returnFocus?: HTMLElement | null;
  }>();
  const form = useRef<HTMLFormElement>(null);
  const letteringOptions = useRef<HTMLDetailsElement>(null);
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
        specialWords: settings.specialWords,
        specialFontId: settings.specialFontId,
      },
      text: "",
      ...(customFontName && customFontData
        ? { customFont: { name: customFontName, dataUrl: customFontData } }
        : {}),
    }),
    [
      settings.fontId,
      settings.shapingEngine,
      settings.specialWords,
      settings.specialFontId,
      customFontName,
      customFontData,
    ],
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

  async function loadPoemExcerpt() {
    const source = session.getSnapshot();
    setBusy(true);
    setError("");
    try {
      const selectedFont = await loadWorksheetFont(source);
      if (session.getSnapshot() !== source)
        throw new Error(
          "Your draft changed while preparing the poem. Try loading it again.",
        );
      const excerpt = worksheetPoemExcerpt(source, selectedFont);
      session.undo.stopCapturing();
      session.doc.transact(() => {
        session.setText(excerpt.text);
        session.updateSettings({ ...source.settings, textEnabled: true });
      });
      session.undo.stopCapturing();
      setPage(0);
      setNotice(
        `Loaded ${excerpt.lineCount} of ${excerpt.totalLines} original poem lines to fit your current sheets. Edit them beside the preview.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The poem could not be fitted to this sheet.",
      );
    } finally {
      setBusy(false);
    }
  }

  function requestPoemExcerpt() {
    if (session.getSnapshot().text)
      setPending({
        title:
          "Replace these words with a fitting poem excerpt? Undo can restore your text; save a named template to keep the whole draft.",
        action: () => {
          void loadPoemExcerpt();
        },
      });
    else void loadPoemExcerpt();
  }

  function toggleCalligraphy(textEnabled: boolean) {
    if (textEnabled && !session.getSnapshot().text) void loadPoemExcerpt();
    else update({ textEnabled });
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

  const guideChoice = WORKSHEET_GUIDES.find((preset) =>
    Object.entries(preset.settings).every(
      ([key, value]) => settings[key as keyof WorksheetSettings] === value,
    ),
  );
  const guidePresets = (
    <fieldset className="ws-presets" id="ws-sheet-setup">
      <legend>Choose a practice template</legend>
      {WORKSHEET_GUIDES.map((preset) => (
        <button
          key={preset.id}
          type="button"
          disabled={!ready || busy}
          aria-pressed={guideChoice?.id === preset.id}
          onClick={() => update(preset.settings)}
        >
          {preset.label}
          <span className="ws-preset-description">{preset.effect}</span>
        </button>
      ))}
    </fieldset>
  );
  const paperControls = (
    <WorksheetPaperControls
      settings={settings}
      layout={layout}
      onChange={update}
    />
  );
  const materials = (
    <WorksheetMaterials settings={settings} onChange={update} />
  );
  const letteringEditor = (
    <WorksheetLetteringEditor
      session={session}
      settings={settings}
      text={snapshot.text}
      onChange={update}
      disabled={!ready || busy}
      onLoadPoem={requestPoemExcerpt}
    />
  );
  const letteringSize = (
    <WorksheetLetteringSize settings={settings} font={font} onChange={update} />
  );
  const practicePattern = (
    <>
      <label className="ws-field">
        <span>Practice row pattern</span>
        <select
          value={settings.practicePattern}
          onChange={(event) =>
            update({
              practicePattern: event.target
                .value as WorksheetSettings["practicePattern"],
            })
          }
        >
          <option value="continuous">Example on every filled row</option>
          <option value="model-trace-blank">Model · faint trace · blank</option>
        </select>
      </label>
      <p className="ws-hint">
        {settings.practicePattern === "model-trace-blank"
          ? "Each example uses three rows: a model, a faint tracing copy, and a blank row for your own hand. Fewer examples fit on each sheet."
          : "Example lettering fills consecutive rows. Turn on repeat in the full studio to reuse your words across the sheets."}
      </p>
    </>
  );
  const printChecks = (
    <>
      {letteringSize}
      {model && model.warnings.length > 0 && (
        <aside className="ws-ink-warnings">
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
      <label className="ws-toggle">
        <input
          type="checkbox"
          checked={includeTemplate}
          onChange={(event) => setIncludeTemplate(event.target.checked)}
        />
        <span>Include an editable template in the PDF</span>
      </label>
      <p className="ws-hint">
        <strong>Print at 100% / Actual size</strong>, with headers and footers
        off.{" "}
        {includeTemplate
          ? "This PDF will also contain your editable text, settings, and materials notes. Photo and original font files are omitted."
          : "A normal PDF contains only what you choose to print."}
      </p>
    </>
  );
  const renderPhotoPanel = (
    initialSection: WorksheetPhotoSection = "reference",
  ) => (
    <WorksheetPhotoPanel
      cockpit={cockpit || wizard}
      section={wizard ? undefined : photoSection}
      initialSection={initialSection}
      onSectionChange={wizard ? undefined : setPhotoSection}
      onImportFont={(file) => void importFont(file)}
      onHelp={
        cockpit ? (context) => assistantHelp.current?.help(context) : undefined
      }
      onApplySuggestion={async (measurements) => {
        const source = session.getSnapshot();
        try {
          const selectedFont = await loadWorksheetFont(source);
          if (session.getSnapshot() !== source)
            throw new Error(
              "Your draft changed while matching the photo. Try applying again.",
            );
          const patch = worksheetPhotoSizing(
            source.settings,
            selectedFont,
            measurements,
          );
          if (!update(patch)) return false;
          setPage(0);
          setNotice(
            "Photo sizing applied to plain rows. Check the suggested scale with a ruler on a test print.",
          );
          return true;
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "The photo sizing could not be applied.",
          );
          return false;
        }
      }}
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
  );
  const sheetPreview = (
    <WorksheetPaperPane
      cockpit={cockpit}
      layout={layout}
      description={`${guideChoice?.label ?? "Custom guide settings"} · ${settings.textEnabled ? (settings.practicePattern === "model-trace-blank" ? "Model, trace, then write" : "Printed examples") : "No example lettering"}`}
      page={{ index: selectedPage, count: pages.length, onChange: setPage }}
    >
      {wizard && settings.textEnabled && (textFitError || overflow) && (
        <p className="ws-error" role="alert">
          {textFitError ||
            "Your words do not fit yet. Go back to adjust the text or sheet count before downloading."}
        </p>
      )}
      <div className="ws-preview-controls">
        <button
          type="button"
          className="ws-text-button ws-calligraphy-toggle"
          aria-pressed={settings.textEnabled}
          disabled={!ready || busy}
          onClick={() => toggleCalligraphy(!settings.textEnabled)}
        >
          {settings.textEnabled ? (
            <Eye size={17} aria-hidden="true" />
          ) : (
            <EyeOff size={17} aria-hidden="true" />
          )}
          Calligraphy {settings.textEnabled ? "on" : "off"}
        </button>
        <p className="ws-hint ws-preview-control-hint">
          {settings.textEnabled
            ? "Your words appear on the preview and in the PDF."
            : "Show your words on the sheet. An empty draft starts with a fitting poem excerpt."}
        </p>
      </div>
      {cockpit ? (
        <WorksheetPaperZoom
          snapshot={deferredSnapshot}
          layout={layout}
          lines={pages[selectedPage] ?? []}
          font={font}
          triggerClassName="ws-preview-mat ck-paper-trigger"
        >
          <WorksheetPreview
            snapshot={deferredSnapshot}
            layout={layout}
            lines={pages[selectedPage] ?? []}
            font={font}
          />
        </WorksheetPaperZoom>
      ) : (
        <div
          className="ws-preview-mat"
          key={`${selectedPage}-${settings.fontId}-${layout.widthMm}-${layout.heightMm}`}
        >
          <WorksheetPreview
            snapshot={deferredSnapshot}
            layout={layout}
            lines={pages[selectedPage] ?? []}
            font={font}
          />
        </div>
      )}
      <div className={cockpit ? "ck-paper-material" : undefined}>
        <WorksheetPaperSurface
          settings={settings}
          onChange={update}
          compact={cockpit}
        />
      </div>
      {!cockpit && !wizard && letteringEditor}
      {!cockpit && printChecks}
      <div className="ws-output">
        <button
          className="ws-primary"
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
          onClick={() => void exportPdf()}
        >
          <Download size={17} aria-hidden="true" />
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
          <Printer size={17} aria-hidden="true" />
          Print sheets
        </button>
        {cockpit && (
          <button
            type="button"
            onClick={() => {
              if (wizard) onExitWizard();
              selectTool("output");
            }}
          >
            Print & checks
            {model?.warnings.length ? ` · ${model.warnings.length}` : ""}
          </button>
        )}
      </div>
    </WorksheetPaperPane>
  );

  return (
    <div
      className={
        cockpit
          ? `ck-workspace${paperFocus ? " ck-paper-focus" : ""}`
          : "ws-workspace"
      }
      id={cockpit ? "ck-workspace" : undefined}
      ref={workspace}
      tabIndex={cockpit ? -1 : undefined}
    >
      <div className={cockpit ? "ck-main" : undefined}>
        {cockpit && !wizard && (
          <CalligraphyToolBar
            active={tool}
            onSelect={selectTool}
            paperFocus={paperFocus}
            onTogglePaper={() => setPaperFocus((active) => !active)}
            onCreateFont={() => {
              selectTool("font");
            }}
          />
        )}
        <div className={cockpit ? "ck-tool-workspace" : undefined}>
          <div className="ws-status-bar">
            <span
              className={`ws-storage ws-storage-${status.storage}`}
              role="status"
            >
              {status.message}
            </span>
            <span>No account needed · print at Actual size / 100%</span>
          </div>
          {!wizard && !cockpit && guidePresets}
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
                  pending.returnFocus?.focus();
                }}
              >
                {pending.label ?? "Replace draft"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPending(undefined);
                  pending.returnFocus?.focus();
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {wizard && (
            <form
              className={cockpit ? "ws-wizard-form" : undefined}
              ref={form}
              onSubmit={(event) => event.preventDefault()}
            >
              <WorksheetWizard
                initialJourney={initialJourney}
                onHelpContextChange={setWizardHelp}
                words={
                  <>
                    {letteringEditor}
                    <Toggle
                      label="Print my words on the sheet"
                      checked={settings.textEnabled}
                      onChange={toggleCalligraphy}
                    />
                    {practicePattern}
                    {letteringSize}
                  </>
                }
                photo={renderPhotoPanel()}
                font={renderPhotoPanel("font")}
                knowledge={<CalligraphyKnowledgeLibrary />}
                guides={guidePresets}
                paper={
                  <div className="ws-wizard-fields">
                    {paperControls}
                    <NumberField
                      label="Sheets to print"
                      value={settings.pageCount}
                      min={1}
                      max={20}
                      step={1}
                      onChange={(pageCount) => update({ pageCount })}
                    />
                  </div>
                }
                materials={materials}
                lettering={
                  <div className="ws-wizard-fields">
                    <Toggle
                      label="Print example text on my sheet"
                      checked={settings.textEnabled}
                      onChange={toggleCalligraphy}
                    />
                    {settings.textEnabled ? (
                      <>
                        <WorksheetFontPicker
                          settings={settings}
                          customFontName={customFontName}
                          onChange={update}
                        />
                        <WorksheetFontFinish
                          onImportFont={(file) => void importFont(file)}
                        />
                        {practicePattern}
                        {letteringSize}
                        {letteringEditor}
                        {textFitError && (
                          <p className="ws-error" role="alert">
                            {textFitError}
                          </p>
                        )}
                        {overflow && (
                          <p className="ws-error" role="alert">
                            Your words need {model?.estimate.pagesNeeded}{" "}
                            sheets. Go back to Paper to increase the sheet
                            count, or shorten your text.
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="ws-wizard-blank">
                        Just the guides, ready for your own hand. Any saved
                        words stay in your draft.
                      </p>
                    )}
                  </div>
                }
                onExit={onExitWizard}
                disabled={!ready || busy}
              >
                {sheetPreview}
              </WorksheetWizard>
            </form>
          )}
          {!wizard && (
            <CalligraphyDesk
              enabled={cockpit}
              preferredColumns={columns}
              onColumnsFit={onColumnsFit}
              layout={deskLayout}
              paperFocus={paperFocus}
              paper={sheetPreview}
              writing={letteringEditor}
              notes={
                <div className="ck-studio-notes">
                  <h2>Keep the good experiments</h2>
                  <p className="ws-hint">
                    Ink recipes, nibs, paper and what worked. These notes stay
                    with your draft and saved templates.
                  </p>
                  <label className="ws-field">
                    <span>Notes & test results</span>
                    <textarea
                      rows={10}
                      maxLength={2000}
                      value={settings.notes}
                      onChange={(event) =>
                        update({ notes: event.target.value })
                      }
                      placeholder="Mix, swatch, let dry. What would you change next time?"
                    />
                  </label>
                  <button type="button" onClick={() => selectTool("materials")}>
                    Open the mixing table
                  </button>
                </div>
              }
            >
              {(visibleColumns) => (
                <>
                  {cockpit && !paperFocus && (
                    <CalligraphySubnav
                      tool={tool}
                      selected={toolSection}
                      onSelect={setToolSection}
                    />
                  )}
                  <form
                    ref={form}
                    className="ws-controls"
                    data-tool={cockpit ? tool : undefined}
                    hidden={
                      cockpit &&
                      (!["paper", "size", "materials", "templates"].includes(
                        tool,
                      ) ||
                        (tool === "templates" && toolSection !== 0))
                    }
                    aria-label="Sheet settings"
                    onSubmit={(event) => event.preventDefault()}
                  >
                    <fieldset disabled={!ready || busy}>
                      <details
                        open
                        hidden={
                          cockpit && (tool !== "paper" || toolSection > 1)
                        }
                      >
                        <summary>Paper & spacing</summary>
                        <div className="ws-detail-body">
                          <div hidden={cockpit && toolSection !== 0}>
                            {paperControls}
                          </div>
                          <div hidden={cockpit && toolSection !== 1}>
                            <div className="ws-pair">
                              {(
                                ["Top", "Bottom", "Left", "Right"] as const
                              ).map((side) => {
                                const key = `margin${side}Mm` as const;
                                return (
                                  <NumberField
                                    key={key}
                                    label={`${side} margin (mm)`}
                                    value={settings[key]}
                                    min={0}
                                    max={200}
                                    onChange={(value) =>
                                      update({ [key]: value })
                                    }
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
                                    mode: event.target
                                      .value as WorksheetSettings["mode"],
                                  })
                                }
                              >
                                <option value="plain">
                                  Plain horizontal lines
                                </option>
                                <option value="copperplate">
                                  Copperplate zones
                                </option>
                                <option value="italic">Italic zones</option>
                                <option value="grid">Square grid</option>
                              </select>
                            </label>
                            {settings.mode === "plain" ||
                            settings.mode === "grid" ? (
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
                                    <option value="fixed">
                                      Exact distance
                                    </option>
                                  </select>
                                </label>
                                {settings.spacingMode === "count" ? (
                                  <NumberField
                                    label="Horizontal lines"
                                    value={settings.lineCount}
                                    min={2}
                                    max={100}
                                    step={1}
                                    onChange={(lineCount) =>
                                      update({ lineCount })
                                    }
                                  />
                                ) : (
                                  <NumberField
                                    label="Line spacing (mm)"
                                    value={settings.spacingMm}
                                    min={0.5}
                                    max={100}
                                    onChange={(spacingMm) =>
                                      update({ spacingMm })
                                    }
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
                                  onChange={(xHeightMm) =>
                                    update({ xHeightMm })
                                  }
                                />
                                <div className="ws-pair">
                                  <NumberField
                                    label="Upper zone × x-height"
                                    value={settings.ascenderRatio}
                                    min={0}
                                    max={5}
                                    onChange={(ascenderRatio) =>
                                      update({ ascenderRatio })
                                    }
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
                                  Each writing row has ascender, waist,
                                  baseline, and descender guides. The page fits{" "}
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
                              onChange={(calibrationMark) =>
                                update({ calibrationMark })
                              }
                            />
                          </div>
                        </div>
                      </details>
                      <details
                        open={cockpit || undefined}
                        hidden={
                          cockpit && (tool !== "paper" || toolSection !== 2)
                        }
                      >
                        <summary>Line appearance & slants</summary>
                        <div className="ws-detail-body">
                          <Toggle
                            label="Print guide lines"
                            checked={settings.guidesEnabled}
                            onChange={(guidesEnabled) =>
                              update({ guidesEnabled })
                            }
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
                              onChange={(lineWidthPt) =>
                                update({ lineWidthPt })
                              }
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
                            onChange={(slantEnabled) =>
                              update({ slantEnabled })
                            }
                          />
                          {settings.slantEnabled && (
                            <>
                              <div className="ws-pair">
                                <NumberField
                                  label="Slant from horizontal (°)"
                                  value={settings.slantAngle}
                                  min={1}
                                  max={89}
                                  onChange={(slantAngle) =>
                                    update({ slantAngle })
                                  }
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
                                  onChange={(slantWidthPt) =>
                                    update({ slantWidthPt })
                                  }
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </details>
                      <details
                        ref={letteringOptions}
                        open={cockpit || undefined}
                        hidden={cockpit && tool !== "size"}
                      >
                        <summary>Lettering size, color & details</summary>
                        <div className="ws-detail-body">
                          {cockpit && (
                            <div hidden={toolSection !== 0}>
                              {letteringSize}
                            </div>
                          )}
                          <WorksheetFontTools
                            section={
                              cockpit
                                ? (
                                    [
                                      "size",
                                      "features",
                                      "characters",
                                      "advanced",
                                    ] as const
                                  )[toolSection]
                                : undefined
                            }
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
                              session.setText(
                                `${session.getSnapshot().text}${glyph}`,
                              );
                              setNotice(
                                `Added “${glyph}” to the end of your practice text.`,
                              );
                            }}
                          />
                          <div hidden={cockpit && toolSection !== 0}>
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
                                Text opacity ·{" "}
                                {Math.round(settings.textOpacity * 100)}%
                              </span>
                              <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.05}
                                value={settings.textOpacity}
                                onChange={(event) =>
                                  update({
                                    textOpacity: Number(event.target.value),
                                  })
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
                                onChange={(letterSpacingMm) =>
                                  update({ letterSpacingMm })
                                }
                              />
                              <NumberField
                                label="Extra word gap (mm)"
                                value={settings.wordSpacingMm}
                                min={0}
                                max={100}
                                onChange={(wordSpacingMm) =>
                                  update({ wordSpacingMm })
                                }
                              />
                            </div>
                            <Toggle
                              label="Repeat text to fill the sheets"
                              checked={settings.textRepeat}
                              onChange={(textRepeat) => update({ textRepeat })}
                            />
                          </div>
                        </div>
                      </details>
                      <details
                        open={cockpit || undefined}
                        hidden={cockpit && tool !== "materials"}
                      >
                        <summary>
                          {cockpit
                            ? "At the mixing table"
                            : "Paper, ink & tools"}
                        </summary>
                        <div className="ws-detail-body">
                          <div hidden={cockpit && toolSection === 2}>
                            <WorksheetMaterials
                              settings={settings}
                              onChange={update}
                              section={
                                cockpit
                                  ? toolSection === 0
                                    ? "mixing"
                                    : "choices"
                                  : undefined
                              }
                            />
                          </div>
                          <div hidden={cockpit && toolSection !== 2}>
                            {(
                              [
                                ["paperWeight", "Paper weight / finish"],
                                ["nib", "Nib / pen"],
                                ["holder", "Holder / brush"],
                              ] as const
                            ).map(([key, label]) => (
                              <label className="ws-field" key={key}>
                                <span>{label}</span>
                                <input
                                  type="text"
                                  maxLength={120}
                                  value={settings[key]}
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
                                onChange={(event) =>
                                  update({ notes: event.target.value })
                                }
                              />
                            </label>
                            <p className="ws-hint">
                              Saved with your template. Materials notes are not
                              printed on your practice sheet.
                            </p>
                          </div>
                        </div>
                      </details>
                      {cockpit &&
                        tool === "templates" &&
                        toolSection === 0 &&
                        guidePresets}
                    </fieldset>
                  </form>
                  <div className="ws-stage">
                    <fieldset
                      className="ws-font-access"
                      hidden={cockpit && tool !== "script"}
                      id="ws-lettering"
                      disabled={!ready || busy}
                    >
                      <legend>Optional lettering</legend>
                      <p
                        className="ws-hint"
                        hidden={cockpit && toolSection === 0}
                      >
                        For a blank sheet, leave example text off. To practise
                        with a model, choose a script and add your words below.
                      </p>
                      <div
                        className="ws-font-access-row"
                        hidden={cockpit && toolSection === 0}
                      >
                        <WorksheetFontPicker
                          settings={settings}
                          customFontName={customFontName}
                          onChange={update}
                        />
                        <Toggle
                          label="Print example text"
                          checked={settings.textEnabled}
                          onChange={toggleCalligraphy}
                        />
                        <button
                          type="button"
                          className="ws-text-button"
                          onClick={() => {
                            if (cockpit) {
                              selectTool("size");
                              return;
                            }
                            if (!letteringOptions.current) return;
                            letteringOptions.current.open = true;
                            letteringOptions.current
                              .querySelector("summary")
                              ?.focus();
                          }}
                        >
                          Size, color & letterforms
                        </button>
                      </div>
                      <div hidden={cockpit && toolSection !== 0}>
                        <WorksheetFontGallery
                          initiallyOpen={cockpit}
                          selected={settings.fontId}
                          onSelect={(fontId) => update({ fontId })}
                        />
                      </div>
                      <div hidden={cockpit && toolSection !== 1}>
                        <WorksheetFontFinish
                          onImportFont={(file) => void importFont(file)}
                        />
                      </div>
                      <button
                        type="button"
                        className="ws-text-button"
                        disabled={!ready || busy}
                        onClick={() => void exportFontComparison()}
                      >
                        {busy ? "Preparing…" : "Download six-font comparison"}
                      </button>
                    </fieldset>
                    {!cockpit && sheetPreview}
                    <section
                      className="ws-text-panel"
                      aria-label="Words and poem versions"
                      hidden={cockpit && tool !== "words"}
                    >
                      {cockpit && visibleColumns < 3 && (
                        <div hidden={toolSection !== 0}>{letteringEditor}</div>
                      )}
                      {cockpit && visibleColumns >= 3 && toolSection === 0 && (
                        <div>
                          <h2>Your words, beside the paper</h2>
                          <p className="ws-hint">
                            Write in the Poem editor column. Shape the lettering
                            here, or choose Poem versions to load a different
                            source.
                          </p>
                          {letteringSize}
                          {practicePattern}
                        </div>
                      )}
                      <div hidden={cockpit && toolSection !== 1}>
                        <div className="ws-panel-heading">
                          <h2 id="ws-text-title">
                            Poem versions & source text
                          </h2>
                          <label>
                            <span className="ws-sr-only">
                              Load example text
                            </span>
                            <select
                              value=""
                              disabled={!ready}
                              onChange={(event) => {
                                const selected = event.target.value;
                                const text =
                                  selected === "alphabet"
                                    ? "abcdefghijklmnopqrstuvwxyz\nABCDEFGHIJKLMNOPQRSTUVWXYZ\n0123456789"
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
                              <option value="alphabet">
                                Alphabet & numbers
                              </option>
                              <option value="blank">Empty text</option>
                            </select>
                          </label>
                        </div>
                        <PoemVersionControls
                          text={snapshot.text}
                          disabled={!ready || busy}
                          onRequestLoad={(text, version, apply) => {
                            const action = () => {
                              session.undo.stopCapturing();
                              apply();
                              session.undo.stopCapturing();
                            };
                            if (snapshot.text && snapshot.text !== text)
                              setPending({
                                title: `Replace these words with “${version.label}”? Undo can restore your text; save a named template to keep the whole draft.`,
                                action,
                                returnFocus:
                                  workspace.current?.querySelector<HTMLElement>(
                                    ".poem-version-controls select",
                                  ),
                              });
                            else action();
                          }}
                          onLoad={(text, version) => {
                            session.setText(text);
                            setNotice(
                              `Loaded “${version.label}”. Turn on Print example text to include it on the sheet.`,
                            );
                          }}
                        />
                      </div>
                      <div className="ws-estimate">
                        {textFitError && (
                          <p className="ws-error" role="alert">
                            {textFitError}
                          </p>
                        )}
                        {model ? (
                          <>
                            <strong>
                              {model.estimate.lineCount} estimated lines ·{" "}
                              {model.estimate.pagesNeeded}{" "}
                              {model.estimate.pagesNeeded === 1
                                ? "sheet"
                                : "sheets"}
                            </strong>
                            <span>
                              {model.estimate.rowsPerPage} writing rows per
                              sheet. Manual line breaks are kept; long lines
                              wrap.
                            </span>
                            {overflow && (
                              <button
                                type="button"
                                onClick={() =>
                                  update({
                                    pageCount: Math.min(
                                      20,
                                      model.estimate.pagesNeeded,
                                    ),
                                  })
                                }
                              >
                                Set sheets to fit text
                                {model.estimate.pagesNeeded > 20
                                  ? " (20 maximum)"
                                  : ""}
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
                    <details
                      className="ws-photo-panel"
                      open={cockpit || undefined}
                      hidden={cockpit && tool !== "photo" && tool !== "font"}
                    >
                      <summary>
                        {tool === "font"
                          ? "Make your own font"
                          : "Photo reference & size calibration"}
                      </summary>
                      {renderPhotoPanel()}
                    </details>
                    <details
                      className="ws-library"
                      open
                      hidden={
                        cockpit && !(tool === "templates" && toolSection === 1)
                      }
                    >
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
                              onChange={(event) =>
                                setTemplateName(event.target.value)
                              }
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
                        <WorksheetAccountPanel
                          ready={ready}
                          getSnapshot={() => session.getSnapshot()}
                          load={(snapshot) => session.load(snapshot)}
                          keepLocalCopy={(name) => session.saveTemplate(name)}
                        />
                        <div className="ws-save-row">
                          <label className="ws-field">
                            <span>Saved in this browser</span>
                            <select
                              value={templateId}
                              onChange={(event) =>
                                setTemplateId(event.target.value)
                              }
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
                                  serializeWorksheetSnapshot(
                                    session.getSnapshot(),
                                  ),
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
                          Digital backups include your draft, settings,
                          materials notes, photo, and uploaded font. Keep them
                          private when needed. Import accepts studio JSON
                          backups and studio PDFs exported with an editable
                          template; other PDFs cannot recover these settings.
                        </p>
                        <p className="ws-hint">
                          Autosave works for every visitor in this browser.
                          Clearing site data removes browser copies; export a
                          backup to keep your work or move it to another device.
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
                    {cockpit && tool === "flow" && (
                      <CalligraphyWorkflow
                        onSelect={selectTool}
                        onStartJourney={onStartWizard}
                      />
                    )}
                    {cockpit && tool === "learn" && (
                      <CalligraphyKnowledgeLibrary />
                    )}
                    {cockpit && tool === "help" && (
                      <section className="ck-help-bay">
                        <WorksheetTechniques />
                      </section>
                    )}
                    {cockpit && tool === "output" && (
                      <section className="ck-output-bay">
                        <p className="ck-eyebrow">FINISH YOUR SHEET</p>
                        <h2>Print & checks</h2>
                        {printChecks}
                      </section>
                    )}
                  </div>
                </>
              )}
            </CalligraphyDesk>
          )}
        </div>
      </div>
      {cockpit && (
        <CalligraphyChatStrip
          ref={assistantHelp}
          helpContext={
            wizard
              ? wizardHelp
              : tool === "photo" || tool === "font"
                ? calligraphyToolHelp(
                    photoSection === "font" ? "font" : "photo",
                    {
                      reference: "Reference",
                      sizing: "Sizing",
                      font: "Create a font",
                    }[photoSection],
                  )
                : calligraphyToolHelp(
                    tool,
                    CALLIGRAPHY_SECTIONS[
                      tool as keyof typeof CALLIGRAPHY_SECTIONS
                    ]?.[toolSection],
                  )
          }
          settings={settings}
          disabled={!ready || busy}
          onApplySettings={update}
          onSelect={(next) => {
            if (wizard) onExitWizard();
            selectTool(next);
          }}
        />
      )}
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
    </div>
  );
}
