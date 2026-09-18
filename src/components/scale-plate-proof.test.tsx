import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_SCALE_DESIGN } from "../../shared/scale-design";
import type { ScalePlate } from "../../shared/scale-study";
import {
  centerProofViewport,
  MAX_PROOF_PIXELS,
  proofCanvasSize,
  ScalePlateProof,
} from "./scale-plate-proof";

test("proof resolution follows device pixel ratio until its memory bound", () => {
  expect(proofCanvasSize(640, 288, 1)).toEqual({
    width: 640,
    height: 288,
    limited: false,
  });
  expect(proofCanvasSize(640, 288, 2)).toEqual({
    width: 1280,
    height: 576,
    limited: false,
  });
  const enlarged = proofCanvasSize(3200, 1440, 3);
  expect(enlarged.width * enlarged.height).toBeLessThanOrEqual(
    MAX_PROOF_PIXELS,
  );
  expect(enlarged.width).toBeGreaterThan(3200);
  expect(enlarged.limited).toBe(true);
});

test("unusual viewport sizes and device ratios stay finite and bounded", () => {
  for (const [width, height, dpr] of [
    [8192, 8192, 8],
    [Infinity, NaN, Infinity],
    [0, 0, -1],
    [100_000, 20, 99],
  ] as const) {
    const size = proofCanvasSize(width, height, dpr);
    expect(Number.isSafeInteger(size.width)).toBe(true);
    expect(Number.isSafeInteger(size.height)).toBe(true);
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
    expect(size.width).toBeLessThanOrEqual(8192);
    expect(size.height).toBeLessThanOrEqual(8192);
    expect(size.width * size.height).toBeLessThanOrEqual(MAX_PROOF_PIXELS);
  }
});

test("the proof exposes magnification and preserves readable fallback wording", () => {
  const html = renderToStaticMarkup(
    createElement(ScalePlateProof, {
      plate: { id: "body-0-0" } as ScalePlate,
      placement: {
        plateId: "body-0-0",
        lines: ["Every original word"],
        fontSizeMm: 8,
      },
      design: DEFAULT_SCALE_DESIGN,
      family: "serif",
    }),
  );
  expect(html).toContain("Fit</button>");
  expect(html).toContain("100%</button>");
  expect(html).toContain("200%</button>");
  expect(html).toContain("Expand proof</button>");
  expect(html).toContain('aria-label="Scrollable lettering proof"');
  expect(html).toContain('tabindex="0"');
  expect(html).toContain("body-0-0: Every original word</canvas>");
  expect(html).not.toContain("<dialog");
});

test("centering completes synchronously without an animation-frame scheduler", () => {
  // The real hidden-tab regression: the canvas had resized, but queued RAF
  // work never ran, leaving its centered lettering outside the viewport.
  const viewport = {
    scrollWidth: 1600,
    scrollHeight: 720,
    clientWidth: 656,
    clientHeight: 358,
    scrollLeft: 0,
    scrollTop: 0,
  };
  centerProofViewport(viewport);
  expect(viewport.scrollLeft).toBe(472);
  expect(viewport.scrollTop).toBe(181);

  Object.assign(viewport, {
    scrollWidth: 3200,
    scrollHeight: 1440,
    clientWidth: 1300,
    clientHeight: 700,
  });
  centerProofViewport(viewport);
  expect(viewport.scrollLeft).toBe(950);
  expect(viewport.scrollTop).toBe(370);

  Object.assign(viewport, {
    scrollWidth: 640,
    scrollHeight: 288,
    clientWidth: 640,
    clientHeight: 360,
  });
  centerProofViewport(viewport);
  expect(viewport.scrollLeft).toBe(0);
  expect(viewport.scrollTop).toBe(0);
});
