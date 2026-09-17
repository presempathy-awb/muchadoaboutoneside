import { useId } from "react";
import type { WorksheetLayout } from "../../../shared/worksheet";
import type { WorksheetFont } from "../../lib/worksheet-fonts";
import type { WorksheetSnapshot } from "../../lib/worksheet-store";

export function WorksheetPreview({
  snapshot,
  layout,
  lines,
  font,
  printed = false,
}: {
  snapshot: WorksheetSnapshot;
  layout: WorksheetLayout;
  lines: string[];
  font?: WorksheetFont;
  printed?: boolean;
}) {
  const id = useId();
  const { settings, photo } = snapshot;
  return (
    <svg
      className="ws-paper"
      viewBox={`0 0 ${layout.widthMm} ${layout.heightMm}`}
      width={`${layout.widthMm}mm`}
      height={`${layout.heightMm}mm`}
      role="img"
      aria-labelledby={`${id}-title`}
    >
      <title
        id={`${id}-title`}
      >{`${settings.mode} practice sheet, ${layout.baselineYsMm.length} writing rows`}</title>
      <defs>
        <clipPath id={`${id}-clip`}>
          <rect width={layout.widthMm} height={layout.heightMm} />
        </clipPath>
      </defs>
      <rect width={layout.widthMm} height={layout.heightMm} fill="white" />
      <g clipPath={`url(#${id}-clip)`}>
        {photo && (!printed || photo.print) && (
          <image
            href={photo.dataUrl}
            x={photo.xMm}
            y={photo.yMm}
            width={photo.widthMm}
            height={(photo.widthMm * photo.pixelHeight) / photo.pixelWidth}
            opacity={photo.opacity}
            transform={`rotate(${photo.rotation} ${photo.xMm + photo.widthMm / 2} ${photo.yMm + (photo.widthMm * photo.pixelHeight) / photo.pixelWidth / 2})`}
          />
        )}
        {layout.lines.map((line) => (
          <line
            key={`${line.kind}-${line.x1}-${line.y1}-${line.x2}-${line.y2}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={line.color}
            strokeWidth={(line.widthPt * 25.4) / 72}
            strokeLinecap={line.dash === "dotted" ? "round" : "butt"}
            strokeDasharray={
              line.dash === "dashed"
                ? `${(3 * line.widthPt * 25.4) / 72} ${(3 * line.widthPt * 25.4) / 72}`
                : line.dash === "dotted"
                  ? `0 ${(2.5 * line.widthPt * 25.4) / 72}`
                  : undefined
            }
          />
        ))}
        {settings.textEnabled &&
          font &&
          lines.map((line, index) => {
            const width = font.measure(line, settings);
            const available = layout.contentX2Mm - layout.contentX1Mm;
            const x =
              layout.contentX1Mm +
              (settings.textAlign === "center"
                ? (available - width) / 2
                : settings.textAlign === "right"
                  ? available - width
                  : 0);
            return (
              line && (
                <text
                  key={layout.baselineYsMm[index]}
                  x={x}
                  y={layout.baselineYsMm[index]}
                  fontFamily={font.family}
                  fontSize={(settings.fontSizePt * 25.4) / 72}
                  fill={settings.textColor}
                  opacity={settings.textOpacity}
                  letterSpacing={settings.letterSpacingMm}
                  wordSpacing={settings.wordSpacingMm}
                  textLength={width > 0 ? width : undefined}
                  lengthAdjust="spacingAndGlyphs"
                  xmlSpace="preserve"
                >
                  {line}
                </text>
              )
            );
          })}
        {settings.calibrationMark && (
          <g stroke="#000000" fill="#444444" strokeWidth={(0.6 * 25.4) / 72}>
            <path
              d={`M ${layout.contentX1Mm} ${layout.heightMm - 4} h 25 M ${layout.contentX1Mm} ${layout.heightMm - 5} v 2 M ${layout.contentX1Mm + 25} ${layout.heightMm - 5} v 2`}
            />
            <text
              x={layout.contentX1Mm + 27}
              y={layout.heightMm - 3}
              fontFamily="Arial, sans-serif"
              fontSize={(7 * 25.4) / 72}
              stroke="none"
            >
              25 mm
            </text>
          </g>
        )}
      </g>
    </svg>
  );
}
