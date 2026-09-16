import { expect, test } from "bun:test";
import {
  type FoilMeshGeometry,
  generateFoilGeometry,
} from "../src/lib/foil-geometry";
import { FABRICATION_GEOMETRY_OPTIONS } from "./fabrication";
import {
  CALIBRATION_LOOP_EM,
  inscriptionBudget,
  MAQUETTE,
  MAQUETTE_STRETCHES_MM,
  MARKING_FLOOR_EM_MM,
  SURFACE_SCALE,
  surfaceLimitEm,
  surfaceRows,
} from "./inscription-layout";
import {
  CANONICAL_POEM,
  INSCRIPTION_LAYOUT,
  JAW_INSCRIPTION_LAYOUT,
  poemVersionById,
} from "./poem";
import { loopWidthEm } from "./script-metrics";

function halfPerimeters(geometry: FoilMeshGeometry) {
  const per = geometry.verticesPerMeridian;
  const point = (row: number, station: number) => {
    const index = (row * per + station) * 3;
    return [
      geometry.positions[index] ?? 0,
      geometry.positions[index + 1] ?? 0,
      geometry.positions[index + 2] ?? 0,
    ] as const;
  };
  const values: number[] = [];
  for (let station = 0; station < per; station++) {
    let half = 0;
    for (let row = 0; row < geometry.meridianCount; row++) {
      const a = point(row, station);
      const b = point(row + 1, station);
      half += Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    }
    values.push(half * 25.4);
  }
  values.sort((a, b) => a - b);
  return {
    min: values[0] ?? 0,
    median: values[Math.floor(values.length / 2)] ?? 0,
    max: values[values.length - 1] ?? 0,
  };
}

test("the canonical wording reproduces the fixed layouts exactly", () => {
  expect(CANONICAL_POEM.loopWidthEm).toBe(CALIBRATION_LOOP_EM);
  const body = surfaceRows("body", CANONICAL_POEM);
  expect(body.layout).toEqual(INSCRIPTION_LAYOUT);
  expect(body.repetitions).toBe(1);
  expect(body.rowText).toBe(CANONICAL_POEM.loop);
  const jaw = surfaceRows("jaw", CANONICAL_POEM);
  expect(jaw.layout).toEqual(JAW_INSCRIPTION_LAYOUT);
  expect(jaw.rowText).toBe(CANONICAL_POEM.loop);
});

test("other wordings keep the glyph proportions, refill the rows, and stay inside the chart", () => {
  const extended = poemVersionById("extended");
  const body = surfaceRows("body", extended);
  const bodyScale = body.layout.fontSize / INSCRIPTION_LAYOUT.fontSize;
  expect(body.layout.fontSize).toBeCloseTo(
    (300 * CALIBRATION_LOOP_EM) / extended.loopWidthEm,
    1,
  );
  expect(body.layout.rowSpacing / body.layout.fontSize).toBeCloseTo(1.4, 3);
  expect(body.layout.firstBaseline).toBeCloseTo(420 * bodyScale, 1);
  expect(body.layout.rows).toBe(9);
  // Glyph width on the chart is the same for every wording: loop em × font size.
  expect(
    Math.abs(
      body.loopWidthEm * body.layout.fontSize - CALIBRATION_LOOP_EM * 300,
    ) /
      (CALIBRATION_LOOP_EM * 300),
  ).toBeLessThan(1e-4);
  const lastBaseline =
    body.layout.firstBaseline + (body.layout.rows - 1) * body.layout.rowSpacing;
  expect(lastBaseline + 0.32 * body.layout.fontSize).toBeLessThan(2048);
  const jaw = surfaceRows("jaw", extended);
  expect(jaw.layout.rows).toBe(43);
  expect(jaw.layout.rowSpacing / jaw.layout.fontSize).toBeCloseTo(2.4, 2);
});

test("a short wording repeats within each row instead of growing past the chart", () => {
  const short = {
    loop: "Come, palindove, let edges twine;",
    loopWidthEm: 9.66,
  };
  const body = surfaceRows("body", short);
  expect(body.repetitions).toBeGreaterThan(1);
  expect(body.layout.fontSize).toBeLessThanOrEqual(
    (2048 * 300) / (420 + 368) + 0.01,
  );
  expect(body.layout.rows).toBeGreaterThanOrEqual(1);
  expect(body.rowText.split("  ")).toHaveLength(body.repetitions);
  expect(surfaceRows("body", { loop: "", loopWidthEm: 0 }).layout.rows).toBe(0);
});

test("the physical scale constants match the foil geometry", () => {
  const geometry = generateFoilGeometry(FABRICATION_GEOMETRY_OPTIONS);
  for (const [surface, mesh] of [
    ["body", geometry],
    ["jaw", geometry.jawGeometry],
  ] as const) {
    const expected = SURFACE_SCALE[surface];
    expect(mesh.readingLoopLengthInches * 25.4).toBeCloseTo(
      expected.loopLengthMm,
      0,
    );
    const measured = halfPerimeters(mesh);
    expect(measured.min).toBeCloseTo(expected.halfPerimeterMm.min, 0);
    expect(measured.median).toBeCloseTo(expected.halfPerimeterMm.median, 0);
    expect(measured.max).toBeCloseTo(expected.halfPerimeterMm.max, 0);
  }
});

test("limits are explicit: the jaw's thinnest section binds, the maquette is tuned to the canonical loop", () => {
  expect(MARKING_FLOOR_EM_MM).toBe(MAQUETTE.emMm);
  expect(MAQUETTE_STRETCHES_MM).toEqual([440, 440]);
  expect(surfaceLimitEm("jaw")).toBeLessThan(surfaceLimitEm("body"));
  const canonical = inscriptionBudget(CANONICAL_POEM);
  expect(canonical.fits).toBe(true);
  expect(canonical.hardLimitSurface).toBe("jaw");
  expect(canonical.jaw.emMmMin).toBeGreaterThan(MARKING_FLOOR_EM_MM);
  expect(canonical.body.emMmMin).toBeGreaterThan(20);
  expect(canonical.maquette.fits).toBe(true);
  expect(canonical.maquette.repetitions).toBe(MAQUETTE.poemRepetitions);
  expect(canonical.maquette.capacityEm).toBeGreaterThan(CALIBRATION_LOOP_EM);
  expect(canonical.maquette.capacityEm).toBeLessThan(CALIBRATION_LOOP_EM + 1);

  const extended = inscriptionBudget(poemVersionById("extended"));
  expect(extended.body.fits).toBe(true);
  expect(extended.jaw.fits).toBe(false);
  expect(extended.jaw.emMmMin).toBeLessThan(MARKING_FLOOR_EM_MM);
  expect(extended.maquette.fits).toBe(false);
  expect(extended.maquette.emMmToFit).toBeLessThan(MARKING_FLOOR_EM_MM);
  expect(extended.hardLimitEm).toBe(surfaceLimitEm("jaw"));

  // At the limit itself the thinnest jaw letters sit exactly on the floor.
  const atLimit = inscriptionBudget({
    loop: "x".repeat(10),
    loopWidthEm: surfaceLimitEm("jaw"),
  });
  expect(atLimit.jaw.emMmMin).toBeCloseTo(MARKING_FLOOR_EM_MM, 1);
  expect(atLimit.fits).toBe(true);
});

test("drafts estimate their loop width from glyph advances", () => {
  const extended = poemVersionById("extended");
  expect(
    Math.abs(loopWidthEm(extended.lines) - extended.loopWidthEm) /
      extended.loopWidthEm,
  ).toBeLessThan(0.005);
});
