import type { ScaleTypography } from "./scale-typography";

export interface ScaleTypographyResources {
  /** Register a loaded renderer before exposing it to preview state. */
  own<T extends ScaleTypography>(typography: T): T;
  /** Keep every loaded, queued, or rendered instance that can still be used. */
  retain(typographies: Iterable<ScaleTypography | null | undefined>): void;
  /** Close the owner; later asynchronous loads are released immediately. */
  dispose(): void;
}

/** Own decoded scan images independently of asynchronous preview transitions. */
export function createScaleTypographyResources(): ScaleTypographyResources {
  const owned = new Set<ScaleTypography>();
  const released = new WeakSet<ScaleTypography>();
  let disposed = false;

  const release = (typographies: Iterable<ScaleTypography>) => {
    const errors: unknown[] = [];
    for (const typography of typographies) {
      owned.delete(typography);
      if (released.has(typography)) continue;
      // Mark first so repeated cleanup and reentrant disposal cannot run twice.
      released.add(typography);
      try {
        typography.dispose?.();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length)
      throw new AggregateError(
        errors,
        "Some handwriting resources could not be released.",
      );
  };

  return {
    own(typography) {
      if (
        typography.engine !== "scan" ||
        !typography.dispose ||
        released.has(typography)
      )
        return typography;
      if (disposed) release([typography]);
      else owned.add(typography);
      return typography;
    },
    retain(typographies) {
      const retained = new Set(typographies);
      release([...owned].filter((typography) => !retained.has(typography)));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      release([...owned]);
    },
  };
}
