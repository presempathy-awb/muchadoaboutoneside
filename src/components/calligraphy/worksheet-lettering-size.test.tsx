import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_WORKSHEET_SETTINGS } from "../../../shared/worksheet";
import type { WorksheetFont } from "../../lib/worksheet-fonts";
import { WorksheetLetteringSize } from "./worksheet-lettering-size";

test("lettering close-up includes the full ink bounds and preserves shaped proportions", () => {
  const settings = { ...DEFAULT_WORKSHEET_SETTINGS, writingScale: 2 };
  const font = {
    id: "sample",
    family: "Sample script",
    engine: "fontkit",
    unitsPerEm: 1000,
    xHeightUnits: 500,
    supportedFeatures: [],
    hasGlyph: () => true,
    measure: () => 40,
    resolveSizePt: () => 20,
    shape: (text: string) => ({
      engine: "fontkit",
      text,
      sizePt: 20,
      widthMm: 40,
      inkBoundsMm: {
        xMin: -4,
        xMax: 46,
        yMin: -3,
        yMax: 9,
        width: 50,
        height: 12,
      },
      glyphs: [
        {
          id: 1,
          cluster: 0,
          xMm: 2,
          yMm: 1,
          advanceMm: 40,
          path: "M0 0L1 1",
          inkBoundsMm: null,
        },
      ],
      pathScaleMm: 0.01,
      writingScale: 2,
    }),
  } satisfies WorksheetFont;
  const html = renderToStaticMarkup(
    <WorksheetLetteringSize
      settings={settings}
      font={font}
      onChange={() => true}
    />,
  );
  // 10% ink-height padding includes a negative sidebearing and the descender.
  expect(html).toContain('viewBox="-5.2 -10.2 52.4 14.4"');
  expect(html).toContain('preserveAspectRatio="xMidYMid meet"');
  expect(html).toContain('transform="translate(2 -1) scale(0.02 -0.01)"');
  expect(html).toContain("Enlarged lettering");
  expect(html).toContain("Lettering width");
});
