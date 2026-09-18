import { expect, test } from "bun:test";
import {
  modelScaleForHeight,
  SCALE_MODELS,
  scaledModelDimensions,
} from "./scale-models";

test("model presets retain source-specific proportions and physical units", () => {
  const sixFoot = scaledModelDimensions(
    "archival",
    modelScaleForHeight("archival", 72),
  );
  expect(sixFoot.height).toBeCloseTo(72, 10);
  const doubledPrint = scaledModelDimensions("maquette", 2);
  expect(doubledPrint.height * 25.4).toBeCloseTo(360, 10);
  expect(doubledPrint.width * 25.4).toBeCloseTo(207.0692, 8);
  expect(doubledPrint.depth * 25.4).toBeCloseTo(91.8058, 8);
  expect(
    SCALE_MODELS.archival.widthInches / SCALE_MODELS.archival.heightInches,
  ).not.toBeCloseTo(
    SCALE_MODELS.maquette.widthInches / SCALE_MODELS.maquette.heightInches,
    2,
  );
  expect(modelScaleForHeight("maquette", 72)).toBeGreaterThan(10);
  expect(() => modelScaleForHeight("maquette", Number.NaN)).toThrow();
  expect(() => scaledModelDimensions("archival", 0)).toThrow();
});
