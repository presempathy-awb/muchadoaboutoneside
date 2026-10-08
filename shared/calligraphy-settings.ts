import {
  getWorksheetLayout,
  normalizeWorksheetSettings,
  type WorksheetSettings,
} from "./worksheet";

export interface CalligraphyRequirements {
  goal: "practice" | "poem" | "trace";
  experience: "beginner" | "comfortable";
  script: "keep" | "plain" | "copperplate" | "italic";
  nibWidthMm: number | null;
  xHeightMm: number | null;
  minMarginMm: number;
}
export interface CalligraphySettingsSuggestion {
  settings: WorksheetSettings;
  reasons: string[];
  warnings: string[];
  calculations: {
    widthMm: number;
    heightMm: number;
    rowsPerPage: number;
    xHeightMm: number;
    rowPitchMm: number;
  };
}
type AiSettingsAdvice = Partial<
  Pick<WorksheetSettings, "xHeightMm" | "rowGapMm">
>;

const REQUIREMENT_FIELDS = new Set([
  "goal",
  "experience",
  "script",
  "nibWidthMm",
  "xHeightMm",
  "minMarginMm",
]);
const ADVICE_FIELDS = new Set(["xHeightMm", "rowGapMm"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertEnum<const T extends readonly string[]>(
  value: unknown,
  field: string,
  choices: T,
): asserts value is T[number] {
  if (typeof value !== "string" || !choices.includes(value)) {
    throw new TypeError(`${field} must be one of: ${choices.join(", ")}.`);
  }
}

function assertBoundedNumber(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new RangeError(`${field} must be between ${minimum} and ${maximum}.`);
  }
}

/** Validate a complete set of answers from the settings wizard. */
export function parseCalligraphyRequirements(
  input: unknown,
): CalligraphyRequirements {
  if (!isRecord(input)) {
    throw new TypeError("Calligraphy requirements must be an object.");
  }
  const fields = Object.keys(input);
  if (
    fields.some((field) => !REQUIREMENT_FIELDS.has(field)) ||
    [...REQUIREMENT_FIELDS].some((field) => !(field in input))
  ) {
    throw new TypeError(
      "Calligraphy requirements have missing or unknown fields.",
    );
  }

  assertEnum(input.goal, "goal", ["practice", "poem", "trace"] as const);
  assertEnum(input.experience, "experience", [
    "beginner",
    "comfortable",
  ] as const);
  assertEnum(input.script, "script", [
    "keep",
    "plain",
    "copperplate",
    "italic",
  ] as const);
  if (input.nibWidthMm !== null) {
    assertBoundedNumber(input.nibWidthMm, "nibWidthMm", 0.1, 10);
  }
  if (input.xHeightMm !== null) {
    assertBoundedNumber(input.xHeightMm, "xHeightMm", 0.5, 50);
  }
  assertBoundedNumber(input.minMarginMm, "minMarginMm", 0, 200);

  return {
    goal: input.goal,
    experience: input.experience,
    script: input.script,
    nibWidthMm: input.nibWidthMm,
    xHeightMm: input.xHeightMm,
    minMarginMm: input.minMarginMm,
  };
}

function parseAiAdvice(input: unknown): AiSettingsAdvice | null {
  if (input === undefined) return {};
  if (
    !isRecord(input) ||
    Object.keys(input).some((field) => !ADVICE_FIELDS.has(field))
  ) {
    return null;
  }
  if (input.xHeightMm !== undefined) {
    try {
      assertBoundedNumber(input.xHeightMm, "xHeightMm", 0.5, 50);
    } catch {
      return null;
    }
  }
  if (input.rowGapMm !== undefined) {
    try {
      assertBoundedNumber(input.rowGapMm, "rowGapMm", 0, 100);
    } catch {
      return null;
    }
  }
  return input as AiSettingsAdvice;
}

function suggestedRowGap(
  goal: CalligraphyRequirements["goal"],
  experience: CalligraphyRequirements["experience"],
  xHeightMm: number,
): number {
  const ratio = goal === "poem" ? 0.35 : experience === "beginner" ? 0.8 : 0.55;
  return Math.min(100, Number((xHeightMm * ratio).toFixed(2)));
}

function scriptGeometry(
  base: WorksheetSettings,
  script: CalligraphyRequirements["script"],
): Pick<
  WorksheetSettings,
  "ascenderRatio" | "descenderRatio" | "slantEnabled" | "slantAngle"
> {
  if (script === "copperplate") {
    return {
      ascenderRatio: 1.5,
      descenderRatio: 1.5,
      slantEnabled: true,
      slantAngle: 55,
    };
  }
  if (script === "italic") {
    return {
      ascenderRatio: 1,
      descenderRatio: 1,
      slantEnabled: true,
      slantAngle: 80,
    };
  }
  if (script === "plain") {
    return {
      ascenderRatio: base.ascenderRatio,
      descenderRatio: base.descenderRatio,
      slantEnabled: false,
      slantAngle: base.slantAngle,
    };
  }
  return {
    ascenderRatio: base.ascenderRatio,
    descenderRatio: base.descenderRatio,
    slantEnabled: base.slantEnabled,
    slantAngle: base.slantAngle,
  };
}

/** Produce a validated, reviewable worksheet proposal from wizard answers. */
export function suggestCalligraphySettings(
  current: WorksheetSettings,
  requirements: CalligraphyRequirements,
  advice?: unknown,
): CalligraphySettingsSuggestion {
  const base = normalizeWorksheetSettings(current);
  const answers = parseCalligraphyRequirements(requirements);
  const parsedAdvice = parseAiAdvice(advice);
  const reasons: string[] = [];
  const warnings: string[] = [];
  const mode = answers.script === "keep" ? base.mode : answers.script;

  let xHeightMm = base.xHeightMm;
  if (answers.xHeightMm !== null) {
    xHeightMm = answers.xHeightMm;
    reasons.push(`Used the requested ${xHeightMm} mm x-height.`);
  } else if (mode === "italic" && answers.nibWidthMm !== null) {
    xHeightMm = answers.nibWidthMm * 5;
    reasons.push("Started the italic x-height at five nib widths.");
  } else if (parsedAdvice?.xHeightMm !== undefined) {
    xHeightMm = parsedAdvice.xHeightMm;
    reasons.push("Used the bounded AI x-height suggestion.");
  }

  if (mode === "copperplate" && answers.nibWidthMm !== null) {
    warnings.push(
      "Pointed-pen proportions do not use a nib-width x-height formula.",
    );
  }
  if (parsedAdvice === null) {
    warnings.push(
      "AI advice was ignored because it contained unsupported or unsafe values.",
    );
  }

  const usesRowGap = mode !== "grid";
  const rowGapMm = usesRowGap
    ? (parsedAdvice?.rowGapMm ??
      suggestedRowGap(answers.goal, answers.experience, xHeightMm))
    : base.rowGapMm;
  if (usesRowGap) {
    reasons.push(
      parsedAdvice?.rowGapMm === undefined
        ? "Calculated row spacing from the goal, experience, and x-height."
        : "Used the bounded AI row-gap suggestion.",
    );
  }
  const geometry = scriptGeometry(base, answers.script);
  const plainRowPitchMm = xHeightMm + rowGapMm;

  let settings: WorksheetSettings;
  let layout: ReturnType<typeof getWorksheetLayout>;
  try {
    settings = normalizeWorksheetSettings({
      ...base,
      mode,
      ...geometry,
      guidesEnabled: answers.script === "keep" ? base.guidesEnabled : true,
      spacingMode: mode === "plain" ? "fixed" : base.spacingMode,
      spacingMm: mode === "plain" ? plainRowPitchMm : base.spacingMm,
      xHeightMm,
      textXHeightMm: xHeightMm,
      fontSizeMode:
        answers.goal === "poem" || answers.goal === "trace"
          ? "xheight"
          : base.fontSizeMode,
      rowGapMm,
      marginTopMm: Math.max(base.marginTopMm, answers.minMarginMm),
      marginBottomMm: Math.max(base.marginBottomMm, answers.minMarginMm),
      marginLeftMm: Math.max(base.marginLeftMm, answers.minMarginMm),
      marginRightMm: Math.max(base.marginRightMm, answers.minMarginMm),
      textEnabled: answers.goal !== "practice",
      practicePattern:
        answers.goal === "trace" ? "model-trace-blank" : "continuous",
    });
    layout = getWorksheetLayout(settings);
    if (layout.baselineYsMm.length === 0) {
      throw new RangeError("No writing rows fit on the page.");
    }
  } catch (error) {
    if (parsedAdvice && Object.keys(parsedAdvice).length > 0) {
      const fallback = suggestCalligraphySettings(current, requirements);
      fallback.warnings.push(
        "AI advice was ignored because it did not fit the selected paper and margins.",
      );
      return fallback;
    }
    const detail = error instanceof Error ? ` ${error.message}` : "";
    throw new RangeError(
      `The requested settings cannot fit the minimum margins and writing proportions.${detail}`,
    );
  }

  warnings.push(
    "Exact font and text fit still needs the worksheet preview fit check.",
  );
  const first = layout.baselineYsMm[0];
  const second = layout.baselineYsMm[1];
  const rowPitchMm =
    first !== undefined && second !== undefined
      ? second - first
      : settings.mode === "plain" || settings.mode === "grid"
        ? settings.spacingMode === "fixed"
          ? settings.spacingMm
          : (layout.contentY2Mm - layout.contentY1Mm) / (settings.lineCount - 1)
        : xHeightMm * (1 + settings.ascenderRatio + settings.descenderRatio) +
          rowGapMm;

  return {
    settings,
    reasons,
    warnings,
    calculations: {
      widthMm: layout.widthMm,
      heightMm: layout.heightMm,
      rowsPerPage: layout.baselineYsMm.length,
      xHeightMm,
      rowPitchMm,
    },
  };
}
