import type { CalligraphyTool } from "../components/calligraphy/calligraphy-cockpit";

export interface CalligraphyReaction {
  label: string;
  question: string;
  offline: string;
}

const toolReactions: Partial<Record<CalligraphyTool, CalligraphyReaction>> = {
  paper: {
    label: "Check my spacing",
    question:
      "React to my paper, margins and guide spacing. Suggest one adjustment and explain its tradeoff; ask for the intended use if needed. Do not claim you have measured the rendered text.",
    offline:
      "Check that Paper size matches your real sheet, then compare Margins & spacing with your writing area. Leave space for ascenders and descenders before increasing the number of rows.",
  },
  script: {
    label: "Find my script mood",
    question:
      "Help me choose a calligraphy script with the right mood. Ask about the occasion, then compare two directions using the current font as a starting point. Do not claim you can see my lettering.",
    offline:
      "Compare the same short phrase in two script specimens. Choose the more readable one at your intended size, then check it on the paper preview.",
  },
  size: {
    label: "Balance my letterforms",
    question:
      "React to the supplied lettering height, width and spacing. Suggest one way to improve readability while keeping the script's character. Explain which preview detail I should compare.",
    offline:
      "In Letterforms, compare your current width with Natural width. Adjust one control at a time and check letter counters, word gaps and flourish warnings in the preview.",
  },
  words: {
    label: "Review my font pairing",
    question:
      "React to my main and special-lettering font pairing and relative size. Help a name or dedication stand out without overpowering the surrounding words. If special lettering is inactive, explain how Special words can help. You cannot see my poem or the selected names.",
    offline:
      "Open Special words to set a name or phrase in a second script. Compare it beside the surrounding text, start near the main lettering size, and enlarge only if the phrase still fits comfortably.",
  },
  photo: {
    label: "Check my photo setup",
    question:
      "Help me prepare a lettering photo for reliable sizing. Give one capture or calibration check and ask what reference measurement I have. You cannot inspect the uploaded image in this chat.",
    offline:
      "Use an evenly lit, straight-on image with a ruler in the same plane as the letters. In Sizing, mark a known distance before measuring; this chat cannot inspect the uploaded photo.",
  },
  font: {
    label: "Plan my next glyph",
    question:
      "Help me choose the next step in building my font from drawn samples. Ask which letters or joins I have reviewed, then suggest one useful proof. Distinguish glyph proposals from FontForge assembly and TTF/OTF export.",
    offline:
      "Compare repeated stems and bowls across the alphabet, then proof common letter pairs. Review generated SVG proposals before FontForge assembly; check cursive joins and ligatures before exporting TTF/OTF.",
  },
  materials: {
    label: "Plan an ink test",
    question:
      "Help me design a small ink-and-paper swatch test. Ask for the ink type and paper because my private materials notes are not attached. Compare flow, feathering and drying; use manufacturer compatibility guidance, not a guessed chemical recipe.",
    offline:
      "On a scrap of the intended paper, test a hairline, a downstroke and a filled shape. Let each dry before comparing feathering or smearing. Check the manufacturer's compatibility guidance before mixing products.",
  },
  output: {
    label: "Give me a print check",
    question:
      "React to this sheet as a pre-print checklist. Name one likely setting to review, then a physical calibration check. You cannot certify rendered text fit or printer compatibility from settings alone.",
    offline:
      "Resolve Print & checks warnings, print one test sheet at Actual size / 100%, and measure the calibration mark with a ruler before printing the full set.",
  },
  templates: {
    label: "Choose a practice pattern",
    question:
      "Help me choose a practice template and row pattern. Compare model-trace-blank with continuous text for my experience and goal; ask which skill I want to practise.",
    offline:
      "Use model-trace-blank to alternate copying and independent practice, or continuous text to rehearse a longer passage. Review the replacement confirmation before loading a template.",
  },
};

const nextStep: CalligraphyReaction = {
  label: "What comes next?",
  question:
    "What comes next? Give one manageable action for this process, using its actual next step when supplied. Do not assume previous steps are complete.",
  offline:
    "Choose one result for this session, then follow the current step's instructions. Review the preview before moving on; the workflow map can show the remaining steps.",
};
const improve: CalligraphyReaction = {
  label: "Spot one improvement",
  question:
    "React constructively to my current setup. Suggest the single most useful improvement for this step, explain the benefit and tradeoff, and tell me how to compare before and after. Do not invent visual observations.",
  offline:
    "Keep a copy of the current sheet and change just one setting. Compare readability, spacing and fit before deciding whether to keep it. A local guide cannot judge your unseen handwriting.",
};
const drill: CalligraphyReaction = {
  label: "Give me a 2-minute drill",
  question:
    "Give me a two-minute calligraphy drill related to this step, with one specific skill to observe. Keep it encouraging and achievable, and distinguish practice advice from a visual assessment.",
  offline:
    "For two minutes, repeat one basic stroke slowly on the guides. Compare the first and last few strokes for consistent height and spacing. Choose one thing to practise next.",
};

export const CALLIGRAPHY_REPLY_REACTIONS: readonly CalligraphyReaction[] = [
  {
    label: "Explain more simply",
    question:
      "Explain your last advice more simply, with one concrete example and one next action. Avoid repeating the whole process.",
    offline:
      "Take one control at a time: change it, inspect the preview, then keep it or undo. Use Help now for the current step's control names.",
  },
  {
    label: "Try a bolder direction",
    question:
      "Offer a more expressive calligraphy direction for this step while preserving readability. Suggest one reversible experiment and how to tell if it is too much.",
    offline:
      "Try emphasis on one name or short phrase with Special words. Leave the surrounding passage quieter, then compare both at the intended print size.",
  },
  {
    label: "Encourage me",
    question:
      "Give me warm, playful encouragement and one small achievable next step. Base it on what I have actually told you; do not invent progress or praise unseen lettering.",
    offline:
      "One thoughtful stroke is enough to start. Pick a small goal, give it a few unhurried tries, and keep the example that teaches you something.",
  },
  {
    label: "What should I check?",
    question:
      "What should I check before continuing? Give a short checklist for this step and distinguish what the software checks from what I must inspect on real paper.",
    offline:
      "Check the preview and any fit warnings, then make a small test on the actual paper. Screen colour and material previews cannot predict real ink flow or drying.",
  },
  nextStep,
];

/** Offer stable, local prompt choices; selecting one is what requests inference. */
export function calligraphyReactions(
  tool?: CalligraphyTool,
): readonly CalligraphyReaction[] {
  return [tool ? (toolReactions[tool] ?? nextStep) : nextStep, improve, drill];
}
