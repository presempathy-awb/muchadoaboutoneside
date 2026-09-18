import { expect, spyOn, test } from "bun:test";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { CANONICAL_POEM, DEFAULT_POEM } from "../../shared/poem";
import { createFoilSkin } from "./foil-skin";
import type { ScaleTypography } from "./scale-typography";
import * as studio from "./studio-reflection";

test("foil scan updates commit both atlases before releasing prior ink and retain it after a failed replacement", async () => {
  const descriptors = ["document", "Image"].map(
    (name) =>
      [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const,
  );
  const canvases: {
    width: number;
    height: number;
    draws: number;
    getContext(): unknown;
  }[] = [];
  let resolveFonts: () => void = () => {};
  const fontsReady = new Promise<void>((resolve) => {
    resolveFonts = resolve;
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      addEventListener() {},
      removeEventListener() {},
      fonts: { load: () => fontsReady },
      createElement() {
        const canvas = {
          width: 0,
          height: 0,
          draws: 0,
          getContext: () => context,
        };
        const context = {
          save() {},
          restore() {},
          scale() {},
          translate() {},
          fillRect() {},
          drawImage() {
            canvas.draws++;
          },
          setLineDash() {},
          strokeRect() {},
          beginPath() {},
          moveTo() {},
          lineTo() {},
          stroke() {},
          measureText: (text: string) => ({ width: text.length * 5 }),
          fillText() {},
        };
        canvases.push(canvas);
        return canvas;
      },
    },
  });
  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    value: class {
      onload?: () => void;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    },
  });
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const reflection = spyOn(studio, "makeStudioReflection").mockImplementation(
    () => null as unknown as ReturnType<typeof studio.makeStudioReflection>,
  );
  let disposeGood = 0;
  let disposeBad = 0;
  let goodDraws = 0;
  const good: ScaleTypography = {
    family: "Good ink",
    engine: "scan",
    supportedFeatures: [],
    hasGlyph: () => true,
    shape() {
      throw new Error("Raster ink");
    },
    measure: (_text, size) => 200 * size,
    measureLine: (_text, size) => ({ widthMm: 200 * size, heightMm: 2 * size }),
    draw() {
      goodDraws++;
    },
    dispose() {
      disposeGood++;
    },
  };
  const bad: ScaleTypography = {
    ...good,
    family: "Bad ink",
    draw(_context, _text, size) {
      if (size < 20) throw new Error("Jaw ink failed");
    },
    dispose() {
      disposeBad++;
    },
  };
  try {
    const skin = await createFoilSkin(scene, null, CANONICAL_POEM);
    if (!skin) throw new Error("Expected foil controller");
    await skin.setPoemVersion(CANONICAL_POEM, good);
    const body = canvases[0];
    const jaw = canvases[2];
    expect(body?.draws).toBe(2);
    expect(jaw?.draws).toBe(2);
    const count = goodDraws;
    await expect(skin.setPoemVersion(DEFAULT_POEM, bad)).rejects.toThrow(
      "Jaw ink failed",
    );
    expect(body?.draws).toBe(2);
    expect(jaw?.draws).toBe(2);
    expect(disposeBad).toBe(1);
    expect(disposeGood).toBe(0);
    skin.setSeams(true);
    expect(goodDraws).toBeGreaterThan(count);
    const beforeCancellation = [body?.draws, jaw?.draws];
    const cancelledScript = skin.setPoemVersion(DEFAULT_POEM);
    // Choosing unavailable handwriting submits no replacement update. Cleanup
    // must still prevent this older font wait from replacing the retained scan.
    skin.cancelPendingPoemVersion();
    resolveFonts();
    await cancelledScript;
    expect([body?.draws, jaw?.draws]).toEqual(beforeCancellation);
    expect(disposeGood).toBe(0);
    const beforeCancelledToggle = goodDraws;
    skin.setLettering(false);
    skin.setLettering(true);
    expect(goodDraws).toBeGreaterThan(beforeCancelledToggle);
    expect(disposeGood).toBe(0);
    let disposeReplacement = 0;
    const replacement = {
      ...good,
      dispose() {
        disposeReplacement++;
      },
    };
    const staleScript = skin.setPoemVersion(DEFAULT_POEM);
    await skin.setPoemVersion(CANONICAL_POEM, replacement);
    await staleScript;
    expect(disposeGood).toBe(1);
    expect(disposeReplacement).toBe(0);
    const beforeToggle = goodDraws;
    skin.setSeams(false);
    expect(goodDraws).toBeGreaterThan(beforeToggle);
    await skin.setPoemVersion(DEFAULT_POEM);
    expect(disposeGood).toBe(1);
    expect(disposeReplacement).toBe(1);
    const countAfterFont = goodDraws;
    skin.setLettering(false);
    skin.setLettering(true);
    expect(goodDraws).toBe(countAfterFont);
    skin.dispose();
    expect(disposeGood).toBe(1);
  } finally {
    reflection.mockRestore();
    scene.dispose();
    engine.dispose();
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
