import type { ReactNode } from "react";
import type { WorksheetSettings } from "../../../shared/worksheet";
import { CALLIGRAPHY_INK_TIPS } from "../../lib/calligraphy-ink-tips";

interface MaterialOption {
  label: string;
  effect: string;
  source: string;
  sourceLabel: string;
}

const INKS: readonly MaterialOption[] = [
  {
    label: "Fountain-pen writing ink",
    effect:
      "Choose a bottle specifically labelled for fountain pens. Check its water resistance and lightfastness before adding washes or making a lasting piece; these properties vary by product.",
    source: "https://www.jacquesherbin.com/en/produit/coffrets-5-encres/",
    sourceLabel: "Herbin: fountain-pen formulations",
  },
  {
    label: "Pigmented calligraphy ink",
    effect:
      "For a dip pen or brush, as the bottle directs. Pigment can give lasting colour, but permanence does not mean waterproof: Winsor & Newton’s calligraphy range can reactivate with water even after drying.",
    source: "https://www.winsornewton.com/products/calligraphy-ink-black/",
    sourceLabel: "Winsor & Newton: calligraphy ink",
  },
  {
    label: "Shellac drawing / India ink",
    effect:
      "Check the exact formula: shellac-based drawing ink can resist water after drying, while lightfastness varies. Use suitable dip pens or brushes; do not put shellac ink in a fountain pen. Clean your tools before ink hardens.",
    source:
      "https://uk.winsornewton.com/blogs/guides/lightfastness-permanence-archival-quality-of-inks",
    sourceLabel: "Winsor & Newton: drawing ink properties",
  },
  {
    label: "Acrylic artist ink",
    effect:
      "Acrylic ink such as Daler-Rowney FW is pigment-based and water-resistant. Opacity and lightfastness vary by colour. Use the manufacturer’s recommended tools, clean promptly, and do not assume it is fountain-pen compatible.",
    source: "https://daler-rowney.com/product/fw-acrylic-ink/",
    sourceLabel: "Daler-Rowney: FW acrylic ink",
  },
];

const PAPERS: readonly MaterialOption[] = [
  {
    label: "Printer paper",
    effect:
      "The ordinary white-sheet default. Test your pen and ink for feathering and bleed-through; a printer-safe sheet is not automatically suitable for every wet ink.",
    source:
      "https://www.strathmoreartist.com/files/content/product_literature/paper_use_guides/sap_fine_art_papers_guide.pdf",
    sourceLabel: "Strathmore: surfaces for pen and ink",
  },
  {
    label: "Smooth calligraphy paper",
    effect:
      "A smooth surface helps the nib travel and the ink flow evenly. Test fine upstrokes, broad downstrokes and the back of the sheet for feathering or bleed-through. Weight alone does not establish ink compatibility.",
    source:
      "https://www.strathmoreartist.com/files/content/product_literature/paper_use_guides/sap_fine_art_papers_guide.pdf",
    sourceLabel: "Strathmore: surfaces for pen and ink",
  },
  {
    label: "Translucent tracing paper / drafting vellum",
    effect:
      "See the printed guide through an upper writing sheet and reuse the underlay. Increase guide darkness if needed. Check that the writing surface accepts your ink; translucent drafting vellum is different from animal-skin vellum.",
    source: "https://us.canson.com/artist-series-vidalon-vellum",
    sourceLabel: "Canson: translucent drafting vellum",
  },
  {
    label: "Opaque or dark paper / card",
    effect:
      "An underlay may be hard to see. Try a light pad or lightly transferred pencil guides. Choose an ink with enough contrast and opacity, test erasing after drying, and check printer compatibility before feeding card.",
    source: "https://thepostmansknock.com/need-light-box-includes-giveaway/",
    sourceLabel: "The Postman’s Knock: using a light box",
  },
];

function MaterialChoice({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: string;
  choices: readonly MaterialOption[];
  onChange: (value: string) => void;
}): ReactNode {
  const choice = choices.find(
    (item) => value === item.label || value.startsWith(`${item.label} · `),
  );
  const detail = choice
    ? value.slice(choice.label.length).replace(/^ · /, "")
    : value;
  return (
    <div className="ws-material-choice">
      <label className="ws-field">
        <span>{label} type</span>
        <select
          value={choice?.label ?? ""}
          onChange={(event) =>
            onChange([event.target.value, detail].filter(Boolean).join(" · "))
          }
        >
          <option value="">Other / choose your own</option>
          {choices.map((item) => (
            <option key={item.label}>{item.label}</option>
          ))}
        </select>
      </label>
      <label className="ws-field">
        <span>{label} brand, colour or details</span>
        <input
          type="text"
          value={detail}
          maxLength={120 - (choice ? choice.label.length + 3 : 0)}
          onChange={(event) =>
            onChange(
              [choice?.label, event.target.value].filter(Boolean).join(" · "),
            )
          }
        />
      </label>
      {choice && (
        <aside className="ws-choice-effect" aria-live="polite">
          <strong>What this changes in practice</strong>
          <p>{choice.effect}</p>
          <a href={choice.source} target="_blank" rel="noreferrer">
            {choice.sourceLabel}
          </a>
        </aside>
      )}
    </div>
  );
}

/** Save material choices with practical, source-linked ink and paper guidance. */
export function WorksheetMaterials({
  settings,
  onChange,
  section,
}: {
  settings: WorksheetSettings;
  onChange: (patch: Partial<WorksheetSettings>) => boolean;
  section?: "choices" | "mixing";
}): ReactNode {
  return (
    <div className="ws-materials">
      <div hidden={section === "mixing"}>
        <MaterialChoice
          label="Ink"
          value={settings.ink}
          choices={INKS}
          onChange={(ink) => onChange({ ink })}
        />
        <MaterialChoice
          label="Paper surface"
          value={settings.paperName || "Printer paper"}
          choices={PAPERS}
          onChange={(paperName) => onChange({ paperName })}
        />
        <p className="ws-hint">
          Optional choices, saved with this draft and your templates. They
          describe your physical materials; printed guide colour, text colour
          and page geometry keep their own settings. Drying time, feathering and
          bleed-through need a small test with your actual paper, ink and nib.
        </p>
      </div>
      <section
        className="ck-ink-guide"
        aria-labelledby="ws-ink-mixing-title"
        hidden={section === "choices"}
      >
        <h3 id="ws-ink-mixing-title">At the mixing table</h3>
        <p className="ws-hint">
          Small samples, useful notes, better next attempts. Choose a topic for
          bottle-specific advice.
        </p>
        {CALLIGRAPHY_INK_TIPS.map((tip) => (
          <details key={tip.id}>
            <summary>{tip.title}</summary>
            <p>{tip.text}</p>
            <a href={tip.source} target="_blank" rel="noreferrer">
              {tip.sourceLabel} (opens in a new tab)
            </a>
          </details>
        ))}
        <p className="ws-hint">
          Use inks and mediums together only when the maker supports the
          combination. Keep a sample separate from the stock bottle. For a
          fountain pen, use a formulation explicitly intended for that pen.
        </p>
      </section>
    </div>
  );
}
