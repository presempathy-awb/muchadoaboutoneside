import { ArrowLeft, ArrowRight, GripVertical, RotateCcw } from "lucide-react";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import {
  fitStudioColumns,
  moveStudioPanel,
  resizeStudioPair,
  type StudioPanel,
} from "@/lib/calligraphy-layout";

const initialOrder: StudioPanel[] = ["tools", "paper", "writing", "notes"];
const labels = {
  tools: "Your tools",
  paper: "Practice sheet",
  writing: "Poem editor",
  notes: "Studio notes",
};

/** Keep a visit's arrangement while the quiz temporarily replaces the desk. */
export function useStudioDeskLayout() {
  const [order, setOrder] = useState(initialOrder);
  const [weights, setWeights] = useState<Record<StudioPanel, number>>({
    tools: 1,
    paper: 1.15,
    writing: 1,
    notes: 1,
  });
  return { order, setOrder, weights, setWeights };
}

/** Keep independent work bays in view; drag titles to reorder and dividers to resize. */
export function CalligraphyDesk({
  enabled,
  preferredColumns,
  onColumnsFit,
  layout,
  paperFocus,
  paper,
  writing,
  notes,
  children,
}: {
  enabled: boolean;
  preferredColumns: number;
  onColumnsFit: (columns: number) => void;
  layout: ReturnType<typeof useStudioDeskLayout>;
  paperFocus: boolean;
  paper: ReactNode;
  writing: ReactNode;
  notes: ReactNode;
  children: (columns: number) => ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const { order, setOrder, weights, setWeights } = layout;
  const [announcement, setAnnouncement] = useState("");
  const dragging = useRef<{ panel: StudioPanel; x: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<StudioPanel | null>(null);
  const resizing = useRef<{
    x: number;
    left: number;
    right: number;
    a: StudioPanel;
    b: StudioPanel;
    scale: number;
  } | null>(null);
  useEffect(() => {
    if (!enabled || !host.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [enabled]);
  const count = fitStudioColumns(preferredColumns, width);
  useEffect(() => {
    if (enabled) onColumnsFit(count);
  }, [count, enabled, onColumnsFit]);
  const visible = order.filter((id) => initialOrder.indexOf(id) < count);
  const move = (source: StudioPanel, target: StudioPanel) => {
    setOrder((current) => moveStudioPanel(current, source, target));
    setAnnouncement(`${labels[source]} moved to ${labels[target]}'s position.`);
  };
  const resize = (left: StudioPanel, right: StudioPanel, delta: number) => {
    const a = host.current?.querySelector<HTMLElement>(
      `[data-panel="${left}"]`,
    );
    const b = host.current?.querySelector<HTMLElement>(
      `[data-panel="${right}"]`,
    );
    if (!a || !b) return;
    const combined = weights[left] + weights[right];
    const [nextA, nextB] = resizeStudioPair(
      a.offsetWidth,
      b.offsetWidth,
      delta,
    );
    const scale = combined / (nextA + nextB);
    setWeights((current) => ({
      ...current,
      [left]: nextA * scale,
      [right]: nextB * scale,
    }));
  };
  if (!enabled) return <div className="ws-desk">{children(2)}</div>;
  const content = { tools: children(count), paper, writing, notes };
  return (
    <div
      ref={host}
      className={`ck-dock${paperFocus ? " ck-dock-focus" : ""}`}
      data-columns={count}
    >
      <p className="ws-sr-only" role="status">
        {announcement}
      </p>
      {visible.map((id, index) => (
        <Fragment key={id}>
          <section
            className={`ck-dock-panel ck-${id}-panel`}
            data-panel={id}
            data-drop-target={dropTarget === id || undefined}
            style={{ flexGrow: weights[id] }}
            aria-label={`${labels[id]} column`}
            hidden={paperFocus && id !== "paper"}
          >
            <header className="ck-panel-handle">
              <button
                type="button"
                className="ck-drag-title"
                aria-label={`Move ${labels[id]} column. Use left and right arrow keys.`}
                title="Drag to another column title, or use arrow keys"
                onPointerDown={(event) => {
                  if (paperFocus || event.button !== 0) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  dragging.current = { panel: id, x: event.clientX };
                }}
                onPointerMove={(event) => {
                  if (!dragging.current) return;
                  const target = document
                    .elementFromPoint(event.clientX, event.clientY)
                    ?.closest<HTMLElement>("[data-panel]")?.dataset.panel;
                  setDropTarget(
                    visible.find(
                      (panel) =>
                        panel === target && panel !== dragging.current?.panel,
                    ) ?? null,
                  );
                }}
                onPointerUp={(event) => {
                  const drag = dragging.current;
                  const target = document
                    .elementFromPoint(event.clientX, event.clientY)
                    ?.closest<HTMLElement>("[data-panel]")?.dataset.panel;
                  const panel = visible.find((item) => item === target);
                  if (
                    drag &&
                    panel &&
                    panel !== drag.panel &&
                    Math.abs(event.clientX - drag.x) > 16
                  )
                    move(drag.panel, panel);
                  dragging.current = null;
                  setDropTarget(null);
                }}
                onPointerCancel={() => {
                  dragging.current = null;
                  setDropTarget(null);
                }}
                onKeyDown={(event) => {
                  const target =
                    visible[
                      index +
                        (event.key === "ArrowLeft"
                          ? -1
                          : event.key === "ArrowRight"
                            ? 1
                            : 0)
                    ];
                  if (target && target !== id) {
                    event.preventDefault();
                    move(id, target);
                  }
                }}
              >
                <GripVertical size={16} aria-hidden="true" />
                <span>{labels[id]}</span>
              </button>
              <span className="ck-move-buttons">
                <button
                  type="button"
                  aria-label={`Move ${labels[id]} left`}
                  disabled={index === 0}
                  onClick={() => {
                    const target = visible[index - 1];
                    if (target) move(id, target);
                  }}
                >
                  <ArrowLeft size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${labels[id]} right`}
                  disabled={index === visible.length - 1}
                  onClick={() => {
                    const target = visible[index + 1];
                    if (target) move(id, target);
                  }}
                >
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </span>
              {id === "tools" && (
                <button
                  type="button"
                  aria-label="Reset column arrangement"
                  title="Reset column arrangement"
                  onClick={() => {
                    setOrder(initialOrder);
                    setWeights({ tools: 1, paper: 1.15, writing: 1, notes: 1 });
                    setAnnouncement("Column arrangement reset.");
                  }}
                >
                  <RotateCcw size={15} aria-hidden="true" />
                </button>
              )}
            </header>
            <div className="ck-panel-content">{content[id]}</div>
          </section>
          {index < visible.length - 1 && !paperFocus && (
            <hr
              className="ck-column-divider"
              tabIndex={0}
              aria-label={`Resize ${labels[id]} column`}
              aria-orientation="vertical"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(
                (100 * weights[id]) /
                  (weights[id] + weights[visible[index + 1] as StudioPanel]),
              )}
              onKeyDown={(event) => {
                const next = visible[index + 1];
                if (!next) return;
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  resize(id, next, event.key === "ArrowLeft" ? -32 : 32);
                }
              }}
              onPointerDown={(event) => {
                const next = visible[index + 1];
                const a = host.current?.querySelector<HTMLElement>(
                  `[data-panel="${id}"]`,
                );
                const b = host.current?.querySelector<HTMLElement>(
                  `[data-panel="${next}"]`,
                );
                if (!next || !a || !b) return;
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                resizing.current = {
                  x: event.clientX,
                  left: a.offsetWidth,
                  right: b.offsetWidth,
                  a: id,
                  b: next,
                  scale:
                    (weights[id] + weights[next]) /
                    (a.offsetWidth + b.offsetWidth),
                };
              }}
              onPointerMove={(event) => {
                const drag = resizing.current;
                if (!drag) return;
                const [a, b] = resizeStudioPair(
                  drag.left,
                  drag.right,
                  event.clientX - drag.x,
                );
                setWeights((current) => ({
                  ...current,
                  [drag.a]: a * drag.scale,
                  [drag.b]: b * drag.scale,
                }));
              }}
              onPointerUp={() => {
                resizing.current = null;
              }}
              onPointerCancel={() => {
                resizing.current = null;
              }}
            />
          )}
        </Fragment>
      ))}
    </div>
  );
}
