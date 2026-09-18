import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { drawScalePlate } from "@/lib/scale-plate-canvas";
import type { ScaleTypography } from "@/lib/scale-typography";
import type { ScaleDesign } from "../../shared/scale-design";
import type { ScaleLetteringPlacement } from "../../shared/scale-lettering";
import type { ScalePlate } from "../../shared/scale-study";

export const MAX_PROOF_PIXELS = 8_000_000;
const PROOF_WIDTH = 1600;
const PROOF_HEIGHT = 720;

/** CSS zoom stays independent of the bounded backing-store resolution. */
export function proofCanvasSize(
  cssWidth: number,
  cssHeight: number,
  dpr: number,
) {
  const width = Number.isFinite(cssWidth)
    ? Math.max(1, Math.min(8192, cssWidth))
    : 1;
  const height = Number.isFinite(cssHeight)
    ? Math.max(1, Math.min(8192, cssHeight))
    : 1;
  const ratio = Number.isFinite(dpr) ? Math.max(1, Math.min(8, dpr)) : 1;
  const density = Math.min(
    ratio,
    Math.sqrt(MAX_PROOF_PIXELS / (width * height)),
    8192 / width,
    8192 / height,
  );
  return {
    width: Math.max(1, Math.floor(width * density)),
    height: Math.max(1, Math.floor(height * density)),
    limited: density < ratio,
  };
}

/** Layout reads and writes must not wait for animation frames in hidden tabs. */
export function centerProofViewport(
  viewport: Pick<
    HTMLElement,
    | "scrollLeft"
    | "scrollTop"
    | "scrollWidth"
    | "scrollHeight"
    | "clientWidth"
    | "clientHeight"
  >,
) {
  viewport.scrollLeft = Math.max(
    0,
    (viewport.scrollWidth - viewport.clientWidth) / 2,
  );
  viewport.scrollTop = Math.max(
    0,
    (viewport.scrollHeight - viewport.clientHeight) / 2,
  );
}

