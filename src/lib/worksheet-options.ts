import type { WorksheetSettings } from "../../shared/worksheet";

interface PaperPreset {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
  settings: Partial<WorksheetSettings>;
}

interface GuidePreset {
  id: string;
  label: string;
  effect: string;
  settings: Partial<WorksheetSettings>;
}

// Additional formats use custom dimensions so older editable drafts remain valid.
export const WORKSHEET_PAPERS: readonly PaperPreset[] = [
  {
    id: "letter",
    label: "US Letter",
    widthMm: 215.9,
    heightMm: 279.4,
    settings: { paper: "letter" },
  },
  {
    id: "a4",
    label: "A4",
    widthMm: 210,
    heightMm: 297,
    settings: { paper: "a4" },
  },
  {
    id: "a5",
    label: "A5",
    widthMm: 148,
    heightMm: 210,
    settings: { paper: "a5" },
  },
  {
    id: "legal",
    label: "US Legal",
    widthMm: 215.9,
    heightMm: 355.6,
    settings: { paper: "legal" },
  },
  ...(
    [
      ["a3", "A3", 297, 420],
      ["a6", "A6", 105, 148],
      ["b5", "B5 (ISO)", 176, 250],
      ["half-letter", "Half Letter", 139.7, 215.9],
      ["tabloid", "Tabloid / Ledger", 279.4, 431.8],
    ] as const
  ).map(([id, label, widthMm, heightMm]) => ({
    id,
    label,
    widthMm,
    heightMm,
    settings: {
      paper: "custom" as const,
      customWidthMm: widthMm,
      customHeightMm: heightMm,
    },
  })),
];

export const WORKSHEET_GUIDES: readonly GuidePreset[] = [
  {
    id: "plain",
    label: "24 plain lines",
    effect:
      "Even horizontal rules. The same 24 rows spread farther apart on taller pages.",
    settings: {
      mode: "plain",
      guidesEnabled: true,
      spacingMode: "count",
      lineCount: 24,
      slantEnabled: false,
    },
  },
  {
    id: "warmup",
    label: "Spacious warm-ups",
    effect:
      "Horizontal lines 12 mm apart for large strokes. Larger pages fit more rows.",
    settings: {
      mode: "plain",
      guidesEnabled: true,
      spacingMode: "fixed",
      spacingMm: 12,
      slantEnabled: false,
    },
  },
  {
    id: "copperplate-323",
    label: "Copperplate 3:2:3",
    effect: "55° slants, a 5 mm letter body, and 7.5 mm upper and lower zones.",
    settings: {
      mode: "copperplate",
      guidesEnabled: true,
      xHeightMm: 5,
      ascenderRatio: 1.5,
      descenderRatio: 1.5,
      rowGapMm: 5,
      slantEnabled: true,
      slantAngle: 55,
    },
  },
  {
    id: "copperplate-212",
    label: "Copperplate 2:1:2",
    effect:
      "55° slants, a 5 mm letter body, and 10 mm upper and lower zones. Fewer rows fit.",
    settings: {
      mode: "copperplate",
      guidesEnabled: true,
      xHeightMm: 5,
      ascenderRatio: 2,
      descenderRatio: 2,
      rowGapMm: 5,
      slantEnabled: true,
      slantAngle: 55,
    },
  },
  {
    id: "italic",
    label: "Italic",
    effect: "80° slants with equal 5 mm letter zones for more upright writing.",
    settings: {
      mode: "italic",
      guidesEnabled: true,
      xHeightMm: 5,
      ascenderRatio: 1,
      descenderRatio: 1,
      rowGapMm: 5,
      slantEnabled: true,
      slantAngle: 80,
    },
  },
  {
    id: "freehand",
    label: "Freehand letter zones",
    effect:
      "Equal 6 mm zones, without slants. Explore your own letter inclination.",
    settings: {
      mode: "italic",
      guidesEnabled: true,
      xHeightMm: 6,
      ascenderRatio: 1,
      descenderRatio: 1,
      rowGapMm: 5,
      slantEnabled: false,
    },
  },
  {
    id: "grid",
    label: "5 mm grid",
    effect: "Small squares to compare widths, spacing and proportions.",
    settings: {
      mode: "grid",
      guidesEnabled: true,
      spacingMode: "fixed",
      spacingMm: 5,
      slantEnabled: false,
    },
  },
  {
    id: "large-grid",
    label: "10 mm grid",
    effect:
      "Larger squares for broad letters, spacing studies and layout sketches.",
    settings: {
      mode: "grid",
      guidesEnabled: true,
      spacingMode: "fixed",
      spacingMm: 10,
      slantEnabled: false,
    },
  },
  {
    id: "unguided",
    label: "Unguided sheet",
    effect:
      "Hide printed rules while keeping your lettering layout and other settings.",
    settings: { guidesEnabled: false },
  },
];

/** Identify a standard paper choice in an existing draft. */
export function worksheetPaperId(settings: WorksheetSettings): string {
  if (settings.paper !== "custom") return settings.paper;
  const width = Math.min(settings.customWidthMm, settings.customHeightMm);
  const height = Math.max(settings.customWidthMm, settings.customHeightMm);
  return (
    WORKSHEET_PAPERS.find(
      (item) =>
        item.settings.paper === "custom" &&
        item.widthMm === width &&
        item.heightMm === height,
    )?.id ?? "custom"
  );
}
