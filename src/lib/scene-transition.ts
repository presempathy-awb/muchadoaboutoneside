export interface CameraPose {
  alpha: number;
  beta: number;
  radius: number;
  target: readonly [number, number, number];
}

export function sameCameraPose(a: CameraPose, b: CameraPose) {
  const epsilon = Math.max(a.radius, b.radius, 1e-6) * 1e-7;
  const angle = Math.atan2(
    Math.sin(a.alpha - b.alpha),
    Math.cos(a.alpha - b.alpha),
  );
  return (
    Math.abs(angle) < 1e-7 &&
    Math.abs(a.beta - b.beta) < 1e-7 &&
    Math.abs(a.radius - b.radius) < epsilon &&
    a.target.every(
      (value, index) => Math.abs(value - (b.target[index] ?? 0)) < epsilon,
    )
  );
}

/** Monotonic, frame-rate independent easing with zero velocity at each end. */
export function transitionProgress(
  start: number,
  now: number,
  duration: number,
) {
  if (!Number.isFinite(duration) || duration <= 0) return 1;
  const t = Math.max(0, Math.min(1, (now - start) / duration));
  return t * t * (3 - 2 * t);
}

export function interpolateCameraPose(
  from: CameraPose,
  to: CameraPose,
  amount: number,
): CameraPose {
  const t = Math.max(0, Math.min(1, amount));
  const turn = Math.PI * 2;
  const angle =
    ((((to.alpha - from.alpha + Math.PI) % turn) + turn) % turn) - Math.PI;
  const mix = (a: number, b: number) => a + (b - a) * t;
  return {
    alpha: from.alpha + angle * t,
    beta: mix(from.beta, to.beta),
    // Multiplicative zoom remains perceptually even across full-size/maquette hops.
    radius: Math.exp(
      mix(
        Math.log(Math.max(1e-6, from.radius)),
        Math.log(Math.max(1e-6, to.radius)),
      ),
    ),
    target: [
      mix(from.target[0], to.target[0]),
      mix(from.target[1], to.target[1]),
      mix(from.target[2], to.target[2]),
    ],
  };
}
