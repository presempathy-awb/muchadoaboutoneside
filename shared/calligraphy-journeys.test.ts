import { describe, expect, test } from "bun:test";
import {
  CALLIGRAPHY_JOURNEYS,
  CALLIGRAPHY_STEPS,
} from "./calligraphy-journeys";

describe("calligraphy journeys", () => {
  test("offer six distinct routes with resolvable steps", () => {
    expect(CALLIGRAPHY_JOURNEYS.map(({ id }) => id)).toEqual([
      "practice",
      "poem",
      "photo-sizing",
      "font-creation",
      "ink-testing",
      "learning",
    ]);
    for (const journey of CALLIGRAPHY_JOURNEYS) {
      expect(journey.steps.length).toBeGreaterThanOrEqual(3);
      expect(new Set(journey.steps).size).toBe(journey.steps.length);
      for (const stepId of journey.steps) {
        expect(CALLIGRAPHY_STEPS[stepId].id).toBe(stepId);
      }
      expect(journey.steps.at(-1)).toBe("output");
    }
  });

  test("route-specific work appears before output", () => {
    const routes = Object.fromEntries(
      CALLIGRAPHY_JOURNEYS.map((journey) => [journey.id, journey.steps]),
    );
    expect(routes.practice).toContain("guides");
    expect(routes.poem).toContain("words");
    expect(routes["photo-sizing"]).toContain("photo");
    expect(routes["font-creation"]).toContain("font");
    expect(routes["ink-testing"]).toContain("materials");
    expect(routes.learning).toContain("knowledge");
    expect(CALLIGRAPHY_STEPS.knowledge.toolTarget).toBe("learn");
  });
});
