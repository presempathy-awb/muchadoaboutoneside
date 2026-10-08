import { Calculator, RotateCcw, Sparkles, WandSparkles, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { CalligraphyAssistantReply } from "../../../shared/calligraphy-assistant";
import {
  type CalligraphyRequirements,
  type CalligraphySettingsSuggestion,
  suggestCalligraphySettings,
} from "../../../shared/calligraphy-settings";
import type { WorksheetSettings } from "../../../shared/worksheet";
import { WORKSHEET_FONT_CATALOG } from "../../../shared/worksheet-font-catalog";
import {
  calligraphySettingsFingerprint,
  isCalligraphyProposalStale,
} from "../../lib/calligraphy-assistant";
import type { CalligraphyHelpContext } from "../../lib/calligraphy-help";
import {
  WORKSHEET_PAPERS,
  worksheetPaperId,
} from "../../lib/worksheet-options";
import { reportVisibleValidity } from "./worksheet-wizard";

interface WizardAnswers extends CalligraphyRequirements {
  paperId: string;
  orientation: WorksheetSettings["orientation"];
  customWidthMm: number;
  customHeightMm: number;
  fontId: WorksheetSettings["fontId"];
}

const STEP_NAMES = ["Purpose", "Paper", "Lettering", "Pen size", "Review"];

function initialAnswers(settings: WorksheetSettings): WizardAnswers {
  return {
    goal: settings.textEnabled ? "trace" : "practice",
    experience: "beginner",
    script: settings.mode === "grid" ? "keep" : settings.mode,
    nibWidthMm: null,
    xHeightMm: null,
    minMarginMm: Math.min(
      settings.marginTopMm,
      settings.marginBottomMm,
      settings.marginLeftMm,
      settings.marginRightMm,
    ),
    paperId: worksheetPaperId(settings),
    orientation: settings.orientation,
    customWidthMm: settings.customWidthMm,
    customHeightMm: settings.customHeightMm,
    fontId: settings.fontId,
  };
}

function requirementsFrom(answers: WizardAnswers): CalligraphyRequirements {
  const { goal, experience, script, nibWidthMm, xHeightMm, minMarginMm } =
    answers;
  return { goal, experience, script, nibWidthMm, xHeightMm, minMarginMm };
}

function baseSettings(
  settings: WorksheetSettings,
  answers: WizardAnswers,
): WorksheetSettings {
  const paper = WORKSHEET_PAPERS.find((entry) => entry.id === answers.paperId);
  return {
    ...settings,
    ...(paper?.settings ?? {
      paper: "custom" as const,
      customWidthMm: answers.customWidthMm,
      customHeightMm: answers.customHeightMm,
    }),
    orientation: answers.orientation,
    fontId: answers.fontId,
    ...(answers.paperId === "custom"
      ? {
          customWidthMm: answers.customWidthMm,
          customHeightMm: answers.customHeightMm,
        }
      : {}),
  };
}

function settingSummary(settings: WorksheetSettings) {
  return [
    ["Paper", `${settings.paper.toUpperCase()} · ${settings.orientation}`],
    ["Script", settings.mode],
    ["Font", settings.fontId],
    ["x-height", `${settings.xHeightMm.toFixed(1)} mm`],
    [
      "Margins",
      `${settings.marginTopMm.toFixed(1)} / ${settings.marginRightMm.toFixed(1)} / ${settings.marginBottomMm.toFixed(1)} / ${settings.marginLeftMm.toFixed(1)} mm`,
    ],
  ];
}

function changedSettings(
  current: WorksheetSettings,
  proposed: WorksheetSettings,
) {
  return (Object.keys(current) as (keyof WorksheetSettings)[])
    .filter((key) => current[key] !== proposed[key])
    .map((key) => ({
      key,
      label: key
        .replace(/Mm$/, " (mm)")
        .replace(/Pt$/, " (pt)")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/^./, (letter) => letter.toUpperCase()),
      before: formatCalligraphySettingValue(current[key]),
      after: formatCalligraphySettingValue(proposed[key]),
    }));
}

