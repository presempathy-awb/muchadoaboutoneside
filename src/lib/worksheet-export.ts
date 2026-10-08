import type { WorksheetFont } from "./worksheet-fonts";
import type { WorksheetComparisonFont } from "./worksheet-pdf";
import type { WorksheetSnapshot } from "./worksheet-store";

export type { WorksheetComparisonFont } from "./worksheet-pdf";
export type {
  WorksheetPlacedText,
  WorksheetPracticeRole,
  WorksheetTextPages,
} from "./worksheet-text";
export { validateWorksheetTextFit, worksheetTextPages } from "./worksheet-text";

/** Load the vector PDF writer only when a worksheet is exported. */
export async function createWorksheetPdf(
  snapshot: WorksheetSnapshot,
  options: { includeTemplate?: boolean; font?: WorksheetFont } = {},
): Promise<Uint8Array<ArrayBuffer>> {
  const pdf = await import("./worksheet-pdf");
  return pdf.createWorksheetPdf(snapshot, options);
}

/** Load the comparison writer on demand, preserving independently shaped pages. */
export async function createWorksheetComparisonPdf(
  snapshot: WorksheetSnapshot,
  entries: readonly WorksheetComparisonFont[],
): Promise<Uint8Array<ArrayBuffer>> {
  const pdf = await import("./worksheet-pdf");
  return pdf.createWorksheetComparisonPdf(snapshot, entries);
}

/** Load PDF parsing only when reopening an editable worksheet. */
export async function importWorksheetPdf(
  bytes: Uint8Array | ArrayBuffer,
): Promise<WorksheetSnapshot> {
  const pdf = await import("./worksheet-pdf");
  return pdf.importWorksheetPdf(bytes);
}
