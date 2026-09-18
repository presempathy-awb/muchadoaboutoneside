import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DEFAULT_WORKSHEET_SETTINGS,
  getWorksheetLayout,
} from "../../../shared/worksheet";
import type { WorksheetFont } from "../../lib/worksheet-fonts";
import type { WorksheetSnapshot } from "../../lib/worksheet-store";
import { WorksheetPreview } from "./worksheet-preview";

const initial: WorksheetSnapshot = {
  version: 1,
  settings: DEFAULT_WORKSHEET_SETTINGS,
  text: "",
};

test("the initial studio sheet is landscape with exactly 24 horizontal rules and no printed text", () => {
  const html = renderToStaticMarkup(
    <WorksheetPreview
      snapshot={initial}
      layout={getWorksheetLayout(initial.settings)}
      lines={[]}
      printed
    />,
  );
  expect(html).toContain('viewBox="0 0 279.4 215.9"');
  expect(html.match(/<line /g)).toHaveLength(24);
  expect(html).not.toContain("<text");
  expect(html).not.toContain("<image");
});

test("screen-only reference photos stay out of the printed sheet", () => {
  const snapshot: WorksheetSnapshot = {
    ...initial,
    photo: {
      dataUrl: "data:image/png;base64,AA==",
      pixelWidth: 100,
      pixelHeight: 50,
      widthMm: 70,
      xMm: 20,
      yMm: 30,
      opacity: 0.25,
      rotation: 90,
      print: false,
    },
  };
  const layout = getWorksheetLayout(snapshot.settings);
  expect(
    renderToStaticMarkup(
      <WorksheetPreview snapshot={snapshot} layout={layout} lines={[]} />,
    ),
  ).toContain('transform="rotate(90 55 47.5)"');
  expect(
    renderToStaticMarkup(
      <WorksheetPreview
        snapshot={snapshot}
        layout={layout}
        lines={[]}
        printed
      />,
    ),
  ).not.toContain("<image");
  snapshot.photo = {
    ...(snapshot.photo as NonNullable<WorksheetSnapshot["photo"]>),
    print: true,
  };
  expect(
    renderToStaticMarkup(
      <WorksheetPreview
        snapshot={snapshot}
        layout={layout}
        lines={[]}
        printed
      />,
    ),
  ).toContain("<image");
});

test("text preview preserves font height, measured width, color, and opacity", () => {
  const snapshot = {
    ...initial,
    text: "Practice",
    settings: {
      ...initial.settings,
      textEnabled: true,
      writingScale: 2,
      fontSizePt: 20,
      textColor: "#123456",
      textOpacity: 0.4,
      lineStyle: "dotted" as const,
    },
  };
  const font = {
    id: "test",
    family: "Arial",
    engine: "fontkit",
    supportedFeatures: [],
    unitsPerEm: 1_000,
    xHeightUnits: 500,
    resolveSizePt: () => 20,
    hasGlyph: () => true,
    measure: () => 42,
    shape: (text: string) => ({
      engine: "fontkit",
      text,
      sizePt: 20,
      widthMm: 42,
      inkBoundsMm: null,
      glyphs: [],
      pathScaleMm: 0.01,
      writingScale: 2,
    }),
  } satisfies WorksheetFont;
  const html = renderToStaticMarkup(
    <WorksheetPreview
      snapshot={snapshot}
      layout={getWorksheetLayout(snapshot.settings)}
      lines={["Practice"]}
      font={font}
      printed
    />,
  );
  expect(html).toContain('textLength="42"');
  expect(html).toContain(`font-size="${(20 * 25.4) / 72}"`);
  expect(html).toContain('fill="#123456"');
  expect(html).toContain('opacity="0.4"');
  expect(html).toContain('stroke-linecap="round"');
  expect(html).toContain(`stroke-dasharray="0 ${(2.5 * 0.5 * 25.4) / 72}"`);
});

test("renders shaped outlines with model and trace opacity on physical rows", () => {
  const snapshot = {
    ...initial,
    text: "Practice",
    settings: {
      ...initial.settings,
      textEnabled: true,
      practicePattern: "model-trace-blank" as const,
      textColor: "#123456",
      textOpacity: 0.4,
      writingScale: 2,
    },
  };
  const font = {
    id: "outline-test",
    family: "Outline Test",
    engine: "fontkit",
    supportedFeatures: [],
    unitsPerEm: 1_000,
    xHeightUnits: 500,
    resolveSizePt: () => 20,
    hasGlyph: () => true,
    measure: () => 20,
    shape: (text: string) => ({
      engine: "fontkit",
      text,
      sizePt: 20,
      widthMm: 20,
      inkBoundsMm: {
        xMin: 0,
        yMin: 0,
        xMax: 10,
        yMax: 10,
        width: 10,
        height: 10,
      },
      glyphs: [
        {
          id: 7,
          cluster: 0,
          xMm: 1,
          yMm: 2,
          advanceMm: 20,
          path: "M0 0L10 0L10 10Z",
          inkBoundsMm: {
            xMin: 0,
            yMin: 0,
            xMax: 10,
            yMax: 10,
            width: 10,
            height: 10,
          },
        },
      ],
      pathScaleMm: 0.01,
      writingScale: 2,
    }),
  } satisfies WorksheetFont;
  const layout = getWorksheetLayout(snapshot.settings);
  const html = renderToStaticMarkup(
    <WorksheetPreview
      snapshot={snapshot}
      layout={layout}
      lines={["Practice", "Practice", ""]}
      font={font}
      printed
    />,
  );
  expect(html.match(/<path /g)).toHaveLength(2);
  expect(html).toContain('opacity="0.4"');
  expect(html).toContain('opacity="0.1"');
  expect(html).toContain("scale(0.02 -0.01)");
  expect(html).not.toContain("<text");
});
