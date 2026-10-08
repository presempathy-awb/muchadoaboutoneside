import { type ReactNode, useEffect, useId, useMemo, useState } from "react";
import {
  normalizeWorksheetSettings,
  type WorksheetSettings,
} from "../../../shared/worksheet";
import {
  WORKSHEET_FONT_CATALOG,
  type WorksheetBundledFontId,
} from "../../../shared/worksheet-font-catalog";
import {
  specialWordParts,
  specialWordPhrases,
} from "../../../shared/worksheet-special-words";

/** Give names, dedications and occasion words their own printable lettering. */
export function WorksheetSpecialWords({
  settings,
  text,
  disabled,
  onChange,
}: {
  settings: WorksheetSettings;
  text: string;
  disabled: boolean;
  onChange: (patch: Partial<WorksheetSettings>) => void;
}): ReactNode {
  const id = useId();
  const [words, setWords] = useState(settings.specialWords);
  const [fontId, setFontId] = useState(settings.specialFontId);
  const [size, setSize] = useState(settings.specialSizePercent);
  const [family, setFamily] = useState<string>();
  const [message, setMessage] = useState("");
  const [previewError, setPreviewError] = useState("");
  useEffect(() => {
    setWords(settings.specialWords);
    setFontId(settings.specialFontId);
    setSize(settings.specialSizePercent);
  }, [
    settings.specialWords,
    settings.specialFontId,
    settings.specialSizePercent,
  ]);
  useEffect(() => {
    let active = true;
    setFamily(undefined);
    setPreviewError("");
    void import("../../lib/worksheet-font-previews")
      .then(({ loadWorksheetFontPreview }) => loadWorksheetFontPreview(fontId))
      .then((loaded) => {
        if (active) setFamily(loaded);
      })
      .catch(() => {
        if (active)
          setPreviewError(
            "The small font sample could not load. The paper preview will report whether the full print font is available.",
          );
      });
    return () => {
      active = false;
    };
  }, [fontId]);
  const draft = useMemo(() => {
    try {
      const phrases = specialWordPhrases(words);
      const count = specialWordParts(
        text.replace(/[^\S\n]+/gu, " "),
        phrases,
      ).filter((part) => part.special).length;
      return { sample: phrases[0] ?? "Your name", count, error: "" };
    } catch (cause) {
      return {
        sample: "Your name",
        count: 0,
        error:
          cause instanceof Error ? cause.message : "Check the special words.",
      };
    }
  }, [words, text]);
  return (
    <fieldset className="ws-special-words" disabled={disabled}>
      <legend>Names & words that matter</legend>
      <p className="ws-hint">
        Names, a dedication, a date or “Happy birthday”. Give matching words a
        script of their own.
      </p>
      <label className="ws-field" htmlFor={`${id}-words`}>
        Special words · one name or phrase per line
        <textarea
          id={`${id}-words`}
          value={words}
          maxLength={648}
          rows={3}
          placeholder={"Ann Marie\nWith love"}
          aria-describedby={`${id}-help`}
          onChange={(event) => {
            setWords(event.target.value);
            setMessage("");
          }}
        />
      </label>
      <p id={`${id}-help`} className="ws-hint">
        Up to eight. Matches every complete word or phrase, with the same
        capitalization. Your poem stays exactly as written.
      </p>
      <div className="ws-special-options">
        <label className="ws-field">
          Special font
          <select
            value={fontId}
            onChange={(event) =>
              setFontId(event.target.value as WorksheetBundledFontId)
            }
          >
            {WORKSHEET_FONT_CATALOG.map((font) => (
              <option key={font.id} value={font.id}>
                {font.name}
              </option>
            ))}
          </select>
        </label>
        <label className="ws-field">
          Size relative to text · {size}%
          <input
            type="range"
            min={50}
            max={200}
            step={5}
            value={size}
            onChange={(event) => setSize(Number(event.target.value))}
          />
        </label>
      </div>
      <figure
        className="ws-special-sample"
        aria-label="Special font sample"
        aria-busy={!family && !previewError}
      >
        <span
          style={{
            fontFamily: family ?? "var(--font-serif)",
            fontSize: `${size / 40}rem`,
          }}
        >
          {draft.sample}
        </span>
        <figcaption>
          {WORKSHEET_FONT_CATALOG.find((font) => font.id === fontId)?.name} ·{" "}
          {size}% on paper
        </figcaption>
      </figure>
      <p className="ws-hint">
        {draft.count
          ? `${draft.count} matching ${draft.count === 1 ? "phrase" : "phrases"} in your text.`
          : "No matching words yet. Add them to your poem or save this treatment for later."}{" "}
        The sheet checks line fit and flourishes at print size.
      </p>
      {previewError && <p role="status">{previewError}</p>}
      {draft.error && <p role="alert">{draft.error}</p>}
      <div className="ws-special-actions">
        <button
          type="button"
          className="ws-primary"
          disabled={Boolean(draft.error)}
          onClick={() => {
            const patch = {
              specialWords: words,
              specialFontId: fontId,
              specialSizePercent: size,
            };
            normalizeWorksheetSettings({ ...settings, ...patch });
            onChange(patch);
            setMessage(
              "Special lettering saved. Check the paper preview before printing.",
            );
          }}
        >
          Apply special lettering
        </button>
        <button
          type="button"
          className="ws-text-button"
          disabled={!settings.specialWords}
          onClick={() => {
            onChange({ specialWords: "" });
            setWords("");
            setMessage("All words use the main font again.");
          }}
        >
          Use main font for all words
        </button>
      </div>
      {message && <p role="status">{message}</p>}
    </fieldset>
  );
}
