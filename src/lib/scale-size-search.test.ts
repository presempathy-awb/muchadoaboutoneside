import { describe, expect, test } from "bun:test";
import {
  DEFAULT_SCALE_DESIGN,
  normalizeScaleDesign,
} from "../../shared/scale-design";
import { allocateScaleLettering } from "../../shared/scale-lettering";
import { generateMaquetteScaleStudy } from "../../shared/scale-maquette";
import { generateScaleStudy } from "../../shared/scale-study";
import { searchScaleSizeForText } from "./scale-size-search";

describe("model size search worker integration", () => {
  test.each(["archival", "maquette"] as const)(
    "finds and independently confirms a larger %s model using real geometry",
    async (modelId) => {
      const design = normalizeScaleDesign({
        ...DEFAULT_SCALE_DESIGN,
        text: "writing",
        fontSizeMm: 16,
        marginMm: 2,
        geometry: {
          ...DEFAULT_SCALE_DESIGN.geometry,
          modelId,
          modelScale: 0.02,
          columns: 4,
          rows: 2,
          relief: 0,
          variation: 0,
        },
      });
      const measuredSizes: number[] = [];
      const typography = {
        measure: (_text: string, size: number) => size * 4,
        measureLine: (_text: string, size: number) => {
          measuredSizes.push(size);
          return { widthMm: size * 4, heightMm: size };
        },
      };
      const result = await searchScaleSizeForText(design, typography, {
        maxTrials: 4,
        maxModelScale: 30,
      });
      expect(result.status).toBe("fit");
      expect(result.trials[0]?.fits).toBe(false);
      expect(result.candidate?.geometry.modelScale).toBeGreaterThan(0.02);
      expect(result.candidate?.geometry.modelId).toBe(modelId);
      expect(result.candidate?.fontSizeMm).toBe(16);
      expect(result.candidate?.geometry.columns).toBe(4);
      expect(measuredSizes.length).toBeGreaterThan(0);
      expect(measuredSizes.every((size) => size === 16)).toBe(true);
      const candidate = result.candidate;
      if (!candidate) throw new Error(result.reason);
      const study =
        modelId === "maquette"
          ? generateMaquetteScaleStudy(candidate.geometry)
          : generateScaleStudy(candidate.geometry);
      const lettering = allocateScaleLettering(study.plates, candidate.text, {
        ...typography,
        fontSizeMm: candidate.fontSizeMm,
        marginMm: candidate.marginMm,
      });
      expect(lettering.placedWordCount).toBe(lettering.totalWordCount);
      if (modelId === "maquette")
        expect(study.sourceGeometry?.positions.length).toBeGreaterThan(0);
    },
    20_000,
  );

  test("cancels a running worker before any old typography is measured", async () => {
    const controller = new AbortController();
    let measurements = 0;
    const pending = searchScaleSizeForText(
      {
        ...DEFAULT_SCALE_DESIGN,
        text: "old scan",
      },
      {
        measure: () => {
          measurements += 1;
          return 5;
        },
        measureLine: () => {
          measurements += 1;
          return { widthMm: 5, heightMm: 5 };
        },
      },
      { signal: controller.signal },
    );
    await Promise.resolve();
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(measurements).toBe(0);
  });
});
