export interface SpecialWordPart {
  text: string;
  special: boolean;
}

/** Read the names or phrases selected for a separate lettering treatment. */
export function specialWordPhrases(value: string): string[] {
  if (typeof value !== "string" || value.length > 648)
    throw new TypeError(
      "Special words must contain at most eight names or phrases.",
    );
  const phrases = value
    .split(/\r?\n/u)
    .map((line) => line.trim().replace(/\s+/gu, " "))
    .filter(Boolean);
  if (
    phrases.length > 8 ||
    phrases.some(
      (phrase) => phrase.length > 80 || /[\p{Cc}\p{Cf}]/u.test(phrase),
    )
  )
    throw new RangeError(
      "Use at most eight special names or phrases, up to 80 characters each.",
    );
  return [...new Set(phrases)];
}

/** Split text only at complete word boundaries. */
export function specialWordParts(
  text: string,
  phrases: readonly string[],
): SpecialWordPart[] {
  if (!phrases.length || !text) return [{ text, special: false }];
  const sorted = [...phrases]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const alternatives = sorted
    .map((phrase) => phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  if (!alternatives) return [{ text, special: false }];
  const boundary = "[\\p{L}\\p{N}\\p{M}_'’\\-\\u200d]";
  const matcher = new RegExp(
    `(?<!${boundary})(?:${alternatives})(?!${boundary})`,
    "gu",
  );
  const parts: SpecialWordPart[] = [];
  let end = 0;
  for (const match of text.matchAll(matcher)) {
    const start = match.index;
    const next = start + match[0].length;
    if (start > end)
      parts.push({ text: text.slice(end, start), special: false });
    parts.push({ text: match[0], special: true });
    end = next;
  }
  if (end < text.length) parts.push({ text: text.slice(end), special: false });
  return parts;
}

/** Find ordinary wrap points while retaining selected phrases and adjacent punctuation. */
export function specialWordWrapUnits(
  text: string,
  phrases: readonly string[],
): SpecialWordPart[] {
  let offset = 0;
  const protectedRanges = specialWordParts(text, phrases).flatMap((part) => {
    const start = offset;
    offset += part.text.length;
    return part.special ? [{ start, end: offset }] : [];
  });
  const units: SpecialWordPart[] = [];
  let start = 0;
  const append = (end: number) => {
    if (end > start)
      units.push({
        text: text.slice(start, end),
        special: protectedRanges.some(
          (range) => range.start < end && range.end > start,
        ),
      });
  };
  for (const space of text.matchAll(/\s+/gu)) {
    if (
      protectedRanges.some(
        (range) => range.start < space.index && range.end > space.index,
      )
    )
      continue;
    append(space.index);
    start = space.index + space[0].length;
  }
  append(text.length);
  return units;
}
