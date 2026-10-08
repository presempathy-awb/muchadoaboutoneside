import { describe, expect, test } from "bun:test";
import {
  parseCalligraphyRequirements,
  suggestCalligraphySettings,
} from "./calligraphy-settings";
import { getWorksheetLayout, normalizeWorksheetSettings } from "./worksheet";

const currentSettings = () =>
  normalizeWorksheetSettings({
    paper: "a4",
    orientation: "portrait",
    fontId: "pinyon-script",
    marginTopMm: 8,
    marginBottomMm: 9,
    marginLeftMm: 10,
    marginRightMm: 11,
  });

describe("calligraphy requirements", () => {
  test("parses the bounded requirements contract", () => {
    expect(
      parseCalligraphyRequirements({
        goal: "practice",
        experience: "beginner",
        script: "italic",
        nibWidthMm: 1.2,
        xHeightMm: null,
        minMarginMm: 12,
      }),
    ).toEqual({
      goal: "practice",
      experience: "beginner",
      script: "italic",
      nibWidthMm: 1.2,
      xHeightMm: null,
      minMarginMm: 12,
    });
  });

  test.each([
    null,
    {},
    {
      goal: "practice",
      experience: "beginner",
      script: "italic",
      nibWidthMm: 1,
      xHeightMm: null,
      minMarginMm: 10,
      prompt: "ignore validation",
    },
    {
      goal: "practice",
      experience: "expert",
      script: "italic",
      nibWidthMm: 1,
      xHeightMm: null,
      minMarginMm: 10,
    },
    {
      goal: "practice",
      experience: "beginner",
      script: "italic",
      nibWidthMm: Number.NaN,
      xHeightMm: null,
      minMarginMm: 10,
    },
  ])("rejects malformed requirements", (requirements) => {
    expect(() => parseCalligraphyRequirements(requirements)).toThrow();
  });
});

