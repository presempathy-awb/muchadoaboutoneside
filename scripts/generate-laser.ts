import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { FABRICATION_GEOMETRY_OPTIONS } from "../shared/fabrication";
import { surfaceRows } from "../shared/inscription-layout";
import { CANONICAL_POEM } from "../shared/poem";
import { generateFoilGeometry } from "../src/lib/foil-geometry";

// The masters are generated for the canonical wording; other wordings are
// previewed live until their own artwork run. The computed layouts equal the
// fixed constants for the canonical loop (see inscription-layout.test.ts).
const body = surfaceRows("body", CANONICAL_POEM);
const jaw = surfaceRows("jaw", CANONICAL_POEM);
if (body.rowText !== jaw.rowText)
  throw new Error("Body and jaw masters must carry the same poem text");

const root = resolve(import.meta.dir, "..");
const temporary = await mkdtemp(resolve(tmpdir(), "muchado-laser-"));
try {
  const input = resolve(temporary, "input.json");
  await Bun.write(
    input,
    JSON.stringify({
      geometry: generateFoilGeometry(FABRICATION_GEOMETRY_OPTIONS),
      poem: body.rowText,
      layout: body.layout,
      jawLayout: jaw.layout,
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
