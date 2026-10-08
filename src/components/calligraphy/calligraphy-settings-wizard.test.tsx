import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_WORKSHEET_SETTINGS } from "../../../shared/worksheet";
import {
  CalligraphySettingsWizard,
  formatCalligraphySettingValue,
  suggestedSettingsFailureMessage,
} from "./calligraphy-settings-wizard";

test("settings wizard exposes formula and AI paths without applying a draft", () => {
  const html = renderToStaticMarkup(
    <CalligraphySettingsWizard
      settings={DEFAULT_WORKSHEET_SETTINGS}
      available={true}
      model="qwen3.5:27b"
      disabled={false}
      onRequestAi={async () => {
        throw new Error("not called during render");
      }}
      onApply={() => true}
    />,
  );

  expect(html).toContain("Suggested settings");
  expect(html).toContain("Requirements wizard");
  expect(html).toContain("Calculate without AI");
  expect(html).toContain("Ask Qwen 27");
  expect(html).toContain("Cancel request");
  expect(html).toContain("Apply these settings");
  expect(html).not.toContain("Qwen’s explanation");
  expect(html).not.toContain('aria-live="assertive">Applied');
});

test("review values round display-only measurements without changing settings", () => {
  const precise = 5.694232948385259;
  expect(formatCalligraphySettingValue(precise)).toBe("5.69");
  expect(precise).toBe(5.694232948385259);
  expect(formatCalligraphySettingValue(true)).toBe("On");
});

test("dual suggestion failure never claims a missing formula proposal exists", () => {
  expect(
    suggestedSettingsFailureMessage(
      "Qwen could not prepare settings.",
      false,
      "The requested proportions do not fit.",
    ),
  ).toBe(
    "The requested proportions do not fit. Qwen could not prepare settings.",
  );
  expect(
    suggestedSettingsFailureMessage(
      "Qwen could not prepare settings.",
      true,
      "",
    ),
  ).toBe(
    "Qwen could not prepare settings. The formula proposal is still available to review.",
  );
});

test("rendered numeric fields distinguish required dimensions from optional sizing", async () => {
  const html = renderToStaticMarkup(
    <CalligraphySettingsWizard
      settings={{ ...DEFAULT_WORKSHEET_SETTINGS, paper: "custom" }}
      available={true}
      model="qwen3.5:27b"
      disabled={false}
      onRequestAi={async () => {
        throw new Error("not called during render");
      }}
      onApply={() => true}
    />,
  );
  const fields: Array<Record<string, string | null>> = [];
  const rewritten = new HTMLRewriter()
    .on('input[type="number"]', {
      element(element) {
        fields.push({
          min: element.getAttribute("min"),
          max: element.getAttribute("max"),
          step: element.getAttribute("step"),
          required: element.getAttribute("required"),
        });
      },
    })
    .transform(new Response(html));
  await rewritten.text();

  expect(fields).toHaveLength(5);
  expect(fields.every(({ step }) => step === "any")).toBe(true);
  expect(
    fields.filter(({ min, max }) => min === "50" && max === "600"),
  ).toEqual([
    { min: "50", max: "600", step: "any", required: "" },
    { min: "50", max: "600", step: "any", required: "" },
  ]);
  expect(fields.find(({ min }) => min === "0")?.required).toBe("");
  expect(fields.find(({ min }) => min === "0.1")?.required).toBeNull();
  expect(fields.find(({ min }) => min === "0.5")?.required).toBeNull();
});
