import type { ScaleDesign } from "../../shared/scale-design";
import type { ScaleLetteringPlacement } from "../../shared/scale-lettering";
import type { ScalePlate } from "../../shared/scale-study";
import type { ScaleTypography } from "./scale-typography";

/** Draw in physical millimetres, then map the face into its atlas/proof rectangle. */
export function drawScalePlate(
  context: CanvasRenderingContext2D,
  plate: ScalePlate,
  placement: ScaleLetteringPlacement | undefined,
  design: ScaleDesign,
  fontFamily: string,
  target: { x: number; y: number; width: number; height: number },
  typography?: ScaleTypography,
) {
  context.save();
  try {
    context.translate(target.x, target.y);
    context.scale(target.width, target.height);
    context.fillStyle = design.plateColor;
    context.fillRect(0, 0, 1, 1);
    if (design.showLettering && placement?.lines.length) {
      const width = plate.widthInches * 25.4;
      const height = plate.heightInches * 25.4;
      context.scale(1 / width, 1 / height);
      const rect = {
        x: plate.safeRect.x * width + design.marginMm,
        y: plate.safeRect.y * height + design.marginMm,
        width: plate.safeRect.width * width - design.marginMm * 2,
        height: plate.safeRect.height * height - design.marginMm * 2,
      };
      context.beginPath();
      context.rect(
        rect.x,
        rect.y,
        Math.max(0, rect.width),
        Math.max(0, rect.height),
      );
      context.clip();
      context.fillStyle = design.inkColor;
      context.font = `${placement.fontSizeMm}px "${fontFamily}", serif`;
      context.textBaseline = "alphabetic";
      const lineHeights =
        placement.lineHeightsMm ??
        placement.lines.map(() => placement.fontSizeMm * 1.4);
      const top =
        rect.y +
        (rect.height - lineHeights.reduce((sum, height) => sum + height, 0)) /
          2;
      let cursor = top;
      placement.lines.forEach((line, index) => {
        const lineHeight = lineHeights[index] ?? placement.fontSizeMm * 1.4;
        const centerY = cursor + lineHeight / 2;
        cursor += lineHeight;
        if (typography) {
          typography.draw(
            context,
            line,
            placement.fontSizeMm,
            rect.x + rect.width / 2,
            centerY,
          );
          return;
        }
        const metrics = context.measureText(line);
        const left = metrics.actualBoundingBoxLeft;
        const right = metrics.actualBoundingBoxRight;
        const ascent = metrics.actualBoundingBoxAscent;
        const descent = metrics.actualBoundingBoxDescent;
        context.save();
        context.translate(rect.x + rect.width / 2, centerY);
        context.fillText(line, -(right - left) / 2, (ascent - descent) / 2);
        context.restore();
      });
    }
  } finally {
    context.restore();
  }
}
