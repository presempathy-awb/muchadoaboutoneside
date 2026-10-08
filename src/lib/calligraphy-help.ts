import type { CalligraphyTool } from "@/components/calligraphy/calligraphy-cockpit";
import {
  CALLIGRAPHY_JOURNEYS,
  CALLIGRAPHY_STEPS,
  type CalligraphyJourneyId,
} from "../../shared/calligraphy-journeys";

export interface CalligraphyHelpContext {
  tool?: CalligraphyTool;
  title: string;
  instruction: string;
  next?: string;
}

const toolHelp: Record<CalligraphyTool, CalligraphyHelpContext> = {
  paper: {
    title: "Paper & guides",
    instruction:
      "Choose Paper size and Orientation, then Margins & spacing and Lines & slants. Match real printer stock and check the preview.",
  },
  templates: {
    title: "Templates",
    instruction:
      "Choose Practice templates for a starting guide, or Saved sheets to load an existing sheet. Review the replacement confirmation before replacing a draft.",
  },
  library: {
    title: "Saved sheets",
    instruction:
      "Save a named sheet, or review an existing sheet before loading it. Keep a backup of important drafts.",
  },
  script: {
    title: "Find a script",
    instruction:
      "Browse scripts to compare real specimens, or use My fonts to import an allowed TTF/OTF. Choose a script, then use Letterforms to size it.",
  },
  size: {
    title: "Letterforms",
    instruction:
      "Adjust lowercase height and lettering width under Size & spacing. Review Letterforms, Characters or Advanced only as needed. Check fit before printing.",
  },
  words: {
    title: "Words & poems",
    instruction:
      "Edit Practice text or use Load poem that fits. Review replacement before loading. Special words gives complete names or phrases one accent font and relative size; Apply special lettering applies it and Use main font for all words removes it. Adjust the practice pattern and lettering size while watching the paper. Undo and Redo preserve editing history.",
  },
  photo: {
    title: "Photo & AI",
    instruction:
      "Use Reference to upload a clear sample. In Sizing, mark a known ruler distance before measuring or asking for AI sizing. Review measurements before applying. This help chat cannot see the uploaded image.",
  },
  font: {
    title: "Make your own font",
    instruction:
      "Choose a sample, Set its scale, Shape letters, then Build your font. Letter rounds require an available registered model profile. A reviewed SVG still needs font assembly before importing a TTF/OTF.",
  },
  materials: {
    title: "At the mixing table",
    instruction:
      "Start with Mixing tips, choose Paper & ink, then record My tools & notes. Make a small swatch and let it dry before judging flow or colour. Follow the ink maker's compatibility guidance.",
  },
  output: {
    title: "Print & checks",
    instruction:
      "Resolve fit and flourish warnings, inspect the paper preview, then Download PDF or Print sheets at Actual size / 100%. Use a ruler to check calibration.",
  },
  learn: {
    title: "Knowledge & guides",
    instruction:
      "Search a specific technique or browse an attributed guide. Pick one exercise to practice, then use Templates to prepare a sheet.",
  },
  flow: {
    title: "Workflow",
    instruction:
      "Choose a purpose in the workflow map, inspect its steps and launch its questions. The wizard guides one decision at a time.",
  },
  help: {
    title: "Studio guidance",
    instruction:
      "Choose a purpose in Wizard quiz mode: practice, poem layout, photo sizing, font creation, ink testing or learning.",
  },
};

/** Describe only the selected interface, without reading private draft content. */
export function calligraphyToolHelp(
  tool: CalligraphyTool,
  section?: string,
): CalligraphyHelpContext {
  const help = toolHelp[tool];
  return {
    ...help,
    tool,
    title: section ? `${help.title} · ${section}` : help.title,
  };
}

/** Use the same route metadata as the actual wizard, including its real next step. */
export function calligraphyJourneyHelp(
  journeyId?: CalligraphyJourneyId,
  index = 0,
): CalligraphyHelpContext {
  const journey = CALLIGRAPHY_JOURNEYS.find(({ id }) => id === journeyId);
  const stepId =
    Number.isInteger(index) && index >= 0 ? journey?.steps[index] : undefined;
  if (!journey || !stepId)
    return {
      title: "Choose your wizard path",
      instruction:
        "Ask which result the user wants: a practice sheet, poem layout, photo sizing, a font, an ink test or a lesson. Choosing a path keeps their draft.",
    };
  const step = CALLIGRAPHY_STEPS[stepId];
  const nextId = journey.steps[index + 1];
  return {
    tool: step.toolTarget,
    title: `${journey.label} · Step ${index + 1} of ${journey.steps.length}: ${step.label}`,
    instruction: `${step.title} ${step.hint} ${toolHelp[step.toolTarget].instruction}`,
    next: nextId
      ? CALLIGRAPHY_STEPS[nextId].label
      : "Review the result before downloading or printing.",
  };
}

/** Keep contextual follow-ups within the existing 2,000-character chat contract. */
export function calligraphyHelpQuestion(
  context: CalligraphyHelpContext,
  question: string,
): string {
  const instructions =
    "Guide me through this calligraphy studio step. Give one concrete action using the supplied control names, explain why, then one check before continuing. Ask at most one useful question. Adapt to my follow-up instead of repeating the whole process. Do not assume earlier steps are complete or that you can see my photo or poem. Do not invent controls, perform edits or claim anything was applied. Stay under 180 words.";
  const location = JSON.stringify({
    title: context.title.slice(0, 160),
    instruction: context.instruction.slice(0, 700),
    next: context.next?.slice(0, 160),
  });
  const prefix = `${instructions}\nCurrent process: ${location}\nMy request: `;
  return prefix + question.trim().slice(0, Math.max(0, 2000 - prefix.length));
}
