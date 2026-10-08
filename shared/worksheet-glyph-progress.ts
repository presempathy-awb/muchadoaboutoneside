export interface WorksheetGlyphProgress {
  state: string;
  errorCode: string;
  reconciliationRequired: boolean;
  steps: { ordinal: number; name: string; state: string; model: string }[];
}

/** Validate a bounded progress response before a browser renders its model steps. */
export function parseWorksheetGlyphProgress(
  value: unknown,
): WorksheetGlyphProgress {
  const invalid = () => {
    throw new Error("The queue status was incomplete. Check again later.");
  };
  if (!value || typeof value !== "object" || Array.isArray(value))
    return invalid();
  const data = value as Record<string, unknown>;
  if (
    ![
      "accepted",
      "queued",
      "running",
      "held",
      "succeeded",
      "failed",
      "timed_out",
      "canceled",
    ].includes(String(data.state)) ||
    typeof data.errorCode !== "string" ||
    !/^[a-z0-9_]{0,80}$/.test(data.errorCode) ||
    typeof data.reconciliationRequired !== "boolean" ||
    !Array.isArray(data.steps) ||
    data.steps.length > 7
  )
    return invalid();
  const steps = data.steps.map((item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item))
      return invalid();
    const step = item as Record<string, unknown>;
    if (
      typeof step.ordinal !== "number" ||
      !Number.isInteger(step.ordinal) ||
      step.ordinal < 1 ||
      step.ordinal > 7 ||
      typeof step.name !== "string" ||
      !/^(style|generate-[1-3]|review-[1-3])$/.test(step.name) ||
      typeof step.state !== "string" ||
      !["reserved", "completed", "ambiguous"].includes(step.state) ||
      typeof step.model !== "string" ||
      step.model.length > 180
    )
      return invalid();
    return {
      ordinal: step.ordinal,
      name: step.name,
      state: step.state,
      model: step.model,
    };
  });
  if (
    new Set(steps.map((step) => step.ordinal)).size !== steps.length ||
    new Set(steps.map((step) => step.name)).size !== steps.length
  )
    return invalid();
  return {
    state: String(data.state),
    errorCode: data.errorCode,
    reconciliationRequired: data.reconciliationRequired,
    steps,
  };
}
