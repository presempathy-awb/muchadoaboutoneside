import { expect, test } from "bun:test";
import {
  fitStudioColumns,
  moveStudioPanel,
  resizeStudioPair,
} from "./calligraphy-layout";

test("desktop columns fit available space without losing the saved preference", () => {
  expect(fitStudioColumns(3, 1700)).toBe(3);
  expect(fitStudioColumns(4, 3600)).toBe(4);
  expect(fitStudioColumns(4, 1700)).toBe(3);
  expect(fitStudioColumns(3, 1100)).toBe(2);
  expect(fitStudioColumns(2, 3600)).toBe(2);
});

test("panel movement preserves every panel and ignores unavailable targets", () => {
  expect(
    moveStudioPanel(["tools", "paper", "writing", "notes"], "paper", "tools"),
  ).toEqual(["paper", "tools", "writing", "notes"]);
  expect(moveStudioPanel(["tools", "paper"], "notes", "paper")).toEqual([
    "tools",
    "paper",
  ]);
});

test("dragging a divider redistributes only its pair and keeps both usable", () => {
  expect(resizeStudioPair(500, 600, 80)).toEqual([580, 520]);
  expect(resizeStudioPair(500, 600, 2000)).toEqual([780, 320]);
  expect(resizeStudioPair(500, 600, -2000)).toEqual([320, 780]);
});
