import type { ScaleStudy } from "./scale-study";

/** Ratios of generated faces, independent of camera perspective and display units. */
export interface ScalePlateProportions {
  count: number;
  medianAspect: number;
  medianShortEdgeInches: number;
  medianReliefRatio: number;
  middleAspectRange: [number, number];
}

function quantile(sorted: number[], fraction: number): number {
  const at = (sorted.length - 1) * fraction;
  const lower = Math.floor(at);
  const a = sorted[lower] ?? 0;
  return a + ((sorted[Math.ceil(at)] ?? a) - a) * (at - lower);
}

/**
 * Estimate emitted face spans from their UV extents and physical UV metrics.
 * A clipped maquette component may occupy only a small fraction of its cell;
 * the cell's full width/height must not masquerade as that component's size.
 * Curvature and local distortion still make these span estimates, not a tape
 * measurement or an oriented bounding rectangle of a flattened wood blank.
 */
export function scalePlateProportions(
  study: ScaleStudy,
): ScalePlateProportions | null {
  const faces = study.plates.flatMap((plate) => {
    let minU = Infinity,
      minV = Infinity,
      maxU = -Infinity,
      maxV = -Infinity;
    for (let i = 0; i < plate.uvs.length; i += 2) {
      const u = plate.uvs[i] ?? Number.NaN;
      const v = plate.uvs[i + 1] ?? Number.NaN;
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }
    const width = plate.widthInches * (maxU - minU);
    const height = plate.heightInches * (maxV - minV);
    if (
      !Number.isFinite(width) ||
      width <= 1e-8 ||
      !Number.isFinite(height) ||
      height <= 1e-8 ||
      !Number.isFinite(plate.appliedReliefInches) ||
      plate.appliedReliefInches < 0
    )
      return [];
    return [{ width, height, relief: plate.appliedReliefInches }];
  });
  if (!faces.length) return null;
  const shortEdges = faces.map((plate) => Math.min(plate.width, plate.height));
  const aspects = faces
    .map(
      (plate, i) => Math.max(plate.width, plate.height) / (shortEdges[i] ?? 1),
    )
    .sort((a, b) => a - b);
  const reliefRatios = faces
    .map((plate, i) => plate.relief / (shortEdges[i] ?? 1))
    .sort((a, b) => a - b);
  shortEdges.sort((a, b) => a - b);
  return {
    count: faces.length,
    medianAspect: quantile(aspects, 0.5),
    medianShortEdgeInches: quantile(shortEdges, 0.5),
    medianReliefRatio: quantile(reliefRatios, 0.5),
    middleAspectRange: [quantile(aspects, 0.25), quantile(aspects, 0.75)],
  };
}
