import { describe, expect, test } from "bun:test";
import {
  evaluateLetteringVisibility,
  type LetteringVisibilityInput,
  letteringContrastRatio,
  letteringRelativeLuminance,
} from "./lettering-visibility";

const measured: LetteringVisibilityInput = {
  text: "Actual measured ink",
  physical: {
    totalWordCount: 3,
    placedWordCount: 3,
    unplacedText: "",
    inkOverflowCount: 0,
  },
  colors: { ink: "#000000", paper: "#ffffff" },
  texture: { inkHeightPx: 24, xHeightPx: 12, strokeWidthPx: 2 },
  source: { kind: "vector" },
  screen: { inkHeightPx: 20, xHeightPx: 12, strokeWidthPx: 1.5 },
};
function status(input: LetteringVisibilityInput, id: string) {
  return evaluateLetteringVisibility(input).checks.find(
    (check) => check.id === id,
  )?.status;
}

describe("deterministic lettering visibility policy", () => {
  test("calculates opaque sRGB contrast with the standard luminance transfer function", () => {
    expect(letteringRelativeLuminance("#000000")).toBe(0);
    expect(letteringRelativeLuminance("#ffffff")).toBe(1);
    expect(letteringRelativeLuminance("#ff0000")).toBe(0.2126);
    expect(letteringContrastRatio("#000000", "#ffffff")).toBe(21);
    expect(letteringContrastRatio("#777777", "#ffffff")).toBeCloseTo(4.478, 3);
    expect(letteringContrastRatio("#ffffff", "#777777")).toBeCloseTo(4.478, 3);
    expect(letteringContrastRatio("#767676", "#ffffff")).toBeGreaterThan(4.5);
    expect(letteringContrastRatio("transparent", "#ffffff")).toBeNull();
    expect(letteringRelativeLuminance("#ffffffff")).toBeNull();
    expect(letteringRelativeLuminance("#0a0a0a")).toBeCloseTo(
      10 / 255 / 12.92,
      12,
    );
  });

  test("reports only measured targets, without equating them to human readability", () => {
    const report = evaluateLetteringVisibility(measured);
    expect(report.status).toBe("meets-targets");
    expect(
      report.checks.find((check) => check.id === "proof-contrast")?.reason,
    ).toContain("does not measure lighting");
    expect(
      report.checks.find((check) => check.id === "texture-inkHeightPx")?.reason,
    ).toContain("does not establish readability");
    expect(status(measured, "source-inkHeightPx")).toBe("not-applicable");
  });

  test("tall flourishes cannot hide a measured small x-height", () => {
    const small = {
      ...measured,
      texture: { inkHeightPx: 40, xHeightPx: 4, strokeWidthPx: 2 },
    };
    expect(status(small, "texture-inkHeightPx")).toBe("pass");
    expect(status(small, "texture-xHeightPx")).toBe("fail");
    expect(evaluateLetteringVisibility(small).status).toBe("needs-attention");
  });

  test("retained source sampling does not improve when the texture is enlarged", () => {
    for (const textureHeight of [24, 1024]) {
      const scan: LetteringVisibilityInput = {
        ...measured,
        texture: {
          inkHeightPx: textureHeight,
          xHeightPx: 50,
          strokeWidthPx: 10,
        },
        source: { kind: "scan", inkHeightPx: 6, strokeWidthPx: 0.5 },
      };
      expect(status(scan, "source-inkHeightPx")).toBe("fail");
      expect(status(scan, "source-xHeightPx")).toBe("not-measured");
      expect(status(scan, "source-strokeWidthPx")).toBe("fail");
      expect(
        evaluateLetteringVisibility(scan).checks.find(
          (check) => check.id === "source-inkHeightPx",
        )?.reason,
      ).toContain("cannot recover absent source detail");
    }
  });

  test("separates camera zoom from physical fit", () => {
    const distant = {
      ...measured,
      screen: { inkHeightPx: 4, xHeightPx: 1, strokeWidthPx: 0.1 },
    };
    expect(status(distant, "physical-bounds")).toBe("pass");
    expect(status(distant, "screen-xHeightPx")).toBe("zoom-needed");
    expect(status(distant, "texture-xHeightPx")).toBe("pass");
    expect(evaluateLetteringVisibility(distant).status).toBe("needs-attention");
  });

  test("missing, nonfinite, stale and unmeasured values never receive a pass", () => {
    expect(evaluateLetteringVisibility({ text: measured.text }).status).toBe(
      "not-measured",
    );
    expect(
      status(
        {
          ...measured,
          texture: { inkHeightPx: Infinity, xHeightPx: NaN, strokeWidthPx: -1 },
        },
        "texture-inkHeightPx",
      ),
    ).toBe("not-measured");
    expect(
      status(
        {
          ...measured,
          physical: {
            totalWordCount: 4,
            placedWordCount: 4,
            unplacedText: "",
            inkOverflowCount: 0,
          },
        },
        "physical-coverage",
      ),
    ).toBe("not-measured");
    expect(
      status(
        {
          ...measured,
          physical: { totalWordCount: 3, placedWordCount: 3, unplacedText: "" },
        },
        "physical-bounds",
      ),
    ).toBe("not-measured");
    const noCamera = evaluateLetteringVisibility({
      ...measured,
      screen: undefined,
    });
    expect(noCamera.status).toBe("meets-targets");
    expect(noCamera.summary).toContain("3 additional checks remain unmeasured");
    expect(
      noCamera.checks
        .filter((check) => check.id.startsWith("screen-"))
        .every((check) => check.status === "not-measured" && !check.required),
    ).toBe(true);
  });

  test("flags low contrast, unplaced words and clipped ink independently", () => {
    const problem = {
      ...measured,
      physical: {
        totalWordCount: 3,
        placedWordCount: 2,
        unplacedText: "ink",
        inkOverflowCount: 1,
      },
      colors: { ink: "#aaaaaa", paper: "#ffffff" },
    };
    expect(status(problem, "physical-coverage")).toBe("fail");
    expect(status(problem, "physical-bounds")).toBe("fail");
    expect(status(problem, "proof-contrast")).toBe("fail");
    expect(evaluateLetteringVisibility(problem).status).toBe("needs-attention");
  });

  test("empty wording is explicitly empty, never a readability pass", () => {
    expect(
      evaluateLetteringVisibility({ ...measured, text: " \n\t " }),
    ).toMatchObject({ status: "empty", checks: [] });
  });
});
