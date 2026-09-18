import { expect, test } from "bun:test";
import type { ScaleTypography } from "./scale-typography";
import { createScaleTypographyResources } from "./scale-typography-resources";

function fixture(engine: ScaleTypography["engine"] = "scan") {
  let released = 0;
  const typography: ScaleTypography = {
    family: "Test handwriting",
    engine,
    supportedFeatures: [],
    hasGlyph: () => true,
    shape() {
      throw new Error("No font outlines in this fixture");
    },
    measure: () => 1,
    measureLine: () => ({ widthMm: 1, heightMm: 1 }),
    draw() {
      if (released) throw new Error("The preview used released handwriting");
    },
    dispose() {
      released++;
    },
  };
  return {
    typography,
    get released() {
      return released;
    },
  };
}

test("loading and queued replacements keep current ink until the replacement commits", () => {
  const resources = createScaleTypographyResources();
  const current = fixture();
  const superseded = fixture();
  const next = fixture();
  expect(resources.own(current.typography)).toBe(current.typography);
  resources.retain([current.typography]);

  resources.own(superseded.typography);
  resources.retain([superseded.typography, current.typography]);
  expect(current.released).toBe(0);
  resources.own(next.typography);
  // The queued renderer still needs to build its atlases, even when a later
  // font has loaded. All three remain live until that queue is replaced.
  resources.retain([
    next.typography,
    superseded.typography,
    current.typography,
  ]);
  expect([current.released, superseded.released, next.released]).toEqual([
    0, 0, 0,
  ]);
  resources.retain([next.typography, current.typography]);
  expect(superseded.released).toBe(1);
  expect(current.released).toBe(0);

  // onCommit and the flat proof now both reference the replacement.
  resources.retain([next.typography, next.typography]);
  expect(current.released).toBe(1);
  expect(next.released).toBe(0);
  resources.dispose();
  expect(next.released).toBe(1);
});

test("a failed candidate leaves the currently rendered handwriting usable", () => {
  const resources = createScaleTypographyResources();
  const current = fixture();
  const candidate = fixture();
  resources.own(current.typography);
  resources.own(candidate.typography);
  // Failure clears the queued candidate but preserves the last rendered view.
  resources.retain([undefined, null, current.typography]);
  expect(candidate.released).toBe(1);
  expect(current.released).toBe(0);
  expect(() =>
    current.typography.draw({} as CanvasRenderingContext2D, "ink", 1, 0, 0),
  ).not.toThrow();
  resources.dispose();
});

test("stale loads and repeated cleanup release each renderer exactly once", () => {
  const resources = createScaleTypographyResources();
  const current = fixture();
  const stale = fixture();
  resources.own(current.typography);
  resources.own(current.typography);
  resources.own(stale.typography);
  resources.retain([current.typography]);
  resources.retain([current.typography]);
  resources.own(stale.typography);
  expect(stale.released).toBe(1);
  resources.dispose();
  resources.dispose();
  resources.retain([]);
  resources.own(current.typography);
  expect(current.released).toBe(1);
  expect(stale.released).toBe(1);
});

test("unmount releases live scans and late asynchronous loads immediately", async () => {
  const resources = createScaleTypographyResources();
  const current = fixture();
  const late = fixture();
  resources.own(current.typography);
  const pending = Promise.resolve(late.typography).then((loaded) =>
    resources.own(loaded),
  );
  resources.dispose();
  await pending;
  expect(current.released).toBe(1);
  expect(late.released).toBe(1);
  resources.own(late.typography);
  resources.dispose();
  expect(late.released).toBe(1);
});

test("normal font engines are never owned or disposed", () => {
  const resources = createScaleTypographyResources();
  for (const engine of ["fontkit", "harfbuzz"] as const) {
    const font = fixture(engine);
    expect(resources.own(font.typography)).toBe(font.typography);
    resources.retain([]);
    resources.dispose();
    resources.own(font.typography);
    expect(font.released).toBe(0);
  }
});

test("one failing disposer does not prevent other scans from being released", () => {
  const resources = createScaleTypographyResources();
  const failed = fixture();
  const other = fixture();
  const dispose = failed.typography.dispose;
  failed.typography.dispose = () => {
    dispose?.();
    throw new Error("Injected disposal failure");
  };
  resources.own(failed.typography);
  resources.own(other.typography);
  expect(() => resources.dispose()).toThrow(AggregateError);
  expect(failed.released).toBe(1);
  expect(other.released).toBe(1);
  expect(() => resources.dispose()).not.toThrow();
});
