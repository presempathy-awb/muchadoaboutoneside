import type { ScaleStudy, ScaleStudySettings } from "../../shared/scale-study";

export function scaleStudyCacheKey(
  settings: ScaleStudySettings,
): string | null {
  const entries = Object.entries(settings).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  if (
    entries.some(
      ([, value]) => typeof value === "number" && !Number.isFinite(value),
    )
  )
    return null;
  return JSON.stringify(entries);
}

/** Conservative JS-array estimate; both entry count and retained size are bounded. */
export function estimateScaleStudyBytes(study: ScaleStudy): number {
  let numbers =
    (study.sourceGeometry?.positions.length ?? 0) +
    (study.sourceGeometry?.indices.length ?? 0);
  for (const plate of study.plates) {
    numbers +=
      plate.positions.length +
      plate.normals.length +
      plate.indices.length +
      plate.uvs.length +
      plate.edgePositions.length +
      plate.edgeIndices.length +
      plate.outline.length * 2 +
      20;
  }
  return numbers * 32 + study.plates.length * 1024;
}

/** Page-local successful results only. Returning to a recent shape avoids a worker rebuild. */
export class ScaleStudyCache {
  private entries = new Map<string, { study: ScaleStudy; bytes: number }>();
  private bytes = 0;

  constructor(
    private readonly maxEntries = 4,
    private readonly maxBytes = 64 * 1024 * 1024,
  ) {
    if (
      !Number.isInteger(maxEntries) ||
      maxEntries < 0 ||
      !Number.isFinite(maxBytes) ||
      maxBytes < 0
    )
      throw new RangeError(
        "Scale cache limits must be finite and nonnegative.",
      );
  }

  get retainedBytes() {
    return this.bytes;
  }
  get size() {
    return this.entries.size;
  }

  get(settings: ScaleStudySettings): ScaleStudy | undefined {
    const key = scaleStudyCacheKey(settings);
    if (key === null) return undefined;
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.study;
  }

  set(settings: ScaleStudySettings, study: ScaleStudy): void {
    const key = scaleStudyCacheKey(settings);
    if (key === null) return;
    const existing = this.entries.get(key);
    if (existing) {
      this.entries.delete(key);
      this.bytes -= existing.bytes;
    }
    const bytes = estimateScaleStudyBytes(study);
    if (this.maxEntries === 0 || bytes > this.maxBytes) return;
    while (
      this.entries.size >= this.maxEntries ||
      this.bytes + bytes > this.maxBytes
    ) {
      const first = this.entries.entries().next().value;
      if (!first) break;
      this.entries.delete(first[0]);
      this.bytes -= first[1].bytes;
    }
    this.entries.set(key, { study, bytes });
    this.bytes += bytes;
  }
}
