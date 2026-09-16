import { defaultKeymap } from "@codemirror/commands";
import { EditorState, Transaction } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import {
  ArrowDownToLine,
  ArrowRight,
  Copy,
  Eye,
  EyeOff,
  Redo2,
  RotateCcw,
  Undo2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";
import { keyed } from "@/lib/keyed";
import {
  type DraftSession,
  type DraftStatus,
  draftSession,
  useDraftStatus,
  useDraftText,
} from "@/lib/poem-drafts";
import { usePoemVersion } from "@/lib/poem-version";
import { longestWordEm, WORD_LIMIT_EM } from "../../shared/calligraphy-guide";
import {
  type InscriptionBudget,
  inscriptionBudget,
  MARKING_FLOOR_EM_MM,
  type SurfaceBudget,
} from "../../shared/inscription-layout";
import { parseDraft } from "../../shared/poem-drafts";
import { loopWidthEm } from "../../shared/script-metrics";
import "../foil.css";
import "../poem-editor.css";

const editorTheme = EditorView.theme({
  "&": {
    fontSize: "17px",
    backgroundColor: "transparent",
  },
  ".cm-content": {
    fontFamily: "var(--font-serif)",
    lineHeight: "1.7",
    padding: "22px 0 40px",
    caretColor: "#2f2c27",
  },
  ".cm-line": { padding: "0 26px" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { overflow: "auto" },
  ".cm-placeholder": { color: "#8f8a82" },
  ".ySelectionInfo": { fontFamily: "var(--font-sans)" },
});

interface Limits {
  loopEm: number;
  wordEm: number;
  hardLimitEm: number;
  hardLimitSurface: string;
}

function measure(text: string): Limits & { budget: InscriptionBudget } {
  const parsed = parseDraft(text);
  const loopEm = loopWidthEm(parsed.lines);
  const budget = inscriptionBudget({ loop: parsed.loop, loopWidthEm: loopEm });
  return {
    loopEm,
    wordEm: longestWordEm(parsed.lines),
    hardLimitEm: budget.hardLimitEm,
    hardLimitSurface: budget.hardLimitSurface,
    budget,
  };
}

/** Why a typed change was refused, or undefined when it is allowed. */
function entryStop(before: Limits, after: Limits): string | undefined {
  if (after.loopEm > after.hardLimitEm && after.loopEm > before.loopEm)
    return `Entry stopped: the poem is at the ${after.hardLimitSurface}'s limit of ${Math.round(after.hardLimitEm)} em. Letters at its thinnest section would fall below the ${MARKING_FLOOR_EM_MM} mm marking floor. Shorten the poem to add more.`;
  if (after.wordEm > WORD_LIMIT_EM && after.wordEm > before.wordEm)
    return `Entry stopped: a single word must fit one copperplate row (${WORD_LIMIT_EM} em, about ${Math.floor(WORD_LIMIT_EM / 0.33)} letters), because rows split only at word gaps.`;
  return undefined;
}

/** Refuses typed edits that push the wording past a hard limit; remote edits, undo, and resets pass. */
function limitGate(onStop: (reason: string) => void) {
  return EditorState.transactionFilter.of((transaction) => {
    if (
      !transaction.docChanged ||
      transaction.annotation(Transaction.userEvent) === undefined
    )
      return transaction;
    const reason = entryStop(
      measure(transaction.startState.doc.toString()),
      measure(transaction.newDoc.toString()),
    );
    if (!reason) return transaction;
    onStop(reason);
    return [];
  });
}

function SurfaceRow({
  name,
  note,
  budget,
}: {
  name: string;
  note: string;
  budget: SurfaceBudget;
}) {
  return (
    <div className={budget.fits ? undefined : "is-over"}>
      <dt>
        {name}
        <small>{note}</small>
      </dt>
      <dd>
        {budget.layout.rows} rows
        {budget.repetitions > 1 && ` × ${budget.repetitions} copies`} ·{" "}
        {budget.layout.fontSize} px em
        <small>
          letters {budget.emMmMin} mm at the thinnest section,{" "}
          {budget.emMmMedian} mm at the median · limit{" "}
          {Math.round(budget.limitEm)} em
        </small>
      </dd>
    </div>
  );
}

function storageLabel(status: DraftStatus) {
  if (status.storage === "loading") return "Opening your draft…";
  if (status.storage === "memory")
    return "Kept in memory only: this browser could not store it.";
  return "Saved in this browser and shared with its open tabs.";
}

function syncLabel(status: DraftStatus) {
  switch (status.sync) {
    case "connected":
      return status.peers === 0
        ? "Live sync on · no one else here right now"
        : `Live sync on · ${status.peers} other${status.peers === 1 ? "" : "s"} here`;
    case "connecting":
      return "Live sync · connecting…";
    case "disconnected":
      return "Live sync · reconnecting…";
    default:
      return "Live sync is off on this site; drafts stay in this browser.";
  }
}

function useUndoState(session: DraftSession) {
  const [state, setState] = useState({ canUndo: false, canRedo: false });
  useEffect(() => {
    const update = () =>
      setState({
        canUndo: session.undo.canUndo(),
        canRedo: session.undo.canRedo(),
      });
    update();
    session.undo.on("stack-item-added", update);
    session.undo.on("stack-item-popped", update);
    session.undo.on("stack-cleared", update);
    return () => {
      session.undo.off("stack-item-added", update);
      session.undo.off("stack-item-popped", update);
      session.undo.off("stack-cleared", update);
    };
  }, [session]);
  return state;
}

export default function PoemEditor() {
  const { base, versions, setVersionId, draftPreview, setDraftPreview } =
    usePoemVersion();
  const session = useMemo(() => draftSession(base), [base]);
  const text = useDraftText(session);
  const status = useDraftStatus(session);
  const undoState = useUndoState(session);
  const parsed = useMemo(() => parseDraft(text), [text]);
  const limits = useMemo(() => measure(text), [text]);
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [copied, setCopied] = useState(false);
  const [stopped, setStopped] = useState<string | null>(null);
  const previewing = draftPreview.has(base.id);
  const changed = parsed.loop !== base.loop;
  const changedLines =
    Math.max(parsed.lines.length, base.lines.length) -
    parsed.lines.filter((line, index) => line === base.lines[index]).length;

  useEffect(() => {
    let active = true;
    setReady(false);
    session.ready.then(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    const host = hostRef.current;
    if (!ready || !host) return;
    const view = new EditorView({
      state: EditorState.create({
        doc: session.text.toString(),
        extensions: [
          keymap.of([...yUndoManagerKeymap, ...defaultKeymap]),
          EditorView.lineWrapping,
          placeholder("Write the poem here, one line per verse line…"),
          editorTheme,
          limitGate(setStopped),
          yCollab(session.text, session.awareness, {
            undoManager: session.undo,
          }),
        ],
      }),
      parent: host,
    });
    return () => view.destroy();
  }, [session, ready]);

  useEffect(() => {
    if (!confirmReset) return;
    const timer = window.setTimeout(() => setConfirmReset(false), 6000);
    return () => window.clearTimeout(timer);
  }, [confirmReset]);

  useEffect(() => {
    if (!stopped) return;
    const timer = window.setTimeout(() => setStopped(null), 5000);
    return () => window.clearTimeout(timer);
  }, [stopped]);

  function download() {
    const blob = new Blob([`${base.title}\n\n${text}\n`], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `much-ado-about-one-side-${base.id}-draft.txt`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="foil-page poem-editor-page">
      <header className="foil-intro">
        <div>
          <span className="foil-kicker">
            <span /> POEM EDITOR / LIVE DRAFTS
          </span>
          <h1>
            Edit the poem, <em>version by version.</em>
          </h1>
        </div>
        <div className="foil-intro-note">
          <p>
            Each fixed wording has its own working draft. Edits are saved as you
            type, undo and redo follow the draft, and when this site relays
            drafts between browsers everyone in the room sees the same text. The
            fixed wordings in the repository only change when a draft is
            committed there.
          </p>
          <span>
            Preview a draft on the sculpture ·{" "}
            <a href="/" className="foil-brief-link">
              open the foil edition
            </a>
          </span>
        </div>
      </header>

      <div
        className="poem-editor-tabs"
        role="tablist"
        aria-label="Poem version to edit"
      >
        {versions.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === base.id}
            className={item.id === base.id ? "is-active" : undefined}
            onClick={() => setVersionId(item.id)}
          >
            <strong>{item.label}</strong>
            <small>{item.lines.length} lines</small>
          </button>
        ))}
      </div>

      <div className="poem-editor-grid">
        <section
          className="poem-editor-card"
          aria-label={`${base.label} draft`}
        >
          <div className="poem-editor-card-head">
            <span>{base.label.toUpperCase()} DRAFT</span>
            <strong>
              {changed
                ? `Differs from the fixed wording in ${changedLines} line${changedLines === 1 ? "" : "s"}`
                : "Matches the fixed wording"}
            </strong>
          </div>
          <div className="poem-editor-host" ref={hostRef}>
            {!ready && (
              <p className="poem-editor-loading" role="status">
                Opening your draft…
              </p>
            )}
          </div>
          <p
            className={`poem-editor-stop${stopped ? " is-visible" : ""}`}
            role="alert"
          >
            {stopped}
          </p>
        </section>

        <aside className="poem-editor-aside">
          <div className="poem-editor-status" role="status">
            <p>{storageLabel(status)}</p>
            <p>{syncLabel(status)}</p>
          </div>

          <div className="poem-editor-actions">
            <button
              type="button"
              onClick={() => session.undo.undo()}
              disabled={!undoState.canUndo}
            >
              <Undo2 size={15} aria-hidden="true" /> Undo
            </button>
            <button
              type="button"
              onClick={() => session.undo.redo()}
              disabled={!undoState.canRedo}
            >
              <Redo2 size={15} aria-hidden="true" /> Redo
            </button>
            <button
              type="button"
              className={previewing ? "is-active" : undefined}
              aria-pressed={previewing}
              onClick={() => setDraftPreview(base.id, !previewing)}
            >
              {previewing ? (
                <EyeOff size={15} aria-hidden="true" />
              ) : (
                <Eye size={15} aria-hidden="true" />
              )}
              {previewing
                ? "Stop previewing on site"
                : "Preview across the site"}
            </button>
            <button type="button" onClick={download}>
              <ArrowDownToLine size={15} aria-hidden="true" /> Download .txt
            </button>
            <button type="button" onClick={copy}>
              <Copy size={15} aria-hidden="true" /> {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              className={confirmReset ? "is-warn" : undefined}
              disabled={!changed && !confirmReset}
              onClick={() => {
                if (confirmReset) {
                  session.reset();
                  setConfirmReset(false);
                } else setConfirmReset(true);
              }}
            >
              <RotateCcw size={15} aria-hidden="true" />
              {confirmReset
                ? "Click again to replace the draft"
                : "Reset to fixed wording"}
            </button>
          </div>

          <dl className="poem-editor-stats">
            <div>
              <dt>Lines</dt>
              <dd>
                {parsed.lines.length}
                <small> / {base.lines.length} fixed</small>
              </dd>
            </div>
            <div>
              <dt>Stanzas</dt>
              <dd>{parsed.stanzas.length}</dd>
            </div>
            <div>
              <dt>Characters</dt>
              <dd>{parsed.loop.length}</dd>
            </div>
          </dl>

          <section
            className="poem-editor-budget"
            aria-labelledby="poem-editor-budget-title"
          >
            <h3 id="poem-editor-budget-title">Surface budget</h3>
            <p className="poem-editor-budget-lede">
              Every wording keeps the canonical glyph proportions on each
              surface; the font size and row count follow its length. Entry
              stops at the strictest large-sculpture limit.
            </p>
            <meter
              className={`poem-editor-meter${limits.loopEm > limits.hardLimitEm ? " is-over" : ""}`}
              min={0}
              max={Math.round(limits.hardLimitEm)}
              value={Math.min(
                Math.round(limits.loopEm),
                Math.round(limits.hardLimitEm),
              )}
              aria-label="Poem length against the hard limit"
            />
            <p className="poem-editor-budget-line">
              {Math.round(limits.loopEm)} em of {Math.round(limits.hardLimitEm)}{" "}
              em ({limits.hardLimitSurface} limit) ·{" "}
              {limits.loopEm > limits.hardLimitEm
                ? `over by ${Math.round(limits.loopEm - limits.hardLimitEm)} em`
                : `${Math.round(limits.hardLimitEm - limits.loopEm)} em left`}
            </p>
            <dl className="poem-editor-surfaces">
              <SurfaceRow
                name="Large body"
                note="28.8 m circuit · half-perimeter 151–1114 mm"
                budget={limits.budget.body}
              />
              <SurfaceRow
                name="Jaw"
                note="1.48 m circuit · half-perimeter 201–475 mm"
                budget={limits.budget.jaw}
              />
              <div
                className={limits.budget.maquette.fits ? undefined : "is-over"}
              >
                <dt>
                  180 mm maquette
                  <small>
                    two {limits.budget.maquette.stretchMm} mm stretches at the{" "}
                    {MARKING_FLOOR_EM_MM} mm em
                  </small>
                </dt>
                <dd>
                  {limits.budget.maquette.fits
                    ? `${limits.budget.maquette.repetitions} complete copies`
                    : "does not fit the kit as generated"}
                  <small>
                    a stretch holds{" "}
                    {Math.round(limits.budget.maquette.capacityEm)} em
                    {limits.budget.maquette.fits
                      ? ""
                      : ` · fitting this wording would need a ${limits.budget.maquette.emMmToFit} mm em`}{" "}
                    · shown, not enforced: the kit is generated for the
                    canonical wording
                  </small>
                </dd>
              </div>
              <div
                className={
                  limits.wordEm > WORD_LIMIT_EM ? "is-over" : undefined
                }
              >
                <dt>
                  Copperplate rows
                  <small>lines split at word gaps</small>
                </dt>
                <dd>
                  widest word {limits.wordEm.toFixed(1)} em of {WORD_LIMIT_EM}{" "}
                  em
                  <small>a word wider than a row cannot be written</small>
                </dd>
              </div>
            </dl>
          </section>

          <p className="poem-editor-note">
            {previewing
              ? `The site is showing this draft wherever the ${base.label.toLowerCase()} version is selected: the foil render, the reading text, and the calligraphy rows.`
              : "The site keeps showing the fixed wording until you preview the draft."}
          </p>
          <a href="/calligraphy" className="poem-editor-link">
            Calligraphy brief for the selected wording{" "}
            <ArrowRight size={14} aria-hidden="true" />
          </a>
        </aside>
      </div>

      <section
        className="foil-reading poem-editor-preview"
        aria-labelledby="poem-editor-preview-title"
      >
        <span className="foil-reading-index">
          LIVE PREVIEW · SUBSTITUTE SCRIPT
        </span>
        <h2 id="poem-editor-preview-title">{base.title}</h2>
        <div className="foil-poem">
          {keyed(parsed.stanzas.map((stanza) => stanza.join("\n"))).map(
            ({ item, key }) => (
              <p key={key}>
                {keyed(item.split("\n")).map((line) => (
                  <span key={line.key}>{line.item}</span>
                ))}
              </p>
            ),
          )}
          {parsed.lines.length === 0 && (
            <p className="poem-editor-empty">The draft is empty.</p>
          )}
        </div>
      </section>
    </div>
  );
}
