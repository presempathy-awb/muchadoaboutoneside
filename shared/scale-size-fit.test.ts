import { describe, expect, test } from "bun:test";
import {
  DEFAULT_SCALE_DESIGN,
  normalizeScaleDesign,
  resizeScaleDesign,
  setScaleDensityMode,
} from "./scale-design";
import {
  allocateScaleLettering,
  type ScaleLetteringPlate,
  type ScaleTextRange,
} from "./scale-lettering";
import {
  assessScaleSizeFit,
  MAX_SCALE_SIZE_SEARCH_TRIALS,
  searchScaleSizeFit,
} from "./scale-size-fit";

const design = normalizeScaleDesign({
  ...DEFAULT_SCALE_DESIGN,
  text: "One word\nthen another.",
  fontSizeMm: 16,
  autoFit: true,
  geometry: {
    ...DEFAULT_SCALE_DESIGN.geometry,
    columns: 4,
    rows: 2,
    bodyWidthScale: 1.4,
    bodyDepthScale: 0.8,
    relief: 0.9,
  },
});

describe("bounded model size search", () => {
  test("returns the unchanged current design when the requested writing already fits", async () => {
    let calls = 0;
    const result = await searchScaleSizeFit(design, async (candidate) => {
      calls += 1;
      expect(candidate).toBe(design);
      return { placedWordCount: 4, totalWordCount: 4 };
    });
    expect(calls).toBe(1);
    expect(result.status).toBe("fit");
    expect(result.candidate).toBe(design);
    expect(result.reason).toContain("already fits");
  });

  test.each(["fixed", "adaptive"] as const)(
    "enlarges at the requested font size and preserves %s density, layers and source text",
    async (mode) => {
      const original = setScaleDensityMode(design, mode);
      const snapshot = JSON.stringify(original);
      const result = await searchScaleSizeFit(
        original,
        async (candidate) => {
          expect(candidate).toEqual(
            resizeScaleDesign(original, candidate.geometry.modelScale),
          );
          expect(candidate.geometry.bodyWidthScale).toBe(1.4);
          expect(candidate.geometry.bodyDepthScale).toBe(0.8);
          expect(candidate.geometry.relief).toBe(0.9);
          expect(candidate.fontSizeMm).toBe(16);
          expect(candidate.autoFit).toBe(true);
          return {
            placedWordCount: candidate.geometry.modelScale >= 1.8 ? 4 : 2,
            totalWordCount: 4,
          };
        },
        { maxModelScale: 4, maxTrials: 10 },
      );
      expect(result.status).toBe("fit");
      expect(result.candidate?.geometry.modelScale).toBeGreaterThanOrEqual(1.8);
      expect(result.candidate?.geometry.modelScale).toBeLessThan(1.82);
      expect(result.candidate?.geometry.modelScale).toBe(
        Math.min(
          ...result.trials
            .filter((trial) => trial.fits)
            .map((trial) => trial.modelScale),
        ),
      );
      expect(result.candidate?.densityMode).toBe(mode);
      expect(result.candidate?.densityReference).toEqual(
        original.densityReference,
      );
      expect(result.candidate?.layers).toEqual(original.layers);
      expect(result.candidate?.text).toBe(original.text);
      expect(result.reason).toContain("Smaller untested sizes may also fit");
      expect(JSON.stringify(original)).toBe(snapshot);
    },
  );

  test("records a failed candidate and can still find a later fit", async () => {
    const result = await searchScaleSizeFit(
      design,
      async (candidate) => {
        if (candidate.geometry.modelScale === 1)
          throw new Error("Bad geometry");
        return { placedWordCount: 4, totalWordCount: 4 };
      },
      { maxTrials: 4, maxModelScale: 2 },
    );
    expect(result.trials[0]?.error).toBe("Bad geometry");
    expect(result.status).toBe("fit");
    expect(result.trials.length).toBe(4);
    expect(result.reason).toContain("4-trial limit");
  });

  test("reports no tested fit after checking the supported maximum and bounds caller limits", async () => {
    const result = await searchScaleSizeFit(
      design,
      async () => ({ placedWordCount: 3, totalWordCount: 4 }),
      { maxTrials: 1000, maxModelScale: 1000 },
    );
    expect(result.status).toBe("limit");
    expect(result.candidate).toBeNull();
    expect(result.trials.length).toBeLessThanOrEqual(
      MAX_SCALE_SIZE_SEARCH_TRIALS,
    );
    expect(result.trials.at(-1)?.modelScale).toBe(30);
    expect(result.reason).toContain("maximum search size was tested");
  });

  test("honors the elapsed bound even if an assessor never finishes", async () => {
    let activeSignal: AbortSignal | undefined;
    const result = await searchScaleSizeFit(
      design,
      (_candidate, signal) => {
        activeSignal = signal;
        return new Promise(() => {});
      },
      { maxElapsedMs: 10 },
    );
    expect(result.status).toBe("limit");
    expect(result.candidate).toBeNull();
    expect(result.reason).toContain("time limit");
    expect(activeSignal?.aborted).toBe(true);
  });

  test("retains a verified candidate if the refinement reaches its time limit", async () => {
    const result = await searchScaleSizeFit(
      design,
      async (candidate) => {
        if (candidate.geometry.modelScale === 1)
          return { placedWordCount: 2, totalWordCount: 4 };
        if (candidate.geometry.modelScale === 2)
          return { placedWordCount: 4, totalWordCount: 4 };
        return new Promise(() => {});
      },
      { maxTrials: 4, maxModelScale: 2, maxElapsedMs: 20 },
    );
    expect(result.status).toBe("fit");
    expect(result.candidate?.geometry.modelScale).toBe(2);
    expect(result.trials).toHaveLength(2);
    expect(result.reason).toContain("time limit");
  });

  test("cancels an active assessor and does not report a stale result", async () => {
    const controller = new AbortController();
    let observations = 0;
    const pending = searchScaleSizeFit(
      design,
      (_candidate, signal) => {
        expect(signal.aborted).toBe(false);
        queueMicrotask(() => controller.abort());
        return new Promise(() => {});
      },
      {
        signal: controller.signal,
        onTrial: () => {
          observations += 1;
        },
      },
    );
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(observations).toBe(0);
  });
});

