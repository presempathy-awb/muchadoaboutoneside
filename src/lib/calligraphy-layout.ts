export type StudioPanel = "tools" | "paper" | "writing" | "notes";

/** Fit the requested work columns without squeezing controls below usable widths. */
export function fitStudioColumns(preferred: number, width: number): number {
  return Math.min(preferred, width >= 2000 ? 4 : width >= 1300 ? 3 : 2);
}

/** Move one visible panel while preserving the order of the others. */
export function moveStudioPanel(
  order: StudioPanel[],
  source: StudioPanel,
  target: StudioPanel,
): StudioPanel[] {
  if (!order.includes(source) || !order.includes(target) || source === target)
    return order;
  const next = order.filter((panel) => panel !== source);
  next.splice(order.indexOf(target), 0, source);
  return next;
}

/** Resize adjacent columns without changing their combined space. */
export function resizeStudioPair(
  left: number,
  right: number,
  delta: number,
): [number, number] {
  const minimum = Math.min(320, (left + right) / 2);
  const width = Math.max(
    minimum,
    Math.min(left + right - minimum, left + delta),
  );
  return [width, left + right - width];
}
