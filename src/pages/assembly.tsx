import { Link } from "@tanstack/react-router";
import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  Handle,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  useNodesState,
} from "@xyflow/react";
import { ArrowRight, GitFork, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { ProjectState } from "@/components/project-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { materialLabel, useProject } from "@/lib/project-query";
import type { Project } from "../../shared/project";

type PartNode = Node<
  { label: string; material: string; color: string; root?: boolean },
  "part"
>;
function PartGraphNode({ data, selected }: NodeProps<PartNode>) {
  return (
    <div
      className={`assembly-node ${data.root ? "root-node" : ""} ${selected ? "node-selected" : ""}`}
    >
      <Handle type="target" position={Position.Left} />
      <span
        className="material-swatch"
        style={{ backgroundColor: data.color }}
      />
      <span>
        <strong>{data.label}</strong>
        <small>{data.material}</small>
      </span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = { part: PartGraphNode };

function AssemblyCanvas({ project }: { project: Project }) {
  const initialNodes = useMemo<PartNode[]>(
    () => [
      {
        id: "sculpture",
        type: "part",
        position: { x: 30, y: 258 },
        data: {
          label: "Figure-eight snake",
          material: "Complete construction model",
          color: "#c6d9b8",
          root: true,
        },
        draggable: true,
      },
      ...project.model.parts.map((part, index) => ({
        id: part.id,
        type: "part" as const,
        position: { x: 385, y: 18 + index * 80 },
        data: {
          label: part.label,
          material: materialLabel(part.material),
          color: part.color,
        },
      })),
    ],
    [project],
  );
  const edges = useMemo<Edge[]>(
    () =>
      project.model.parts.map((part) => ({
        id: `sculpture-${part.id}`,
        source: "sculpture",
        target: part.id,
        type: "smoothstep",
        style: { stroke: "#8b9c87", strokeWidth: 1.5 },
      })),
    [project],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const part = project.model.parts.find(
    (candidate) => candidate.id === selectedPart,
  );
  return (
    <>
      <div className="assembly-grid">
        <div className="graph-panel">
          <div className="graph-caption">
            <Badge variant="secondary">MODEL COMPOSITION</Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setNodes(initialNodes);
                setSelectedPart(null);
              }}
            >
              <RotateCcw size={14} />
              Reset positions
            </Button>
          </div>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeClick={(_, node) => setSelectedPart(node.id)}
            onPaneClick={() => setSelectedPart(null)}
            nodesConnectable={false}
            edgesReconnectable={false}
            fitView
            fitViewOptions={{ padding: 0.18 }}
            minZoom={0.35}
            maxZoom={1.7}
            aria-label="Sculpture model composition graph"
          >
            <Background
              variant={BackgroundVariant.Dots}
              color="#b9bfb0"
              gap={22}
              size={1}
            />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
        <aside className="assembly-detail">
          <span className="eyebrow">
            {part ? "SELECTED COMPONENT" : "READING THE MODEL"}
          </span>
          <div className="assembly-symbol">
            <GitFork size={32} strokeWidth={1.3} />
          </div>
          <h2>{part?.label ?? "A whole, in parts."}</h2>
          <p>
            {part
              ? `${part.label} is one of the seven named component groups preserved in the original sculpture model.`
              : "The original model is organized into seven component groups. Select a node to inspect its material and geometry."}
          </p>
          <dl>
            <div>
              <dt>Material</dt>
              <dd>{part ? materialLabel(part.material) : "Mixed wood"}</dd>
            </div>
            <div>
              <dt>Triangles</dt>
              <dd>
                {(part?.triangles ?? project.model.triangles).toLocaleString()}
              </dd>
            </div>
          </dl>
          <Link to="/studio" search={{ part: part?.id }} className="text-link">
            {part ? "Inspect in 3D" : "Open the sculpture"}
            <ArrowRight size={16} />
          </Link>
        </aside>
      </div>
      <p className="section-note">
        Connections show membership in the model, not engineering joints or a
        construction sequence. Drag nodes to rearrange this view.
      </p>
    </>
  );
}

export default function Assembly() {
  const project = useProject();
  if (!project.data)
    return (
      <ProjectState
        error={project.isError}
        retry={() => void project.refetch()}
      />
    );
  return (
    <div className="page-content">
      <div className="compact-heading">
        <span className="eyebrow">SCULPTURE STUDY / 002</span>
        <h1>
          Everything is <em>connected.</em>
        </h1>
        <p>A map of the parts that make the whole.</p>
      </div>
      <AssemblyCanvas project={project.data} />
    </div>
  );
}
