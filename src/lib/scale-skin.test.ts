import { expect, spyOn, test } from "bun:test";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import { DEFAULT_SCALE_DESIGN } from "../../shared/scale-design";
import { allocateScaleLettering } from "../../shared/scale-lettering";
import { generateScaleStudy } from "../../shared/scale-study";
import { planScaleAtlases } from "./scale-atlas";
import { createScaleSkin, type ScalePreview } from "./scale-skin";

test("scale rebuilds keep bounded draw calls, correct UVs and no stale GPU resources", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "document");
  let canvasCount = 0;
  let failCanvas = 0;
  let failContextRead = 1;
  const canvases: { width: number; height: number }[] = [];
  const context = {
    save() {},
    restore() {},
    translate() {},
    scale() {},
    fillRect() {},
    beginPath() {},
    rect() {},
    clip() {},
    fillText() {},
    measureText() {
      return {
        width: 20,
        actualBoundingBoxLeft: 2,
        actualBoundingBoxRight: 18,
        actualBoundingBoxAscent: 8,
        actualBoundingBoxDescent: 2,
      };
    },
  };
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      addEventListener() {},
      removeEventListener() {},
      createElement() {
        canvasCount += 1;
        const shouldFail = canvasCount === failCanvas;
        let contextReads = 0;
        const canvas = {
          width: 0,
          height: 0,
          getContext() {
            contextReads += 1;
            if (shouldFail && contextReads === failContextRead)
              throw new Error("Simulated canvas allocation failure");
            return context;
          },
        };
        canvases.push(canvas);
        return canvas;
      },
    },
  });
  const engine = new NullEngine();
  const scene = new Scene(engine);
  try {
    const root = new TransformNode("gltf-root", scene);
    root.scaling.z = -1;
    const committed: ScalePreview[] = [];
    const failed: { preview: ScalePreview; error: unknown }[] = [];
    const skin = createScaleSkin(scene, root, {
      onCommit: (preview) => committed.push(preview),
      onError: (preview, error) => failed.push({ preview, error }),
    });
    skin.setReducedMotion(true);
    // Surface generation has separate geometry tests. Reuse one simple face to
    // exercise renderer pressure and repeated rebuilds without remeshing it.
    const fixtureStudy = generateScaleStudy({
      columns: 24,
      rows: 2,
      surfaceMode: "planar",
    });
    const fixturePlate = fixtureStudy.plates[0];
    if (!fixturePlate) throw new Error("Expected a generated fixture plate");
    const makeStudy = (count: number) => ({
      ...fixtureStudy,
      plates: Array.from({ length: count }, (_, index) => ({
        ...fixturePlate,
        id: `renderer-fixture-${index}`,
        widthInches: 40,
        heightInches: 2,
      })),
      triangleCount:
        (count *
          (fixturePlate.indices.length + fixturePlate.edgeIndices.length)) /
        3,
      adjustedReliefCount: 0,
    });
    for (const count of [24, 1200, 4, 24]) {
      const study = makeStudy(count);
      const lettering = allocateScaleLettering(
        study.plates,
        "A little structure for our words.",
        { fontSizeMm: 3, marginMm: 1 },
      );
      skin.update({
        study,
        lettering,
        design: DEFAULT_SCALE_DESIGN,
        fontFamily: "serif",
      });
      const topMeshes = scene.meshes.filter((mesh) =>
        mesh.name.startsWith("scales-lettered-"),
      );
      const plan = planScaleAtlases(
        study,
        lettering,
        true,
        engine.getCaps().maxTextureSize,
      );
      expect(topMeshes.length).toBe(plan.atlases.length);
      expect(scene.meshes.length).toBeLessThanOrEqual(25);
      expect(scene.materials.length).toBe(scene.meshes.length);
      expect(
        scene.textures.filter((texture) =>
          texture.name.startsWith("scale-atlas-"),
        ).length,
      ).toBe(topMeshes.length);
      expect(
        scene.meshes.reduce((sum, mesh) => sum + mesh.getTotalIndices() / 3, 0),
      ).toBe(study.triangleCount);
      for (const mesh of topMeshes) {
        expect(mesh.parent).toBe(root);
        const uvs = mesh.getVerticesData(VertexBuffer.UVKind) ?? [];
        expect(uvs.length).toBe(mesh.getTotalVertices() * 2);
        expect(uvs.every((value) => value > 0 && value < 1)).toBe(true);
      }
      for (const [atlasIndex, atlas] of plan.atlases.entries()) {
        const meshUvs =
          topMeshes[atlasIndex]?.getVerticesData(VertexBuffer.UVKind) ?? [];
        let uvIndex = 0;
        for (const slot of atlas.slots) {
          const plate = study.plates.find(
            (candidate) => candidate.id === slot.plateId,
          );
          if (!plate) throw new Error("Expected the planned plate");
          for (let index = 0; index < plate.uvs.length; index += 2) {
            expect(meshUvs[uvIndex++]).toBeCloseTo(
              (slot.x + (plate.uvs[index] ?? 0) * slot.width) / atlas.width,
              6,
            );
            expect(meshUvs[uvIndex++]).toBeCloseTo(
              (slot.y + (plate.uvs[index + 1] ?? 0) * slot.height) /
                atlas.height,
              6,
            );
          }
        }
      }
      skin.setWireframe(true);
      expect(scene.materials.every((material) => material.wireframe)).toBe(
        true,
      );
    }
    const study = makeStudy(1200);
    const lettering = {
      placements: study.plates.map((plate) => ({
        plateId: plate.id,
        lines: ["Words"],
        fontSizeMm: 3,
      })),
      unplacedText: "",
      placedWordCount: study.plates.length,
      totalWordCount: study.plates.length,
    };
    expect(
      planScaleAtlases(study, lettering, true).atlases.length,
    ).toBeGreaterThan(1);
    const goodMeshes = [...skin.getMeshes()];
    const goodMaterials = [...scene.materials];
    const goodTextures = [...scene.textures];
    const goodCanvasCount = canvasCount;
    failCanvas = canvasCount + 2;
    expect(() =>
      skin.update({
        study,
        lettering,
        design: DEFAULT_SCALE_DESIGN,
        fontFamily: "serif",
      }),
    ).toThrow("Simulated canvas allocation failure");
    expect(scene.meshes).toEqual(goodMeshes);
    expect(scene.materials).toEqual(goodMaterials);
    expect(scene.textures).toEqual(goodTextures);
    expect(
      canvases
        .slice(goodCanvasCount)
        .every((canvas) => canvas.width === 0 && canvas.height === 0),
    ).toBe(true);
    // Exercise a throw after DynamicTexture has registered itself with the scene.
    failCanvas = canvasCount + 1;
    failContextRead = 2;
    expect(() =>
      skin.update({
        study,
        lettering,
        design: DEFAULT_SCALE_DESIGN,
        fontFamily: "serif",
      }),
    ).toThrow("Simulated canvas allocation failure");
    expect(scene.meshes).toEqual(goodMeshes);
    expect(scene.materials).toEqual(goodMaterials);
    expect(scene.textures).toEqual(goodTextures);
    skin.update({
      study,
      lettering,
      design: { ...DEFAULT_SCALE_DESIGN, showLettering: false },
      fontFamily: "serif",
    });
    expect(scene.meshes.length).toBe(2);
    expect(
      scene.textures.filter((texture) =>
        texture.name.startsWith("scale-atlas-"),
      ).length,
    ).toBe(0);
    // Changes build an atomic replacement and fade only two bounded groups.
    let now = 1000;
    const clock = spyOn(performance, "now").mockImplementation(() => now);
    try {
      skin.setReducedMotion(false);
      const firstMeshes = [...skin.getMeshes()];
      const preview = {
        study: makeStudy(2),
        lettering: { ...lettering, placements: [] },
        design: { ...DEFAULT_SCALE_DESIGN, showLettering: false },
        fontFamily: "serif",
      };
      skin.update(preview);
      const nextMeshes = [...skin.getMeshes()];
      expect(nextMeshes.every((mesh) => mesh.visibility === 0)).toBe(true);
      expect(scene.meshes.length).toBe(4);
      now += 160;
      scene.onBeforeRenderObservable.notifyObservers(scene);
      expect(nextMeshes.every((mesh) => mesh.visibility === 0.5)).toBe(true);
      expect(firstMeshes.every((mesh) => mesh.visibility === 0.5)).toBe(true);
      const committedBeforeQueue = committed.length;
      const allocated = canvasCount;
      const superseded = { ...preview, study: makeStudy(3) };
      const latest = { ...preview, study: makeStudy(4) };
      skin.update(superseded);
      skin.update(latest);
      // A third/fourth request leaves both the exact opacity and resources of
      // the running A→B transition untouched; only the latest request is queued.
      expect(skin.getMeshes()).toEqual(nextMeshes);
      expect(canvasCount).toBe(allocated);
      expect(committed.length).toBe(committedBeforeQueue);
      expect(
        firstMeshes.every(
          (mesh) => mesh.visibility === 0.5 && !mesh.isDisposed(),
        ),
      ).toBe(true);
      expect(
        nextMeshes.every(
          (mesh) => mesh.visibility === 0.5 && !mesh.isDisposed(),
        ),
      ).toBe(true);
      expect(scene.meshes.length).toBe(4);
      now += 160;
      scene.onBeforeRenderObservable.notifyObservers(scene);
      expect(firstMeshes.every((mesh) => mesh.isDisposed())).toBe(true);
      expect(
        nextMeshes.every((mesh) => mesh.visibility === 1 && !mesh.isDisposed()),
      ).toBe(true);
      const latestMeshes = [...skin.getMeshes()];
      expect(latestMeshes.every((mesh) => mesh.visibility === 0)).toBe(true);
      expect(scene.meshes.length).toBe(4);
      expect(committed.at(-1)).toBe(latest);
      expect(committed.includes(superseded)).toBe(false);
      now += 160;
      scene.onBeforeRenderObservable.notifyObservers(scene);
      const failedPreview = {
        study,
        lettering,
        design: DEFAULT_SCALE_DESIGN,
        fontFamily: "serif",
      };
      failCanvas = canvasCount + 1;
      failContextRead = 1;
      // Deferred failures are reported with their exact request identity and
      // never throw from a render-loop callback or replace the working skin.
      expect(() => skin.update(failedPreview)).not.toThrow();
      expect(failed.length).toBe(0);
      expect(latestMeshes.every((mesh) => mesh.visibility === 0.5)).toBe(true);
      expect(nextMeshes.every((mesh) => mesh.visibility === 0.5)).toBe(true);
      now += 160;
      expect(() =>
        scene.onBeforeRenderObservable.notifyObservers(scene),
      ).not.toThrow();
      expect(scene.meshes).toEqual(latestMeshes);
      expect(
        latestMeshes.every(
          (mesh) => mesh.visibility === 1 && !mesh.isDisposed(),
        ),
      ).toBe(true);
      expect(failed.at(-1)?.preview).toBe(failedPreview);
      expect(failed.at(-1)?.error).toBeInstanceOf(Error);
      expect(committed.includes(failedPreview)).toBe(false);
      const next = { ...preview, study: makeStudy(5) };
      const reducedLatest = { ...preview, study: makeStudy(6) };
      skin.update(next);
      skin.update(superseded);
      skin.update(reducedLatest);
      expect(committed.at(-1)).toBe(next);
      expect(scene.meshes.length).toBe(4);
      skin.setReducedMotion(true);
      expect(committed.at(-1)).toBe(reducedLatest);
      expect(committed.includes(superseded)).toBe(false);
      expect(scene.meshes.length).toBe(2);
      expect(skin.getMeshes().every((mesh) => mesh.visibility === 1)).toBe(
        true,
      );
      // An unchanged rendered preview, including metadata-only edits, allocates nothing.
      const unchangedMeshes = [...skin.getMeshes()];
      const unchangedCanvases = canvasCount;
      const metadata = {
        ...reducedLatest,
        design: { ...reducedLatest.design, notes: "Only a note" },
      };
      skin.update(metadata);
      expect(skin.getMeshes()).toEqual(unchangedMeshes);
      expect(canvasCount).toBe(unchangedCanvases);
      expect(committed.at(-1)).toBe(metadata);
      // Ink-only updates share immutable geometry; old mesh disposal cannot
      // dispose the buffers still used by its successfully committed replacement.
      skin.update(preview);
      const colored = [...skin.getMeshes()];
      const sharedGeometry = colored.map((mesh) => mesh.geometry);
      skin.update({
        ...preview,
        design: { ...preview.design, plateColor: "#123456" },
      });
      for (const [index, mesh] of skin.getMeshes().entries()) {
        expect(mesh.geometry).toBe(sharedGeometry[index] ?? null);
        expect(mesh.getTotalIndices()).toBeGreaterThan(0);
      }
      expect(colored.every((mesh) => mesh.isDisposed())).toBe(true);
      // Parent hardware may animate, but skin coordinates remain physical inches.
      root.scaling.set(1.5, 1.5, -1.5);
      skin.setModelScale(1.5);
      const mesh = skin.getMeshes()[0];
      expect(mesh?.scaling.x).toBeCloseTo(1 / 1.5, 8);
    } finally {
      clock.mockRestore();
    }
    // Geometry is already in physical inches. A resized archival glTF parent
    // must scale hardware without applying that resize to the scales twice.
    root.scaling.set(2, 2, -2);
    const scaledStudy = { ...makeStudy(1), modelScale: 2 };
    skin.update({
      study: scaledStudy,
      lettering: { ...lettering, placements: [] },
      design: { ...DEFAULT_SCALE_DESIGN, showLettering: false },
      fontFamily: "serif",
    });
    const top = scene.meshes.find((mesh) => mesh.name === "scales-plain");
    if (!top) throw new Error("Scaled top mesh missing");
    const first = scaledStudy.plates[0]?.positions.slice(0, 3) ?? [];
    const world = Vector3.TransformCoordinates(
      Vector3.FromArray(first),
      top.computeWorldMatrix(true),
    );
    expect(world.x).toBeCloseTo(first[0] ?? 0, 5);
    expect(world.y).toBeCloseTo(first[1] ?? 0, 5);
    expect(world.z).toBeCloseTo(-(first[2] ?? 0), 5);
    root.scaling.set(1, 1, -1);
    skin.update({
      study: {
        ...scaledStudy,
        modelId: "maquette",
        sourceGeometry: {
          positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
          indices: [0, 1, 2],
        },
      },
      lettering: { ...lettering, placements: [] },
      design: { ...DEFAULT_SCALE_DESIGN, showLettering: false },
      fontFamily: "serif",
    });
    const substrate = scene.meshes.find(
      (mesh) => mesh.name === "scale-print-substrate",
    );
    expect(substrate?.getTotalIndices()).toBe(3);
    expect(substrate?.scaling.x).toBe(1);
    skin.setReducedMotion(false);
    skin.update({
      study: makeStudy(2),
      lettering: { ...lettering, placements: [] },
      design: { ...DEFAULT_SCALE_DESIGN, showLettering: false },
      fontFamily: "serif",
    });
    expect(scene.meshes.length).toBeGreaterThan(skin.getMeshes().length);
    const cancelled = {
      study: makeStudy(3),
      lettering: { ...lettering, placements: [] },
      design: { ...DEFAULT_SCALE_DESIGN, showLettering: false },
      fontFamily: "serif",
    };
    skin.update(cancelled);
    const committedBeforeDispose = committed.length;
    skin.dispose();
    scene.onBeforeRenderObservable.notifyObservers(scene);
    expect(committed.length).toBe(committedBeforeDispose);
    expect(committed.includes(cancelled)).toBe(false);
    expect(scene.meshes.length).toBe(0);
    expect(scene.materials.length).toBe(0);
    expect(
      scene.textures.filter((texture) =>
        texture.name.startsWith("scale-atlas-"),
      ).length,
    ).toBe(0);
    skin.dispose();
    expect(
      canvases.every((canvas) => canvas.width === 0 && canvas.height === 0),
    ).toBe(true);
  } finally {
    scene.dispose();
    engine.dispose();
    if (original) Object.defineProperty(globalThis, "document", original);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
