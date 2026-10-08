import type { CalligraphyTool } from "@/components/calligraphy/calligraphy-cockpit";
import { CALLIGRAPHY_INK_TIPS } from "./calligraphy-ink-tips";

export interface CalligraphyGuideReply {
  text: string;
  tool?: CalligraphyTool;
  action?: string;
  source?: string;
  sourceLabel?: string;
}

/** Local topic guide: never executes an edit, model call, or upload. */
export function calligraphyGuideReply(question: string): CalligraphyGuideReply {
  const text = question.trim().slice(0, 1000).toLowerCase();
  if (
    /\b(ink|mix|mixtures|gold|silver|metallic|gum|binder|gouache|watercolour|watercolor|pigment)\b/.test(
      text,
    )
  ) {
    const id = /\b(test|surface|vellum|pooling|bleed|feather)\b/.test(text)
      ? "surface"
      : /gold|silver|metallic/.test(text)
        ? "metallic"
        : /gum|binder|gouache/.test(text)
          ? "binder"
          : /dilut|water|wash|thin/.test(text)
            ? "dilution"
            : "colour";
    const tip = CALLIGRAPHY_INK_TIPS.find((item) => item.id === id);
    if (tip)
      return { ...tip, tool: "materials", action: "Open ink & materials" };
  }
  if (/\b(photo|image|scan|qwen|ai|glyph|font file)\b/.test(text))
    return {
      text: "Open Photo & AI to import a sample and calibrate a known ruler distance. Review sizing before applying it. Letter rounds use the server’s registered model profiles when available; an accepted letter SVG still needs the drawn-alphabet font workflow to become an installable font.",
      tool: "photo",
      action: "Open photo & AI",
    };
  if (/\b(poem|excerpt|words|text|fit)\b/.test(text))
    return {
      text: "Your words has an editable text box and a fitting poem excerpt. Fit keeps complete lines, and replacing existing words asks first. Height, width and row pattern affect how much fits. The preview and PDF use the same measured lettering.",
      tool: "words",
      action: "Open your words",
    };
  if (
    /\b(paper|sheet|page)\b.*\b(size|dimensions|spacing|rows|margin)\b|\b(size|dimensions|spacing|rows|margin)\b.*\b(paper|sheet|page)\b/.test(
      text,
    )
  )
    return {
      text: "Paper & guides controls sheet dimensions, margins and writing rows. Choose a standard size or custom dimensions, then check the preview before printing at Actual size / 100%.",
      tool: "paper",
      action: "Open paper & guides",
    };
  if (
    /\b(tall|taller|height|wide|wider|width|spacing|size|letterforms)\b/.test(
      text,
    )
  )
    return {
      text: "Use Letterforms to adjust lowercase height in millimetres and lettering width as a percentage. Match guide height aligns the letter body with the writing guides. Natural width restores the font’s original proportions. Watch fit and flourish warnings before printing.",
      tool: "size",
      action: "Open letterforms",
    };
  if (/\b(print|pdf|download|export)\b/.test(text))
    return {
      text: "Download PDF keeps the sheet’s physical dimensions. Print at Actual size / 100%, with headers and footers off. Print & checks shows fit and flourish warnings, plus the optional editable-template setting. A material preview does not print a simulated paper background.",
      tool: "output",
      action: "Open print & checks",
    };
  if (/\b(paper|vellum|guides|rows|template|landscape|portrait)\b/.test(text))
    return {
      text: "Paper & guides offers standard sheet sizes, custom dimensions, margins and row spacing. Printer paper is the default; vellum suggests a translucent writing sheet over the guides. Changing the material leaves the printed background white. Ink & materials explains what to test on the real sheet.",
      tool: "paper",
      action: "Open paper & guides",
    };
  if (/\b(font|script|copperplate|italic)\b/.test(text))
    return {
      text: "Find a script shows real font specimens. Choose a card to use it on the sheet; Letterforms then controls its physical size and width. Import a TTF or OTF that you are allowed to use to practise your own alphabet.",
      tool: "script",
      action: "Find a script",
    };
  return {
    text: "This is the local studio guide. Ask about ink mixing, paper, lettering size, fitting words, photo sizing, fonts or printing. It offers guidance and opens tools; it does not send messages to a model or change your draft.",
  };
}
