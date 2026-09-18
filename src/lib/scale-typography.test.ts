import { describe, expect, test } from "bun:test";
import {
  allocateScaleLettering,
  fitScaleLettering,
  type ScaleLetteringPlate,
} from "../../shared/scale-lettering";
import { WORKSHEET_FONT_CATALOG } from "../../shared/worksheet-font-catalog";
import {
  loadScaleTypography,
  type ScaleTypographyRequest,
} from "./scale-typography";

async function customRequest(
  file = "GreatVibes-Regular.ttf",
  overrides: Partial<ScaleTypographyRequest> = {},
): Promise<ScaleTypographyRequest> {
  const bytes = await Bun.file(`public/fonts/${file}`).arrayBuffer();
  return {
    fontId: "custom",
    shapingEngine: "fontkit",
    fontFeatures: "",
    customFont: {
      name: file,
      dataUrl: `data:font/ttf;base64,${Buffer.from(bytes).toString("base64")}`,
    },
    ...overrides,
  };
}

function plate(widthMm: number, heightMm: number): ScaleLetteringPlate {
  return {
    id: "face",
    surface: "body",
    widthInches: widthMm / 25.4,
    heightInches: heightMm / 25.4,
    safeRect: { x: 0, y: 0, width: 1, height: 1 },
  };
}