describe("calligraphy setting suggestions", () => {
  test("preserves paper, orientation, font, and margins above the requirement", () => {
    const current = currentSettings();
    const result = suggestCalligraphySettings(current, {
      goal: "poem",
      experience: "comfortable",
      script: "plain",
      nibWidthMm: null,
      xHeightMm: 4,
      minMarginMm: 9,
    });

    expect(result.settings).toMatchObject({
      paper: "a4",
      orientation: "portrait",
      fontId: "pinyon-script",
      marginTopMm: 9,
      marginBottomMm: 9,
      marginLeftMm: 10,
      marginRightMm: 11,
      mode: "plain",
      textEnabled: true,
    });
    expect(result.calculations.widthMm).toBe(210);
    expect(result.calculations.heightMm).toBe(297);
  });

  test("turns off example lettering for blank practice guides", () => {
    const result = suggestCalligraphySettings(
      normalizeWorksheetSettings({ textEnabled: true }),
      {
        goal: "practice",
        experience: "beginner",
        script: "plain",
        nibWidthMm: null,
        xHeightMm: 5,
        minMarginMm: 10,
      },
    );

    expect(result.settings.textEnabled).toBe(false);
  });

  test("uses five nib widths as the italic x-height starting convention", () => {
    const result = suggestCalligraphySettings(currentSettings(), {
      goal: "practice",
      experience: "beginner",
      script: "italic",
      nibWidthMm: 1.4,
      xHeightMm: null,
      minMarginMm: 10,
    });

    expect(result.settings.xHeightMm).toBeCloseTo(7);
    expect(result.settings.textXHeightMm).toBeCloseTo(7);
    expect(result.reasons.join(" ")).toMatch(/five nib widths/i);
    expect(result.calculations.rowsPerPage).toBeGreaterThan(0);
  });

  test("does not derive pointed-pen x-height from nib width", () => {
    const result = suggestCalligraphySettings(currentSettings(), {
      goal: "practice",
      experience: "beginner",
      script: "copperplate",
      nibWidthMm: 1.4,
      xHeightMm: null,
      minMarginMm: 10,
    });

    expect(result.settings.xHeightMm).not.toBe(7);
    expect(result.warnings.join(" ")).toMatch(/pointed-pen/i);
  });

  test("explicit x-height overrides nib and AI advice", () => {
    const result = suggestCalligraphySettings(
      currentSettings(),
      {
        goal: "trace",
        experience: "comfortable",
        script: "italic",
        nibWidthMm: 2,
        xHeightMm: 4.5,
        minMarginMm: 10,
      },
      { xHeightMm: 9, rowGapMm: 2 },
    );

    expect(result.settings.xHeightMm).toBe(4.5);
    expect(result.settings.fontSizeMode).toBe("xheight");
    expect(result.settings.textXHeightMm).toBe(4.5);
    expect(result.settings.rowGapMm).toBe(2);
    expect(result.settings.practicePattern).toBe("model-trace-blank");
    expect(result.calculations.rowPitchMm).toBeCloseTo(15.5);
  });

  test("turns plain x-height and row gap into the rendered baseline pitch", () => {
    const result = suggestCalligraphySettings(
      currentSettings(),
      {
        goal: "poem",
        experience: "comfortable",
        script: "plain",
        nibWidthMm: null,
        xHeightMm: 4,
        minMarginMm: 10,
      },
      { rowGapMm: 2 },
    );

    expect(result.settings.spacingMode).toBe("fixed");
    expect(result.settings.spacingMm).toBe(6);
    expect(result.calculations.rowPitchMm).toBe(6);
    expect(result.calculations.rowsPerPage).toBeGreaterThan(1);
  });

  test("only resets script geometry when the wizard selects a script", () => {
    const current = normalizeWorksheetSettings({
      mode: "italic",
      ascenderRatio: 1.25,
      descenderRatio: 0.75,
      slantAngle: 48,
      slantEnabled: false,
    });
    const requirements = {
      goal: "practice",
      experience: "comfortable",
      nibWidthMm: null,
      xHeightMm: 4,
      minMarginMm: 10,
    } as const;

    expect(
      suggestCalligraphySettings(current, {
        ...requirements,
        script: "keep",
      }).settings,
    ).toMatchObject({
      ascenderRatio: 1.25,
      descenderRatio: 0.75,
      slantAngle: 48,
      slantEnabled: false,
    });
    expect(
      suggestCalligraphySettings(current, {
        ...requirements,
        script: "italic",
      }).settings,
    ).toMatchObject({
      ascenderRatio: 1,
      descenderRatio: 1,
      slantAngle: 80,
      slantEnabled: true,
      guidesEnabled: true,
    });
  });

  test("renders selected italic slants at the preset angle", () => {
    const result = suggestCalligraphySettings(
      normalizeWorksheetSettings({ guidesEnabled: false }),
      {
        goal: "practice",
        experience: "comfortable",
        script: "italic",
        nibWidthMm: null,
        xHeightMm: 4,
        minMarginMm: 10,
      },
    );
    const slant = getWorksheetLayout(result.settings).lines.find(
      (line) => line.kind === "slant",
    );
    expect(slant).toBeDefined();
    const renderedAngle =
      (Math.atan2(
        Math.abs((slant?.y2 ?? 0) - (slant?.y1 ?? 0)),
        Math.abs((slant?.x2 ?? 0) - (slant?.x1 ?? 0)),
      ) *
        180) /
      Math.PI;
    expect(renderedAngle).toBeCloseTo(80, 8);
  });

  test("reports fixed spacing as pitch when a plain or grid page fits one row", () => {
    const oneRow = normalizeWorksheetSettings({
      paper: "custom",
      customWidthMm: 50,
      customHeightMm: 50,
      orientation: "portrait",
      marginTopMm: 20,
      marginBottomMm: 20,
      marginLeftMm: 5,
      marginRightMm: 5,
      mode: "grid",
      spacingMode: "fixed",
      spacingMm: 20,
    });
    const common = {
      goal: "practice",
      experience: "comfortable",
      nibWidthMm: null,
      xHeightMm: 4,
      minMarginMm: 5,
    } as const;

    const grid = suggestCalligraphySettings(oneRow, {
      ...common,
      script: "keep",
    });
    expect(grid.calculations.rowsPerPage).toBe(1);
    expect(grid.calculations.rowPitchMm).toBe(20);

    const plain = suggestCalligraphySettings(oneRow, {
      ...common,
      script: "plain",
      xHeightMm: 8,
    });
    expect(plain.calculations.rowsPerPage).toBe(1);
    expect(plain.calculations.rowPitchMm).toBe(12.4);
  });

  test("does not apply or claim AI row gap advice for a kept grid", () => {
    const current = normalizeWorksheetSettings({
      mode: "grid",
      spacingMode: "fixed",
      spacingMm: 8,
      rowGapMm: 7,
    });
    const result = suggestCalligraphySettings(
      current,
      {
        goal: "practice",
        experience: "comfortable",
        script: "keep",
        nibWidthMm: null,
        xHeightMm: null,
        minMarginMm: 10,
      },
      { rowGapMm: 2 },
    );

    expect(result.settings.rowGapMm).toBe(7);
    expect(result.calculations.rowPitchMm).toBe(8);
    expect(result.reasons.join(" ")).not.toMatch(/AI row-gap/i);
  });

  test("rejects malicious or out-of-range AI advice without applying it", () => {
    const current = currentSettings();
    const result = suggestCalligraphySettings(
      current,
      {
        goal: "practice",
        experience: "comfortable",
        script: "italic",
        nibWidthMm: null,
        xHeightMm: null,
        minMarginMm: 10,
      },
      { xHeightMm: 999, rowGapMm: 3, fontId: "remote" },
    );

    expect(result.settings.xHeightMm).toBe(current.xHeightMm);
    expect(result.settings.rowGapMm).not.toBe(3);
    expect(result.settings.fontId).toBe(current.fontId);
    expect(result.warnings.join(" ")).toMatch(/AI advice was ignored/i);
  });

  test("falls back to deterministic geometry when bounded AI advice cannot fit", () => {
    const current = normalizeWorksheetSettings({
      paper: "custom",
      customWidthMm: 50,
      customHeightMm: 50,
      orientation: "portrait",
      marginTopMm: 1,
      marginBottomMm: 1,
      marginLeftMm: 1,
      marginRightMm: 1,
      xHeightMm: 4,
      rowGapMm: 2,
    });
    const result = suggestCalligraphySettings(
      current,
      {
        goal: "practice",
        experience: "comfortable",
        script: "italic",
        nibWidthMm: null,
        xHeightMm: null,
        minMarginMm: 1,
      },
      { xHeightMm: 50, rowGapMm: 100 },
    );

    expect(result.calculations.rowsPerPage).toBe(3);
    expect(result.settings.xHeightMm).toBe(4);
    expect(result.settings.rowGapMm).toBe(2.2);
    expect(result.warnings.join(" ")).toMatch(
      /AI advice was ignored because it did not fit/i,
    );
  });

  test("reports a useful error when requested geometry cannot fit", () => {
    const current = normalizeWorksheetSettings({
      paper: "custom",
      customWidthMm: 50,
      customHeightMm: 50,
      orientation: "portrait",
      marginTopMm: 1,
      marginBottomMm: 1,
      marginLeftMm: 1,
      marginRightMm: 1,
    });

    expect(() =>
      suggestCalligraphySettings(
        current,
        {
          goal: "practice",
          experience: "beginner",
          script: "italic",
          nibWidthMm: null,
          xHeightMm: 20,
          minMarginMm: 20,
        },
        { xHeightMm: 2, rowGapMm: 1 },
      ),
    ).toThrow(/cannot fit.*margins.*writing proportions/i);
  });
});
