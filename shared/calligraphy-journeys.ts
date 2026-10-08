export type CalligraphyJourneyId =
  | "practice"
  | "poem"
  | "photo-sizing"
  | "font-creation"
  | "ink-testing"
  | "learning";

export type CalligraphyStepId =
  | "guides"
  | "paper"
  | "materials"
  | "lettering"
  | "words"
  | "photo"
  | "font"
  | "knowledge"
  | "output";

export type CalligraphyToolTarget =
  | "paper"
  | "materials"
  | "script"
  | "templates"
  | "words"
  | "photo"
  | "font"
  | "learn"
  | "output";

export interface CalligraphyStep {
  id: CalligraphyStepId;
  label: string;
  title: string;
  hint: string;
  toolTarget: CalligraphyToolTarget;
}

export interface CalligraphyJourney {
  id: CalligraphyJourneyId;
  label: string;
  description: string;
  steps: readonly CalligraphyStepId[];
}

/** Shared wizard and workflow-map metadata for the calligraphy studio. */
export const CALLIGRAPHY_STEPS: Readonly<
  Record<CalligraphyStepId, CalligraphyStep>
> = {
  guides: {
    id: "guides",
    label: "Guides",
    title: "What would you like to practise?",
    hint: "Choose a starting guide. Your words and saved templates stay with you.",
    toolTarget: "templates",
  },
  paper: {
    id: "paper",
    label: "Paper",
    title: "What paper are you using?",
    hint: "Match the sheet to your printer paper and choose the room your hand needs.",
    toolTarget: "paper",
  },
  materials: {
    id: "materials",
    label: "Ink & materials",
    title: "What will you put pen to paper with?",
    hint: "Record the ink, nib and surface you want to test before making a full sheet.",
    toolTarget: "materials",
  },
  lettering: {
    id: "lettering",
    label: "Lettering",
    title: "Blank guides or letters to follow?",
    hint: "Keep a blank sheet for your own hand, or print example lettering as a model.",
    toolTarget: "script",
  },
  words: {
    id: "words",
    label: "Words",
    title: "What do you want to write?",
    hint: "Shape a poem, excerpt or practice phrase before fitting it to the page.",
    toolTarget: "words",
  },
  photo: {
    id: "photo",
    label: "Photo",
    title: "Show us the lettering you want to measure",
    hint: "Use a clear, straight-on image with a ruler or known page size when possible.",
    toolTarget: "photo",
  },
  font: {
    id: "font",
    label: "Font",
    title: "Prepare your alphabet for a font",
    hint: "Upload a clear sample, calibrate its size and use the available letter tools before finishing and importing your font.",
    toolTarget: "font",
  },
  knowledge: {
    id: "knowledge",
    label: "Learn",
    title: "What would you like help learning?",
    hint: "Browse a guide or ask the studio assistant, then carry what you learn into a practice sheet.",
    toolTarget: "learn",
  },
  output: {
    id: "output",
    label: "Your result",
    title: "Ready to put pen to paper?",
    hint: "Check the preview, then download or print at Actual size / 100%.",
    toolTarget: "output",
  },
};

/** Purpose-led routes through the studio; each ends with a reviewable result. */
export const CALLIGRAPHY_JOURNEYS: readonly CalligraphyJourney[] = [
  {
    id: "practice",
    label: "Make a practice sheet",
    description:
      "Set guides, paper, tools and example lettering for a printable session.",
    steps: ["guides", "paper", "materials", "lettering", "output"],
  },
  {
    id: "poem",
    label: "Lay out a poem or excerpt",
    description:
      "Edit the words, choose their lettering and fit the composition to paper.",
    steps: ["words", "lettering", "paper", "output"],
  },
  {
    id: "photo-sizing",
    label: "Match lettering from a photo",
    description:
      "Measure a sample, translate its proportions into guides and check the page.",
    steps: ["guides", "paper", "photo", "output"],
  },
  {
    id: "font-creation",
    label: "Create a font from an alphabet",
    description:
      "Prepare a sample, review available letter tools, then finish and import a font.",
    steps: ["font", "lettering", "words", "output"],
  },
  {
    id: "ink-testing",
    label: "Plan an ink and paper test",
    description:
      "Choose a useful test layout, record materials and print a comparison sheet.",
    steps: ["materials", "guides", "paper", "output"],
  },
  {
    id: "learning",
    label: "Learn a calligraphy skill",
    description:
      "Start with a guide, select a focused exercise and leave with a practice page.",
    steps: ["knowledge", "guides", "materials", "output"],
  },
];
