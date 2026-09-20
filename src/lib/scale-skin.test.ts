import { expect, spyOn, test } from "bun:test";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import { DEFAULT_SCALE_DESIGN } from "../../shared/scale-design";
import { allocateScaleLettering } from "../../shared/scale-lettering";
import { generateScaleStudy } from "../../shared/scale-study";
import { planScaleAtlases, type ScaleAtlasPlan } from "./scale-atlas";
import { createScaleSkin, type ScalePreview } from "./scale-skin";

test("a paused render loop settles the fade and commits its newest queued preview", async () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const root = new TransformNode("paused-render-root", scene);
  const committed: ScalePreview[] = [];
  const skin = createScaleSkin(scene, root, {
    onCommit: (preview) => committed.push(preview),
  });
  try {
    const generated = generateScaleStudy({
      columns: 4,
      rows: 2,
      surfaceMode: "planar",
    });
    const study = { ...generated, plates: generated.plates.slice(0, 1) };
    const makePreview = (plateColor: string): ScalePreview => ({
      study,
      lettering: {
        placements: [],
        unplacedText: "",
        placedWordCount: 0,
        totalWordCount: 0,
      },
      design: { ...DEFAULT_SCALE_DESIGN, showLettering: false, plateColor },
      fontFamily: "serif",
    });
    const first = makePreview("#aaaaaa");
    const second = makePreview("#bbbbbb");
    const superseded = makePreview("#cccccc");
    const latest = makePreview("#dddddd");
    skin.update(first);
    const firstMeshes = [...skin.getMeshes()];
    skin.update(second);
    const secondMeshes = [...skin.getMeshes()];
    skin.update(superseded);
    skin.update(latest);
    expect(committed).toEqual([first, second]);
    expect(firstMeshes).toHaveLength(3);
    expect(secondMeshes).toHaveLength(3);
    expect(scene.meshes.length).toBe(firstMeshes.length + secondMeshes.length);
    // No render, observer notification, visibility change, or reduced-motion
    // toggle may be needed to release the queued newest complete preview.
    await Bun.sleep(850);
    expect(committed.at(-1)).toBe(latest);
    expect(committed.includes(superseded)).toBe(false);
    expect(scene.meshes.length).toBe(firstMeshes.length);
    expect(
      [...firstMeshes, ...secondMeshes].every((mesh) => mesh.isDisposed()),
    ).toBe(true);
    expect(scene.meshes).toEqual([...skin.getMeshes()]);
    expect(skin.getMeshes().every((mesh) => mesh.visibility === 1)).toBe(true);
    expect(scene.materials.length).toBe(scene.meshes.length);
    expect(
      scene.textures.filter((texture) =>
        texture.name.startsWith("scale-atlas-"),
      ).length,
    ).toBe(0);
  } finally {
    skin.dispose();
    scene.dispose();
    engine.dispose();
  }
});

