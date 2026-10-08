import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DEFAULT_WORKSHEET_SETTINGS,
  getWorksheetLayout,
} from "../../../shared/worksheet";
import { WorksheetPaperZoom } from "./worksheet-paper-zoom";

const layout = getWorksheetLayout(DEFAULT_WORKSHEET_SETTINGS);
const snapshot = {
  version: 1 as const,
  settings: DEFAULT_WORKSHEET_SETTINGS,
  text: "",
};

describe("paper zoom trigger", () => {
  test("keeps the compact zoom button when no paper trigger is supplied", () => {
    const markup = renderToStaticMarkup(
      <WorksheetPaperZoom snapshot={snapshot} layout={layout} lines={[]} />,
    );

    expect(markup).toContain("Zoom paper");
    expect(markup).not.toContain("Enlarge paper preview");
    expect(markup).not.toContain('role="img"');
  });

  test("turns supplied paper content into a labelled enlargement trigger", () => {
    const markup = renderToStaticMarkup(
      <WorksheetPaperZoom
        snapshot={snapshot}
        layout={layout}
        lines={[]}
        triggerClassName="ws-preview-mat"
      >
        <span>Paper preview</span>
      </WorksheetPaperZoom>,
    );

    expect(markup).toContain('aria-label="Enlarge paper preview"');
    expect(markup).toContain(
      'class="ck-paper-trigger ck-paper-trigger--surface ws-preview-mat"',
    );
    expect(markup).toContain("Paper preview");
    expect(markup).not.toContain("Zoom paper");
  });
});
