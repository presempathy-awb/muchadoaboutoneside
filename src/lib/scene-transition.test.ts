import { expect, test } from "bun:test";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import {
  applyHardwareOpacity,
  type CameraPose,
  hardwareForBounds,
  hardwareScaleTarget,
  interpolateCameraPose,
  sameCameraPose,
  transitionProgress,
} from "./scene-transition";

test("hardware scales only between archival sizes and preserves the leaving model's factor", () => {
  expect(hardwareScaleTarget("archival", "maquette", 0.35, 4)).toEqual({
    factor: 0.35,
    animate: false,
    opacity: 0,
  });
  expect(hardwareScaleTarget("maquette", "archival", 1, 0.175)).toEqual({
    factor: 0.175,
    animate: false,
    opacity: 1,
  });
  expect(hardwareScaleTarget("archival", "archival", 0.35, 0.7)).toEqual({
    factor: 0.7,
    animate: true,
    opacity: 1,
  });
  expect(hardwareScaleTarget("maquette", "maquette", 0.35, 8)).toEqual({
    factor: 0.35,
    animate: false,
    opacity: 0,
  });
  expect(hardwareScaleTarget(undefined, "archival", 1, 0.35).animate).toBe(
    false,
  );
});

test("hardware crossfades at the correct size and destination bounds ignore departing fittings", () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  try {
    const root = new TransformNode("archival-root", scene);
    const meshes = new Map<string, Mesh[]>();
    for (const part of ["base", "eyes", "ribs"]) {
      const mesh = new Mesh(part, scene);
      const data = new VertexData();
      data.positions = [0, 0, 0, 1, 0, 0, 0, 1, 0];
      data.indices = [0, 1, 2];
      data.applyToMesh(mesh);
      mesh.parent = root;
      meshes.set(part, [mesh]);
    }
    const base = meshes.get("base")?.[0];
    if (!base) throw new Error("Expected fixture base");
    const allowed = (part: string) => part !== "eyes" && part !== "ribs";
    const outgoing = hardwareScaleTarget("archival", "maquette", 0.35, 1);
    root.scaling.setAll(outgoing.factor);
    for (const elapsed of [0, 160, 320]) {
      const opacity = 1 - transitionProgress(0, elapsed, 320);
      applyHardwareOpacity(meshes, allowed, opacity);
      expect(base.visibility).toBe(opacity);
      expect(base.isEnabled()).toBe(opacity > 0);
      expect(meshes.get("eyes")?.[0]?.isEnabled()).toBe(false);
      expect(meshes.get("ribs")?.[0]?.isEnabled()).toBe(false);
      base.computeWorldMatrix(true);
      expect(base.getBoundingInfo().boundingBox.maximumWorld.x).toBeCloseTo(
        0.35,
      );
      // Departing hardware may still be enabled, but the maquette frame excludes it.
      expect(hardwareForBounds(meshes, () => false)).toEqual([]);
    }
    const incoming = hardwareScaleTarget(
      "maquette",
      "archival",
      outgoing.factor,
      0.175,
    );
    root.scaling.setAll(incoming.factor);
    // Fit the arriving base even at zero opacity, before it becomes enabled.
    expect(base.isEnabled()).toBe(false);
    expect(hardwareForBounds(meshes, allowed)).toEqual([base]);
    for (const elapsed of [0, 160, 320]) {
      const opacity = transitionProgress(0, elapsed, 320);
      applyHardwareOpacity(meshes, allowed, opacity);
      expect(base.visibility).toBe(opacity);
      expect(base.isEnabled()).toBe(opacity > 0);
      base.computeWorldMatrix(true);
      expect(base.getBoundingInfo().boundingBox.maximumWorld.x).toBeCloseTo(
        0.175,
      );
      expect(meshes.get("eyes")?.[0]?.isEnabled()).toBe(false);
    }
    // Reduced motion uses the same endpoint setter and hidden parts remain hidden.
    applyHardwareOpacity(meshes, allowed, 0);
    expect(base.isEnabled()).toBe(false);
    applyHardwareOpacity(meshes, allowed, 1);
    expect(base.isEnabled()).toBe(true);
    expect(meshes.get("eyes")?.[0]?.isEnabled()).toBe(false);
  } finally {
    scene.dispose();
    engine.dispose();
  }
});

test("camera easing is bounded, frame-rate independent, and immediate for reduced motion", () => {
  expect(transitionProgress(100, 90, 400)).toBe(0);
  expect(transitionProgress(100, 100, 400)).toBe(0);
  expect(transitionProgress(100, 300, 400)).toBe(0.5);
  expect(transitionProgress(100, 500, 400)).toBe(1);
  expect(transitionProgress(100, 5000, 400)).toBe(1);
  expect(transitionProgress(100, 100, 0)).toBe(1);
  expect(transitionProgress(100, 100, Number.NaN)).toBe(1);
  let previous = 0;
  for (let now = 100; now <= 500; now += 8) {
    const amount = transitionProgress(100, now, 400);
    expect(amount).toBeGreaterThanOrEqual(previous);
    expect(amount).toBeLessThanOrEqual(1);
    previous = amount;
  }
});

test("camera pose crosses the short orbit arc and zooms evenly across model sizes", () => {
  const from: CameraPose = {
    alpha: Math.PI * 1.9,
    beta: 1,
    radius: 100,
    target: [0, 10, 0],
  };
  const to: CameraPose = {
    alpha: Math.PI * 0.1,
    beta: 2,
    radius: 1,
    target: [10, 0, 2],
  };
  const midpoint = interpolateCameraPose(from, to, 0.5);
  expect(midpoint.alpha).toBeCloseTo(Math.PI * 2);
  expect(midpoint.beta).toBe(1.5);
  expect(midpoint.radius).toBeCloseTo(10);
  expect(midpoint.target).toEqual([5, 5, 1]);
  const end = interpolateCameraPose(from, to, 1);
  expect(end.radius).toBeCloseTo(to.radius);
  expect(end.target).toEqual(to.target);
  expect(Math.cos(end.alpha)).toBeCloseTo(Math.cos(to.alpha));
  // An interrupted transition starts exactly at its last displayed pose.
  const replacement = interpolateCameraPose(midpoint, from, 0);
  expect(replacement.alpha).toBe(midpoint.alpha);
  expect(replacement.radius).toBeCloseTo(midpoint.radius);
  expect(replacement.target).toEqual(midpoint.target);
  expect(
    sameCameraPose(from, { ...from, alpha: from.alpha + Math.PI * 2 }),
  ).toBe(true);
  expect(sameCameraPose(from, { ...from, radius: from.radius * 1.1 })).toBe(
    false,
  );
  expect(sameCameraPose(from, { ...from, target: [1, 10, 0] })).toBe(false);
});
