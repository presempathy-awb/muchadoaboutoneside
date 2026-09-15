import { expect, test } from "bun:test";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
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
    root.rotationQuaternion = new Quaternion(0, 1, 0, 0);
    const mesh = new Mesh("marked-foil", scene);
    mesh.parent = root;
    foilVertexData(
      generateFoilGeometry(FABRICATION_GEOMETRY_OPTIONS),
    ).applyToMesh(mesh);
    const view = inscriptionView(mesh);
    expect(view.target.x).toBeGreaterThan(-20);
    expect(view.target.x).toBeLessThan(0);
    expect(view.target.y).toBeGreaterThan(25);
    expect(view.target.y).toBeLessThan(40);
    expect(view.target.z).toBeGreaterThan(10);
    expect(view.position.z).toBeGreaterThan(view.target.z);
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
    expect(moved.up.equalsWithEpsilon(view.up)).toBe(true);
  } finally {
    scene.dispose();
    engine.dispose();
  }
});

test.each([false, true])(
  "reading camera shows SVG +U right and +V down (nonuniform parent: %s)",
  (transformed) => {
    const engine = new NullEngine({
      renderWidth: 1_000,
      renderHeight: 1_000,
      textureSize: 512,
      deterministicLockstep: false,
      lockstepMaxSteps: 4,
    });
    const scene = new Scene(engine);
    try {
      const parent = new TransformNode("display-transform", scene);
      if (transformed) {
        parent.scaling.set(1.8, 0.7, 1.3);
        parent.rotationQuaternion = Quaternion.FromEulerAngles(0.4, -0.3, 0.2);
        parent.position.set(12, -5, 8);
      }
      const root = new TransformNode("gltf-root", scene);
      root.parent = parent;
      root.scaling.z = -1;
      root.rotationQuaternion = new Quaternion(0, 1, 0, 0);
      const geometry = generateFoilGeometry(FABRICATION_GEOMETRY_OPTIONS);
      const mesh = new Mesh("marked-foil", scene);
      foilVertexData(geometry).applyToMesh(mesh);
      const localView = inscriptionView(mesh);
      mesh.parent = root;
      const view = inscriptionView(mesh);
      const normal = view.position.subtract(view.target).normalize();
      const expectedNormal = Vector3.TransformNormal(
        localView.position.subtract(localView.target).normalize(),
        Matrix.Transpose(mesh.getWorldMatrix().clone().invert()),
      ).normalize();
      expect(normal.equalsWithEpsilon(expectedNormal, 1e-6)).toBe(true);
      expect(Vector3.Dot(view.up, normal)).toBeCloseTo(0, 6);
      expect(view.up.length()).toBeCloseTo(1, 6);

      const camera = new ArcRotateCamera(
        "reading-camera",
        0,
        Math.PI / 2,
        36,
        Vector3.Zero(),
        scene,
      );
      camera.upVector = view.up;
      camera.target.copyFrom(view.target);
      camera.setPosition(view.position);
      scene.activeCamera = camera;
      scene.render();

      // Locate the actual target in the chart, then sample independent mesh
      // neighbors that increase U and V, rather than copying the tangent math.
      let nearest = 0;
      let distance = Number.POSITIVE_INFINITY;
      for (let index = 0; index < geometry.positions.length / 3; index++) {
        const point = Vector3.TransformCoordinates(
          Vector3.FromArray(geometry.positions, index * 3),
          mesh.getWorldMatrix(),
        );
        const candidate = Vector3.DistanceSquared(point, view.target);
        if (candidate < distance) {
          distance = candidate;
          nearest = index;
        }
      }
      const project = (index: number) =>
        Vector3.Project(
          Vector3.FromArray(geometry.positions, index * 3),
          mesh.getWorldMatrix(),
          scene.getTransformMatrix(),
          camera.viewport.toGlobal(1_000, 1_000),
        );
      const origin = project(nearest);
      const right = project(nearest + 1).subtract(origin);
      const down = project(nearest + geometry.verticesPerMeridian).subtract(
        origin,
      );
      expect(right.x).toBeGreaterThan(0);
      expect(down.y).toBeGreaterThan(0);
      // Positive screen determinant excludes a reflected inscription.
      expect(right.x * down.y - right.y * down.x).toBeGreaterThan(0);
      expect(Math.abs(right.y)).toBeLessThan(right.x);
      expect(Math.abs(down.x)).toBeLessThan(down.y);

      // Reset the rolled ArcRotate camera in the controller's order. Its
      // resulting matrix must match a fresh overview camera with world-up.
      const overviewTarget = new Vector3(0, 103, 0);
      const overview = new ArcRotateCamera(
        "fresh-overview",
        -Math.PI / 2.4,
        Math.PI / 2.7,
        420,
        overviewTarget,
        scene,
      );
      camera.upVector = Vector3.Up();
      camera.alpha = overview.alpha;
      camera.beta = overview.beta;
      camera.radius = overview.radius;
      camera.target.copyFrom(overviewTarget);
      const resetMatrix = camera.getViewMatrix().asArray();
      const freshMatrix = overview.getViewMatrix().asArray();
      for (let index = 0; index < 16; index++) {
        expect(resetMatrix[index]).toBeCloseTo(freshMatrix[index] ?? 0, 6);
      }
    } finally {
      scene.dispose();
      engine.dispose();
    }
  },
);
