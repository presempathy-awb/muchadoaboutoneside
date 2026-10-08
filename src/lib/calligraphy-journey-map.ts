import type { Edge, Node } from "@xyflow/react";
import {
  CALLIGRAPHY_JOURNEYS,
  CALLIGRAPHY_STEPS,
  type CalligraphyJourneyId,
  type CalligraphyStepId,
} from "../../shared/calligraphy-journeys";

/** Render the wizard's actual sequence as a navigable workflow map. */
export function buildCalligraphyJourneyMap(id: CalligraphyJourneyId): {
  nodes: Node[];
  edges: Edge[];
} {
  const journey = CALLIGRAPHY_JOURNEYS.find((item) => item.id === id);
  if (!journey) throw new Error("Unknown calligraphy journey");
  return {
    nodes: journey.steps.map((step, index) => ({
      id: step,
      position: { x: 0, y: index * 90 },
      data: { label: `${index + 1} · ${CALLIGRAPHY_STEPS[step].label}` },
      type:
        index === 0
          ? "input"
          : index === journey.steps.length - 1
            ? "output"
            : "default",
    })),
    edges: journey.steps.slice(1).map((step, index) => ({
      id: `${journey.steps[index]}-${step}`,
      source: journey.steps[index] as CalligraphyStepId,
      target: step,
    })),
  };
}

/** Export Mermaid from the same steps used by the interactive wizard. */
export function calligraphyJourneyMermaid(id: CalligraphyJourneyId): string {
  const journey = CALLIGRAPHY_JOURNEYS.find((item) => item.id === id);
  if (!journey) throw new Error("Unknown calligraphy journey");
  const lines = journey.steps.map(
    (step) =>
      `  ${step}["${CALLIGRAPHY_STEPS[step].label.replaceAll('"', "&quot;")}"]`,
  );
  journey.steps.slice(1).forEach((step, index) => {
    lines.push(`  ${journey.steps[index]} --> ${step}`);
  });
  return `flowchart TD\n${lines.join("\n")}\n`;
}