export function ScalePlateProof({
  plate,
  placement,
  design,
  family,
  typography,
}: {
  plate: ScalePlate;
  placement: ScaleLetteringPlacement | undefined;
  design: ScaleDesign;
  family: string;
  typography?: ScaleTypography;
}) {
  const viewportRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const viewportId = useId();
  const [zoom, setZoom] = useState<"fit" | 1 | 2>("fit");
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState({ width: 640, dpr: 1 });
  const [proofError, setProofError] = useState("");
  const lines = placement?.lines ?? [];
  const cssWidth = zoom === "fit" ? view.width : PROOF_WIDTH * zoom;
  const cssHeight = (cssWidth * PROOF_HEIGHT) / PROOF_WIDTH;
  const backing = proofCanvasSize(cssWidth, cssHeight, view.dpr);

  useLayoutEffect(() => {
    if (expanded) dialogRef.current?.showModal();
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const dialog = dialogRef.current;
    return () => {
      dialog?.close();
      expandButtonRef.current?.focus();
    };
  }, [expanded]);

  useEffect(() => {
    void expanded;
    const viewport = viewportRef.current;
    if (!viewport) return;
    let measuredWidth = 0;
    let measuredHeight = 0;
    const measure = () => {
      const width = viewport.clientWidth;
      const height = viewport.clientHeight;
      if (width !== measuredWidth || height !== measuredHeight) {
        centerProofViewport(viewport);
        measuredWidth = width;
        measuredHeight = height;
      }
      setView({ width: Math.max(1, width), dpr: window.devicePixelRatio || 1 });
    };
    measure();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    observer?.observe(viewport);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [expanded]);

  useLayoutEffect(() => {
    void plate.id;
    void zoom;
    void expanded;
    void cssWidth;
    void cssHeight;
    // Canvas CSS dimensions are committed and the dialog is already open.
    // Reading its box here forces layout even when animation frames are paused.
    const viewport = viewportRef.current;
    if (viewport) centerProofViewport(viewport);
  }, [plate.id, zoom, expanded, cssWidth, cssHeight]);

  useEffect(() => {
    void expanded;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      setProofError(
        "The browser could not draw the proof. Its words are available below.",
      );
      return;
    }
    setProofError("");
    try {
      canvas.width = backing.width;
      canvas.height = backing.height;
      context.setTransform(
        backing.width / cssWidth,
        0,
        0,
        backing.height / cssHeight,
        0,
        0,
      );
      const widthMm = plate.widthInches * 25.4;
      const heightMm = plate.heightInches * 25.4;
      const scale = Math.min(
        (cssWidth * 0.93) / widthMm,
        (cssHeight * 0.86) / heightMm,
      );
      const width = widthMm * scale;
      const height = heightMm * scale;
      const target = {
        x: (cssWidth - width) / 2,
        y: (cssHeight - height) / 2,
        width,
        height,
      };
      context.save();
      context.beginPath();
      plate.outline.forEach(([x, y], index) => {
        if (index === 0)
          context.moveTo(target.x + x * width, target.y + y * height);
        else context.lineTo(target.x + x * width, target.y + y * height);
      });
      context.closePath();
      context.strokeStyle = "#5b625b";
      context.lineWidth = 1;
      context.stroke();
      context.clip();
      drawScalePlate(
        context,
        plate,
        placement,
        design,
        family,
        target,
        typography,
      );
      context.restore();
      const safe = plate.safeRect;
      context.save();
      context.strokeStyle = "#6b786b";
      context.lineWidth = 1;
      context.setLineDash([5, 5]);
      context.strokeRect(
        target.x + safe.x * width + design.marginMm * scale,
        target.y + safe.y * height + design.marginMm * scale,
        Math.max(0, safe.width * width - design.marginMm * scale * 2),
        Math.max(0, safe.height * height - design.marginMm * scale * 2),
      );
      context.restore();
    } catch (error) {
      canvas.width = backing.width;
      setProofError(
        error instanceof Error
          ? error.message
          : "The close-up proof could not be drawn.",
      );
    }
  }, [
    expanded,
    plate,
    placement,
    design,
    family,
    typography,
    cssWidth,
    cssHeight,
    backing.width,
    backing.height,
  ]);

  const content = (
    <>
      <fieldset
        className="scale-proof-tools"
        aria-label="Lettering proof magnification"
      >
        {(["fit", 1, 2] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={zoom === value}
            onClick={() => setZoom(value)}
          >
            {value === "fit" ? "Fit" : `${value * 100}%`}
          </button>
        ))}
        <button
          ref={expandButtonRef}
          type="button"
          aria-expanded={expanded}
          aria-controls={viewportId}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Collapse proof" : "Expand proof"}
        </button>
      </fieldset>
      {proofError && (
        <p className="scales-error" role="alert">
          Proof unavailable: {proofError}
        </p>
      )}
      <section
        id={viewportId}
        ref={viewportRef}
        className="scale-proof-viewport"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users scroll this enlarged canvas with arrow keys.
        tabIndex={0}
        aria-label="Scrollable lettering proof"
      >
        <canvas
          hidden={Boolean(proofError)}
          ref={canvasRef}
          width={backing.width}
          height={backing.height}
          style={{ width: cssWidth, height: cssHeight }}
          role="img"
          aria-label={`Lettering proof for ${plate.id}. ${lines.join(" ") || "No lettering assigned."}`}
        >
          {plate.id}: {lines.join(" ") || "No lettering assigned."}
        </canvas>
      </section>
      <p className="scales-help">
        Fit shows the whole face. 100% and 200% enlarge the original drawing for
        inspection; scroll to explore. These are screen magnifications, not
        physical-size proofs.
        {backing.limited
          ? " Display resolution is capped at 8 million pixels."
          : ""}
      </p>
    </>
  );
  return (
    <div className="scale-proof" data-testid="scales-proof">
      {expanded ? (
        <dialog
          ref={dialogRef}
          className="scale-proof-dialog"
          aria-label={`Expanded lettering proof for ${plate.id}`}
          onCancel={(event) => {
            event.preventDefault();
            setExpanded(false);
          }}
        >
          {content}
          <p className="scales-plate-words">
            {lines.join(" ") || "No words on this face yet."}
          </p>
        </dialog>
      ) : (
        content
      )}
    </div>
  );
}
