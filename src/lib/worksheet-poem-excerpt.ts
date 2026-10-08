import { DEFAULT_POEM } from "../../shared/poem";
import {
  validateWorksheetTextFit,
  worksheetTextPages,
} from "./worksheet-export";
import type { WorksheetFont } from "./worksheet-fonts";
import type { WorksheetSnapshot } from "./worksheet-store";

interface PoemExcerpt {
  text: string;
  lineCount: number;
  totalLines: number;
}

/** Choose complete opening poem lines that fit the measured worksheet. */
export function worksheetPoemExcerpt(
  snapshot: WorksheetSnapshot,
  font: WorksheetFont,
): PoemExcerpt {
  const settings = { ...snapshot.settings, textEnabled: true };
  // Reject invalid settings before considering any shorter wording.
  worksheetTextPages({ ...snapshot, settings, text: "" }, font);
  let excerpt: PoemExcerpt | undefined;
  for (let count = 1; count <= DEFAULT_POEM.lines.length; count += 1) {
    const text = DEFAULT_POEM.lines.slice(0, count).join("\n");
    const candidate = { ...snapshot, settings, text };
    try {
      const model = worksheetTextPages(candidate, font);
      validateWorksheetTextFit(candidate, model);
    } catch (cause) {
      if (cause instanceof RangeError && excerpt) return excerpt;
      throw cause;
    }
    excerpt = { text, lineCount: count, totalLines: DEFAULT_POEM.lines.length };
  }
  if (!excerpt)
    throw new RangeError("No complete poem line fits these settings.");
  return excerpt;
}
