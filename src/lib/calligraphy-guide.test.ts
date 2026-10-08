import { expect, test } from "bun:test";
import { calligraphyGuideReply } from "./calligraphy-guide";

test("the local guide opens the relevant tool without treating arbitrary requests as edits", () => {
  expect(calligraphyGuideReply("How do I mix gold ink?").tool).toBe(
    "materials",
  );
  expect(calligraphyGuideReply("make the letters taller and wider").tool).toBe(
    "size",
  );
  expect(calligraphyGuideReply("fit a poem on this paper").tool).toBe("words");
  expect(calligraphyGuideReply("turn a photo into a font").tool).toBe("photo");
  expect(calligraphyGuideReply("download my sheet").tool).toBe("output");
  expect(calligraphyGuideReply("buy an airline ticket").tool).toBeUndefined();
  expect(calligraphyGuideReply(" ").tool).toBeUndefined();
});

test("material questions and paper dimensions lead to the corresponding guidance", () => {
  expect(calligraphyGuideReply("gum arabic").text).toContain("slows drying");
  expect(calligraphyGuideReply("metallic mixtures").text).toContain(
    "Do not store",
  );
  expect(calligraphyGuideReply("test ink on vellum").text).toContain(
    "back of the sheet",
  );
  expect(calligraphyGuideReply("change the paper size").tool).toBe("paper");
  expect(calligraphyGuideReply("paper row spacing").tool).toBe("paper");
  expect(calligraphyGuideReply("letter width on paper").tool).toBe("size");
});
