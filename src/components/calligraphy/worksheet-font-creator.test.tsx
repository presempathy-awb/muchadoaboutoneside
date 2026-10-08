import { describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import type { WorksheetPipelineProfile } from "../../../server/worksheet-pipeline";
import { WorksheetFontCreator } from "./worksheet-font-creator";
import {
  canPrepareAnotherGlyph,
  selectDefaultGlyphProfile,
} from "./worksheet-glyph-jobs";
import { WorksheetPhotoPanel } from "./worksheet-photo";

describe("photo-to-font creator", () => {
  test("a font journey can start in font creation without opening the reference tab", () => {
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <WorksheetPhotoPanel
          cockpit
          initialSection="font"
          photo={undefined}
          onChange={() => undefined}
          onApplyMeasurements={() => undefined}
          onApplySuggestion={async () => true}
        />
      </QueryClientProvider>,
    );
    expect(markup).toContain('data-section="font" aria-pressed="true"');
    expect(markup).toContain('data-section="reference" aria-pressed="false"');
  });

  test("continuous photo placement keeps measured precision natively valid", () => {
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <WorksheetPhotoPanel
          cockpit
          initialSection="reference"
          photo={{
            dataUrl: "data:image/png;base64,AA==",
            pixelWidth: 1000,
            pixelHeight: 500,
            widthMm: 130.15,
            xMm: 12.35,
            yMm: 18.75,
            opacity: 0.25,
            rotation: 0,
            print: false,
          }}
          onChange={() => undefined}
          onApplyMeasurements={() => undefined}
          onApplySuggestion={async () => true}
        />
      </QueryClientProvider>,
    );

    expect(markup).toContain(
      'id="ws-photo-width" type="number" min="0.1" max="5000" step="any" value="130.15"',
    );
    expect(markup).toContain(
      'id="ws-photo-x" type="number" min="-5000" max="5000" step="any" value="12.35"',
    );
    expect(markup).toContain(
      'id="ws-photo-y" type="number" min="-5000" max="5000" step="any" value="18.75"',
    );
  });
  test("renders all wizard steps with only the first step initially visible", () => {
    const markup = renderToStaticMarkup(
      <WorksheetFontCreator
        hasPhoto={true}
        isCalibrated={true}
        onOpenReference={() => undefined}
        onOpenSizing={() => undefined}
        onImportFont={() => undefined}
        photoUpload={<div>Shared photo upload</div>}
        letterRounds={<div>Persistent letter-round controls</div>}
      />,
    );

    expect(markup).toContain("Create a font from a photo");
    expect(markup.match(/aria-current="step"/g)).toHaveLength(1);
    expect(markup.match(/aria-labelledby="ws-font-step-/g)).toHaveLength(4);
    expect(markup).toContain("Shared photo upload");
    expect(markup).toContain("Persistent letter-round controls");
    expect(markup).toContain("Calligraphr");
    expect(markup).toContain("TTF/OTF");
    expect(markup).toContain("Import finished TTF / OTF");
  });

  test("prefers the registered Qwen 27 profile when one is available", () => {
    const profiles: WorksheetPipelineProfile[] = [
      {
        id: "small",
        label: "Qwen 27 comparison · fast preview",
        styleModel: "qwen3.5:9b",
        generatorModel: "VecGlypher/VecGlypher-27b-it",
        reviewModel: "qwen3.5:9b",
        maxRounds: 1,
      },
      {
        id: "qwen-27",
        label: "Qwen 27 · VecGlypher rounds",
        styleModel: "qwen3.5:27b",
        generatorModel: "VecGlypher/VecGlypher-27b-it",
        reviewModel: "qwen3.5:27b",
        maxRounds: 3,
      },
    ];

    expect(selectDefaultGlyphProfile(profiles)?.id).toBe("qwen-27");
    expect(
      selectDefaultGlyphProfile([profiles[0] as WorksheetPipelineProfile])?.id,
    ).toBe("small");
  });

  test("keeps the local access handle for held glyph work", () => {
    expect(canPrepareAnotherGlyph("held")).toBe(false);
    expect(canPrepareAnotherGlyph("succeeded")).toBe(true);
    expect(canPrepareAnotherGlyph("failed")).toBe(true);
  });

  test("adds photo subselectors only to the cockpit route", () => {
    function renderPhoto(cockpit: boolean): string {
      return renderToStaticMarkup(
        <QueryClientProvider client={new QueryClient()}>
          <WorksheetPhotoPanel
            cockpit={cockpit}
            photo={undefined}
            onChange={() => undefined}
            onApplyMeasurements={() => undefined}
            onApplySuggestion={async () => true}
          />
        </QueryClientProvider>,
      );
    }

    const original = renderPhoto(false);
    const cockpit = renderPhoto(true);

    expect(original).not.toContain("Photo workspace");
    expect(original).not.toContain("Create a font from a photo");
    expect(original).toContain("Shape one letter in rounds");
    expect(cockpit).toContain("Photo workspace");
    expect(cockpit).toContain("Create a font from a photo");
    expect(cockpit).not.toContain("Qwen");
  });
});
