import {
  ArrowLeft,
  ArrowRight,
  FileType2,
  ImageUp,
  LifeBuoy,
  WandSparkles,
} from "lucide-react";
import { type JSX, type ReactNode, useEffect, useRef, useState } from "react";
import type { CalligraphyHelpContext } from "../../lib/calligraphy-help";
import { WorksheetFontFinish } from "./worksheet-font-finish";

const steps = ["reference", "sizing", "rounds", "font"] as const;
type FontCreatorStep = (typeof steps)[number];

const stepLabels: Record<FontCreatorStep, string> = {
  reference: "Choose a sample",
  sizing: "Set its scale",
  rounds: "Shape letters",
  font: "Build your font",
};

const stepHelp: Record<FontCreatorStep, string> = {
  reference:
    "Upload a clear, straight-on PNG, JPEG or WebP with a ruler in the writing plane. Use Review reference to check placement. Help chat does not receive the image.",
  sizing:
    "Open sizing tools. Mark two ruler points and enter their known distance, then measure a representative lowercase height. Check calibration before asking for AI sizing.",
  rounds:
    "Choose an available registered model profile, a printable character and a bounded round count. Review each proposed glyph. A missing profile means letter generation is not available yet.",
  font: "Review the complete alphabet. Import approved SVGs into FontForge, align metrics and spacing, proof cursive joins and ligatures, then validate and export TTF/OTF. Use Import finished TTF / OTF to bring it back. Calligraphr is an alternative using its own marked template. Assembly happens outside the studio.",
};

interface WorksheetFontCreatorProps {
  hasPhoto: boolean;
  isCalibrated: boolean;
  onOpenReference: () => void;
  onOpenSizing: () => void;
  onImportFont?: (file?: File) => void;
  photoUpload: ReactNode;
  letterRounds: ReactNode;
  onHelp?: (context: CalligraphyHelpContext) => void;
}

