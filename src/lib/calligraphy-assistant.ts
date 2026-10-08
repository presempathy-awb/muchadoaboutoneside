import type {
  CalligraphyAssistantCapability,
  CalligraphyAssistantReply,
  CalligraphyAssistantRequest,
  CalligraphyMessage,
  CalligraphySource,
} from "../../shared/calligraphy-assistant";
import type { CalligraphySettingsSuggestion } from "../../shared/calligraphy-settings";
import {
  normalizeWorksheetSettings,
  type WorksheetSettings,
} from "../../shared/worksheet";

const HISTORY_LIMIT = 6;
const REQUEST_TIMEOUT_MS = 180_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isStringList(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function parseSources(value: unknown): CalligraphySource[] {
  if (!Array.isArray(value))
    throw new TypeError("Assistant reply sources are invalid.");
  return value.map((source) => {
    if (
      !isRecord(source) ||
      typeof source.id !== "string" ||
      typeof source.title !== "string" ||
      typeof source.url !== "string" ||
      (source.kind !== "library" && source.kind !== "web")
    ) {
      throw new TypeError("Assistant reply sources are invalid.");
    }
    let url: URL;
    try {
      url = new URL(source.url);
    } catch {
      throw new TypeError("Assistant reply source URL is invalid.");
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new TypeError("Assistant reply source URL is unsafe.");
    }
    return source as unknown as CalligraphySource;
  });
}

function parseProposal(
  value: unknown,
): CalligraphySettingsSuggestion | undefined {
  if (value === undefined) return undefined;
  if (
    !isRecord(value) ||
    !isRecord(value.settings) ||
    !isStringList(value.reasons) ||
    !isStringList(value.warnings) ||
    !isRecord(value.calculations)
  ) {
    throw new TypeError("Assistant reply proposal is invalid.");
  }
  const settings = value.settings;
  const requiredSettings = Object.keys(normalizeWorksheetSettings({}));
  if (requiredSettings.some((key) => !(key in settings))) {
    throw new TypeError("Assistant reply proposal is incomplete.");
  }
  const calculations = value.calculations;
  if (
    ["widthMm", "heightMm", "rowsPerPage", "xHeightMm", "rowPitchMm"].some(
      (key) =>
        typeof calculations[key] !== "number" ||
        !Number.isFinite(calculations[key]),
    )
  ) {
    throw new TypeError("Assistant reply calculations are invalid.");
  }
  return {
    settings: normalizeWorksheetSettings(settings),
    reasons: value.reasons,
    warnings: value.warnings,
    calculations:
      calculations as unknown as CalligraphySettingsSuggestion["calculations"],
  };
}

export function parseCalligraphyAssistantCapability(
  value: unknown,
): CalligraphyAssistantCapability {
  if (
    !isRecord(value) ||
    typeof value.available !== "boolean" ||
    !isStringList(value.models) ||
    typeof value.webSearch !== "boolean" ||
    value.transport !== "ollama"
  ) {
    throw new TypeError("Calligraphy assistant capability is invalid.");
  }
  return {
    available: value.available,
    models: value.models.filter((model) => model.trim()).slice(0, 12),
    webSearch: value.webSearch,
    transport: value.transport,
  };
}

export function parseCalligraphyAssistantReply(
  value: unknown,
): CalligraphyAssistantReply {
  if (
    !isRecord(value) ||
    typeof value.answer !== "string" ||
    typeof value.model !== "string" ||
    !isStringList(value.warnings) ||
    typeof value.searched !== "boolean"
  ) {
    throw new TypeError("Calligraphy assistant reply is invalid.");
  }
  return {
    answer: value.answer,
    model: value.model,
    sources: parseSources(value.sources),
    warnings: value.warnings,
    searched: value.searched,
    proposal: parseProposal(value.proposal),
  };
}

export function trimCalligraphyHistory(
  messages: readonly CalligraphyMessage[],
): CalligraphyMessage[] {
  return messages.slice(-HISTORY_LIMIT).map(({ role, content }) => ({
    role,
    content,
  }));
}

export function calligraphySettingsFingerprint(
  settings: WorksheetSettings,
): string {
  return JSON.stringify(normalizeWorksheetSettings(settings));
}

export function isCalligraphyProposalStale(
  baseFingerprint: string,
  current: WorksheetSettings,
): boolean {
  return Boolean(
    baseFingerprint &&
      baseFingerprint !== calligraphySettingsFingerprint(current),
  );
}

export function calligraphyAssistantErrorMessage(
  status: number,
  body: string,
): string {
  try {
    const parsed: unknown = JSON.parse(body.slice(0, 4_096));
    if (
      isRecord(parsed) &&
      typeof parsed.error === "string" &&
      parsed.error.trim()
    ) {
      return parsed.error.trim().slice(0, 240);
    }
  } catch {
    // A non-JSON upstream response uses the bounded status fallback below.
  }
  return `The calligraphy assistant returned HTTP ${status}. Please try again.`;
}

export async function getCalligraphyAssistantCapability(
  signal?: AbortSignal,
): Promise<CalligraphyAssistantCapability> {
  const response = await fetch("/api/worksheet/assistant", {
    cache: "no-store",
    signal,
  });
  if (!response.ok)
    throw new Error("The calligraphy assistant could not be checked.");
  return parseCalligraphyAssistantCapability(await response.json());
}

export async function askCalligraphyAssistant(
  request: CalligraphyAssistantRequest,
  signal?: AbortSignal,
): Promise<CalligraphyAssistantReply> {
  const requestSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
    : AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const response = await fetch("/api/worksheet/assistant", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...request,
      question: request.question.trim().slice(0, 2_000),
      history: trimCalligraphyHistory(request.history),
    }),
    signal: requestSignal,
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(calligraphyAssistantErrorMessage(response.status, body));
  }
  return parseCalligraphyAssistantReply(await response.json());
}