export function formatCalligraphySettingValue(
  value: WorksheetSettings[keyof WorksheetSettings],
) {
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (typeof value === "number" && Number.isFinite(value))
    return String(Number(value.toFixed(2)));
  return String(value);
}

/** Describe AI failure without claiming a formula proposal that does not exist. */
export function suggestedSettingsFailureMessage(
  aiError: string,
  hasFormulaProposal: boolean,
  formulaError: string,
): string {
  if (hasFormulaProposal) {
    return `${aiError} The formula proposal is still available to review.`;
  }
  return [formulaError, aiError].filter(Boolean).join(" ");
}

export function CalligraphySettingsWizard({
  settings,
  available,
  model,
  disabled,
  onRequestAi,
  onApply,
  onUndo,
  onCancelRequest,
  onHelp,
}: {
  settings: WorksheetSettings;
  available: boolean;
  model: string;
  disabled: boolean;
  onRequestAi: (
    requirements: CalligraphyRequirements,
    base: WorksheetSettings,
  ) => Promise<CalligraphyAssistantReply>;
  onApply: (settings: WorksheetSettings) => boolean;
  onUndo?: () => void;
  onCancelRequest?: () => void;
  onHelp?: (context: CalligraphyHelpContext) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const launch = useRef<HTMLButtonElement>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(() => initialAnswers(settings));
  const [proposal, setProposal] = useState<CalligraphySettingsSuggestion>();
  const [aiReply, setAiReply] = useState<CalligraphyAssistantReply>();
  const [baseFingerprint, setBaseFingerprint] = useState("");
  const [error, setError] = useState("");
  const [asking, setAsking] = useState(false);
  const requestGeneration = useRef(0);
  const changes = proposal ? changedSettings(settings, proposal.settings) : [];
  const stale = isCalligraphyProposalStale(baseFingerprint, settings);
  const proposedBase = useMemo(
    () => baseSettings(settings, answers),
    [settings, answers],
  );

  function visibleStepIsValid(): boolean {
    return reportVisibleValidity(
      body.current?.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >("input, select, textarea") ?? [],
    );
  }

  function open() {
    requestGeneration.current += 1;
    const fresh = initialAnswers(settings);
    setAnswers(fresh);
    setBaseFingerprint(calligraphySettingsFingerprint(settings));
    setError("");
    setProposal(undefined);
    setAiReply(undefined);
    setStep(0);
    dialog.current?.showModal();
  }

  async function openSuggested() {
    const generation = ++requestGeneration.current;
    const fresh = initialAnswers(settings);
    const base = baseSettings(settings, fresh);
    const requirements = requirementsFrom(fresh);
    setAnswers(fresh);
    setBaseFingerprint(calligraphySettingsFingerprint(settings));
    setStep(4);
    setError("");
    setAiReply(undefined);
    setProposal(undefined);
    let formula: CalligraphySettingsSuggestion | undefined;
    let formulaError = "";
    try {
      formula = suggestCalligraphySettings(base, requirements);
      setProposal(formula);
    } catch (cause) {
      formulaError =
        cause instanceof Error
          ? cause.message
          : "These settings could not be calculated.";
      setError(formulaError);
    }
    dialog.current?.showModal();
    if (!available) return;
    setAsking(true);
    try {
      const reply = await onRequestAi(requirements, base);
      if (requestGeneration.current !== generation) return;
      if (!reply.proposal)
        throw new Error("Qwen answered without a settings proposal.");
      setProposal(reply.proposal);
      setAiReply(reply);
      setError("");
    } catch (cause) {
      if (requestGeneration.current !== generation) return;
      setError(
        suggestedSettingsFailureMessage(
          cause instanceof Error
            ? cause.message
            : "Qwen could not prepare settings.",
          Boolean(formula),
          formulaError,
        ),
      );
    } finally {
      if (requestGeneration.current === generation) setAsking(false);
    }
  }

  function cancelRequest() {
    requestGeneration.current += 1;
    setAsking(false);
    onCancelRequest?.();
  }

  function close() {
    cancelRequest();
    dialog.current?.close();
  }

  function calculate() {
    if (!visibleStepIsValid()) return;
    setBaseFingerprint(calligraphySettingsFingerprint(settings));
    try {
      setAiReply(undefined);
      setProposal(
        suggestCalligraphySettings(proposedBase, requirementsFrom(answers)),
      );
      setError("");
      setStep(4);
    } catch (cause) {
      setProposal(undefined);
      setError(
        cause instanceof Error
          ? cause.message
          : "These settings could not be calculated.",
      );
    }
  }

  async function askAi() {
    if (!visibleStepIsValid()) return;
    const generation = ++requestGeneration.current;
    setBaseFingerprint(calligraphySettingsFingerprint(settings));
    setAsking(true);
    setError("");
    setAiReply(undefined);
    setProposal(undefined);
    try {
      const reply = await onRequestAi(requirementsFrom(answers), proposedBase);
      if (requestGeneration.current !== generation) return;
      if (!reply.proposal)
        throw new Error("Qwen answered without a settings proposal.");
      setProposal(reply.proposal);
      setAiReply(reply);
      setStep(4);
    } catch (cause) {
      if (requestGeneration.current !== generation) return;
      setError(
        cause instanceof Error
          ? cause.message
          : "Qwen could not prepare settings.",
      );
    } finally {
      if (requestGeneration.current === generation) setAsking(false);
    }
  }

  return (
    <div className="ck-settings-launches">
      <button
        ref={launch}
        type="button"
        disabled={disabled}
        onClick={() => void openSuggested()}
      >
        <Sparkles size={18} aria-hidden="true" />
        <span>
          <strong>Suggested settings</strong>
          <small>
            {available
              ? "Ask AI, then review every change"
              : "Review a formula-based fit"}
          </small>
        </span>
      </button>
      <button type="button" disabled={disabled} onClick={open}>
        <WandSparkles size={18} aria-hidden="true" /> Requirements wizard
      </button>
      {onUndo && (
        <button type="button" onClick={onUndo}>
          <RotateCcw size={16} aria-hidden="true" /> Undo suggestion
        </button>
      )}
      <dialog
        ref={dialog}
        className="ck-settings-dialog"
        aria-labelledby="ck-settings-title"
        onClose={() => {
          cancelRequest();
          launch.current?.focus();
        }}
      >
        <header>
          <div>
            <p>Sheet fit assistant</p>
            <h2 id="ck-settings-title">Make the page fit your hand</h2>
            {onHelp && (
              <button
                type="button"
                className="ck-inline-help"
                disabled={asking || disabled}
                onClick={() =>
                  onHelp({
                    title: `Requirements wizard · ${STEP_NAMES[step]}`,
                    instruction:
                      "Work through Purpose, Paper, Lettering and Pen size, then Review. Required values constrain the recommendation. Calculate with formulas or Ask Qwen for settings, review the proposal and choose Apply only when ready. Keep existing answers; nothing is applied by asking for help.",
                  })
                }
              >
                Help with this step
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close settings wizard"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </header>
        <ol className="ck-settings-steps" aria-label="Settings wizard progress">
          {STEP_NAMES.map((name, index) => (
            <li key={name} aria-current={step === index ? "step" : undefined}>
              {index + 1}. {name}
            </li>
          ))}
        </ol>
        <div ref={body} className="ck-settings-body">
          <fieldset hidden={step !== 0}>
            <legend>What are you making?</legend>
            <label>
              Goal
              <select
                value={answers.goal}
                onChange={(event) =>
                  setAnswers({
                    ...answers,
                    goal: event.target.value as WizardAnswers["goal"],
                  })
                }
              >
                <option value="practice">Blank practice guides</option>
                <option value="trace">Model, trace, then write</option>
                <option value="poem">A poem or finished piece</option>
              </select>
            </label>
            <label>
              Experience
              <select
                value={answers.experience}
                onChange={(event) =>
                  setAnswers({
                    ...answers,
                    experience: event.target
                      .value as WizardAnswers["experience"],
                  })
                }
              >
                <option value="beginner">Beginner · more room</option>
                <option value="comfortable">
                  Comfortable · a tighter page
                </option>
              </select>
            </label>
          </fieldset>
          <fieldset hidden={step !== 1}>
            <legend>Choose the physical page</legend>
            <label>
              Paper
              <select
                value={answers.paperId}
                onChange={(event) =>
                  setAnswers({ ...answers, paperId: event.target.value })
                }
              >
                {WORKSHEET_PAPERS.map((paper) => (
                  <option key={paper.id} value={paper.id}>
                    {paper.label} · {paper.widthMm} × {paper.heightMm} mm
                  </option>
                ))}
                <option value="custom">Custom size</option>
              </select>
            </label>
            <label>
              Orientation
              <select
                value={answers.orientation}
                onChange={(event) =>
                  setAnswers({
                    ...answers,
                    orientation: event.target
                      .value as WorksheetSettings["orientation"],
                  })
                }
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </label>
            {answers.paperId === "custom" && (
              <div className="ck-settings-pair">
                <label>
                  Width (mm)
                  <input
                    type="number"
                    min="50"
                    max="600"
                    step="any"
                    required
                    value={answers.customWidthMm}
                    onChange={(event) =>
                      setAnswers({
                        ...answers,
                        customWidthMm: event.currentTarget.valueAsNumber,
                      })
                    }
                  />
                </label>
                <label>
                  Height (mm)
                  <input
                    type="number"
                    min="50"
                    max="600"
                    step="any"
                    required
                    value={answers.customHeightMm}
                    onChange={(event) =>
                      setAnswers({
                        ...answers,
                        customHeightMm: event.currentTarget.valueAsNumber,
                      })
                    }
                  />
                </label>
              </div>
            )}
            <label>
              Minimum margin (mm)
              <input
                type="number"
                min="0"
                max="200"
                step="any"
                required
                value={answers.minMarginMm}
                onChange={(event) =>
                  setAnswers({
                    ...answers,
                    minMarginMm: event.currentTarget.valueAsNumber,
                  })
                }
              />
            </label>
          </fieldset>
          <fieldset hidden={step !== 2}>
            <legend>Choose the lettering</legend>
            <label>
              Guide script
              <select
                value={answers.script}
                onChange={(event) =>
                  setAnswers({
                    ...answers,
                    script: event.target.value as WizardAnswers["script"],
                  })
                }
              >
                <option value="keep">Keep current guides</option>
                <option value="plain">Plain lines</option>
                <option value="copperplate">Copperplate</option>
                <option value="italic">Italic</option>
              </select>
            </label>
            <label>
              Example font
              <select
                value={answers.fontId}
                onChange={(event) =>
                  setAnswers({
                    ...answers,
                    fontId: event.target.value as WorksheetSettings["fontId"],
                  })
                }
              >
                {WORKSHEET_FONT_CATALOG.map((font) => (
                  <option key={font.id} value={font.id}>
                    {font.name}
                  </option>
                ))}
                <option value="serif">Serif</option>
                <option value="sans">Sans</option>
                <option value="mono">Monospace</option>
                {settings.fontId === "custom" && (
                  <option value="custom">Current custom font</option>
                )}
              </select>
            </label>
          </fieldset>
          <fieldset hidden={step !== 3}>
            <legend>Size the hand</legend>
            <label>
              Nib width (mm, optional)
              <input
                type="number"
                min="0.1"
                max="10"
                step="any"
                value={answers.nibWidthMm ?? ""}
                onChange={(event) =>
                  setAnswers({
                    ...answers,
                    nibWidthMm: event.target.value
                      ? event.currentTarget.valueAsNumber
                      : null,
                  })
                }
              />
            </label>
            <label>
              Required x-height (mm, optional)
              <input
                type="number"
                min="0.5"
                max="50"
                step="any"
                value={answers.xHeightMm ?? ""}
                placeholder={`Current: ${settings.xHeightMm}`}
                onChange={(event) =>
                  setAnswers({
                    ...answers,
                    xHeightMm: event.target.value
                      ? event.currentTarget.valueAsNumber
                      : null,
                  })
                }
              />
            </label>
            <p>
              Italic can start at five broad-edge nib widths. Pointed-pen
              proportions use x-height directly.
            </p>
          </fieldset>
          <section hidden={step !== 4} aria-label="Settings proposal">
            <h3>Review before applying</h3>
            {proposal ? (
              <>
                <div className="ck-settings-compare">
                  <section>
                    <h4>Current</h4>
                    <dl>
                      {settingSummary(settings).map(([name, value]) => (
                        <div key={name}>
                          <dt>{name}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                  <section>
                    <h4>Proposed</h4>
                    <dl>
                      {settingSummary(proposal.settings).map(
                        ([name, value]) => (
                          <div key={name}>
                            <dt>{name}</dt>
                            <dd>{value}</dd>
                          </div>
                        ),
                      )}
                    </dl>
                  </section>
                </div>
                <p className="ck-settings-math">
                  {proposal.calculations.rowsPerPage} rows ·{" "}
                  {proposal.calculations.xHeightMm.toFixed(1)} mm x-height ·{" "}
                  {proposal.calculations.rowPitchMm.toFixed(1)} mm row pitch
                </p>
                <details className="ck-settings-all-changes" open>
                  <summary>All proposed changes · {changes.length}</summary>
                  {changes.length > 0 ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Setting</th>
                          <th>Current</th>
                          <th>Proposed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {changes.map((change) => (
                          <tr key={change.key}>
                            <th>{change.label}</th>
                            <td>{change.before}</td>
                            <td>{change.after}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p>The calculated proposal keeps every current setting.</p>
                  )}
                </details>
                {aiReply && (
                  <section className="ck-settings-ai-note">
                    <h4>Calculated fit</h4>
                    <p className="ck-settings-ai-answer">{aiReply.answer}</p>
                    {aiReply.warnings.length > 0 && (
                      <ul>
                        {aiReply.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    )}
                    {aiReply.sources.length > 0 && (
                      <p className="ck-settings-ai-sources">
                        Sources:{" "}
                        {aiReply.sources.map((source, index) => (
                          <span key={source.id}>
                            {index > 0 ? " · " : ""}
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {source.title}
                              <span className="sr-only">
                                {" "}
                                (opens in a new tab)
                              </span>
                            </a>
                          </span>
                        ))}
                      </p>
                    )}
                  </section>
                )}
                <ul>
                  {proposal.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                {proposal.warnings.length > 0 && (
                  <aside>
                    <strong>Check before printing</strong>
                    <ul>
                      {proposal.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </aside>
                )}
              </>
            ) : (
              <p>Answer the questions, then calculate a proposal.</p>
            )}
          </section>
          {stale && (
            <p className="ws-error" role="alert">
              The sheet changed after this proposal was made. Recalculate so no
              newer edits are replaced.
            </p>
          )}
          {error && (
            <p className="ws-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer>
          <button
            type="button"
            disabled={step === 0 || asking}
            onClick={() => setStep((value) => value - 1)}
          >
            Back
          </button>
          {step < 3 && (
            <button
              className="ws-primary"
              type="button"
              onClick={() => {
                if (visibleStepIsValid()) setStep((value) => value + 1);
              }}
            >
              Next
            </button>
          )}
          <button
            type="button"
            hidden={step < 3}
            disabled={asking}
            onClick={calculate}
          >
            <Calculator size={17} aria-hidden="true" /> Calculate without AI
          </button>
          <button type="button" hidden={!asking} onClick={cancelRequest}>
            Cancel request
          </button>
          <button
            type="button"
            hidden={step < 3}
            disabled={!available || asking}
            onClick={() => void askAi()}
          >
            <Sparkles size={17} aria-hidden="true" />{" "}
            {asking
              ? "Asking Qwen…"
              : `Ask ${/27/i.test(model) ? "Qwen 27" : model || "Qwen"}`}
          </button>
          <button
            className="ws-primary"
            type="button"
            hidden={step !== 4}
            disabled={!proposal || stale || disabled || asking}
            onClick={() => {
              if (proposal && onApply(proposal.settings)) close();
            }}
          >
            Apply these settings
          </button>
        </footer>
      </dialog>
    </div>
  );
}
