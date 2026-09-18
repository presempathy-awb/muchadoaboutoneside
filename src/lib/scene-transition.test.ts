import { expect, test } from "bun:test";
import {
  type CameraPose,
  interpolateCameraPose,
  sameCameraPose,
  transitionProgress,
} from "./scene-transition";

test("camera easing is bounded, frame-rate independent, and immediate for reduced motion", () => {
  expect(transitionProgress(100, 90, 400)).toBe(0);
  expect(transitionProgress(100, 100, 400)).toBe(0);
  expect(transitionProgress(100, 300, 400)).toBe(0.5);
  expect(transitionProgress(100, 500, 400)).toBe(1);
  expect(transitionProgress(100, 5000, 400)).toBe(1);
  expect(transitionProgress(100, 100, 0)).toBe(1);
  expect(transitionProgress(100, 100, Number.NaN)).toBe(1);
  let previous = 0;
  for (let now = 100; now <= 500; now += 8) {
    const amount = transitionProgress(100, now, 400);
    expect(amount).toBeGreaterThanOrEqual(previous);
    expect(amount).toBeLessThanOrEqual(1);
    previous = amount;
  }
});

test("camera pose crosses the short orbit arc and zooms evenly across model sizes", () => {
  const from: CameraPose = {
    alpha: Math.PI * 1.9,
    beta: 1,
    radius: 100,
    target: [0, 10, 0],
  };
  const to: CameraPose = {
    alpha: Math.PI * 0.1,
    beta: 2,
    radius: 1,
    target: [10, 0, 2],
  };
  const midpoint = interpolateCameraPose(from, to, 0.5);
  expect(midpoint.alpha).toBeCloseTo(Math.PI * 2);
  expect(midpoint.beta).toBe(1.5);
  expect(midpoint.radius).toBeCloseTo(10);
  expect(midpoint.target).toEqual([5, 5, 1]);
  const end = interpolateCameraPose(from, to, 1);
  expect(end.radius).toBeCloseTo(to.radius);
  expect(end.target).toEqual(to.target);
  expect(Math.cos(end.alpha)).toBeCloseTo(Math.cos(to.alpha));
  // An interrupted transition starts exactly at its last displayed pose.
  const replacement = interpolateCameraPose(midpoint, from, 0);
  expect(replacement.alpha).toBe(midpoint.alpha);
  expect(replacement.radius).toBeCloseTo(midpoint.radius);
  expect(replacement.target).toEqual(midpoint.target);
  expect(
    sameCameraPose(from, { ...from, alpha: from.alpha + Math.PI * 2 }),
  ).toBe(true);
  expect(sameCameraPose(from, { ...from, radius: from.radius * 1.1 })).toBe(
    false,
  );
  expect(sameCameraPose(from, { ...from, target: [1, 10, 0] })).toBe(false);
});
