import { expect, test } from "bun:test";
import sections from "./foil-sections.json";
import { deformArchivalHardwarePosition } from "./scale-body";

test("head hardware identity is exact and caller data is not mutated", () => {
  const position: [number, number, number] = [34.3, 188.7, -5.2];
  expect(deformArchivalHardwarePosition(position, 1, 1)).toEqual(position);
  expect(position).toEqual([34.3, 188.7, -5.2]);
});
test("head attachment centerline remains fixed under radial sizing", () => {
  for (const source of [
    ...sections.upperHeadSections,
    ...sections.jawSections,
  ]) {
    const center: [number, number, number] = [
      source.center[0] ?? 0,
      source.center[1] ?? 0,
      source.center[2] ?? 0,
    ];
    const result = deformArchivalHardwarePosition(center, 1.7, 0.65);
    for (let axis = 0; axis < 3; axis++)
      expect(result[axis]).toBeCloseTo(center[axis] ?? 0, 10);
  }
});
test("hardware preserves the centerline component and scales local depth", () => {
  const source = sections.upperHeadSections.at(-1);
  if (!source) throw new Error("Missing head frame");
  const center = source.center;
  const position: [number, number, number] = [
    center[0] ?? 0,
    center[1] ?? 0,
    (center[2] ?? 0) + 2,
  ];
  const changed = deformArchivalHardwarePosition(position, 1, 1.5);
  expect(changed[0]).toBeCloseTo(position[0], 5);
  expect(changed[1]).toBeCloseTo(position[1], 5);
  expect(changed[2]).toBeCloseTo((center[2] ?? 0) + 3, 5);
});
