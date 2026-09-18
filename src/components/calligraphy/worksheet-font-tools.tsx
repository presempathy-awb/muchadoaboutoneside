import { useEffect, useMemo, useState } from "react";
import type { WorksheetSettings } from "../../../shared/worksheet";
import {
  WORKSHEET_FONT_CATALOG,
  type WorksheetBundledFontId,
} from "../../../shared/worksheet-font-catalog";
import { loadWorksheetFontPreview } from "../../lib/worksheet-font-previews";
import type { WorksheetFont } from "../../lib/worksheet-fonts";

const FONT_GROUP: Record<WorksheetBundledFontId, string> = {
  "great-vibes": "Connected script",
  "pinyon-script": "Formal roundhand",
  "imperial-script": "Formal roundhand",
  italianno: "Light script",
  "herr-von-muellerhoff": "Historic signature",
  "mrs-saint-delafield": "Historic signature",
};

const FEATURE_LABELS: Record<string, string> = {
  liga: "Standard joins",
  clig: "Context-aware joins",
  calt: "Contextual letterforms",
  rlig: "Required joins",
  dlig: "Decorative ligatures",
  hlig: "Historic ligatures",
  salt: "Alternate letterforms",
  swsh: "Swash capitals and endings",
  titl: "Titling capitals",
  kern: "Balanced letter spacing",
  mark: "Accent placement",
  mkmk: "Stacked accent placement",
};

const DEFAULT_ON_FEATURES = new Set([
  "liga",
  "clig",
  "calt",
  "rlig",
  "kern",
  "mark",
  "mkmk",
]);

const GLYPH_CANDIDATES = Array.from(
  "&@№§¶©®™°·–—‘’“”…¡¿¢£¥€æœßçñéèêëåøÆŒÇÑÉÅØ",
);

function featureLabel(tag: string) {
  if (FEATURE_LABELS[tag]) return FEATURE_LABELS[tag];
  if (/^ss\d\d$/u.test(tag)) {
    return `Style set ${Number(tag.slice(2))}`;
  }
  return `Font option ${tag.toUpperCase()}`;
}

function parseFeatureChoices(value: string) {
  const result = new Map<string, boolean>();
  for (const choice of value.split(",")) {
    const [rawTag, rawValue] = choice.trim().split("=");
    if (!rawTag) continue;
    result.set(rawTag, rawValue !== "0");
  }
  return result;
}

function updateFeatureChoice(current: string, tag: string, enabled: boolean) {
  const choices = parseFeatureChoices(current);
  const defaultOn = DEFAULT_ON_FEATURES.has(tag);
  if (enabled === defaultOn) choices.delete(tag);
  else choices.set(tag, enabled);
  return Array.from(choices, ([key, value]) => `${key}=${value ? 1 : 0}`).join(
    ",",
  );
}

function featureIsEnabled(value: string, tag: string) {
  return parseFeatureChoices(value).get(tag) ?? DEFAULT_ON_FEATURES.has(tag);
}

function TypographyNumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number | "any";
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <label className="ws-field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          const next = Number(event.target.value);
          if (
            event.target.value !== "" &&
            Number.isFinite(next) &&
            next >= min &&
            next <= max
          ) {
            onChange(next);
          }
        }}
        onBlur={() => setDraft(String(value))}
      />
    </label>
  );
}

function cssFeatureSettings(value: string, selectedTag?: string) {
  const choices = parseFeatureChoices(value);
  if (selectedTag) choices.set(selectedTag, true);
  return Array.from(
    choices,
    ([tag, enabled]) => `"${tag}" ${enabled ? 1 : 0}`,
  ).join(", ");
}

