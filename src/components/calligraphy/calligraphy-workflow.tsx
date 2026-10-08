import { ArrowRight, Download, WandSparkles } from "lucide-react";
import { type JSX, useEffect, useMemo, useState } from "react";
import {
  CALLIGRAPHY_JOURNEYS,
  CALLIGRAPHY_STEPS,
  type CalligraphyJourneyId,
  type CalligraphyStepId,
} from "../../../shared/calligraphy-journeys";
import {
  buildCalligraphyJourneyMap,
  calligraphyJourneyMermaid,
} from "../../lib/calligraphy-journey-map";
import { Button } from "../ui/button";
import type { CalligraphyTool } from "./calligraphy-cockpit";
import "../../calligraphy-workflow.css";

type FlowRenderer = Pick<
  typeof import("@xyflow/react"),
  "ReactFlow" | "Background" | "Controls"
>;

/** Explore a real wizard route, open any tool, or follow the questions in order. */
export function CalligraphyWorkflow({
  onSelect,
  onStartJourney,
}: {
  onSelect: (tool: CalligraphyTool) => void;
  onStartJourney: (journey: CalligraphyJourneyId) => void;
}): JSX.Element {
  const [renderer, setRenderer] = useState<FlowRenderer>();
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    let active = true;
    import("@xyflow/react")
      .then(({ ReactFlow, Background, Controls }) => {
        if (active) setRenderer({ ReactFlow, Background, Controls });
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const [selected, setSelected] = useState<CalligraphyJourneyId>("practice");
  const journey =
    CALLIGRAPHY_JOURNEYS.find((item) => item.id === selected) ??
    CALLIGRAPHY_JOURNEYS[0];
  const graph = useMemo(() => buildCalligraphyJourneyMap(selected), [selected]);
  const mermaid = useMemo(
    () => calligraphyJourneyMermaid(selected),
    [selected],
  );
  if (!journey) return <p>No guided paths are available.</p>;
  return (
    <section className="ck-workflow" aria-labelledby="ck-workflow-title">
      <h2 id="ck-workflow-title">Find your way to the page.</h2>
      <label className="ck-workflow-choice">
        <span>What would you like to make?</span>
        <select
          value={selected}
          onChange={(event) =>
            setSelected(event.target.value as CalligraphyJourneyId)
          }
        >
          {CALLIGRAPHY_JOURNEYS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <p>{journey.description}</p>
      <Button
        type="button"
        className="ck-start-path"
        onClick={() => onStartJourney(selected)}
      >
        <WandSparkles size={18} aria-hidden="true" /> Follow this path
      </Button>
      <div className="ck-flow-canvas">
        {renderer ? (
          <renderer.ReactFlow
            key={selected}
            nodes={graph.nodes}
            edges={graph.edges}
            fitView
            fitViewOptions={{ padding: 0.18 }}
            minZoom={0.4}
            maxZoom={1.5}
            nodesDraggable={false}
            nodesConnectable={false}
            onNodeClick={(_, node) =>
              onSelect(
                CALLIGRAPHY_STEPS[node.id as CalligraphyStepId].toolTarget,
              )
            }
            ariaLabelConfig={{
              "node.a11yDescription.default":
                "Choose a node to open its tool. The step buttons below also open every tool with the keyboard.",
            }}
          >
            <renderer.Background gap={24} />
            <renderer.Controls showInteractive={false} />
          </renderer.ReactFlow>
        ) : (
          <p role="status">
            {loadError
              ? "The interactive map could not load. The step buttons below still open every tool."
              : "Loading the interactive map… You can already follow the path or choose a step below."}
          </p>
        )}
      </div>
      <nav className="ck-flow-links" aria-label="Open a path tool">
        {journey.steps.map((step) => (
          <button
            type="button"
            key={step}
            onClick={() => onSelect(CALLIGRAPHY_STEPS[step].toolTarget)}
          >
            {CALLIGRAPHY_STEPS[step].label}{" "}
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        ))}
      </nav>
      <details className="ck-mermaid-source">
        <summary>Mermaid diagram for this path</summary>
        <pre>{mermaid}</pre>
        <a
          download={`${selected}.mmd`}
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(mermaid)}`}
        >
          <Download size={16} aria-hidden="true" /> Download Mermaid
        </a>
      </details>
      <p className="ws-hint">
        The map and wizard share the same steps. Opening a path keeps your
        draft. Studio chat and the requirements assistant remain available along
        the bottom.
      </p>
    </section>
  );
}
