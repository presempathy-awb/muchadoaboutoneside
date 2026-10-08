import { expect, test } from "bun:test";
import {
  DEFAULT_WORKSHEET_SETTINGS,
  getWorksheetLayout,
  normalizeWorksheetSettings,
} from "../../shared/worksheet";
import {
  WORKSHEET_GUIDES,
  WORKSHEET_PAPERS,
  worksheetPaperId,
} from "./worksheet-options";

test("additional paper formats retain exact dimensions through the existing saved-draft schema", () => {
  for (const [id, widthMm, heightMm] of [
    ["a3", 297, 420],
    ["a6", 105, 148],
    ["b5", 176, 250],
    ["half-letter", 139.7, 215.9],
    ["tabloid", 279.4, 431.8],
  ] as const) {
    const preset = WORKSHEET_PAPERS.find((item) => item.id === id);
    expect(preset).toBeDefined();
    const portrait = normalizeWorksheetSettings({
      ...preset?.settings,
      orientation: "portrait",
    });
    expect(getWorksheetLayout(portrait)).toMatchObject({ widthMm, heightMm });
    expect(worksheetPaperId(portrait)).toBe(id);
    const landscape = normalizeWorksheetSettings({
      ...portrait,
      orientation: "landscape",
    });
    expect(getWorksheetLayout(landscape)).toMatchObject({
      widthMm: heightMm,
      heightMm: widthMm,
    });
    expect(
      worksheetPaperId({
        ...landscape,
        customWidthMm: heightMm,
        customHeightMm: widthMm,
      }),
    ).toBe(id);
  }
  expect(
    worksheetPaperId({
      ...DEFAULT_WORKSHEET_SETTINGS,
      paper: "custom",
      customWidthMm: 123,
      customHeightMm: 234,
    }),
  ).toBe("custom");
});

test("warm-up and unguided templates produce their promised guide behavior without changing materials or lettering", () => {
  const draft = {
    ...DEFAULT_WORKSHEET_SETTINGS,
    ink: "My ink",
    textEnabled: true,
    guidesEnabled: false,
  };
  const warmup = WORKSHEET_GUIDES.find((item) => item.id === "warmup");
  expect(warmup).toBeDefined();
  const settings = normalizeWorksheetSettings({
    ...draft,
    ...warmup?.settings,
  });
  const layout = getWorksheetLayout(settings);
  expect(layout.baselineYsMm.slice(0, 2)).toEqual([12.7, 24.7]);
  expect(layout.lines.length).toBeGreaterThan(0);
  expect(settings.ink).toBe("My ink");
  expect(settings.textEnabled).toBe(true);
  const unguided = WORKSHEET_GUIDES.find((item) => item.id === "unguided");
  expect(unguided).toBeDefined();
  expect(
    getWorksheetLayout(
      normalizeWorksheetSettings({ ...settings, ...unguided?.settings }),
    ).lines,
  ).toHaveLength(0);
});
