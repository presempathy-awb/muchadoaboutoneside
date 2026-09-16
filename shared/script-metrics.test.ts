import { expect, test } from "bun:test";
import { POEM_VERSIONS } from "./poem";
import { GLYPH_ADVANCES_EM, loopWidthEm, textWidthEm } from "./script-metrics";

/** Loop widths measured in Chrome for the fixed wordings (see calligraphy metrics). */
const MEASURED_LOOP_EM = { canonical: 194.14, extended: 430.54 } as const;

test("summed glyph advances track the measured loop widths within half a percent", () => {
  for (const version of POEM_VERSIONS) {
    const estimate = loopWidthEm(version.lines);
    const measured = MEASURED_LOOP_EM[version.id];
    expect(Math.abs(estimate - measured) / measured).toBeLessThan(0.005);
  }
});

test("every character of both wordings has a measured advance", () => {
  for (const version of POEM_VERSIONS)
    for (const character of version.loop)
      expect(GLYPH_ADVANCES_EM[character]).toBeGreaterThan(0);
  expect(textWidthEm("")).toBe(0);
  expect(textWidthEm(" ")).toBeCloseTo(0.171, 3);
  expect(textWidthEm("ab")).toBeCloseTo(
    (GLYPH_ADVANCES_EM.a ?? 0) + (GLYPH_ADVANCES_EM.b ?? 0),
    3,
  );
});