test("disposing a paused fade cancels its deadline and queued preview", async () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const root = new TransformNode("disposed-render-root", scene);
  const committed: ScalePreview[] = [];
  const skin = createScaleSkin(scene, root, {
    onCommit: (preview) => committed.push(preview),
  });
  try {
    const generated = generateScaleStudy({
      columns: 4,
      rows: 2,
      surfaceMode: "planar",
    });
    const study = { ...generated, plates: generated.plates.slice(0, 1) };
    const base: ScalePreview = {
      study,
      lettering: {
        placements: [],
        unplacedText: "",
        placedWordCount: 0,
        totalWordCount: 0,
      },
      design: { ...DEFAULT_SCALE_DESIGN, showLettering: false },
      fontFamily: "serif",
    };
    const fading = {
      ...base,
      design: { ...base.design, plateColor: "#aaaaaa" },
    };
    const queued = {
      ...base,
      design: { ...base.design, plateColor: "#bbbbbb" },
    };
    skin.update(base);
    skin.update(fading);
    skin.update(queued);
    expect(committed).toEqual([base, fading]);
    skin.dispose();
    await Bun.sleep(850);
    expect(committed).toEqual([base, fading]);
    expect(scene.meshes.length).toBe(0);
    expect(scene.materials.length).toBe(0);
    expect(
      scene.textures.filter((texture) =>
        texture.name.startsWith("scale-atlas-"),
      ).length,
    ).toBe(0);
  } finally {
    skin.dispose();
    scene.dispose();
    engine.dispose();
  }
});

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
    const committedPlans = new Map<ScalePreview, ScaleAtlasPlan>();
    const failed: { preview: ScalePreview; error: unknown }[] = [];
    const skin = createScaleSkin(scene, root, {
      onCommit: (preview, atlasPlan) => {
        committed.push(preview);
        committedPlans.set(preview, atlasPlan);
      },
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
      const committedPreview = committed.at(-1);
      expect(committedPreview && committedPlans.get(committedPreview)).toEqual(
        plan,
      );
      expect(scene.meshes.length).toBeLessThanOrEqual(25);
      expect(scene.materials.length).toBe(scene.meshes.length);
      expect(
        scene.textures.filter((texture) =>
          texture.name.startsWith("scale-atlas-"),
        ).length,
      ).toBe(topMeshes.length);
      expect(
        scene.meshes.reduce((sum, mesh) => sum + mesh.getTotalIndices() / 3, 0),
      ).toBe(
        study.triangleCount + (study.sourceGeometry?.indices.length ?? 0) / 3,
      );
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
    // Quality alone changes atlas dimensions and therefore UVs. Reusing the old
    // top geometry here would sample the wrong rectangles in the crisp texture.
    const previousGpuLimit = engine.getCaps().maxTextureSize;
    engine.getCaps().maxTextureSize = 4096;
    try {
      const qualityStudy = makeStudy(1);
      const qualityLettering = {
        placements: [
          {
            plateId: qualityStudy.plates[0]?.id ?? "",
            lines: ["Words"],
            fontSizeMm: 16,
          },
        ],
        unplacedText: "",
        placedWordCount: 1,
        totalWordCount: 1,
      };
      const balanced: ScalePreview = {
        study: qualityStudy,
        lettering: qualityLettering,
        design: { ...DEFAULT_SCALE_DESIGN, letteringQuality: "balanced" },
        fontFamily: "serif",
      };
      skin.update(balanced);
      const balancedTop = skin
        .getMeshes()
        .find((mesh) => mesh.name === "scales-lettered-0");
      const balancedGeometry = balancedTop?.geometry;
      const balancedUvs = balancedTop?.getVerticesData(VertexBuffer.UVKind);
      const edgesGeometry = skin
        .getMeshes()
        .find((mesh) => mesh.name === "scale-sidewalls")?.geometry;
      const balancedCanvases = canvases.filter((canvas) => canvas.width > 0);
      const crisp: ScalePreview = {
        ...balanced,
        design: { ...balanced.design, letteringQuality: "crisp" },
      };
      skin.update(crisp);
      const crispTop = skin
        .getMeshes()
        .find((mesh) => mesh.name === "scales-lettered-0");
      expect(crispTop?.geometry).not.toBe(balancedGeometry);
      expect(crispTop?.getVerticesData(VertexBuffer.UVKind)).not.toEqual(
        balancedUvs,
      );
      expect(
        skin.getMeshes().find((mesh) => mesh.name === "scale-sidewalls")
          ?.geometry,
      ).toBe(edgesGeometry);
      expect(balancedTop?.isDisposed()).toBe(true);
      expect(
        balancedCanvases.every(
          (canvas) => canvas.width === 0 && canvas.height === 0,
        ),
      ).toBe(true);
      const plan = planScaleAtlases(
        qualityStudy,
        qualityLettering,
        true,
        4096,
        { quality: "crisp" },
      );
      expect(committedPlans.get(crisp)).toEqual(plan);
      expect(committedPlans.get(crisp)?.minPixelsPerEm).toBeGreaterThan(
        planScaleAtlases(qualityStudy, qualityLettering, true, 2048)
          .minPixelsPerEm ?? 0,
      );
      const canvas = canvases.find((candidate) => candidate.width > 0);
      expect(canvas?.width).toBe(plan.atlases[0]?.width);
      expect(canvas?.width).toBe(4096);
      const atlas = scene.textures.find(
        (texture) => texture.name === "scale-atlas-0",
      );
      expect(atlas?.getInternalTexture()?.generateMipMaps).toBe(true);
      expect(atlas?.getInternalTexture()?.samplingMode).toBe(
        Texture.TRILINEAR_SAMPLINGMODE,
      );
      expect(atlas?.anisotropicFilteringLevel).toBe(
        Math.max(1, engine.getCaps().maxAnisotropy),
      );
      const allocated = canvasCount;
      skin.update({
        ...crisp,
        design: { ...crisp.design, letteringQuality: undefined },
      });
      expect(canvasCount).toBe(allocated);
      expect(committed.at(-1)?.design.letteringQuality).toBeUndefined();
    } finally {
      engine.getCaps().maxTextureSize = previousGpuLimit;
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
    expect(scene.meshes.length).toBe(3);
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
      expect(scene.meshes.length).toBe(6);
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
      expect(scene.meshes.length).toBe(6);
      now += 160;
      scene.onBeforeRenderObservable.notifyObservers(scene);
      expect(firstMeshes.every((mesh) => mesh.isDisposed())).toBe(true);
      expect(
        nextMeshes.every((mesh) => mesh.visibility === 1 && !mesh.isDisposed()),
      ).toBe(true);
      const latestMeshes = [...skin.getMeshes()];
      expect(latestMeshes.every((mesh) => mesh.visibility === 0)).toBe(true);
      expect(scene.meshes.length).toBe(6);
      expect(committed.at(-1)).toBe(latest);
      expect(committed.includes(superseded)).toBe(false);
      expect(committedPlans.has(superseded)).toBe(false);
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
      expect(committedPlans.has(failedPreview)).toBe(false);
      const next = { ...preview, study: makeStudy(5) };
      const reducedLatest = { ...preview, study: makeStudy(6) };
      skin.update(next);
      skin.update(superseded);
      skin.update(reducedLatest);
      expect(committed.at(-1)).toBe(next);
      expect(scene.meshes.length).toBe(6);
      skin.setReducedMotion(true);
      expect(committed.at(-1)).toBe(reducedLatest);
      expect(committed.includes(superseded)).toBe(false);
      expect(scene.meshes.length).toBe(3);
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
      expect(committedPlans.get(metadata)).toBe(
        committedPlans.get(reducedLatest),
      );
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
    // Scroll out during a font fade, then edit colors at the proof below it.
    // No render notifications occur: hiding must flush the latest complete
    // request and every later hidden update must commit without a frame.
    const hiddenBase: ScalePreview = {
      study: makeStudy(1),
      lettering: { ...lettering, placements: lettering.placements.slice(0, 1) },
      design: DEFAULT_SCALE_DESIGN,
      fontFamily: "before-font-change",
    };
    skin.update(hiddenBase);
    const beforeHideMeshes = [...skin.getMeshes()];
    skin.setReducedMotion(false);
    const fontChange = { ...hiddenBase, fontFamily: "after-font-change" };
    skin.update(fontChange);
    const fadingMeshes = [...skin.getMeshes()];
    expect(fadingMeshes.every((mesh) => mesh.visibility === 0)).toBe(true);
    const skippedColor = {
      ...fontChange,
      design: { ...fontChange.design, inkColor: "#123456" },
    };
    const latestColor = {
      ...fontChange,
      design: { ...fontChange.design, inkColor: "#654321" },
    };
    skin.update(skippedColor);
    skin.update(latestColor);
    expect(committed.at(-1)).toBe(fontChange);
    skin.setVisible(false);
    expect(committed.at(-1)).toBe(latestColor);
    expect(committedPlans.has(skippedColor)).toBe(false);
    expect(committedPlans.get(latestColor)).toEqual(
      planScaleAtlases(
        latestColor.study,
        latestColor.lettering,
        true,
        engine.getCaps().maxTextureSize,
      ),
    );
    expect(
      [...beforeHideMeshes, ...fadingMeshes].every((mesh) => mesh.isDisposed()),
    ).toBe(true);
    expect(scene.meshes).toEqual([...skin.getMeshes()]);
    expect(skin.getMeshes().every((mesh) => mesh.visibility === 1)).toBe(true);
    const hiddenColor = {
      ...latestColor,
      design: { ...latestColor.design, plateColor: "#abcdef" },
    };
    skin.update(hiddenColor);
    expect(committed.at(-1)).toBe(hiddenColor);
    expect(scene.meshes).toEqual([...skin.getMeshes()]);
    expect(skin.getMeshes().every((mesh) => mesh.visibility === 1)).toBe(true);

    // Visibility must not overwrite the user's motion preference. Returning
    // with motion enabled animates again, while reduced motion stays immediate.
    skin.setVisible(true);
    const resumed = { ...hiddenColor, fontFamily: "visible-font-change" };
    skin.update(resumed);
    const resumedMeshes = [...skin.getMeshes()];
    expect(resumedMeshes.every((mesh) => mesh.visibility === 0)).toBe(true);
    const hiddenFailure = {
      ...resumed,
      design: { ...resumed.design, inkColor: "#111111" },
    };
    skin.update(hiddenFailure);
    failCanvas = canvasCount + 1;
    failContextRead = 1;
    expect(() => skin.setVisible(false)).not.toThrow();
    expect(failed.at(-1)?.preview).toBe(hiddenFailure);
    expect(committedPlans.has(hiddenFailure)).toBe(false);
    expect(committed.at(-1)).toBe(resumed);
    expect(scene.meshes).toEqual(resumedMeshes);
    expect(
      resumedMeshes.every(
        (mesh) => mesh.visibility === 1 && !mesh.isDisposed(),
      ),
    ).toBe(true);
    failCanvas = 0;
    skin.setReducedMotion(true);
    skin.setVisible(true);
    skin.update(hiddenColor);
    expect(committed.at(-1)).toBe(hiddenColor);
    expect(scene.meshes).toEqual([...skin.getMeshes()]);
    expect(skin.getMeshes().every((mesh) => mesh.visibility === 1)).toBe(true);

    // Geometry is already in physical inches. A resized archival glTF parent
    // must scale hardware without applying that resize to the scales twice.
    root.scaling.set(2, 2, -2);
    const scaledStudy = {
      ...makeStudy(1),
      modelScale: 2,
      sourceGeometry: {
        positions: [0, 0, 0, 2, 0, 0, 0, 2, 0],
        indices: [0, 1, 2],
      },
    };
    skin.update({
      study: scaledStudy,
      lettering: { ...lettering, placements: [] },
      design: { ...DEFAULT_SCALE_DESIGN, showLettering: false },
      fontFamily: "serif",
    });
    const top = scene.meshes.find((mesh) => mesh.name === "scales-plain");
    if (!top) throw new Error("Scaled top mesh missing");
    expect(top.material instanceof PBRMaterial).toBe(true);
    if (top.material instanceof PBRMaterial) {
      expect(top.material.metallic).toBe(0);
      expect(top.material.roughness).toBe(0.88);
    }
    const first = scaledStudy.plates[0]?.positions.slice(0, 3) ?? [];
    const world = Vector3.TransformCoordinates(
      Vector3.FromArray(first),
      top.computeWorldMatrix(true),
    );
    expect(world.x).toBeCloseTo(first[0] ?? 0, 5);
    expect(world.y).toBeCloseTo(first[1] ?? 0, 5);
    expect(world.z).toBeCloseTo(-(first[2] ?? 0), 5);
    const woodSubstrate = scene.meshes.find(
      (mesh) => mesh.name === "scale-wood-substrate",
    );
    if (!woodSubstrate || !(woodSubstrate.material instanceof PBRMaterial)) {
      throw new Error("Archival wood substrate missing");
    }
    expect(woodSubstrate.getTotalIndices()).toBe(3);
    expect(
      Array.from(
        woodSubstrate.getVerticesData(VertexBuffer.PositionKind) ?? [],
      ),
    ).toEqual(scaledStudy.sourceGeometry.positions);
    expect(
      Array.from(woodSubstrate.getVerticesData(VertexBuffer.NormalKind) ?? []),
    ).toEqual([0, 0, 1, 0, 0, 1, 0, 0, 1]);
    expect(woodSubstrate.scaling.x).toBe(0.5);
    expect(woodSubstrate.material.metallic).toBe(0);
    expect(woodSubstrate.material.roughness).toBe(0.95);
    expect(woodSubstrate.material.albedoColor.toHexString()).toBe("#65503C");
    const bodyGeometry = woodSubstrate.geometry;
    skin.update({
      study: scaledStudy,
      lettering: { ...lettering, placements: [] },
      design: {
        ...DEFAULT_SCALE_DESIGN,
        showLettering: false,
        plateColor: "#c8aa83",
      },
      fontFamily: "serif",
    });
    expect(
      scene.meshes.find((mesh) => mesh.name === "scale-wood-substrate")
        ?.geometry,
    ).toBe(bodyGeometry);
    for (const [buildMethod, metallic, roughness] of [
      ["printed", 0.62, 0.46],
      ["hybrid", 0, 0.88],
    ] as const) {
      skin.update({
        study: scaledStudy,
        lettering: { ...lettering, placements: [] },
        design: {
          ...DEFAULT_SCALE_DESIGN,
          showLettering: false,
          plateColor: "#c8aa83",
          buildMethod,
        },
        fontFamily: "serif",
      });
      const changedTop = skin
        .getMeshes()
        .find((mesh) => mesh.name === "scales-plain");
      if (!(changedTop?.material instanceof PBRMaterial))
        throw new Error("Plate material missing");
      expect(changedTop.material.metallic).toBe(metallic);
      expect(changedTop.material.roughness).toBe(roughness);
    }
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
    expect(substrate?.material instanceof PBRMaterial).toBe(true);
    if (substrate?.material instanceof PBRMaterial) {
      expect(substrate.material.metallic).toBe(0);
      expect(substrate.material.roughness).toBe(0.85);
      expect(substrate.material.albedoColor.toHexString()).toBe("#AFA99C");
    }
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
    expect(committedPlans.has(cancelled)).toBe(false);
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
