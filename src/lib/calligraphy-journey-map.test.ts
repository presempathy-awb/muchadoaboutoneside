import { expect, test } from "bun:test";
import {
  buildCalligraphyJourneyMap,
  calligraphyJourneyMermaid,
} from "./calligraphy-journey-map";

test("photo workflow keeps sizing after guide and paper choices in both diagrams", () => {
  const map = buildCalligraphyJourneyMap("photo-sizing");
  expect(map.nodes.map((node) => node.id)).toEqual([
    "guides",
    "paper",
    "photo",
    "output",
  ]);
  expect(map.edges.at(-1)).toMatchObject({ source: "photo", target: "output" });
  expect(calligraphyJourneyMermaid("photo-sizing")).toContain(
    "paper --> photo",
  );
  expect(calligraphyJourneyMermaid("photo-sizing")).toContain(
    "photo --> output",
  );
});
