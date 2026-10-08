import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_WORKSHEET_SETTINGS } from "../../../shared/worksheet";
import { WorksheetMaterials } from "./worksheet-materials";

test("stored ink choices recover their guidance and retain the user's brand note", () => {
  const html = renderToStaticMarkup(
    <WorksheetMaterials
      settings={{
        ...DEFAULT_WORKSHEET_SETTINGS,
        ink: "Pigmented calligraphy ink · My blue bottle, undiluted",
        paperName: "My handmade paper",
      }}
      onChange={() => true}
    />,
  );
  expect(html).toContain('value="My blue bottle, undiluted"');
  expect(html).toContain("reactivate with water");
  expect(html).toContain('value="My handmade paper"');
  expect(html).not.toContain("Increase guide darkness");
});