function FeatureSample({
  font,
  settings,
  tag,
}: {
  font: WorksheetFont;
  settings: WorksheetSettings;
  tag: string;
}) {
  const run = useMemo(() => {
    try {
      return font.shape("A flourish flows", {
        ...settings,
        fontFeatures: updateFeatureChoice(settings.fontFeatures, tag, true),
      });
    } catch {
      return undefined;
    }
  }, [font, settings, tag]);
  const bounds = run?.inkBoundsMm;
  if (!run || !bounds || !run.glyphs.some((glyph) => glyph.path)) {
    return (
      <span
        style={{
          fontFamily: font.family,
          fontFeatureSettings: cssFeatureSettings(settings.fontFeatures, tag),
        }}
        aria-hidden="true"
      >
        A flourish flows
      </span>
    );
  }
  const pad = Math.max(0.4, bounds.height * 0.08);
  return (
    <svg
      className="ws-feature-sample"
      viewBox={`${bounds.xMin - pad} ${-bounds.yMax - pad} ${bounds.width + pad * 2} ${bounds.height + pad * 2}`}
      role="img"
      aria-label={`${featureLabel(tag)} sample`}
    >
      {run.glyphs.map((glyph) =>
        glyph.path ? (
          <path
            // A shaped word can contain the same glyph many times.
            key={`${glyph.id}-${glyph.cluster}-${glyph.xMm}`}
            d={glyph.path}
            transform={`translate(${glyph.xMm} ${-glyph.yMm}) scale(${run.pathScaleMm * run.writingScale} ${-run.pathScaleMm})`}
          />
        ) : null,
      )}
    </svg>
  );
}

