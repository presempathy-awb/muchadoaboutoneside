/** Project proof-quality targets, not a universal human-readability guarantee. */
export const LETTERING_VISIBILITY_POLICY = Object.freeze({
  contrastRatio: 4.5,
  inkHeightPx: 12,
  xHeightPx: 12,
  strokeWidthPx: 1.5,
});

export interface LetteringPixelMetrics {
  /** Actual measured ink bounds; never the font's em or line box. */
  inkHeightPx?: number;
  /** Measured lower-case x, when the face has one. */
  xHeightPx?: number;
  /** Only supply a measured stroke sample; no guessed font-size multiplier. */
  strokeWidthPx?: number;
}

export interface LetteringPhysicalFit {
  totalWordCount: number;
  placedWordCount: number;
  unplacedText: string;
  /** Number of placed faces whose measured ink/line boxes exceed the safe area. */
  inkOverflowCount?: number;
}

export interface LetteringVisibilityInput {
  text: string;
  physical?: LetteringPhysicalFit;
  colors?: { ink: string; paper: string };
  texture?: LetteringPixelMetrics;
  /** Scan values are native retained source pixels, before display upscaling. */
  source?: LetteringPixelMetrics & { kind: "vector" | "scan" };
  /** Actual projected CSS pixels at the current camera, not texture pixels. */
  screen?: LetteringPixelMetrics;
}

export type LetteringVisibilityCheckStatus =
  | "pass"
  | "fail"
  | "not-measured"
  | "not-applicable"
  | "zoom-needed";

export interface LetteringVisibilityCheck {
  id: string;
  label: string;
  status: LetteringVisibilityCheckStatus;
  reason: string;
  /** Core proof acceptance requires this measurement; optional gaps stay visible. */
  required: boolean;
  value?: number;
  target?: number;
}

export interface LetteringVisibilityReport {
  status: "meets-targets" | "needs-attention" | "not-measured" | "empty";
  checks: LetteringVisibilityCheck[];
  summary: string;
  policy: typeof LETTERING_VISIBILITY_POLICY;
}

/**
 * sRGB relative luminance of an opaque #RRGGBB proof color.
 * Formula: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
 */
