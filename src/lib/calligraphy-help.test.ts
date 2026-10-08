import { expect, test } from "bun:test";
import {
  calligraphyHelpQuestion,
  calligraphyJourneyHelp,
  calligraphyToolHelp,
} from "./calligraphy-help";

test("guidance follows the actual selected journey step and next action", () => {
  const help = calligraphyJourneyHelp("photo-sizing", 2);
  expect(help.title).toBe("Match lettering from a photo · Step 3 of 4: Photo");
  expect(help.instruction).toContain("ruler");
  expect(help.next).toBe("Your result");
  expect(help).toHaveProperty("tool", "photo");
  expect(calligraphyJourneyHelp("photo-sizing", 3).next).toContain("Review");
  expect(calligraphyJourneyHelp(undefined).title).toBe(
    "Choose your wizard path",
  );
  expect(calligraphyJourneyHelp("photo-sizing", -1).title).toBe(
    "Choose your wizard path",
  );
});

test("help stays on the selected tool subsection and carries a contextual follow-up", () => {
  const help = calligraphyToolHelp("size", "Characters");
  expect(help.title).toBe("Letterforms · Characters");
  expect(help).toHaveProperty("tool", "size");
  const question = calligraphyHelpQuestion(help, "Explain that more simply.");
  expect(question).toContain("Letterforms · Characters");
  expect(question).toContain("Explain that more simply.");
  expect(question).toContain("one concrete action");
  expect(question).not.toContain("Photo & AI");
});

test("guidance whitelists context fields and fits the chat request limit", () => {
  const help = {
    ...calligraphyToolHelp("font"),
    notes: "PRIVATE NOTES",
    photo: "PRIVATE IMAGE",
    poem: "PRIVATE POEM",
  };
  const question = calligraphyHelpQuestion(help, "Why? ".repeat(1000));
  expect(question.length).toBeLessThanOrEqual(2000);
  expect(question).not.toContain("PRIVATE");
  expect(question).toContain("Make your own font");
});
