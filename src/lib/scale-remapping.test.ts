import { beforeAll, describe, expect, spyOn, test } from "bun:test";
import {
  fitScaleLettering,
  type ScaleLetteringResult,
} from "../../shared/scale-lettering";
import { generateMaquetteScaleStudy } from "../../shared/scale-maquette";
import {
  generateScaleStudy,
  normalizeScaleStudySettings,
  type ScaleStudy,
} from "../../shared/scale-study";
import { WORKSHEET_FONT_CATALOG } from "../../shared/worksheet-font-catalog";
import { loadScaleTypography, type ScaleTypography } from "./scale-typography";

const WORDING = `A little room for graceful writing,
Each curve a place for words to grow.
The wooden frame and printed pieces
Carry the lines wherever they flow.
We measure the shape, the ink, the spaces,
And leave each flourish room to show.`;
const WORDS = WORDING.match(/\S+/gu) ?? [];
const studies: Array<{ label: string; study: ScaleStudy }> = [];

// Generate each physical model once; the same actual geometry is then remapped
// with all six bundled fonts and both engines. No source-model substitution.
beforeAll(() => {
  for (const modelScale of [1, 1.1]) {
    for (const surfaceMode of ["conforming", "planar"] as const) {
      studies.push({
        label: `archival ${surfaceMode} ${modelScale}`,
        study: generateScaleStudy({
          modelScale,
          columns: 12,
          rows: 2,
          surfaceMode,
          variation: 0.2,
          supportOffsetInches: 1,
          relief: 0.65,
        }),
      });
    }
    studies.push({
      label: `maquette conforming ${modelScale}`,
      study: generateMaquetteScaleStudy(
        normalizeScaleStudySettings({
          modelId: "maquette",
          modelScale,
          columns: 12,
          rows: 2,
          variation: 0,
          gap: 0.12,
          supportOffsetInches: 0.005,
          relief: 0,
        }),
      ),
    });
  }
}, 20_000);

function verifyRemapping(
  study: ScaleStudy,
  result: ScaleLetteringResult,
  typography: ScaleTypography,
  marginMm: number,
) {
  const placedWords = result.placements.flatMap(({ lines }) =>
    lines.flatMap((line) => line.match(/\S+/gu) ?? []),
  );
  const unplacedWords = result.unplacedText.match(/\S+/gu) ?? [];
  expect([...placedWords, ...unplacedWords]).toEqual(WORDS);
  expect(result.placedWordCount).toBe(placedWords.length);
  expect(result.totalWordCount).toBe(WORDS.length);
  expect(result.placements.length).toBe(study.plates.length);
  if (placedWords.length < WORDS.length)
    expect(result.unplacedText).not.toBe("");

  const byId = new Map(study.plates.map((plate) => [plate.id, plate]));
  for (const placement of result.placements) {
    if (!placement.lines.length) continue;
    const plate = byId.get(placement.plateId);
    if (!plate) throw new Error("The lettering refers to a nonexistent plate.");
    const widthMm = Math.max(
      0,
      plate.widthInches * 25.4 * plate.safeRect.width - marginMm * 2,
    );
    const heightMm = Math.max(
      0,
      plate.heightInches * 25.4 * plate.safeRect.height - marginMm * 2,
    );
    expect(placement.lineHeightsMm?.length).toBe(placement.lines.length);
    expect(
      placement.lineHeightsMm?.reduce((sum, height) => sum + height, 0),
    ).toBeLessThanOrEqual(heightMm + 1e-7);
    for (const [index, line] of placement.lines.entries()) {
      const measured = typography.measureLine(line, placement.fontSizeMm);
      expect(measured.widthMm).toBeLessThanOrEqual(widthMm + 1e-7);
      expect(placement.lineHeightsMm?.[index]).toBeCloseTo(
        measured.heightMm,
        8,
      );
      const shaped = typography.shape(line, placement.fontSizeMm);
      expect(typography.engine).toBe(shaped.engine);
      expect(shaped.glyphs.some(({ path }) => Boolean(path))).toBe(true);
      expect(shaped.inkBoundsMm?.width ?? 0).toBeLessThanOrEqual(
        measured.widthMm + 1e-7,
      );
      expect(shaped.inkBoundsMm?.height ?? 0).toBeLessThanOrEqual(
        measured.heightMm + 1e-7,
      );
    }
  }
}

describe("physical model and font remapping matrix", () => {
  for (const definition of WORKSHEET_FONT_CATALOG) {
    for (const shapingEngine of ["fontkit", "harfbuzz"] as const) {
      test(`${definition.name}, ${shapingEngine}: both models resize and preserve every word`, async () => {
        // Exercise the bundled-font identity and integrity check using the real
        // local release asset, without network access or a global lasting mock.
        const localFetch: typeof fetch = Object.assign(
          async (input: Parameters<typeof fetch>[0]) => {
            const url = new URL(
              input instanceof Request ? input.url : String(input),
            );
            if (url.pathname !== definition.path)
              throw new Error(`Unexpected font request: ${url.pathname}`);
            return new Response(
              await Bun.file(`public${definition.path}`).arrayBuffer(),
            );
          },
          {
            preconnect() {
              throw new Error("Network connections are not used by this test.");
            },
          },
        );
        const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
          localFetch,
        );
        let typography: ScaleTypography;
        try {
          typography = await loadScaleTypography({
            fontId: definition.id,
            shapingEngine,
            fontFeatures: "",
          });
        } finally {
          fetchSpy.mockRestore();
        }
        expect(typography.family).toBe(`"Worksheet-${definition.id}"`);
        expect(typography.engine).toBe(shapingEngine);
        for (const { study } of studies) {
          const marginMm = study.modelId === "maquette" ? 0.2 : 2;
          const result = fitScaleLettering(study.plates, WORDING, {
            fontSizeMm: study.modelId === "maquette" ? 6 : 40,
            minFontSizeMm: 2,
            marginMm,
            measureLine: typography.measureLine,
          });
          verifyRemapping(study, result, typography, marginMm);
        }
      }, 10_000);
    }
  }

  test("the two model adapters retain their distinct physical sources after resizing", () => {
    expect(studies).toHaveLength(6);
    for (const modelScale of [1, 1.1]) {
      const archival = studies.find(
        ({ label }) => label === `archival conforming ${modelScale}`,
      )?.study;
      const maquette = studies.find(
        ({ label }) => label === `maquette conforming ${modelScale}`,
      )?.study;
      expect(archival?.modelId).toBe("archival");
      expect(maquette?.modelId).toBe("maquette");
      expect(archival?.modelScale).toBe(modelScale);
      expect(maquette?.modelScale).toBe(modelScale);
      expect(maquette?.sourceGeometry?.positions.length).toBeGreaterThan(0);
      expect(maquette?.plates.length).toBeGreaterThan(0);
      expect(maquette?.plates[0]?.positions).not.toEqual(
        archival?.plates[0]?.positions,
      );
    }
  });
});
