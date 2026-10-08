import { expect, test } from "bun:test";
import { sanitizeWorksheetGlyphSvg } from "./worksheet-glyph";

const svg = (content: string, attrs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" ${attrs}>${content}</svg>`;

test("glyph preview accepts bounded inert paths and rejects executable or malformed output", () => {
  const safe = svg(
    '<g fill="#123456"><path d="M0 0 C0 10 10 20 20 30 Z"/></g>',
  );
  expect(sanitizeWorksheetGlyphSvg(safe, 1000, 1000)).toContain(
    'fill="#123456"',
  );
  for (const bad of [
    svg("<script>alert(1)</script>"),
    svg('<path d="M0 0 L20 20" onload="alert(1)"/>'),
    svg('<image href="https://example.com/private"/>'),
    svg('<path d="M0 0 L20 20" fill="url(#x)"/>'),
    svg('<path d="M0 0 L20"/>'),
    svg('<path d="M0 0 A10 10 0 2 0 20 20"/>'),
    svg('<path d="M0 0 L1e999 10"/>'),
    svg('<path d="M0 0 L20 20"/><svg/>'),
    svg('<path d="M0 0 L20 20"/>', 'xmlns:x="https://example.com"'),
    svg('<path d="M0 0 L20 20"/>').replace("1000 1000", "999 1000"),
    `<!DOCTYPE svg>${svg('<path d="M0 0 L20 20"/>')}`,
    `${safe}<path d="M0 0 L1 1"/>`,
  ])
    expect(() => sanitizeWorksheetGlyphSvg(bad, 1000, 1000)).toThrow();
});

test("glyph attributes are parsed in bounded time and viewBox numbers follow SVG grammar", () => {
  const padded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"${" ".repeat(60_000)}><path d="M0 0 L20 20"/></svg>`;
  const started = performance.now();
  expect(sanitizeWorksheetGlyphSvg(padded, 1000, 1000)).toContain(
    'viewBox="0 0 1000 1000"',
  );
  // Timing is the behavior under test: hostile whitespace must not block the request thread.
  expect(performance.now() - started).toBeLessThan(500);
  const path = svg('<path d="M0 0 L20 20"/>');
  expect(() =>
    sanitizeWorksheetGlyphSvg(
      path.replace('viewBox="0 0', 'viewBox="0x0 0'),
      1000,
      1000,
    ),
  ).toThrow();
  expect(
    sanitizeWorksheetGlyphSvg(
      path.replace("1000 1000", "1e3 1000"),
      1000,
      1000,
    ),
  ).toContain('viewBox="0 0 1000 1000"');
});
