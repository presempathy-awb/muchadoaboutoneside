import { expect, test } from "bun:test";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { FABRICATION_GEOMETRY_OPTIONS as options } from "../../shared/fabrication";
import sections from "../../shared/foil-sections.json";
import { generateFoilGeometry } from "./foil-geometry";
import { foilVertexData } from "./foil-mesh";

const geometry = generateFoilGeometry(options);
const parts = [
  {
    name: "body",
    geometry,
    sectionCount: sections.sections.length + sections.upperHeadSections.length,
  },
  {
    name: "jaw",
    geometry: geometry.jawGeometry,
    sectionCount: sections.jawSections.length,
  },
];

test.each(parts)(
  "$name foil normals face outward before and after the glTF root transform",
  ({ geometry: part, sectionCount }) => {
    const data = foilVertexData(part);
    expect(data.positions).toBe(part.positions);
    expect(data.indices).toBe(part.indices);
    expect(data.uvs).toBe(part.uvs);
    const normals = data.normals;
    if (!normals) throw new Error("The rendered foil requires normals.");
    expect(normals.length).toBe(part.positions.length);

    const world = Matrix.Scaling(1, 1, -1);
    const normalMatrix = Matrix.Transpose(Matrix.Invert(world));
    const point = (row: number, column: number) =>
      Vector3.FromArray(
        part.positions,
        (row * part.verticesPerMeridian + column) * 3,
      );
    const frontCount = (sectionCount - 1) * options.subdivisionsPerSpan + 1;
    const middleRow = part.meridianCount / 2;
    let minimumLocalDot = 1;
    let minimumWorldDot = 1;
    let samples = 0;

    // Opposite front/back points identify each actual section's center.
    // Skip cap corners and singular side meridians, where normals are blended.
    for (let front = 1; front < frontCount - 1; front++) {
      const back = 2 * frontCount + options.capSteps - 2 - front;
      const center = point(middleRow, front)
        .add(point(middleRow, back))
        .scale(0.5);
      for (let row = 1; row < part.meridianCount; row++) {
        for (const column of [front, back]) {
          const radial = point(row, column).subtract(center).normalize();
          const normal = Vector3.FromArray(
            normals,
            (row * part.verticesPerMeridian + column) * 3,
          );
          minimumLocalDot = Math.min(
            minimumLocalDot,
            Vector3.Dot(normal, radial),
          );
          minimumWorldDot = Math.min(
            minimumWorldDot,
            Vector3.Dot(
              Vector3.TransformNormal(normal, normalMatrix).normalize(),
              Vector3.TransformNormal(radial, world).normalize(),
            ),
          );
          samples++;
        }
      }
    }

    expect(samples).toBe(2 * (frontCount - 2) * (part.meridianCount - 1));
    expect(samples).toBeGreaterThan(0);
    expect(minimumLocalDot).toBeGreaterThan(0.7);
    expect(minimumWorldDot).toBeGreaterThan(0.7);
  },
);