describe("scale typography", () => {
  test("every bundled face fits its exact glyph ink and scales without changing outlines", async () => {
    for (const definition of WORKSHEET_FONT_CATALOG) {
      const typography = await loadScaleTypography(
        await customRequest(definition.path.split("/").at(-1)),
      );
      const text = "A flourish flows gracefully";
      const small = typography.shape(text, 6);
      const large = typography.shape(text, 18);
      expect(large.glyphs.map(({ path }) => path)).toEqual(
        small.glyphs.map(({ path }) => path),
      );
      expect(large.inkBoundsMm?.width).toBeCloseTo(
        (small.inkBoundsMm?.width ?? 0) * 3,
        9,
      );
      expect(large.inkBoundsMm?.height).toBeCloseTo(
        (small.inkBoundsMm?.height ?? 0) * 3,
        9,
      );
      const measured = typography.measureLine(text, 18);
      expect(measured.widthMm).toBeGreaterThanOrEqual(
        large.inkBoundsMm?.width ?? 0,
      );
      expect(measured.heightMm).toBeGreaterThan(large.inkBoundsMm?.height ?? 0);

      const result = fitScaleLettering([plate(80, 35)], text, {
        fontSizeMm: 30,
        minFontSizeMm: 2,
        marginMm: 2,
        measureLine: typography.measureLine,
      });
      expect(result.unplacedText).toBe("");
      const placement = result.placements[0];
      if (!placement) throw new Error("Expected a fitted face.");
      expect(
        placement.lineHeightsMm?.reduce((a, b) => a + b, 0),
      ).toBeLessThanOrEqual(31);
      for (const line of placement.lines) {
        expect(
          typography.measure(line, placement.fontSizeMm),
        ).toBeLessThanOrEqual(76);
      }
    }
  });

  test("Fontkit and HarfBuzz shape the selected ligatures and measure resulting bearings", async () => {
    const text = "office afflict";
    for (const shapingEngine of ["fontkit", "harfbuzz"] as const) {
      const typography = await loadScaleTypography(
        await customRequest("GreatVibes-Regular.ttf", {
          shapingEngine,
          fontFeatures: "liga=1,calt=1",
        }),
      );
      const run = typography.shape(text, 12);
      expect(run.engine).toBe(shapingEngine);
      expect(run.glyphs.length).toBeLessThan(text.length);
      expect(run.glyphs.every(({ path }) => typeof path === "string")).toBe(
        true,
      );
      expect(typography.measureLine(text, 12).widthMm).toBeGreaterThanOrEqual(
        run.inkBoundsMm?.width ?? 0,
      );
      expect(typography.measureLine(text, 12).heightMm).toBeGreaterThan(
        run.inkBoundsMm?.height ?? 0,
      );
    }
  });

  test("larger parts reflow lettering while retaining physical font size", async () => {
    const typography = await loadScaleTypography(await customRequest());
    const text = "A little more room for graceful writing";
    const options = {
      fontSizeMm: 12,
      marginMm: 1,
      measureLine: typography.measureLine,
    };
    const small = allocateScaleLettering([plate(35, 200)], text, options);
    const large = allocateScaleLettering([plate(140, 200)], text, options);
    expect(small.unplacedText).toBe("");
    expect(large.unplacedText).toBe("");
    expect(small.placements[0]?.lines.length).toBeGreaterThan(
      large.placements[0]?.lines.length ?? 0,
    );
    expect(small.placements[0]?.fontSizeMm).toBe(
      large.placements[0]?.fontSizeMm,
    );
  });

  test("rejects unsupported glyphs, features, missing fonts, invalid font bytes and unsafe sizes", async () => {
    const typography = await loadScaleTypography(await customRequest());
    expect(typography.hasGlyph("🦕")).toBe(false);
    expect(() => typography.measureLine("🦕", 10)).toThrow("cannot print");
    expect(() =>
      fitScaleLettering([plate(200, 200)], "🦕", {
        fontSizeMm: 10,
        minFontSizeMm: 2,
        marginMm: 0,
        measureLine: typography.measureLine,
      }),
    ).toThrow("cannot print");
    await expect(
      loadScaleTypography(
        await customRequest("GreatVibes-Regular.ttf", {
          fontFeatures: "swsh=1",
        }),
      ),
    ).rejects.toThrow("does not support");
    await expect(
      loadScaleTypography({
        fontId: "custom",
        shapingEngine: "fontkit",
        fontFeatures: "",
      }),
    ).rejects.toThrow("Reselect");
    await expect(
      loadScaleTypography({
        fontId: "custom",
        shapingEngine: "fontkit",
        fontFeatures: "",
        customFont: {
          name: "bad.ttf",
          dataUrl: "data:font/ttf;base64,AAEAAA==",
        },
      }),
    ).rejects.toThrow("too short");
    for (const size of [0, -1, Number.NaN, 701])
      expect(() => typography.measure("A", size)).toThrow("Font size");
  });

  test("system fonts use actual canvas bearings and vertical ink metrics", async () => {
    const context = {
      font: "",
      textAlign: "",
      textBaseline: "",
      save() {},
      restore() {},
      measureText(this: { font: string }, text: string) {
        const size = Number.parseFloat(this.font);
        return {
          width: text.length * size,
          actualBoundingBoxLeft: size * 0.3,
          actualBoundingBoxRight: text.length * size + size * 0.5,
          actualBoundingBoxAscent: size * 2,
          actualBoundingBoxDescent: size * 0.4,
        };
      },
    } as unknown as CanvasRenderingContext2D;
    const typography = await loadScaleTypography(
      { fontId: "serif", shapingEngine: "fontkit", fontFeatures: "" },
      context,
    );
    expect(typography.measureLine("A", 10)).toEqual({
      widthMm: 18,
      heightMm: 26,
    });
    const result = allocateScaleLettering([plate(30, 20)], "A", {
      fontSizeMm: 10,
      marginMm: 0,
      measureLine: typography.measureLine,
    });
    expect(result.unplacedText).toBe("A");
    await expect(
      loadScaleTypography(
        { fontId: "serif", shapingEngine: "harfbuzz", fontFeatures: "" },
        context,
      ),
    ).rejects.toThrow("requires an embedded");
  });

  test("draws the measured shaped paths without changing glyph proportions", async () => {
    const typography = await loadScaleTypography(await customRequest());
    const run = typography.shape("A graceful flourish", 15);
    const scales: number[][] = [];
    const translations: number[][] = [];
    const paths: string[] = [];
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "Path2D");
    class TestPath {
      constructor(readonly svg: string) {}
    }
    Object.defineProperty(globalThis, "Path2D", {
      value: TestPath,
      configurable: true,
    });
    let saved = 0;
    const context = {
      save() {
        saved += 1;
      },
      restore() {
        saved -= 1;
      },
      translate(x: number, y: number) {
        translations.push([x, y]);
      },
      scale(x: number, y: number) {
        scales.push([x, y]);
      },
      fill(path: TestPath) {
        paths.push(path.svg);
      },
      fillText() {
        throw new Error(
          "Embedded paths must not use a different browser shaper.",
        );
      },
    } as unknown as CanvasRenderingContext2D;
    try {
      typography.draw(context, run.text, 15, 80, 30);
    } finally {
      if (descriptor) Object.defineProperty(globalThis, "Path2D", descriptor);
      else Reflect.deleteProperty(globalThis, "Path2D");
    }
    const visibleGlyphs = run.glyphs.filter(({ path }) => Boolean(path));
    expect(paths).toEqual(visibleGlyphs.map(({ path }) => path ?? ""));
    expect(scales).toEqual(
      visibleGlyphs.map(() => [run.pathScaleMm, -run.pathScaleMm]),
    );
    const first = visibleGlyphs[0];
    const ink = run.inkBoundsMm;
    if (!first || !ink) throw new Error("Expected visible glyphs.");
    expect(translations[0]?.[0]).toBeCloseTo(
      80 - (ink.xMin + ink.xMax) / 2 + first.xMm,
      10,
    );
    expect(translations[0]?.[1]).toBeCloseTo(
      30 + (ink.yMin + ink.yMax) / 2 - first.yMm,
      10,
    );
    expect(saved).toBe(0);
  });
});
