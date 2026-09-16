/**
 * Stable React keys for repeated text: the text itself plus its occurrence,
 * so a wording that repeats a line or a stanza never reuses a key.
 */
export function keyed(items: readonly string[]) {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const occurrence = seen.get(item) ?? 0;
    seen.set(item, occurrence + 1);
    return { item, key: `${item}#${occurrence}` };
  });
}
