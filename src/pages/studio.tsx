import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowRight,
  Eye,
  EyeOff,
  Layers3,
  Maximize,
  Pause,
  Play,
  RotateCcw,
  ScanLine,
} from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { DimensionsOverview } from "@/components/dimensions-overview";
import { ProjectState } from "@/components/project-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatInches, materialLabel, useProject } from "@/lib/project-query";

const SculptureViewer = lazy(() => import("@/components/sculpture-viewer"));

export function Studio() {
  const project = useProject();
  const search = useSearch({ from: "/studio" });
  const navigate = useNavigate();
  const selectedPart = search.part ?? null;
  function setSelectedPart(part: string | null) {
    void navigate({
      to: "/studio",
      search: { part: part ?? undefined },
      replace: true,
    });
  }
  const [hiddenParts, setHiddenParts] = useState<string[]>([]);
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  if (!project.data)
    return (
      <ProjectState
        error={project.isError}
        retry={() => void project.refetch()}
      />
    );
  const { model } = project.data;
  const selected = model.parts.find((part) => part.id === selectedPart);
  function togglePart(id: string) {
    setHiddenParts((current) =>
      current.includes(id)
        ? current.filter((part) => part !== id)
        : [...current, id],
    );
  }
  function reset() {
    setResetKey((value) => value + 1);
    setHiddenParts([]);
    setSelectedPart(null);
    setWireframe(false);
    setAutoRotate(false);
  }

  return (
    <div className="page-content studio-page">
      <section className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="small-line" />
            SCULPTURE STUDY / 001
          </div>
          <h1>
            A twist in the
            <br />
            <em>ordinary.</em>
          </h1>
        </div>
        <div className="heading-aside">
          <p>
            A figure-eight snake, assembled from
            <br className="desktop-break" /> plywood ribs, lath stringers, and a
            timber spine.
          </p>
          <Link to="/assembly" className="text-link">
            Explore how it comes together <ArrowRight size={16} />
          </Link>
        </div>
      </section>
      <section
        className="studio-grid"
        aria-label="Interactive sculpture viewer"
      >
        <div className="viewer-panel">
          <div className="viewer-topline">
            <Badge variant="secondary">FIGURE-EIGHT SNAKE</Badge>
            <span className="model-badge">
              <span className="status-dot" />
              Original construction model
            </span>
          </div>
          <Suspense
            fallback={
              <div className="viewer-loading" role="status">
                Preparing the 3D model…
              </div>
            }
          >
            <SculptureViewer
              className="main-viewer"
              selectedPart={selectedPart}
              hiddenParts={hiddenParts}
              wireframe={wireframe}
              autoRotate={autoRotate}
              resetKey={resetKey}
              onSelectPart={setSelectedPart}
            />
          </Suspense>
          <div className="viewer-bottomline">
            <span>
              <Maximize size={13} />
              Drag to orbit · Scroll to zoom
            </span>
            <fieldset className="viewer-toolbar" aria-label="View options">
              <Button
                variant={autoRotate ? "secondary" : "ghost"}
                size="icon"
                aria-label={autoRotate ? "Pause rotation" : "Rotate model"}
                onClick={() => setAutoRotate(!autoRotate)}
              >
                {autoRotate ? <Pause /> : <Play />}
              </Button>
              <Button
                variant={wireframe ? "secondary" : "ghost"}
                size="icon"
                aria-label="Toggle wireframe"
                aria-pressed={wireframe}
                onClick={() => setWireframe(!wireframe)}
              >
                <ScanLine />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Reset model view"
                onClick={reset}
              >
                <RotateCcw />
              </Button>
            </fieldset>
          </div>
        </div>
        <aside className="parts-panel" aria-label="Model parts">
          <div className="parts-heading">
            <Layers3 size={18} />
            <h2>The anatomy</h2>
            <span>{model.parts.length.toString().padStart(2, "0")}</span>
          </div>
          <p className="parts-intro">Select a part to take a closer look.</p>
          <div className="parts-list">
            {model.parts.map((part, index) => (
              <div
                key={part.id}
                className={`part-row ${part.id === selectedPart ? "selected" : ""} ${hiddenParts.includes(part.id) ? "part-hidden" : ""}`}
              >
                <button
                  type="button"
                  className="part-select"
                  onClick={() =>
                    setSelectedPart(part.id === selectedPart ? null : part.id)
                  }
                  aria-pressed={part.id === selectedPart}
                >
                  <span className="part-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span
                    className="material-swatch"
                    style={{ background: part.color }}
                  />
                  <span>
                    <strong>{part.label}</strong>
                    <small>{materialLabel(part.material)}</small>
                  </span>
                </button>
                <button
                  type="button"
                  className="visibility-button"
                  aria-label={`${hiddenParts.includes(part.id) ? "Show" : "Hide"} ${part.label}`}
                  onClick={() => togglePart(part.id)}
                >
                  {hiddenParts.includes(part.id) ? (
                    <EyeOff size={15} />
                  ) : (
                    <Eye size={15} />
                  )}
                </button>
              </div>
            ))}
          </div>
          <div className="part-detail" aria-live="polite">
            <span className="eyebrow">
              {selected ? "IN FOCUS" : "MADE OF MANY"}
            </span>
            <p>
              {selected
                ? `${selected.label} · ${selected.triangles.toLocaleString()} triangles`
                : "Seven parts. One continuous form."}
            </p>
            <span className="muted">
              {selected
                ? materialLabel(selected.material)
                : "Toggle the eyes to reveal the structure."}
            </span>
          </div>
        </aside>
      </section>
      <section className="spec-strip" aria-label="Model dimensions">
        <div>
          <span className="eyebrow">OVERALL HEIGHT</span>
          <strong>{formatInches(model.heightInches)}</strong>
          <small>
            {model.heightInches} in · {(model.heightInches * 0.0254).toFixed(2)}{" "}
            m
          </small>
        </div>
        <div>
          <span className="eyebrow">FOOTPRINT</span>
          <strong>
            {formatInches(model.widthInches)} <span>×</span>{" "}
            {formatInches(model.depthInches)}
          </strong>
          <small>
            {model.widthInches} × {model.depthInches} in · width × depth
          </small>
        </div>
        <div>
          <span className="eyebrow">CONSTRUCTION</span>
          <strong>Wood & possibility</strong>
          <small>Plywood · lath · timber</small>
        </div>
        <a
          className="download-callout"
          href="/api/assets/snake_build.glb"
          download
        >
          <span className="download-icon">
            <ArrowDownToLine size={20} />
          </span>
          <span>
            <strong>Take the model with you</strong>
            <small>Download GLB · 295 KB</small>
          </span>
          <ArrowRight size={17} />
        </a>
      </section>
      <DimensionsOverview compact />
      <div className="studio-note">
        <Link to="/" className="text-link">
          Explore the foil edition <ArrowRight size={15} />
        </Link>
        <span className="note-index">FIELD NOTE 001</span>
        <p>Follow the form. Find the structure.</p>
        <Link to="/archive" className="text-link">
          View all source files <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}
