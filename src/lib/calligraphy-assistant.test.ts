import { describe, expect, test } from "bun:test";
import { DEFAULT_WORKSHEET_SETTINGS } from "../../shared/worksheet";
import {
  calligraphyAssistantErrorMessage,
  calligraphySettingsFingerprint,
  isCalligraphyProposalStale,
  parseCalligraphyAssistantCapability,
  parseCalligraphyAssistantReply,
  trimCalligraphyHistory,
} from "./calligraphy-assistant";

describe("calligraphy assistant client boundaries", () => {
  test("keeps only the six newest session messages", () => {
    const history = Array.from({ length: 8 }, (_, index) => ({
      role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `message ${index + 1}`,
    }));

    expect(
      trimCalligraphyHistory(history).map((entry) => entry.content),
    ).toEqual([
      "message 3",
      "message 4",
      "message 5",
      "message 6",
      "message 7",
      "message 8",
    ]);
  });

  test("rejects capability payloads that invent unsupported transports", () => {
    expect(() =>
      parseCalligraphyAssistantCapability({
        available: true,
        models: ["qwen3.5:27b"],
        webSearch: true,
        transport: "browser-key",
      }),
    ).toThrow(/capability/i);
  });

  test("rejects malformed assistant replies before the UI can apply them", () => {
    expect(() =>
      parseCalligraphyAssistantReply({
        answer: "Try this",
        model: "qwen3.5:27b",
        sources: [],
        warnings: [],
        searched: false,
        proposal: { settings: { marginLeftMm: -99 } },
      }),
    ).toThrow(/reply/i);
  });

  test("rejects active-content source links", () => {
    expect(() =>
      parseCalligraphyAssistantReply({
        answer: "Open this",
        model: "qwen3.5:27b",
        sources: [
          {
            id: "unsafe",
            title: "Unsafe",
            url: "javascript:alert(1)",
            kind: "web",
          },
        ],
        warnings: [],
        searched: true,
      }),
    ).toThrow(/unsafe/i);
  });

  test("fingerprints every worksheet field so stale proposals are detectable", () => {
    const original = calligraphySettingsFingerprint(DEFAULT_WORKSHEET_SETTINGS);
    const changed = calligraphySettingsFingerprint({
      ...DEFAULT_WORKSHEET_SETTINGS,
      marginRightMm: DEFAULT_WORKSHEET_SETTINGS.marginRightMm + 1,
    });

    expect(changed).not.toBe(original);
  });

  test("a recalculated proposal becomes current and later synchronized edits stale it", () => {
    const synchronized = {
      ...DEFAULT_WORKSHEET_SETTINGS,
      marginLeftMm: 18,
    };
    const recalculatedAt = calligraphySettingsFingerprint(synchronized);

    expect(
      isCalligraphyProposalStale(recalculatedAt, synchronized),
    ).toBeFalse();
    expect(
      isCalligraphyProposalStale(recalculatedAt, {
        ...synchronized,
        marginLeftMm: 19,
      }),
    ).toBeTrue();
  });

  test("shows bounded JSON errors without exposing raw response bodies", () => {
    expect(
      calligraphyAssistantErrorMessage(
        429,
        JSON.stringify({ error: "The studio assistant is busy. Try later." }),
      ),
    ).toBe("The studio assistant is busy. Try later.");
    expect(
      calligraphyAssistantErrorMessage(502, "<html>proxy failure</html>"),
    ).toBe("The calligraphy assistant returned HTTP 502. Please try again.");
  });
});