/** Guide one uploaded handwriting sample into bounded letter rounds and a font handoff. */
export function WorksheetFontCreator({
  hasPhoto,
  isCalibrated,
  onOpenReference,
  onOpenSizing,
  onImportFont,
  photoUpload,
  letterRounds,
  onHelp,
}: WorksheetFontCreatorProps): JSX.Element {
  const [step, setStep] = useState<FontCreatorStep>("reference");
  const nextHeading = useRef<FontCreatorStep | undefined>(undefined);
  const headings = useRef<Partial<Record<FontCreatorStep, HTMLHeadingElement>>>(
    {},
  );

  useEffect(() => {
    if (nextHeading.current !== step) return;
    nextHeading.current = undefined;
    headings.current[step]?.focus();
  }, [step]);

  function moveTo(next: FontCreatorStep): void {
    nextHeading.current = next;
    setStep(next);
  }

  const index = steps.indexOf(step);

  return (
    <section
      className="ck-font-wizard ws-font-creator"
      aria-labelledby="ws-font-creator-title"
    >
      <header>
        <WandSparkles size={22} aria-hidden="true" />
        <div>
          <h3 id="ws-font-creator-title">Create a font from a photo</h3>
          <p>
            Work through one decision at a time. Your uploaded sample, sizing,
            and letter-round request stay in place while you move between steps.
          </p>
        </div>
      </header>

      {onHelp && (
        <button
          type="button"
          className="ck-inline-help"
          onClick={() =>
            onHelp({
              tool: "font",
              title: `Make your own font · ${stepLabels[step]}`,
              instruction: stepHelp[step],
            })
          }
        >
          <LifeBuoy size={17} aria-hidden="true" /> Help with this step
        </button>
      )}

      <nav
        className="ck-subnav ws-font-creator__steps"
        aria-label="Font creator steps"
      >
        {steps.map((entry, position) => (
          <button
            type="button"
            key={entry}
            aria-current={step === entry ? "step" : undefined}
            onClick={() => moveTo(entry)}
          >
            <span aria-hidden="true">{position + 1}</span>
            {stepLabels[entry]}
          </button>
        ))}
      </nav>

      <section
        hidden={step !== "reference"}
        aria-labelledby="ws-font-step-reference"
      >
        <h4
          id="ws-font-step-reference"
          ref={(node) => {
            if (node) headings.current.reference = node;
          }}
          tabIndex={-1}
        >
          <ImageUp size={20} aria-hidden="true" /> Choose a clear sample
        </h4>
        <p>
          Use one straight-on PNG, JPEG, or WebP with a ruler in the same plane
          as the writing. The same prepared image supports reference, sizing,
          and optional letter rounds.
        </p>
        {photoUpload}
        <p className="ws-choice-effect" role="status">
          {hasPhoto
            ? "Sample ready. Review the crop and placement under Reference whenever you need it."
            : "Add a handwriting photo with the upload above before continuing."}
        </p>
        <button type="button" onClick={onOpenReference}>
          {hasPhoto ? "Review reference" : "Open photo upload"}
        </button>
      </section>

      <section hidden={step !== "sizing"} aria-labelledby="ws-font-step-sizing">
        <h4
          id="ws-font-step-sizing"
          ref={(node) => {
            if (node) headings.current.sizing = node;
          }}
          tabIndex={-1}
        >
          Set a real-world scale
        </h4>
        <p>
          Mark two ruler points, enter their known distance, then measure a
          representative lowercase height. Photo AI can suggest sizing only
          after calibration; every suggestion still needs a ruler check.
        </p>
        <p className="ws-choice-effect" role="status">
          {isCalibrated
            ? "Scale calibrated. The prepared photo can now accompany a letter-round request."
            : hasPhoto
              ? "Calibration is still needed before the photo can guide letter rounds."
              : "Add a sample first, then calibrate its ruler distance."}
        </p>
        <button type="button" onClick={onOpenSizing}>
          Open sizing tools
        </button>
      </section>

      <section hidden={step !== "rounds"} aria-labelledby="ws-font-step-rounds">
        <h4
          id="ws-font-step-rounds"
          ref={(node) => {
            if (node) headings.current.rounds = node;
          }}
          tabIndex={-1}
        >
          Shape and review one letter
        </h4>
        <p>
          Choose a registered model profile, a printable letter, and bounded
          rounds. Each available profile shows the models used for its rounds.
        </p>
        {letterRounds}
      </section>

      <section hidden={step !== "font"} aria-labelledby="ws-font-step-font">
        <h4
          id="ws-font-step-font"
          ref={(node) => {
            if (node) headings.current.font = node;
          }}
          tabIndex={-1}
        >
          <FileType2 size={20} aria-hidden="true" /> Finish the alphabet
        </h4>
        <p>
          A reviewed SVG is one letter. Assemble approved outlines into a
          complete font in FontForge, then import the finished TTF/OTF to proof
          your words on the sheet.
        </p>
        {onImportFont ? (
          <WorksheetFontFinish onImportFont={onImportFont} />
        ) : (
          <p className="ws-hint">
            Import approved SVGs into FontForge, check spacing and cursive
            joins, then validate and export TTF/OTF. Bring it back through Find
            a script. Calligraphr’s marked template is another finishing path.
          </p>
        )}
      </section>

      <footer className="ws-font-creator__actions">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => moveTo(steps[Math.max(0, index - 1)] ?? "reference")}
        >
          <ArrowLeft size={17} aria-hidden="true" /> Previous
        </button>
        <span>
          Step {index + 1} of {steps.length}
        </span>
        <button
          type="button"
          disabled={
            index === steps.length - 1 ||
            (step === "reference" && !hasPhoto) ||
            (step === "sizing" && !isCalibrated)
          }
          onClick={() =>
            moveTo(steps[Math.min(steps.length - 1, index + 1)] ?? "font")
          }
        >
          Next <ArrowRight size={17} aria-hidden="true" />
        </button>
      </footer>
    </section>
  );
}
