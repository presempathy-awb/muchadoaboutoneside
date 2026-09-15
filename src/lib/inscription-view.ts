import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";

/** Focus on the actual marked lower bend, clear of the sculpture's crossing. */
export function inscriptionView(mesh: Mesh) {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  const normals = mesh.getVerticesData(VertexBuffer.NormalKind);
  const uvs = mesh.getVerticesData(VertexBuffer.UVKind);
  const indices = mesh.getIndices();
  if (
    !positions?.length ||
    !normals?.length ||
    !uvs?.length ||
    !indices?.length
  ) {
    throw new Error(
      "The inscription surface is missing its reading coordinates.",
    );
  }
  let nearest = 0;
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < uvs.length; index += 2) {
    const u = uvs[index];
    const v = uvs[index + 1];
    if (u === undefined || v === undefined) continue;
    const candidate = (u - 0.25) ** 2 + (v - 0.5) ** 2;
    if (candidate < distance) {
      distance = candidate;
      nearest = index / 2;
    }
  }
  const world = mesh.computeWorldMatrix(true);
  const target = Vector3.TransformCoordinates(
    Vector3.FromArray(positions, nearest * 3),
    world,
  );
  const normal = Vector3.TransformNormal(
    Vector3.FromArray(normals, nearest * 3),
    Matrix.Transpose(world.clone().invert()),
  ).normalize();
  // The SVG chart grows downward in V. Its surface tangent determines the
  // reading camera's roll without changing the artwork's laser coordinates.
  for (let offset = 0; offset < indices.length; offset += 3) {
    const a = indices[offset];
    const b = indices[offset + 1];
    const c = indices[offset + 2];
    if (a === undefined || b === undefined || c === undefined) continue;
    if (a !== nearest && b !== nearest && c !== nearest) continue;
    const du1 = (uvs[b * 2] ?? 0) - (uvs[a * 2] ?? 0);
    const dv1 = (uvs[b * 2 + 1] ?? 0) - (uvs[a * 2 + 1] ?? 0);
    const du2 = (uvs[c * 2] ?? 0) - (uvs[a * 2] ?? 0);
    const dv2 = (uvs[c * 2 + 1] ?? 0) - (uvs[a * 2 + 1] ?? 0);
    const determinant = du1 * dv2 - du2 * dv1;
    if (Math.abs(determinant) < 1e-12) continue;
    const origin = Vector3.FromArray(positions, a * 3);
    const edge1 = Vector3.FromArray(positions, b * 3).subtract(origin);
    const edge2 = Vector3.FromArray(positions, c * 3).subtract(origin);
    const down = Vector3.TransformNormal(
      edge2
        .scale(du1)
        .subtract(edge1.scale(du2))
        .scale(1 / determinant),
      world,
    );
    const up = down.subtract(normal.scale(Vector3.Dot(down, normal))).negate();
    if (up.lengthSquared() < 1e-12) continue;
    return {
      target,
      position: target.add(normal.scale(36)),
      up: up.normalize(),
    };
  }
  throw new Error("The inscription surface has no usable reading tangent.");
}
