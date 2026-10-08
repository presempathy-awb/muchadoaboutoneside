export type PaperSurface = "printer" | "vellum" | "smooth" | "dark";
export const PAPER_SURFACE_LABELS: Record<PaperSurface, string> = {
  printer: "Printer paper",
  vellum: "Translucent tracing paper / drafting vellum",
  smooth: "Smooth calligraphy paper",
  dark: "Opaque or dark paper / card",
};

/** Recognize the saved material category, with ordinary printer paper as default. */
export function paperSurface(note: string): PaperSurface {
  return (
    (Object.entries(PAPER_SURFACE_LABELS).find(
      ([, label]) => note === label || note.startsWith(`${label} · `),
    )?.[0] as PaperSurface | undefined) ?? "printer"
  );
}

/** Switch material categories while retaining a user's brand or custom note. */
export function paperSurfaceNote(note: string, surface: PaperSurface): string {
  const current = Object.values(PAPER_SURFACE_LABELS).find(
    (label) => note === label || note.startsWith(`${label} · `),
  );
  const detail = current
    ? note.slice(current.length).replace(/^ · /, "")
    : note;
  return [PAPER_SURFACE_LABELS[surface], detail]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 120);
}