export function letteringRelativeLuminance(color: string): number | null {
  if (!/^#[a-f\d]{6}$/i.test(color)) return null;
  const linear = (offset: number) => {
    const channel = Number.parseInt(color.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(1) + 0.7152 * linear(3) + 0.0722 * linear(5);
}

export function letteringContrastRatio(
  ink: string,
  paper: string,
): number | null {
  const a = letteringRelativeLuminance(ink);
  const b = letteringRelativeLuminance(paper);
  if (a === null || b === null) return null;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function pixelCheck(
  space: "texture" | "source" | "screen",
  metric: "inkHeightPx" | "xHeightPx" | "strokeWidthPx",
  values: LetteringPixelMetrics | undefined,
  applicable = true,
): LetteringVisibilityCheck {
  const names = {
    inkHeightPx: "ink height",
    xHeightPx: "representative lowercase-x height",
    strokeWidthPx: "stroke sample",
  };
  const value = values?.[metric];
  const target = LETTERING_VISIBILITY_POLICY[metric];
  const base = {
    id: `${space}-${metric}`,
    label: `${space === "source" ? "Native scan" : space === "screen" ? "On-screen" : "Texture"} ${names[metric]}`,
    target,
    required: applicable && metric === "inkHeightPx" && space !== "screen",
  };
  if (!applicable)
    return {
      ...base,
      status: "not-applicable",
      reason: "Vector outlines have no source-raster sampling limit.",
    };
  if (value === undefined || !Number.isFinite(value) || value < 0)
    return {
      ...base,
      status: "not-measured",
      reason: `No measured ${space} ${names[metric]} is available. Font size and line height do not substitute for this measurement.`,
    };
  const enough = value >= target;
  return {
    ...base,
    value,
    status: enough ? "pass" : space === "screen" ? "zoom-needed" : "fail",
    reason: enough
      ? `${value.toFixed(2)} px meets the project's ${target} px ${names[metric]} target; this alone does not establish readability.`
      : space === "screen"
        ? `${value.toFixed(2)} CSS px is below the ${target} px target. Zoom closer; physical fit is checked separately.`
        : space === "source"
          ? `${value.toFixed(2)} retained source px is below the ${target} px target. Enlarging the texture cannot recover absent source detail.`
          : `${value.toFixed(2)} texture px is below the ${target} px target. Increase proof resolution or lettering size.`,
  };
}

/** Deterministic measurements only: no OCR, AI assessment or invented metrics. */
export function evaluateLetteringVisibility(
  input: LetteringVisibilityInput,
): LetteringVisibilityReport {
  const words = input.text.match(/\S+/gu) ?? [];
  if (!words.length)
    return {
      status: "empty",
      summary: "No wording is selected; there is no lettering to assess.",
      checks: [],
      policy: LETTERING_VISIBILITY_POLICY,
    };
  const physical = input.physical;
  const coverageKnown =
    physical &&
    count(physical.totalWordCount) &&
    count(physical.placedWordCount) &&
    physical.totalWordCount === words.length &&
    physical.placedWordCount <= physical.totalWordCount;
  const covered =
    coverageKnown &&
    physical.placedWordCount === words.length &&
    !physical.unplacedText.trim();
  const checks: LetteringVisibilityCheck[] = [
    {
      id: "physical-coverage",
      required: true,
      label: "Words placed",
      status: !coverageKnown ? "not-measured" : covered ? "pass" : "fail",
      reason: !coverageKnown
        ? "A matching measured layout is not available for the current wording."
        : covered
          ? `All ${words.length} words are assigned to plates.`
          : `${physical.placedWordCount} of ${words.length} words are assigned; some wording remains unplaced.`,
      ...(coverageKnown
        ? { value: physical.placedWordCount, target: words.length }
        : {}),
    },
    {
      id: "physical-bounds",
      required: true,
      label: "Measured safe-area fit",
      status: !count(physical?.inkOverflowCount)
        ? "not-measured"
        : physical.inkOverflowCount === 0
          ? "pass"
          : "fail",
      reason: !count(physical?.inkOverflowCount)
        ? "The placed ink and line boxes have not been checked against the plate safe areas."
        : physical.inkOverflowCount === 0
          ? "Measured ink and line boxes stay within their physical safe areas."
          : `${physical.inkOverflowCount} placed faces exceed their physical safe area.`,
      ...(count(physical?.inkOverflowCount)
        ? { value: physical.inkOverflowCount, target: 0 }
        : {}),
    },
  ];
  const contrast = input.colors
    ? letteringContrastRatio(input.colors.ink, input.colors.paper)
    : null;
  checks.push({
    id: "proof-contrast",
    required: true,
    label: "Proof color contrast",
    status:
      contrast === null
        ? "not-measured"
        : contrast >= LETTERING_VISIBILITY_POLICY.contrastRatio
          ? "pass"
          : "fail",
    reason:
      contrast === null
        ? "Opaque ink and paper proof colors have not been measured."
        : `${contrast.toFixed(2)}:1 between the configured proof colors; project target 4.5:1. This does not measure lighting, reflections, transparency or WCAG compliance of the 3D scene.`,
    ...(contrast === null
      ? {}
      : { value: contrast, target: LETTERING_VISIBILITY_POLICY.contrastRatio }),
  });
  for (const metric of ["inkHeightPx", "xHeightPx", "strokeWidthPx"] as const) {
    checks.push(pixelCheck("texture", metric, input.texture));
    checks.push(
      pixelCheck(
        "source",
        metric,
        input.source,
        input.source?.kind !== "vector",
      ),
    );
    checks.push(pixelCheck("screen", metric, input.screen));
  }
  const status = checks.some(
    ({ status }) => status === "fail" || status === "zoom-needed",
  )
    ? "needs-attention"
    : checks.some(
          ({ status, required }) => required && status === "not-measured",
        )
      ? "not-measured"
      : "meets-targets";
  const unknown = checks.filter(
    (check) => check.status === "not-measured",
  ).length;
  return {
    status,
    summary:
      status === "needs-attention"
        ? "One or more measured targets need attention. Review the individual reasons."
        : status === "not-measured"
          ? "A required proof measurement is unavailable; acceptance has not been established."
          : `Measured proof targets met.${unknown ? ` ${unknown} additional checks remain unmeasured.` : ""} This is not a human-readability guarantee.`,
    checks,
    policy: LETTERING_VISIBILITY_POLICY,
  };
}
