import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { FABRICATION_GEOMETRY_OPTIONS } from "../shared/fabrication";
import {
  INSCRIPTION_LAYOUT,
  JAW_INSCRIPTION_LAYOUT,
  POEM_LOOP,
} from "../shared/poem";
import { generateFoilGeometry } from "../src/lib/foil-geometry";

const root = resolve(import.meta.dir, "..");
const temporary = await mkdtemp(resolve(tmpdir(), "muchado-laser-"));
try {
  const input = resolve(temporary, "input.json");
  await Bun.write(
    input,
    JSON.stringify({
      geometry: generateFoilGeometry(FABRICATION_GEOMETRY_OPTIONS),
      poem: POEM_LOOP,
      layout: INSCRIPTION_LAYOUT,
      jawLayout: JAW_INSCRIPTION_LAYOUT,
      options: FABRICATION_GEOMETRY_OPTIONS,
    }),
  );
  const result = Bun.spawnSync(
    [
      process.env.FABRICATION_PYTHON ?? "python3",
      resolve(import.meta.dir, "generate-laser.py"),
      input,
    ],
    { cwd: root, stdout: "inherit", stderr: "inherit" },
  );
  if (result.exitCode !== 0) throw new Error("Laser artwork generation failed");
} finally {
  await rm(temporary, { recursive: true, force: true });
}
