import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import type { FoilMeshGeometry } from "./foil-geometry";

export function foilVertexData(
  geometry: Pick<FoilMeshGeometry, "positions" | "indices" | "uvs">,
): VertexData {
  const vertexData = new VertexData();
  vertexData.positions = geometry.positions;
  vertexData.indices = geometry.indices;
  vertexData.uvs = geometry.uvs;
  const normals: number[] = [];
  // Source triangles use right-handed winding before the glTF root transform.
  VertexData.ComputeNormals(geometry.positions, geometry.indices, normals, {
    useRightHandedSystem: true,
  });
  vertexData.normals = normals;
  return vertexData;
}
