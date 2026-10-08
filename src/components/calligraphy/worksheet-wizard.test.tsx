import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CALLIGRAPHY_JOURNEYS } from "../../../shared/calligraphy-journeys";
import { reportVisibleValidity, WorksheetWizard } from "./worksheet-wizard";

const slots = {
  guides: <button type="button">24 plain lines</button>,
  paper: (
    <label>
      Paper size
      <select>
        <option>A4</option>
      </select>
    </label>
  ),
  lettering: (
    <label>
      Print example text
      <input type="checkbox" />
    </label>
  ),
  materials: <input type="text" placeholder="Ink brand" />,
  words: <textarea aria-label="Practice words" />,
  photo: <input type="file" aria-label="Lettering photo" />,
  font: <button type="button">Build font</button>,
  knowledge: <button type="button">Open a guide</button>,
};

test("guided setup starts with a path choice and mounts no editing controls", () => {
  const html = renderToStaticMarkup(
    <WorksheetWizard {...slots} onExit={() => undefined}>
      <button type="button">Download PDF</button>
    </WorksheetWizard>,
  );
  expect(html).toContain("Choose your path");
  for (const journey of CALLIGRAPHY_JOURNEYS) {
    expect(html).toContain(journey.label);
  }
  expect(html).not.toContain("24 plain lines");
  expect(html).not.toContain("<select");
  expect(html).not.toContain('type="checkbox"');
  expect(html).not.toContain("Download PDF");
  expect(html).not.toContain('placeholder="Ink brand"');
  expect(html).not.toContain("Build font");
});

test("an initial journey mounts only its first step and shows its path progress", () => {
  const html = renderToStaticMarkup(
    <WorksheetWizard
      {...slots}
      initialJourney="font-creation"
      onExit={() => undefined}
    >
      <button type="button">Download PDF</button>
    </WorksheetWizard>,
  );
  expect(html).toContain("Prepare your alphabet for a font");
  expect(html).toContain("Build font");
  expect(html).not.toContain('aria-label="Lettering photo"');
  expect(html).not.toContain("Paper size");
  expect(html).toContain("Change path");
  expect(html).toContain('aria-current="step"');
});

test("each journey starts in its purpose-specific tool", () => {
  const expectedStart = {
    practice: "24 plain lines",
    poem: "Practice words",
    "photo-sizing": "24 plain lines",
    "font-creation": "Build font",
    "ink-testing": "Ink brand",
    learning: "Open a guide",
  } as const;

  for (const [initialJourney, expected] of Object.entries(expectedStart)) {
    const html = renderToStaticMarkup(
      <WorksheetWizard
        {...slots}
        initialJourney={initialJourney as keyof typeof expectedStart}
        onExit={() => undefined}
      >
        <button type="button">Download PDF</button>
      </WorksheetWizard>,
    );
    expect(html).toContain(expected);
  }
});

test("hidden invalid controls do not block the current wizard step", () => {
  let hiddenReports = 0;
  const valid = reportVisibleValidity([
    {
      disabled: false,
      closest: () => ({}) as Element,
      getClientRects: () => ({ length: 0 }) as DOMRectList,
      checkValidity: () => false,
      reportValidity: () => {
        hiddenReports += 1;
        return false;
      },
    },
    {
      disabled: false,
      closest: () => null,
      getClientRects: () => ({ length: 1 }) as DOMRectList,
      checkValidity: () => true,
      reportValidity: () => true,
    },
  ]);
  expect(valid).toBe(true);
  expect(hiddenReports).toBe(0);
});

test("the first visible invalid control reports and blocks advancement", () => {
  let reports = 0;
  const valid = reportVisibleValidity([
    {
      disabled: false,
      closest: () => null,
      getClientRects: () => ({ length: 1 }) as DOMRectList,
      checkValidity: () => false,
      reportValidity: () => {
        reports += 1;
        return false;
      },
    },
  ]);
  expect(valid).toBe(false);
  expect(reports).toBe(1);
});
