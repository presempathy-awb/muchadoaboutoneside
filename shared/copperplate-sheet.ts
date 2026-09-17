export const PAPER_SIZES = {
  letter: { label: "US Letter", widthMm: 215.9, heightMm: 279.4 },
  a4: { label: "A4", widthMm: 210, heightMm: 297 },
} as const;

export type PaperSize = keyof typeof PAPER_SIZES;
export type SheetOrientation = "portrait" | "landscape";

export interface SheetSettings {
  lineCount: number;
  paper: PaperSize;
  orientation: SheetOrientation;
  marginMm: number;
  lineWidthPt: number;
  darkness: number;
}

export const DEFAULT_SHEET_SETTINGS: SheetSettings = {
  lineCount: 24,
  paper: "letter",
  orientation: "landscape",
  marginMm: 12.7,
  lineWidthPt: 0.5,
  darkness: 40,
};

export interface SheetLayout {
  widthMm: number;
  heightMm: number;
  x1Mm: number;
  x2Mm: number;
  lineYsMm: number[];
  spacingMm: number;
}

const POINTS_PER_MM = 72 / 25.4;

function assertFiniteRange(
  value: number,
  name: string,
  minimum: number,
  maximum: number,
) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be between ${minimum} and ${maximum}`);
  }
}

function validateSettings(settings: SheetSettings) {
  if (!Number.isInteger(settings.lineCount)) {
    throw new RangeError("Enter a whole number of horizontal lines (2–100).");
  }
  assertFiniteRange(settings.lineCount, "Horizontal lines", 2, 100);
  if (!Object.hasOwn(PAPER_SIZES, settings.paper)) {
    throw new RangeError("Choose US Letter or A4 paper.");
  }
  if (
    settings.orientation !== "portrait" &&
    settings.orientation !== "landscape"
  ) {
    throw new RangeError("Choose portrait or landscape orientation.");
  }
  assertFiniteRange(settings.marginMm, "Margins (mm)", 5, 50);
  assertFiniteRange(settings.lineWidthPt, "Line weight (pt)", 0.1, 2);
  assertFiniteRange(settings.darkness, "Line darkness (%)", 10, 100);
}

export function createSheetLayout(settings: SheetSettings): SheetLayout {
  validateSettings(settings);

  const paper = PAPER_SIZES[settings.paper];
  const portrait = settings.orientation === "portrait";
  const widthMm = portrait ? paper.widthMm : paper.heightMm;
  const heightMm = portrait ? paper.heightMm : paper.widthMm;
  const spacingMm =
    (heightMm - 2 * settings.marginMm) / (settings.lineCount - 1);
  const lineYsMm = Array.from(
    { length: settings.lineCount },
    (_, index) => settings.marginMm + index * spacingMm,
  );

  return {
    widthMm,
    heightMm,
    x1Mm: settings.marginMm,
    x2Mm: widthMm - settings.marginMm,
    lineYsMm,
    spacingMm,
  };
}

function pdfNumber(value: number) {
  return value.toFixed(4);
}

function pdfObject(number: number, body: string) {
  return `${number} 0 obj\n${body}\nendobj\n`;
}

/** Builds a deterministic, dependency-free, one-page PDF from the shared layout. */
export function createSheetPdf(
  settings: SheetSettings,
): Uint8Array<ArrayBuffer> {
  const layout = createSheetLayout(settings);
  const widthPt = layout.widthMm * POINTS_PER_MM;
  const heightPt = layout.heightMm * POINTS_PER_MM;
  const gray = 1 - settings.darkness / 100;
  const x1Pt = layout.x1Mm * POINTS_PER_MM;
  const x2Pt = layout.x2Mm * POINTS_PER_MM;

  const lines = layout.lineYsMm.map((yMm) => {
    const yPt = (layout.heightMm - yMm) * POINTS_PER_MM;
    return `${pdfNumber(x1Pt)} ${pdfNumber(yPt)} m ${pdfNumber(x2Pt)} ${pdfNumber(yPt)} l`;
  });
  const content = [
    "q",
    `${pdfNumber(gray)} G`,
    `${pdfNumber(settings.lineWidthPt)} w`,
    ...lines,
    "S",
    "Q",
    "",
  ].join("\n");

  const objects = [
    pdfObject(
      1,
      "<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /PrintScaling /None >> >>",
    ),
    pdfObject(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    pdfObject(
      3,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfNumber(widthPt)} ${pdfNumber(heightPt)}] /Resources << >> /Contents 4 0 R >>`,
    ),
    pdfObject(
      4,
      `<< /Length ${content.length} >>\nstream\n${content}endstream`,
    ),
  ];

  let pdf = "%PDF-1.7\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += object;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

  return new TextEncoder().encode(pdf);
}

export function sheetFilename(settings: SheetSettings) {
  createSheetLayout(settings);
  return `copperplate-lines-${settings.lineCount}-${settings.paper}-${settings.orientation}.pdf`;
}
