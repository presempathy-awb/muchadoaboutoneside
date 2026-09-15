/**
 * Printable template sheets and diagrams for Jill's lettering brief.
 * Every coordinate is in millimetres; the SVG viewBox is the paper size, so
 * a 100 % print reproduces the working size exactly.
 */
import type { ReactNode } from "react";
import {
  ALPHABET_ROWS,
  CAPITALS,
  HARD_WORD_ROWS,
  MASTER_ROWS,
  MASTER_SHEETS,
  type MasterRow,
  REFERENCE_METRICS,
  SHEET,
  SHEET_WRITING_WIDTH_MM,
  SMALL_EDITION,
  WORKING,
} from "../../../shared/calligraphy-guide";
import { POEM_LINES, POEM_TITLE } from "../../../shared/poem";

const SCRIPT = "'Great Vibes', 'Iowan Old Style', serif";
const SANS = "'Avenir Next', 'Segoe UI', sans-serif";
const INK = "#211f1b";
const GHOST = "#bdb9b1";
const GHOST_DARK = "#8f8a82";
const RULE = "#7e7a73";
const FAINT = "#d7d3cb";

const round = (value: number) => Math.round(value * 1000) / 1000;

interface RowLinesProps {
  baseline: number;
  x1: number;
  x2: number;
}

/** The guideline set for one row: solid, dashed, and dotted rules plus slant. */
function RowLines({ baseline, x1, x2 }: RowLinesProps) {
  const ceiling = baseline - WORKING.flourishCeilingMm;
  const floor = baseline + WORKING.flourishFloorMm;
  const slantRun =
    (floor - ceiling) / Math.tan((WORKING.slantDegrees * Math.PI) / 180);
  const clipId = `slant-${round(baseline)}-${round(x1)}-${round(x2)}`;
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
          y1={baseline - WORKING.capHeightMm}
          x2={x2}
          y2={baseline - WORKING.capHeightMm}
          strokeWidth={0.2}
          strokeDasharray="4 2"
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
          strokeDasharray="1.5 1.5"
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
        <text x={x2} y={baseline - WORKING.capHeightMm - 0.8}>
          capitals +{WORKING.capHeightMm}
        </text>
        <text x={x2} y={baseline - WORKING.ascenderMm - 0.8}>
          ascender +{WORKING.ascenderMm}
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
  ghost?: string;
  ghostFill?: string;
}

function LabeledRow({
  baseline,
  id,
  ghost,
  ghostFill = GHOST,
}: LabeledRowProps) {
  const m = SHEET.marginMm;
  const x1 = m + SHEET.labelColumnMm;
  const x2 = SHEET.widthMm - m;
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
      <RowLines baseline={baseline} x1={x1} x2={x2} />
      {ghost && (
        <text
          x={x1 + 2}
          y={baseline}
          fontFamily={SCRIPT}
          fontSize={WORKING.emMm}
          fill={ghostFill}
        >
          {ghost}
        </text>
      )}
    </g>
  );
}

function rowBaselines(count: number, pitch: number, first: number) {
  return Array.from({ length: count }, (_, index) => first + index * pitch);
}

export function BlankSheet() {
  return (
    <SheetFrame
      label="Blank ruled master sheet"
      title={`${POEM_TITLE} · master sheet`}
      subtitle={`Blank ruled sheet · x-height ${WORKING.xHeightMm} mm · slant ${WORKING.slantDegrees}° · write one row ID per box`}
      footer="Solid: baseline and x-height. Long dash: ascender and capital. Short dash: descender. Dotted: flourish limits. Keep every stroke inside the dotted lines."
    >
      {rowBaselines(
        SHEET.rowsPerSheet,
        WORKING.rowPitchMm,
        SHEET.firstBaselineMm,
      ).map((baseline) => (
        <LabeledRow key={baseline} baseline={baseline} />
      ))}
    </SheetFrame>
  );
}

interface GhostSheetProps {
  rows: readonly MasterRow[];
  number: number;
}

export function GhostSheet({ rows, number }: GhostSheetProps) {
  return (
    <SheetFrame
      label={`Ghosted reference sheet ${number} of ${MASTER_SHEETS.length}`}
      title={`${POEM_TITLE} · reference sheet ${number} of ${MASTER_SHEETS.length}`}
      subtitle={`Rows ${rows[0]?.id ?? ""} to ${rows[rows.length - 1]?.id ?? ""} · stand-in font at working size · size and spacing reference, not letterforms`}
      footer="Grey text is the substitute font. Write your own hand over it for practice; write the final master on the blank sheets."
    >
      {rowBaselines(
        SHEET.rowsPerSheet,
        WORKING.rowPitchMm,
        SHEET.firstBaselineMm,
      ).map((baseline, index) => {
        const row = rows[index];
        return (
          <LabeledRow
            key={baseline}
            baseline={baseline}
            id={row?.id}
            ghost={row?.text}
          />
        );
      })}
    </SheetFrame>
  );
}

const PRACTICE_PITCH = 44;
const PRACTICE_FIRST_BASELINE = 52;

