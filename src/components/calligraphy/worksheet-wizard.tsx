import { ArrowLeft, ArrowRight, X } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  CALLIGRAPHY_JOURNEYS,
  CALLIGRAPHY_STEPS,
  type CalligraphyJourneyId,
  type CalligraphyStepId,
} from "../../../shared/calligraphy-journeys";
import {
  type CalligraphyHelpContext,
  calligraphyJourneyHelp,
} from "../../lib/calligraphy-help";
import "../../calligraphy-journeys.css";

interface WizardProps {
  guides: ReactNode;
  paper: ReactNode;
  materials: ReactNode;
  lettering: ReactNode;
  words: ReactNode;
  photo: ReactNode;
  font: ReactNode;
  knowledge: ReactNode;
  children: ReactNode;
  onExit: () => void;
  disabled?: boolean;
  initialJourney?: CalligraphyJourneyId;
  onHelpContextChange?: (context: CalligraphyHelpContext) => void;
}

type WizardSlots = Readonly<Record<CalligraphyStepId, ReactNode>>;
type WizardControl = Pick<
  HTMLInputElement,
  "checkValidity" | "closest" | "disabled" | "getClientRects" | "reportValidity"
>;

/** Report the first invalid control that is actually visible in this wizard step. */
export function reportVisibleValidity(
  controls: Iterable<WizardControl>,
): boolean {
  for (const control of controls) {
    if (
      control.disabled ||
      control.closest("[hidden]") ||
      control.getClientRects().length === 0
    ) {
      continue;
    }
    if (!control.checkValidity()) {
      control.reportValidity();
      return false;
    }
  }
  return true;
}

/** Guide the current worksheet through one setup question at a time. */
export function WorksheetWizard({
  guides,
  paper,
  materials,
  lettering,
  words,
  photo,
  font,
  knowledge,
  children,
  onExit,
  disabled,
  initialJourney,
  onHelpContextChange,
}: WizardProps): ReactNode {
  const [journeyId, setJourneyId] = useState<CalligraphyJourneyId | undefined>(
    initialJourney,
  );
  const [step, setStep] = useState(0);
  useEffect(() => {
    onHelpContextChange?.(calligraphyJourneyHelp(journeyId, step));
  }, [journeyId, step, onHelpContextChange]);
  const answer = useRef<HTMLFieldSetElement>(null);
  const focusHeading = useCallback((node: HTMLHeadingElement | null) => {
    node?.focus();
  }, []);
  const slots: WizardSlots = {
    guides,
    paper,
    materials,
    lettering,
    words,
    photo,
    font,
    knowledge,
    output: children,
  };
  const journey = CALLIGRAPHY_JOURNEYS.find(({ id }) => id === journeyId);
  const stepIds = journey?.steps ?? [];
  const currentId = stepIds[step];
  const current = currentId ? CALLIGRAPHY_STEPS[currentId] : undefined;

  if (!journey || !current) {
    return (
      <section
        className="ws-wizard ws-journey-picker"
        aria-labelledby="ws-wizard-title"
      >
        <div className="ws-wizard-top">
          <p className="ws-wizard-count">Wizard mode</p>
          <button type="button" onClick={onExit} className="ws-text-button">
            <X size={16} aria-hidden="true" /> Exit wizard
          </button>
        </div>
        <header className="ws-wizard-question">
          <h2 id="ws-wizard-title" ref={focusHeading} tabIndex={-1}>
            Choose your path
          </h2>
          <p>
            Start with the result you want. Choosing a path does not change your
            draft, and you can switch paths without losing saved work.
          </p>
        </header>
        <fieldset className="ws-journey-options">
          <legend>Calligraphy wizard paths</legend>
          {CALLIGRAPHY_JOURNEYS.map((option) => (
            <button
              type="button"
              className="ws-journey-option"
              key={option.id}
              disabled={disabled}
              onClick={() => {
                setStep(0);
                setJourneyId(option.id);
              }}
            >
              <strong>{option.label}</strong>
              <span>{option.description}</span>
              <small>{option.steps.length} focused steps</small>
            </button>
          ))}
        </fieldset>
      </section>
    );
  }

  return (
    <section
      className="ws-wizard ws-wizard-active"
      aria-labelledby="ws-wizard-title"
    >
      <div className="ws-wizard-top">
        <p className="ws-wizard-count" aria-live="polite">
          {journey.label} · Step {step + 1} of {stepIds.length}
        </p>
        <div className="ws-wizard-top-actions">
          <button
            type="button"
            onClick={() => {
              setStep(0);
              setJourneyId(undefined);
            }}
            className="ws-text-button"
          >
            Change path
          </button>
          <button type="button" onClick={onExit} className="ws-text-button">
            <X size={16} aria-hidden="true" /> Exit wizard
          </button>
        </div>
      </div>
      <ol className="ws-wizard-progress" aria-label="Setup progress">
        {stepIds.map((stepId, index) => (
          <li key={stepId} aria-current={index === step ? "step" : undefined}>
            {CALLIGRAPHY_STEPS[stepId].label}
          </li>
        ))}
      </ol>
      <header className="ws-wizard-question">
        <h2 id="ws-wizard-title" key={step} ref={focusHeading} tabIndex={-1}>
          {current.title}
        </h2>
        <p>{current.hint}</p>
      </header>
      <fieldset
        key={step}
        ref={answer}
        className="ws-wizard-answer"
        disabled={disabled}
        aria-label={current.title}
      >
        {slots[current.id]}
      </fieldset>
      <nav className="ws-wizard-navigation" aria-label="Wizard steps">
        <button
          type="button"
          className="ws-text-button"
          disabled={step === 0 || disabled}
          onClick={() => setStep((value) => Math.max(0, value - 1))}
        >
          <ArrowLeft size={17} aria-hidden="true" /> Back
        </button>
        {step < stepIds.length - 1 ? (
          <button
            type="button"
            className="ws-wizard-next"
            disabled={disabled}
            onClick={() => {
              const controls = answer.current?.querySelectorAll<
                HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
              >("input, select, textarea");
              if (controls && !reportVisibleValidity(controls)) return;
              setStep((value) => Math.min(stepIds.length - 1, value + 1));
            }}
          >
            Next: {CALLIGRAPHY_STEPS[stepIds[step + 1] ?? "output"].label}{" "}
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        ) : (
          <button type="button" className="ws-text-button" onClick={onExit}>
            Continue in full studio <ArrowRight size={17} aria-hidden="true" />
          </button>
        )}
      </nav>
      <p className="ws-hint">
        Changes use your current draft and the same browser autosave. Exit at
        any time to adjust every detail in the full studio.
      </p>
    </section>
  );
}
