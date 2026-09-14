import { expect, test } from "bun:test";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import { FABRICATION_GEOMETRY_OPTIONS } from "../../shared/fabrication";
import { generateFoilGeometry } from "./foil-geometry";
import { foilVertexData } from "./foil-mesh";
import { inscriptionView } from "./inscription-view";

test("reading view faces the marked lower bend outside the mirrored glTF surface", () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  try {
    const root = new TransformNode("gltf-root", scene);
    root.scaling.z = -1;
    const mesh = new Mesh("marked-foil", scene);
    mesh.parent = root;
    foilVertexData(
      generateFoilGeometry(FABRICATION_GEOMETRY_OPTIONS),
    ).applyToMesh(mesh);
    const view = inscriptionView(mesh);
    expect(view.target.x).toBeGreaterThan(0);
    expect(view.target.x).toBeLessThan(20);
    expect(view.target.y).toBeGreaterThan(25);
    expect(view.target.y).toBeLessThan(40);
    expect(view.target.z).toBeLessThan(-10);
    expect(view.position.z).toBeLessThan(view.target.z);
    expect(Vector3.Distance(view.position, view.target)).toBeCloseTo(36, 5);
    root.position.set(20, 10, 5);
    root.computeWorldMatrix(true);
    const moved = inscriptionView(mesh);
    expect(
      moved.target.subtract(view.target).equalsWithEpsilon(root.position),
    ).toBe(true);
    expect(
      moved.position.subtract(view.position).equalsWithEpsilon(root.position),
    ).toBe(true);
  } finally {
    scene.dispose();
    engine.dispose();
  }
});
