import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { POEM_VERSIONS, poemVersionById } from "../../shared/poem";
import { draftSource } from "../../shared/poem-drafts";
import { poemVersionSaveError } from "../../shared/poem-library";
import {
  PoemVersionControls,
  PoemVersionNameField,
} from "./poem-version-controls";

test("version controls render both protected originals, a new-copy name, and the calligrapher", () => {
  const html = renderToStaticMarkup(
    createElement(PoemVersionControls, {
      text: "Current working text",
      onLoad() {},
    }),
  );
  expect(html.indexOf('value="canonical"')).toBeLessThan(
    html.indexOf('value="extended"'),
  );
  expect(html).toContain('value="Extended"');
  expect(html).toContain('value="Jill Winters"');
  expect(html).toContain("Load selected wording");
  expect(html).toContain("Save version");
  expect(html).toContain("Import calligraphy scan");
  expect(html).toMatch(
    /<button[^>]+disabled=""[^>]+aria-describedby="[^"]+">Delete version<\/button>/,
  );
  expect(html).toContain(
    'title="The Canonical and Extended originals cannot be deleted."',
  );
  expect(html).not.toContain('type="file"');
});

test("unchanged names produce a linked, visible name error while identical text can be copied", () => {
  const base = poemVersionById("extended");
  const input = {
    name: "  EXTENDED  ",
    text: draftSource(base),
    baseId: base.id,
  };
  const error = poemVersionSaveError(input, POEM_VERSIONS, base);
  expect(error).toBe(
    "Change the selected version’s name before saving a copy.",
  );
  const html = renderToStaticMarkup(
    createElement(PoemVersionNameField, {
      name: input.name,
      error,
      errorId: "save-name-error",
      attempt: 1,
      onChange() {},
    }),
  );
  expect(html).toContain('aria-invalid="true"');
  expect(html).toContain('aria-errormessage="save-name-error"');
  expect(html).toContain('data-invalid-attempt="1"');
  expect(html).toContain(`title="${error}"`);
  expect(html).not.toContain("disabled");
  expect(
    poemVersionSaveError(
      { ...input, name: "A new reading" },
      POEM_VERSIONS,
      base,
    ),
  ).toBeUndefined();
});