export function WorksheetFontGallery({
  selected,
  onSelect,
}: {
  selected: WorksheetSettings["fontId"];
  onSelect: (fontId: WorksheetBundledFontId) => void;
}) {
  const [opened, setOpened] = useState(false);
  const [families, setFamilies] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState("");
  const loaded = WORKSHEET_FONT_CATALOG.every((entry) => families[entry.id]);

  useEffect(() => {
    if (!opened || loaded) return;
    let active = true;
    Promise.all(
      WORKSHEET_FONT_CATALOG.map(
        async (entry) =>
          [entry.id, await loadWorksheetFontPreview(entry.id)] as const,
      ),
    )
      .then((loadedFamilies) => {
        if (active) setFamilies(Object.fromEntries(loadedFamilies));
      })
      .catch(() => {
        if (active) {
          setLoadError(
            "The visual font cards could not load. You can still choose a font from the menu.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [opened, loaded]);

  return (
    <details
      className="ws-font-gallery"
      onToggle={(event) => setOpened(event.currentTarget.open)}
    >
      <summary>Browse script fonts visually</summary>
      <div className="ws-font-grid" aria-busy={opened && !loaded && !loadError}>
        {WORKSHEET_FONT_CATALOG.map((entry) => (
          <button
            className={selected === entry.id ? "is-selected" : undefined}
            type="button"
            key={entry.id}
            aria-pressed={selected === entry.id}
            onClick={() => onSelect(entry.id)}
          >
            <span
              className="ws-font-sample"
              style={{
                fontFamily: families[entry.id]
                  ? `"${families[entry.id]}"`
                  : "cursive",
              }}
              aria-hidden="true"
            >
              Flourish &amp; form
            </span>
            <span className="ws-font-card-title">
              <strong>{entry.name}</strong>
              <small>{FONT_GROUP[entry.id]}</small>
            </span>
            <span>{entry.description}</span>
          </button>
        ))}
      </div>
      {!loaded && !loadError && (
        <p className="ws-hint" role="status">
          Loading the small Latin previews only while this gallery is open…
        </p>
      )}
      {loadError && (
        <p className="ws-font-warning" role="status">
          {loadError}
        </p>
      )}
    </details>
  );
}

export function WorksheetFontPicker({
  settings,
  customFontName,
  onChange,
}: {
  settings: WorksheetSettings;
  customFontName?: string;
  onChange: (patch: Partial<WorksheetSettings>) => void;
}) {
  return (
    <label className="ws-field">
      <span>Lettering font</span>
      <select
        value={settings.fontId}
        onChange={(event) =>
          onChange({
            fontId: event.target.value as WorksheetSettings["fontId"],
          })
        }
      >
        <optgroup label="Calligraphy scripts">
          {WORKSHEET_FONT_CATALOG.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name} · {FONT_GROUP[entry.id].toLowerCase()}
            </option>
          ))}
        </optgroup>
        <optgroup label="Simple references">
          <option value="serif">Classic serif</option>
          <option value="sans">Simple sans serif</option>
          <option value="mono">Monospace</option>
        </optgroup>
        {(customFontName || settings.fontId === "custom") && (
          <optgroup label="Your font">
            <option value="custom">
              {customFontName ?? "Custom font · please re-import"}
            </option>
          </optgroup>
        )}
      </select>
    </label>
  );
}

export function WorksheetFontTools({
  settings,
  font,
  customFontName,
  onChange,
  onImportFont,
  onInsertGlyph,
}: {
  settings: WorksheetSettings;
  font?: WorksheetFont;
  customFontName?: string;
  onChange: (patch: Partial<WorksheetSettings>) => void;
  onImportFont: (file?: File) => void;
  onInsertGlyph: (glyph: string) => void;
}) {
  const [featureAdjustment, setFeatureAdjustment] = useState<{
    fontId: WorksheetSettings["fontId"];
    message: string;
  }>();
  const supportedFeatures = font?.supportedFeatures ?? [];
  const glyphs = useMemo(
    () =>
      font ? GLYPH_CANDIDATES.filter((glyph) => font.hasGlyph(glyph)) : [],
    [font],
  );
  const resolvedSize = useMemo(() => {
    try {
      return font?.resolveSizePt(settings);
    } catch {
      return undefined;
    }
  }, [font, settings]);
  const selectedName =
    WORKSHEET_FONT_CATALOG.find((entry) => entry.id === settings.fontId)
      ?.name ??
    customFontName ??
    "the selected font";

  useEffect(() => {
    if (!font || !settings.fontFeatures) return;
    const supported = new Set(font.supportedFeatures);
    const choices = parseFeatureChoices(settings.fontFeatures);
    const filtered = Array.from(choices)
      .filter(([tag]) => supported.has(tag))
      .map(([tag, enabled]) => `${tag}=${enabled ? 1 : 0}`)
      .join(",");
    if (filtered !== settings.fontFeatures) {
      setFeatureAdjustment({
        fontId: settings.fontId,
        message:
          "Letterform choices that are unavailable in this font were reset.",
      });
      onChange({ fontFeatures: filtered });
    }
  }, [font, onChange, settings.fontFeatures, settings.fontId]);

  return (
    <>
      <label className="ws-file">
        Import your TTF / OTF font
        <input
          type="file"
          accept=".ttf,.otf"
          onChange={(event) => {
            onImportFont(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>
      <p className="ws-hint">
        Use a font you have permission to embed. Font files stay in this browser
        and your digital backups. Printed lettering is saved as vector outlines
        in the PDF.
      </p>

      <fieldset className="ws-inline-choice">
        <legend>Size lettering by</legend>
        <label>
          <input
            type="radio"
            name="ws-font-size-mode"
            checked={settings.fontSizeMode === "points"}
            onChange={() => onChange({ fontSizeMode: "points" })}
          />
          Point size
        </label>
        <label>
          <input
            type="radio"
            name="ws-font-size-mode"
            checked={settings.fontSizeMode === "xheight"}
            onChange={() => onChange({ fontSizeMode: "xheight" })}
          />
          Physical lowercase height
        </label>
      </fieldset>

      {settings.fontSizeMode === "points" ? (
        <div className="ws-xheight-control">
          <TypographyNumberField
            label="Font size (pt)"
            value={settings.fontSizePt}
            min={4}
            max={300}
            step="any"
            onChange={(fontSizePt) => onChange({ fontSizePt })}
          />
          <button
            type="button"
            onClick={() =>
              onChange({
                fontSizeMode: "xheight",
                textXHeightMm: settings.xHeightMm,
              })
            }
          >
            Match guide x-height
          </button>
        </div>
      ) : (
        <div className="ws-xheight-control">
          <TypographyNumberField
            label="Lowercase height (mm)"
            value={settings.textXHeightMm}
            min={0.5}
            max={50}
            step={0.1}
            onChange={(textXHeightMm) => onChange({ textXHeightMm })}
          />
          <button
            type="button"
            onClick={() =>
              onChange({
                fontSizeMode: "xheight",
                textXHeightMm: settings.xHeightMm,
              })
            }
          >
            Match guide x-height
          </button>
        </div>
      )}
      <p className="ws-hint">
        {resolvedSize
          ? `${selectedName} resolves to ${resolvedSize.toFixed(1)} pt at this physical size.`
          : "Add practice text or turn on example printing to load the full font and show its exact physical size."}
      </p>
      {featureAdjustment?.fontId === settings.fontId && (
        <p className="ws-font-warning" role="status">
          {featureAdjustment.message}
        </p>
      )}

      <label className="ws-field">
        <span>Practice row pattern</span>
        <select
          value={settings.practicePattern}
          onChange={(event) =>
            onChange({
              practicePattern: event.target
                .value as WorksheetSettings["practicePattern"],
            })
          }
        >
          <option value="continuous">Example on every filled row</option>
          <option value="model-trace-blank">Model · faint trace · blank</option>
        </select>
      </label>
      <p className="ws-hint">
        The three-row pattern gives you a clear model, a lighter pass for
        tracing, then open space to repeat the movement in your own hand.
      </p>

      {font && supportedFeatures.length > 0 && (
        <fieldset className="ws-font-features">
          <legend>Letterform choices available in this font</legend>
          <p className="ws-hint">
            These are real choices contained in the font. The preview and PDF
            use the same settings.
          </p>
          <div>
            {supportedFeatures.map((tag) => {
              const checked = featureIsEnabled(settings.fontFeatures, tag);
              return (
                <label key={tag}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) =>
                      onChange({
                        fontFeatures: updateFeatureChoice(
                          settings.fontFeatures,
                          tag,
                          event.target.checked,
                        ),
                      })
                    }
                  />
                  <span>
                    <strong>{featureLabel(tag)}</strong>
                    <FeatureSample font={font} settings={settings} tag={tag} />
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {glyphs.length > 0 && (
        <details className="ws-glyph-browser">
          <summary>Useful characters in this font</summary>
          <p className="ws-hint">
            Every character shown is present in the selected font. Choose one to
            append it to your practice text. Alternate letterforms stay in the
            letterform controls above because they are font behavior, not
            pretend characters.
          </p>
          <div>
            {glyphs.map((glyph) => (
              <button
                type="button"
                key={glyph}
                title={`Append ${glyph} to practice text`}
                style={{ fontFamily: font?.family }}
                onClick={() => onInsertGlyph(glyph)}
              >
                {glyph}
              </button>
            ))}
          </div>
        </details>
      )}

      <details className="ws-font-advanced">
        <summary>Advanced text shaping</summary>
        <label className="ws-field">
          <span>Shaping engine</span>
          <select
            value={settings.shapingEngine}
            onChange={(event) =>
              onChange({
                shapingEngine: event.target
                  .value as WorksheetSettings["shapingEngine"],
              })
            }
          >
            <option value="fontkit">Fontkit · fast Latin calligraphy</option>
            <option value="harfbuzz">HarfBuzz · broader script support</option>
          </select>
        </label>
        <p className="ws-hint">
          Fontkit is the smaller, faster default for these Latin calligraphy
          fonts. HarfBuzz loads only when selected and can shape more complex
          writing systems. Both use the same size and letterform choices in the
          preview and exported PDF.
        </p>
      </details>

      <aside className="ws-font-note">
        <strong>Use these as spacing and rhythm references.</strong>
        <span>
          Decorative type cannot teach pressure, stroke order, or pen angle. For
          Copperplate study, pair the model–trace–blank pattern with a trusted
          exemplar and the transfer techniques below.
        </span>
      </aside>
    </>
  );
}