describe("requested-size allocation in yielding batches", () => {
  const plates: ScaleLetteringPlate[] = Array.from(
    { length: 12 },
    (_, index) => ({
      id: `plate-${index}`,
      surface: "body",
      widthInches: 10 / 25.4,
      heightInches: 5 / 25.4,
      safeRect: { x: 0, y: 0, width: 1, height: 1 },
    }),
  );
  const text = Array.from({ length: 24 }, () => "same").join(" ");
  const segments = Array.from({ length: 12 }, (_, index) => ({
    wordStart: index * 2,
    wordEnd: index * 2 + 2,
  }));

  test("matches allocation while retaining repeated-word occurrence ranges across batches", async () => {
    const ranges: ScaleTextRange[] = [];
    const options = {
      fontSizeMm: 4,
      marginMm: 0,
      segments,
      measureLine: (line: string, size: number, range?: ScaleTextRange) => {
        expect(size).toBe(4);
        expect(range).toBeDefined();
        if (!range) throw new Error("Missing source occurrence range.");
        const source = range;
        expect(source.wordStart % 2).toBe(0);
        expect(source.wordEnd % 2).toBe(0);
        expect(line).toBe(
          text.split(" ").slice(source.wordStart, source.wordEnd).join(" "),
        );
        ranges.push(source);
        return {
          widthMm: (source.wordEnd - source.wordStart) * size,
          heightMm: size,
        };
      },
    };
    const expected = allocateScaleLettering(plates, text, options);
    ranges.length = 0;
    const result = await assessScaleSizeFit(
      plates,
      text,
      options,
      new AbortController().signal,
    );
    expect(result).toEqual({
      placedWordCount: expected.placedWordCount,
      totalWordCount: 24,
    });
    expect(result.placedWordCount).toBe(24);
    expect(ranges.some((range) => range.wordStart === 16)).toBe(true);
    expect(ranges.at(-1)).toEqual({ wordStart: 22, wordEnd: 24 });
  });

  test("checks cancellation before the next measurement can touch disposed scan data", async () => {
    const controller = new AbortController();
    let measurements = 0;
    await expect(
      assessScaleSizeFit(
        plates,
        text,
        {
          fontSizeMm: 4,
          marginMm: 0,
          segments,
          measureLine: () => {
            measurements += 1;
            controller.abort();
            return { widthMm: 8, heightMm: 4 };
          },
        },
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(measurements).toBe(1);
  });
});
