/**
 * Printable template sheets and diagrams for Jill's lettering brief.
 * Every coordinate is in millimetres; the SVG viewBox is the paper size, so
 * a 100 % print reproduces the working size exactly.
 */
import { type ReactNode, useId } from "react";
import {
  HARD_WORD_ROWS,
  MASTER_ROWS,
  MASTER_SHEETS,
  type MasterRow,
  REFERENCE_METRICS,
  SHEET,
  SHEET_WRITING_WIDTH_MM,
  SMALL_EDITION,
  STYLE_SAMPLE_ROWS,
  WORKING,
} from "../../../shared/calligraphy-guide";
import { POEM_LINES, POEM_TITLE } from "../../../shared/poem";

const SCRIPT = "'Great Vibes', 'Iowan Old Style', serif";
const SANS = "'Avenir Next', 'Segoe UI', sans-serif";
const INK = "#211f1b";
const GHOST_DARK = "#8f8a82";
const RULE = "#7e7a73";
const FAINT = "#d7d3cb";

const round = (value: number) => Math.round(value * 1000) / 1000;

type RowMode = "copperplate" | "plain";

interface RowLinesProps {
  baseline: number;
  x1: number;
  x2: number;
  mode?: RowMode;
}

/** The guide-line set for one row. Plain mode keeps only baseline and x-height. */
function RowLines({ baseline, x1, x2, mode = "copperplate" }: RowLinesProps) {
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ceiling = baseline - WORKING.flourishCeilingMm;
  const floor = baseline + WORKING.flourishFloorMm;
  if (mode === "plain") {
    return (
      <g stroke={RULE} fill="none">
        <line
          x1={x1}
          y1={baseline - WORKING.xHeightMm}
          x2={x2}
          y2={baseline - WORKING.xHeightMm}
          strokeWidth={0.15}
          strokeDasharray="0.4 1.6"
        />
        <line x1={x1} y1={baseline} x2={x2} y2={baseline} strokeWidth={0.4} />
        <g
          fontFamily={SANS}
          fontSize={2.2}
          fill={GHOST_DARK}
          textAnchor="end"
          stroke="none"
        >
          <text x={x2} y={baseline - WORKING.xHeightMm - 0.8}>
            x-height +{WORKING.xHeightMm}, if you want it
          </text>
          <text x={x2} y={baseline + 3}>
            baseline
          </text>
        </g>
      </g>
    );
  }
  const slantRun =
    (floor - ceiling) / Math.tan((WORKING.slantDegrees * Math.PI) / 180);
  const clipId = `slant-${round(baseline)}-${round(x1)}-${round(x2)}-${instanceId}`;
  const slants: ReactNode[] = [];
  for (let x = x1; x + slantRun <= x2 + slantRun; x += SHEET.slantSpacingMm) {
    slants.push(
      <line
        key={x}
        x1={round(x)}
        y1={floor}
        x2={round(x + slantRun)}
        y2={ceiling}
      />,
    );
  }
  return (
    <g>
      <g stroke={FAINT} strokeWidth={0.18}>
        <clipPath id={clipId}>
          <rect x={x1} y={ceiling} width={x2 - x1} height={floor - ceiling} />
        </clipPath>
        <g clipPath={`url(#${clipId})`}>{slants}</g>
      </g>
      <g stroke={RULE} fill="none">
        <line
          x1={x1}
          y1={ceiling}
          x2={x2}
          y2={ceiling}
          strokeWidth={0.2}
          strokeDasharray="0.4 1.2"
        />
        <line
          x1={x1}
          y1={baseline - WORKING.ascenderMm}
          x2={x2}
          y2={baseline - WORKING.ascenderMm}
          strokeWidth={0.2}
          strokeDasharray="4 2"
        />
        <line
          x1={x1}
          y1={baseline - WORKING.xHeightMm}
          x2={x2}
          y2={baseline - WORKING.xHeightMm}
          strokeWidth={0.28}
        />
        <line x1={x1} y1={baseline} x2={x2} y2={baseline} strokeWidth={0.4} />
        <line
          x1={x1}
          y1={baseline + WORKING.descenderMm}
          x2={x2}
          y2={baseline + WORKING.descenderMm}
          strokeWidth={0.2}
          strokeDasharray="4 2"
        />
        <line
          x1={x1}
          y1={floor}
          x2={x2}
          y2={floor}
          strokeWidth={0.2}
          strokeDasharray="0.4 1.2"
        />
      </g>
      <g fontFamily={SANS} fontSize={2.2} fill={GHOST_DARK} textAnchor="end">
        <text x={x2} y={ceiling - 0.8}>
          flourish ceiling +{WORKING.flourishCeilingMm}
        </text>
        <text x={x2} y={baseline - WORKING.ascenderMm - 0.8}>
          ascender · capitals +{WORKING.ascenderMm}
        </text>
        <text x={x2} y={baseline - WORKING.xHeightMm - 0.8}>
          x-height +{WORKING.xHeightMm}
        </text>
        <text x={x2} y={baseline + 3}>
          baseline 0
        </text>
        <text x={x2} y={baseline + WORKING.descenderMm + 3}>
          descender −{WORKING.descenderMm}
        </text>
        <text x={x2} y={floor + 3}>
          flourish floor −{WORKING.flourishFloorMm}
        </text>
      </g>
    </g>
  );
}

