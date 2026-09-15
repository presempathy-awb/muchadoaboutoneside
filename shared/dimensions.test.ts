import { expect, test } from "bun:test";
import { project } from "../server/project";
import { DIMENSIONS, formatDimension } from "./dimensions";

test("dimensions distinguish print height, depth, and original source inches", () => {
  expect(DIMENSIONS.maquette).toEqual({
    width: 103.5346,
    height: 180,
    depth: 45.9029,
  });
  expect(DIMENSIONS.sculpture.height / 25.4).toBeCloseTo(
    project.model.heightInches,
    8,
  );
  expect(DIMENSIONS.sculpture.width / 25.4).toBeCloseTo(
    project.model.widthInches,
    8,
  );
  expect(DIMENSIONS.sculpture.depth / 25.4).toBeCloseTo(
    project.model.depthInches,
    8,
  );
});

test("display conversions preserve source precision and landscape paper orientation", () => {
  expect(formatDimension(DIMENSIONS.sculpture.height, "in")).toBe("206.3");
  expect(formatDimension(DIMENSIONS.maquette.height, "in")).toBe("7.09");
  expect(formatDimension(DIMENSIONS.maquette.width, "mm")).toBe("103.5");
  expect(formatDimension(DIMENSIONS.maquette.depth, "mm")).toBe("45.9");
  expect(formatDimension(DIMENSIONS.paper.width, "in")).toBe("11");
  expect(formatDimension(DIMENSIONS.paper.height, "in")).toBe("8.5");
});
