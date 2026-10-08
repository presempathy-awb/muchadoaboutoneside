import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CalligraphyToolBar } from "./calligraphy-cockpit";

test("creative destinations are directly available in desktop and mobile navigation", () => {
  const html = renderToStaticMarkup(
    <CalligraphyToolBar
      active="paper"
      onSelect={() => undefined}
      paperFocus={false}
      onTogglePaper={() => undefined}
      onCreateFont={() => undefined}
    />,
  );
  for (const label of [
    "Templates",
    "Make your own font",
    "At the mixing table",
    "Words & poems",
  ]) {
    expect(html).toContain(`>${label.replaceAll("&", "&amp;")}</option>`);
  }
});