interface SheetFrameProps {
  title: string;
  subtitle: string;
  footer: string;
  children: ReactNode;
  label: string;
}

/** Letter-landscape page with header, 100 mm check bar, and footer. */
function SheetFrame({
  title,
  subtitle,
  footer,
  children,
  label,
}: SheetFrameProps) {
  const m = SHEET.marginMm;
  const right = SHEET.widthMm - m;
  const barX = right - SHEET.scaleBarMm;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${SHEET.widthMm} ${SHEET.heightMm}`}
      width={`${SHEET.widthMm}mm`}
      height={`${SHEET.heightMm}mm`}
      role="img"
      aria-label={label}
      className="guide-sheet"
    >
      <title>{label}</title>
      <rect width={SHEET.widthMm} height={SHEET.heightMm} fill="#ffffff" />
      <g fontFamily={SANS} fill={INK}>
        <text x={m} y={m + 2.5} fontSize={3.2} fontWeight={650}>
          {title.toUpperCase()}
        </text>
        <text x={m} y={m + 7.5} fontSize={2.6} fill={GHOST_DARK}>
          {subtitle}
        </text>
        <text x={m} y={SHEET.heightMm - m + 5} fontSize={2.4} fill={GHOST_DARK}>
          {footer}
        </text>
      </g>
      <g stroke={INK} strokeWidth={0.3}>
        <line x1={barX} y1={m + 4} x2={right} y2={m + 4} />
        <line x1={barX} y1={m + 1.5} x2={barX} y2={m + 6.5} />
        <line x1={right} y1={m + 1.5} x2={right} y2={m + 6.5} />
        <line
          x1={barX + SHEET.scaleBarMm / 2}
          y1={m + 2.5}
          x2={barX + SHEET.scaleBarMm / 2}
          y2={m + 5.5}
        />
      </g>
      <g fontFamily={SANS} fontSize={2.4} fill={INK}>
        <text x={barX} y={m + 10}>
          0
        </text>
        <text x={right} y={m + 10} textAnchor="end">
          {SHEET.scaleBarMm} mm check bar · print at 100 %
        </text>
      </g>
      {children}
    </svg>
  );
}

interface LabeledRowProps {
  baseline: number;
  id?: string;
  /** Plain-type words printed above the row so Jill never has to look away. */
  prompt?: string;
  /** Script text on the baseline, used only for the placeholder comparison. */
  script?: string;
  mode?: RowMode;
}

function LabeledRow({
  baseline,
  id,
  prompt,
  script,
  mode = "copperplate",
}: LabeledRowProps) {
  const m = SHEET.marginMm;
  const x1 = m + SHEET.labelColumnMm;
  const x2 = SHEET.widthMm - m;
  const promptY =
    mode === "plain"
      ? baseline - WORKING.xHeightMm - 6
      : baseline - WORKING.flourishCeilingMm - 2.5;
  return (
    <g>
      <rect
        x={m}
        y={baseline - 9}
        width={11}
        height={11}
        fill="none"
        stroke={RULE}
        strokeWidth={0.2}
      />
      {id && (
        <text
          x={m + 5.5}
          y={baseline - 2.5}
          fontFamily={SANS}
          fontSize={3}
          fontWeight={650}
          fill={INK}
          textAnchor="middle"
        >
          {id}
        </text>
      )}
      <RowLines baseline={baseline} x1={x1} x2={x2} mode={mode} />
      {prompt && (
        <text
          x={x1 + 1}
          y={promptY}
          fontFamily={SANS}
          fontSize={3.6}
          fontWeight={600}
          fill={INK}
        >
          {prompt}
        </text>
      )}
      {script && (
        <text
          x={x1 + 2}
          y={baseline}
          fontFamily={SCRIPT}
          fontSize={WORKING.emMm}
          fill={INK}
        >
          {script}
        </text>
      )}
    </g>
  );
}

function rowBaselines(count: number, pitch: number, first: number) {
  return Array.from({ length: count }, (_, index) => first + index * pitch);
}

const MASTER_BASELINES = rowBaselines(
  SHEET.rowsPerSheet,
  WORKING.rowPitchMm,
  SHEET.firstBaselineMm,
);
const PRACTICE_PITCH = 44;
const PRACTICE_FIRST_BASELINE = 54;
const PRACTICE_BASELINES = rowBaselines(
  4,
  PRACTICE_PITCH,
  PRACTICE_FIRST_BASELINE,
);

const LINE_KEY =
  "Solid: baseline and x-height. Dashed: ascender and descender at 1.5 × x-height. Dotted: flourish ceiling and floor. Faint diagonals: 55° slant.";

export function BlankSheet() {
  return (
    <SheetFrame
      label="Blank copperplate master sheet"
      title={`${POEM_TITLE} · blank master sheet`}
      subtitle={`Copperplate guide lines · x-height ${WORKING.xHeightMm} mm suggested · write the row ID in the box`}
      footer={`${LINE_KEY} Use for rewrites and part-b rows.`}
    >
      {MASTER_BASELINES.map((baseline) => (
        <LabeledRow key={baseline} baseline={baseline} />
      ))}
    </SheetFrame>
  );
}

export function FreeSheet() {
  return (
    <SheetFrame
      label="Plain baseline sheet"
      title={`${POEM_TITLE} · plain sheet`}
      subtitle="Baseline and a faint x-height only · for writing without slant or loop lines · write the row ID in the box"
      footer="Keep rows from touching each other; baselines are 56 mm apart for that. Everything else is your choice."
    >
      {MASTER_BASELINES.map((baseline) => (
        <LabeledRow key={baseline} baseline={baseline} mode="plain" />
      ))}
    </SheetFrame>
  );
}

interface MasterSheetProps {
  rows: readonly MasterRow[];
  number: number;
}

export function MasterSheet({ rows, number }: MasterSheetProps) {
  return (
    <SheetFrame
      label={`Master sheet ${number} of ${MASTER_SHEETS.length}`}
      title={`${POEM_TITLE} · master sheet ${number} of ${MASTER_SHEETS.length}`}
      subtitle={`Rows ${rows[0]?.id ?? ""} to ${rows[rows.length - 1]?.id ?? ""} · write each row on the baseline beneath its printed words`}
      footer={`${LINE_KEY} A row without printed words is a spare for a part-b continuation.`}
    >
      {MASTER_BASELINES.map((baseline, index) => {
        const row = rows[index];
        return (
          <LabeledRow
            key={baseline}
            baseline={baseline}
            id={row?.id}
            prompt={row ? `${row.id} · ${row.text}` : undefined}
          />
        );
      })}
    </SheetFrame>
  );
}

export function MasterSheets() {
  return (
    <>
      {MASTER_SHEETS.map((rows, index) => (
        <div className="guide-sheet-page" key={rows[0]?.id ?? index}>
          <MasterSheet rows={rows} number={index + 1} />
        </div>
      ))}
    </>
  );
}

export function StyleSampleSheet() {
  return (
    <SheetFrame
      label="Style-sample sheet"
      title={`${POEM_TITLE} · style sample`}
      subtitle="Your alphabet in your own copperplate, at the size you will use for the poem. Also the reference for any digital repair."
      footer="Join the lowercase as you naturally would; give the capitals the flourishes you like best. Nothing here is compared with a font."
    >
      {MASTER_BASELINES.map((baseline, index) => (
        <LabeledRow
          key={baseline}
          baseline={baseline}
          prompt={STYLE_SAMPLE_ROWS[index]}
        />
      ))}
    </SheetFrame>
  );
}

export function HardWordsSheet() {
  return (
    <SheetFrame
      label="Hard words practice sheet"
      title={`${POEM_TITLE} · hard words`}
      subtitle="Invented and compound words, each written as one word with no gap or hyphen. Plain baselines; use your own slant."
      footer="palindove · inkhands · halfheight · halfknight · quarterknight · knightling · swordfeud · inkprick's · doublelong · mirrorknave · swordwave · Onesided"
    >
      {PRACTICE_BASELINES.map((baseline, index) => (
        <LabeledRow
          key={baseline}
          baseline={baseline}
          prompt={HARD_WORD_ROWS[index]}
          mode="plain"
        />
      ))}
    </SheetFrame>
  );
}

/** One row of guide lines at the working size with every line named. */
export function ProportionsFigure() {
  const width = 180;
  const baseline = 40;
  const x1 = 4;
  const x2 = 132;
  const height = 70;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      width={`${width}mm`}
      height={`${height}mm`}
      role="img"
      aria-label="Guide-line proportions at the working size"
      className="guide-figure guide-actual"
    >
      <title>Guide-line proportions at the working size</title>
      <rect width={width} height={height} fill="#ffffff" />
      <RowLines baseline={baseline} x1={x1} x2={x2} />
      <text
        x={x1 + 6}
        y={baseline}
        fontFamily={SCRIPT}
        fontSize={WORKING.emMm}
        fill={INK}
      >
        palindove
      </text>
      <g fontFamily={SANS} fontSize={2.6} fill={INK}>
        <text x={x2 + 6} y={baseline - WORKING.flourishCeilingMm + 1}>
          flourish ceiling · 3.4 × x-height
        </text>
        <text x={x2 + 6} y={baseline - WORKING.ascenderMm + 1}>
          ascender and capitals · 1.5 ×
        </text>
        <text x={x2 + 6} y={baseline - WORKING.xHeightMm + 1}>
          x-height · 1 ×
        </text>
        <text x={x2 + 6} y={baseline + 1}>
          baseline
        </text>
        <text x={x2 + 6} y={baseline + WORKING.descenderMm + 1}>
          descender · 1.5 ×
        </text>
        <text x={x2 + 6} y={baseline + WORKING.flourishFloorMm + 1}>
          flourish floor · 2.6 ×
        </text>
        <text x={x1} y={height - 3} fill={GHOST_DARK}>
          x-height {WORKING.xHeightMm} mm on paper becomes about{" "}
          {(WORKING.xHeightMm * (SMALL_EDITION.emMm / WORKING.emMm)).toFixed(1)}{" "}
          mm on the maquette · slant guide {WORKING.slantDegrees}°
        </text>
      </g>
    </svg>
  );
}

const GAUGE_WIDTHS = [0.15, 0.3, 0.5, 1, 1.5, 2.5] as const;

export function StrokeGaugeFigure() {
  const width = 180;
  const height = 46;
  const scale = SMALL_EDITION.emMm / WORKING.emMm;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      width={`${width}mm`}
      height={`${height}mm`}
      role="img"
      aria-label="Stroke width reference from 0.15 to 2.5 mm"
      className="guide-figure guide-actual"
    >
      <title>Stroke width reference</title>
      <rect width={width} height={height} fill="#ffffff" />
      {GAUGE_WIDTHS.map((stroke, index) => {
        const x = 16 + index * 28;
        const label =
          stroke < WORKING.scanHairlineMm
            ? "too faint to scan"
            : stroke < WORKING.digitalHairlineMm
              ? "thickened to 1 mm"
              : stroke === WORKING.digitalHairlineMm
                ? "the floor"
                : "kept as written";
        return (
          <g key={stroke}>
            <rect x={x} y={8} width={stroke} height={22} fill={INK} />
            <text
              x={x + stroke / 2}
              y={35}
              fontFamily={SANS}
              fontSize={2.8}
              fontWeight={650}
              fill={INK}
              textAnchor="middle"
            >
              {stroke} mm
            </text>
            <text
              x={x + stroke / 2}
              y={39.5}
              fontFamily={SANS}
              fontSize={2.4}
              fill={stroke < WORKING.digitalHairlineMm ? "#7a6a3a" : "#2f5a48"}
              textAnchor="middle"
            >
              {label}
            </text>
          </g>
        );
      })}
      <text
        x={width - 4}
        y={43.5}
        fontFamily={SANS}
        fontSize={2.3}
        fill={GHOST_DARK}
        textAnchor="end"
      >
        On the maquette these become{" "}
        {GAUGE_WIDTHS.map((w) => (w * scale).toFixed(2)).join(" · ")} mm
      </text>
    </svg>
  );
}

/** The first three rows at working size in the placeholder font, for scale. */
export function RibbonWorkingFigure() {
  return (
    <SheetFrame
      label="Placeholder font at working size"
      title={`${POEM_TITLE} · placeholder comparison`}
      subtitle="Rows R01 to R03 in the substitute font Great Vibes on the copperplate sheet lines. A size comparison only."
      footer="The site shows this font today. Your rows replace it; nothing about its letterforms, weight, or slant is a target."
    >
      {MASTER_BASELINES.map((baseline, index) => {
        const row = MASTER_ROWS[index];
        return (
          <LabeledRow
            key={baseline}
            baseline={baseline}
            id={row?.id}
            script={row?.text}
          />
        );
      })}
    </SheetFrame>
  );
}

/** The whole poem at maquette size, actual size when printed at 100 %. */
export function RibbonSmallFigure() {
  const width = 180;
  const em = SMALL_EDITION.emMm;
  const gap = 2 * 0.171 * em * SMALL_EDITION.horizontalScale;
  const usable = width - 8;
  const lines: { text: string; x: number; y: number; length: number }[] = [];
  let x = 4;
  let y = 9;
  POEM_LINES.forEach((text, index) => {
    const length =
      (REFERENCE_METRICS.lineWidthsEm[index] ?? 10) *
      em *
      SMALL_EDITION.horizontalScale;
    if (x + length > usable + 4) {
      x = 4;
      y += SMALL_EDITION.ribbonHeightMm + 2;
    }
    lines.push({ text, x: round(x), y, length: round(length) });
    x += length + gap;
  });
  const height = y + 11;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      width={`${width}mm`}
      height={`${height}mm`}
      role="img"
      aria-label="The poem at maquette size"
      className="guide-figure guide-actual"
    >
      <title>The poem at maquette size</title>
      <rect width={width} height={height} fill="#ffffff" />
      {Array.from(new Set(lines.map((line) => line.y))).map((baseline) => (
        <g key={baseline}>
          <rect
            x={2}
            y={baseline - em * 2.16}
            width={width - 4}
            height={SMALL_EDITION.ribbonHeightMm}
            fill="none"
            stroke={FAINT}
            strokeWidth={0.15}
          />
          <line
            x1={2}
            y1={baseline}
            x2={width - 2}
            y2={baseline}
            stroke={FAINT}
            strokeWidth={0.12}
          />
        </g>
      ))}
      {lines.map((line) => (
        <text
          key={line.text}
          x={line.x}
          y={line.y}
          fontFamily={SCRIPT}
          fontSize={em}
          fill={INK}
          textLength={line.length}
          lengthAdjust="spacingAndGlyphs"
        >
          {line.text}
        </text>
      ))}
      <text
        x={4}
        y={height - 2}
        fontFamily={SANS}
        fontSize={2.2}
        fill={GHOST_DARK}
      >
        {SMALL_EDITION.emMm} mm em · {SMALL_EDITION.ribbonHeightMm} mm ribbon
        band · horizontal scale {SMALL_EDITION.horizontalScale} · actual size at
        100 %
      </text>
    </svg>
  );
}

/** The closed loop: the whole poem around a stadium path, ending at its start. */
export function LoopFigure() {
  const width = 240;
  const height = 70;
  const r = 18;
  const straight = 190;
  const perimeter = 2 * straight + 2 * Math.PI * r;
  const em = perimeter / REFERENCE_METRICS.loopWidthEm;
  const left = (width - straight) / 2;
  const top = 12;
  const path = `M ${left} ${top} H ${left + straight} A ${r} ${r} 0 0 1 ${left + straight} ${top + 2 * r} H ${left} A ${r} ${r} 0 0 1 ${left} ${top} Z`;
  const loop = `${POEM_LINES.join("  ")} `;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      width={`${width}mm`}
      height={`${height}mm`}
      role="img"
      aria-label="The poem as a closed loop"
      className="guide-figure"
    >
      <title>The poem as a closed loop</title>
      <defs>
        <path id="guide-loop-path" d={path} />
      </defs>
      <rect width={width} height={height} fill="#ffffff" />
      <use
        href="#guide-loop-path"
        fill="none"
        stroke={FAINT}
        strokeWidth={0.2}
      />
      <text
        fontFamily={SCRIPT}
        fontSize={round(em)}
        fill={INK}
        textLength={round(perimeter)}
        lengthAdjust="spacingAndGlyphs"
      >
        <textPath href="#guide-loop-path">{loop}</textPath>
      </text>
      <g fontFamily={SANS} fontSize={2.5} fill={GHOST_DARK}>
        <text x={left - 2} y={top - 5} textAnchor="end">
          ends with “twine…”
        </text>
        <text x={left + 2} y={top - 5}>
          begins with “Come,”
        </text>
        <path
          d={`M ${left - 1} ${top - 4} q 1 3 2 0`}
          fill="none"
          stroke={GHOST_DARK}
          strokeWidth={0.3}
        />
        <text x={width / 2} y={height - 3} textAnchor="middle">
          One complete poem in the substitute font · {round(em).toFixed(1)} mm
          em here, {SMALL_EDITION.emMm} mm on the maquette
        </text>
      </g>
    </svg>
  );
}

/** Which rows go on which sheet. */
export function RowMapFigure() {
  return (
    <div className="guide-row-map">
      {MASTER_SHEETS.map((rows, index) => (
        <div key={rows[0]?.id ?? index}>
          <span>Sheet {index + 1}</span>
          {rows.map((row) => (
            <p key={row.id}>
              <strong>{row.id}</strong>
              <span>{row.text}</span>
            </p>
          ))}
        </div>
      ))}
      <div className="guide-row-map-total">
        <span>Total</span>
        <p>
          <strong>{MASTER_ROWS.length} rows</strong>
          <span>
            on {MASTER_SHEETS.length} sheets · writing width{" "}
            {Math.round(SHEET_WRITING_WIDTH_MM)} mm
          </span>
        </p>
      </div>
    </div>
  );
}

const PIPELINE = [
  ["Paper sheets", "your copperplate, labelled rows"],
  ["Scan", "1200 dpi, checked to the 100 mm bar"],
  ["Trace", "threshold, closed vector outlines"],
  ["Adapt", "hairlines to 1 mm, rows normalised"],
  ["Join", "one ribbon, single and double gaps"],
  ["Proof", "1:1 and 4:1 for Jill's approval"],
  ["Coupon", "denhac laser test on real foil"],
  ["Foil kits", "the maquette, then the study"],
] as const;

export function PipelineFigure() {
  const width = 240;
  const height = 62;
  const columns = 4;
  const boxWidth = 52;
  const boxHeight = 20;
  const gapX = (width - columns * boxWidth) / (columns + 1);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      width={`${width}mm`}
      height={`${height}mm`}
      role="img"
      aria-label="From scan to foil"
      className="guide-figure"
    >
      <title>From scan to foil</title>
      <rect width={width} height={height} fill="#ffffff" />
      {PIPELINE.map(([name, detail], index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const x = gapX + column * (boxWidth + gapX);
        const y = 6 + row * (boxHeight + 10);
        const next = index + 1 < PIPELINE.length;
        return (
          <g key={name}>
            <rect
              x={x}
              y={y}
              width={boxWidth}
              height={boxHeight}
              rx={1.5}
              fill="#f6f4ef"
              stroke={RULE}
              strokeWidth={0.25}
            />
            <text
              x={x + 4}
              y={y + 7}
              fontFamily={SANS}
              fontSize={3.2}
              fontWeight={650}
              fill={INK}
            >
              {index + 1}. {name}
            </text>
            <text
              x={x + 4}
              y={y + 13}
              fontFamily={SANS}
              fontSize={2.5}
              fill={GHOST_DARK}
            >
              {detail}
            </text>
            {next && column < columns - 1 && (
              <path
                d={`M ${x + boxWidth + 1} ${y + boxHeight / 2} h ${gapX - 2} m -2 -1.5 l 2 1.5 -2 1.5`}
                fill="none"
                stroke={RULE}
                strokeWidth={0.3}
              />
            )}
            {next && column === columns - 1 && (
              <path
                d={`M ${x + boxWidth / 2} ${y + boxHeight + 1} v 4 H ${gapX + boxWidth / 2} v 3 m -1.5 -2 l 1.5 2 1.5 -2`}
                fill="none"
                stroke={RULE}
                strokeWidth={0.3}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