export function AlphabetSheet() {
  const capitalSet = new Set<string>(CAPITALS);
  return (
    <SheetFrame
      label="Alphabet warm-up sheet"
      title={`${POEM_TITLE} · alphabet warm-up`}
      subtitle="Lowercase joined, then capitals. The poem's capitals (C D E F I L O S T) are shown darker."
      footer="Write the lowercase alphabet twice and each capital once, joined as in running text. Check ten letters in a row sit on the baseline and touch the x-height line."
    >
      {rowBaselines(4, PRACTICE_PITCH, PRACTICE_FIRST_BASELINE).map(
        (baseline, index) => {
          const text = ALPHABET_ROWS[index] ?? "";
          const x1 = SHEET.marginMm + SHEET.labelColumnMm;
          return (
            <g key={baseline}>
              <LabeledRow baseline={baseline} />
              <text
                x={x1 + 2}
                y={baseline}
                fontFamily={SCRIPT}
                fontSize={WORKING.emMm}
                fill={GHOST}
              >
                {Array.from(text).map((letter, position) => (
                  <tspan
                    // biome-ignore lint/suspicious/noArrayIndexKey: letters repeat within a row
                    key={position}
                    fill={capitalSet.has(letter) ? GHOST_DARK : GHOST}
                  >
                    {letter}
                  </tspan>
                ))}
              </text>
            </g>
          );
        },
      )}
    </SheetFrame>
  );
}

export function HardWordsSheet() {
  return (
    <SheetFrame
      label="Hard words practice sheet"
      title={`${POEM_TITLE} · hard words`}
      subtitle="Invented and compound words, each written as one word with no gap or hyphen."
      footer="palindove · inkhands · halfheight · halfknight · quarterknight · knightling · swordfeud · inkprick's · doublelong · mirrorknave · swordwave · Onesided"
    >
      {rowBaselines(4, PRACTICE_PITCH, PRACTICE_FIRST_BASELINE).map(
        (baseline, index) => (
          <LabeledRow
            key={baseline}
            baseline={baseline}
            ghost={HARD_WORD_ROWS[index]}
          />
        ),
      )}
    </SheetFrame>
  );
}

/** One row of guidelines at the working size with every line named. */
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
      aria-label="Guideline proportions at the working size"
      className="guide-figure guide-actual"
    >
      <title>Guideline proportions at the working size</title>
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
          flourish ceiling · 1.12 em
        </text>
        <text x={x2 + 6} y={baseline - WORKING.capHeightMm + 1}>
          capital height · 0.81 em
        </text>
        <text x={x2 + 6} y={baseline - WORKING.ascenderMm + 1}>
          ascender · 0.62 em
        </text>
        <text x={x2 + 6} y={baseline - WORKING.xHeightMm + 1}>
          x-height · 0.36 em
        </text>
        <text x={x2 + 6} y={baseline + 1}>
          baseline
        </text>
        <text x={x2 + 6} y={baseline + WORKING.descenderMm + 1}>
          descender · 0.32 em
        </text>
        <text x={x2 + 6} y={baseline + WORKING.flourishFloorMm + 1}>
          flourish floor · 0.80 em
        </text>
        <text x={x1} y={height - 3} fill={GHOST_DARK}>
          1 em = {WORKING.emMm} mm on paper = {SMALL_EDITION.emMm} mm on the
          maquette · slant {WORKING.slantDegrees}°
        </text>
      </g>
    </svg>
  );
}

const GAUGE_WIDTHS = [0.5, 0.75, 1, 1.5, 2, 3] as const;

export function StrokeGaugeFigure() {
  const width = 180;
  const height = 46;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      width={`${width}mm`}
      height={`${height}mm`}
      role="img"
      aria-label="Stroke width gauge from 0.5 to 3 mm"
      className="guide-figure guide-actual"
    >
      <title>Stroke width gauge</title>
      <rect width={width} height={height} fill="#ffffff" />
      {GAUGE_WIDTHS.map((stroke, index) => {
        const x = 8 + index * 28;
        const tooThin = stroke < WORKING.minimumThinStrokeMm;
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
              fill={tooThin ? "#9c3b34" : "#2f5a48"}
              textAnchor="middle"
            >
              {tooThin
                ? "too thin"
                : stroke === WORKING.minimumThinStrokeMm
                  ? "minimum"
                  : stroke > WORKING.thickStrokeMm[1]
                    ? "thick limit"
                    : "good"}
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
        {GAUGE_WIDTHS.map((w) =>
          (w * (SMALL_EDITION.emMm / WORKING.emMm)).toFixed(2),
        ).join(" · ")}{" "}
        mm
      </text>
    </svg>
  );
}

/** The first three rows at working size in full ink: the size to aim for. */
export function RibbonWorkingFigure() {
  return (
    <SheetFrame
      label="Reference render at working size"
      title={`${POEM_TITLE} · reference render`}
      subtitle="Rows R01 to R03 in the stand-in font at the working size: aim for this size and weight in your own hand."
      footer="Black text is the substitute font Great Vibes, not the target letterforms. Compare stroke widths with the gauge; the thinnest strokes here are close to the 1 mm minimum."
    >
      {rowBaselines(
        SHEET.rowsPerSheet,
        WORKING.rowPitchMm,
        SHEET.firstBaselineMm,
      ).map((baseline, index) => {
        const row = MASTER_ROWS[index];
        return (
          <LabeledRow
            key={baseline}
            baseline={baseline}
            id={row?.id}
            ghost={row?.text}
            ghostFill={INK}
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
          One complete poem in the stand-in font · {round(em).toFixed(1)} mm em
          here, {SMALL_EDITION.emMm} mm on the maquette
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
  ["Paper sheets", "black on white, labelled rows"],
  ["Scan", "600 dpi, checked to the 100 mm bar"],
  ["Trace", "threshold, closed vector outlines"],
  ["Normalise", `each row to the ${WORKING.emMm} mm em`],
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

export function GhostSheets() {
  return (
    <>
      {MASTER_SHEETS.map((rows, index) => (
        <div className="guide-sheet-page" key={rows[0]?.id ?? index}>
          <GhostSheet rows={rows} number={index + 1} />
        </div>
      ))}
    </>
  );
}
