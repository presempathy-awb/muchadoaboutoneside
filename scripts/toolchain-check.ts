import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const config = Bun.TOML.parse(
  await Bun.file(resolve(root, "mise.toml")).text(),
) as { tools: Record<string, string> };
// Container-job plugins: locked for Gitea CI, not local CLI binaries.
const ciOnlyTools = new Set(["docker-cli", "aqua:docker/buildx"]);
for (const [tool, expected] of Object.entries(config.tools)) {
  if (ciOnlyTools.has(tool)) continue;
  const result = Bun.spawnSync([tool, "--version"], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = result.stdout.toString() + result.stderr.toString();
  if (
    result.exitCode !== 0 ||
    !output.match(
      new RegExp(
        `(?:^|[^0-9.])${expected.replaceAll(".", "\\.")}(?:$|[^0-9.])`,
      ),
    )
  ) {
    throw new Error(
      `${tool}: expected ${expected}; run mise install and mise exec -- just toolchain-check`,
    );
  }
  console.log(`${tool}: ${expected}`);
}
