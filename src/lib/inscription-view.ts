import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";

/** Focus on the actual marked lower bend, clear of the sculpture's crossing. */
export function inscriptionView(mesh: Mesh) {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  const normals = mesh.getVerticesData(VertexBuffer.NormalKind);
  const uvs = mesh.getVerticesData(VertexBuffer.UVKind);
  if (!positions?.length || !normals?.length || !uvs?.length) {
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
  return { target, position: target.add(normal.scale(36)) };
}
