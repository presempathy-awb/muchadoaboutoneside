import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { POEM_LOOP } from "../shared/poem";

const root = resolve(import.meta.dir, "..");
const temporary = await mkdtemp(resolve(tmpdir(), "muchado-small-foil-"));

try {
  const input = resolve(temporary, "input.json");
  await Bun.write(
    input,
    JSON.stringify({
      poem: POEM_LOOP,
    }),
  );
  const result = Bun.spawnSync(
    [
      process.env.SMALL_FOIL_PYTHON ?? "python3",
      resolve(import.meta.dir, "generate-small-foil.py"),
      input,
      ...(process.argv.includes("--check") ? ["--check"] : []),
    ],
    { cwd: root, stdout: "inherit", stderr: "inherit" },
  );
  if (result.exitCode !== 0) throw new Error("Small foil generation failed");
} finally {
  await rm(temporary, { recursive: true, force: true });
}
