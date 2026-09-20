import source from "./scale-maquette.json";
import radial from "./scale-maquette-body.json";
import { cross, dot, type Point2, subtract, vectorAt } from "./scale-surface";

const required = <T>(value: T | undefined): T => {
  if (value === undefined)
    throw new Error("Print-model chart data is incomplete.");
  return value;
};

const distance = (a: number[], b: number[]) =>
  Math.hypot(...a.map((v, i) => v - (b[i] ?? 0)));

/** Exact identity; changed tube proportions use precomputed operand-surface fields.
 * The union topology and plinth remain fixed. This preview is not print certification.
 */
export function deformedMaquetteBody(widthScale = 1, depthScale = 1) {
  if (
    !Number.isFinite(widthScale) ||
    !Number.isFinite(depthScale) ||
    widthScale < 0.5 ||
    widthScale > 2 ||
    depthScale < 0.5 ||
    depthScale > 2
  )
    throw new RangeError("Body width and depth must be between 50% and 200%.");
  if (widthScale === 1 && depthScale === 1)
    return { positionsMm: source.positionsMm, charts: source.charts };
  const positionsMm = source.positionsMm.map((v, i) =>
    radial.widthDisplacementsMm[i] === 0 && radial.depthDisplacementsMm[i] === 0
      ? v
      : v +
        (widthScale - 1) * (radial.widthDisplacementsMm[i] ?? 0) +
        (depthScale - 1) * (radial.depthDisplacementsMm[i] ?? 0),
  );
  for (let i = 0; i < source.indices.length; i += 3) {
    const ids = source.indices.slice(i, i + 3);
    const before = ids.map((id) => vectorAt(source.positionsMm, id));
    const after = ids.map((id) => vectorAt(positionsMm, id));
    const n0 = cross(
      subtract(required(before[1]), required(before[0])),
      subtract(required(before[2]), required(before[0])),
    );
    const n1 = cross(
      subtract(required(after[1]), required(after[0])),
      subtract(required(after[2]), required(after[0])),
    );
    if (
      !n1.every(Number.isFinite) ||
      Math.hypot(...n1) < 1e-10 ||
      dot(n0, n1) <= 0
    )
      throw new RangeError(
        "These body proportions fold a print-model junction. Reduce width or depth adjustment.",
      );
  }
  const charts = source.charts.map((chart) => {
    const positions = chart.vertices.map((id) => vectorAt(positionsMm, id));
    const first = chart.indices.slice(0, 3);
    const [ia, ib, ic] = first as [number, number, number];
    const ab = distance(required(positions[ia]), required(positions[ib]));
    const ac = distance(required(positions[ia]), required(positions[ic]));
    const bc = distance(required(positions[ib]), required(positions[ic]));
    const x = (ac * ac + ab * ab - bc * bc) / (2 * ab);
    const flat = new Map<number, Point2>([
      [ia, [0, 0]],
      [ib, [ab, 0]],
      [ic, [x, Math.sqrt(Math.max(0, ac * ac - x * x))]],
    ]);
    const accepted = [first];
    for (let offset = 3; offset < chart.indices.length; offset += 3) {
      const face = chart.indices.slice(offset, offset + 3);
      const shared = face.filter((id) => flat.has(id));
      const unknown = face.filter((id) => !flat.has(id));
      if (shared.length !== 2 || unknown.length !== 1)
        throw new Error("Print-model hinge topology changed.");
      const [aId, bId] = shared as [number, number];
      const third = required(unknown[0]);
      const parent = accepted.find(
        (prior) => prior.includes(aId) && prior.includes(bId),
      );
      const opposite = parent?.find((id) => !shared.includes(id));
      if (opposite === undefined)
        throw new Error("Print-model hinge parent is missing.");
      const a = required(flat.get(aId));
      const b = required(flat.get(bId));
      const op = required(flat.get(opposite));
      const edge = distance(a, b);
      const da = distance(required(positions[aId]), required(positions[third]));
      const db = distance(required(positions[bId]), required(positions[third]));
      const along = (da * da + edge * edge - db * db) / (2 * edge);
      const height = Math.sqrt(Math.max(0, da * da - along * along));
      const dx = (b[0] - a[0]) / edge;
      const dy = (b[1] - a[1]) / edge;
      const sign = dx * (op[1] - a[1]) - dy * (op[0] - a[0]) > 0 ? -1 : 1;
      flat.set(third, [
        a[0] + dx * along - dy * height * sign,
        a[1] + dy * along + dx * height * sign,
      ]);
      accepted.push(face);
    }
    const points = chart.vertices.map((_, id) => required(flat.get(id)));
    const minX = Math.min(...points.map((p) => p[0]));
    const minY = Math.min(...points.map((p) => p[1]));
    const widthMm = Math.max(...points.map((p) => p[0])) - minX;
    const heightMm = Math.max(...points.map((p) => p[1])) - minY;
    if (!(widthMm > 0 && heightMm > 0))
      throw new RangeError(
        "Body adjustment collapsed a print-model writing chart.",
      );
    const uvs = points.flatMap((p) => [
      (p[0] - minX) / widthMm,
      1 - (p[1] - minY) / heightMm,
    ]);
    for (let i = 0; i < chart.indices.length; i += 3) {
      const [a, b, c] = chart.indices
        .slice(i, i + 3)
        .map(
          (id) => [required(uvs[id * 2]), required(uvs[id * 2 + 1])] as Point2,
        ) as [Point2, Point2, Point2];
      if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) >= 0)
        throw new RangeError(
          "Body adjustment folded a print-model writing chart.",
        );
    }
    return { ...chart, uvs, widthMm, heightMm };
  });
  return { positionsMm, charts };
}
