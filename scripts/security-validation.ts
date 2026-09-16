import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Synthetic disposable fixtures prove scanner findings fail the command.
// Never print a scanner report containing token material.
const root = resolve(import.meta.dir, "..");
const scratch = await mkdtemp(join(tmpdir(), "muchado-security-"));
async function expectExit(command: string[], expected: number) {
  const child = Bun.spawn(command, {
    cwd: scratch,
    stdout: "ignore",
    stderr: "ignore",
  });
  const actual = await child.exited;
  if (actual !== expected)
    throw new Error(
      `${command[0]} fixture expected exit ${expected}, got ${actual}`,
    );
}
try {
  await cp(join(root, "rules"), join(scratch, "rules"), { recursive: true });
  await cp(join(root, "sgconfig.yml"), join(scratch, "sgconfig.yml"));
  await cp(join(root, ".trivyignore.yaml"), join(scratch, ".trivyignore.yaml"));
  await mkdir(join(scratch, "server"));
  const fixture = join(scratch, "server/fixture.ts");
  await writeFile(fixture, 'logger.info("ready");\n');
  await expectExit(
    ["ast-grep", "scan", "--config", "sgconfig.yml", "server"],
    0,
  );
  await writeFile(fixture, 'console.log("ready");\n');
  await expectExit(
    ["ast-grep", "scan", "--config", "sgconfig.yml", "server"],
    1,
  );
  await rm(fixture);
  const leakArgs = [
    "gitleaks",
    "dir",
    ".",
    "--config",
    join(root, ".gitleaks.toml"),
    "--redact",
    "--exit-code",
    "1",
  ];
  await expectExit(leakArgs, 0);
  await writeFile(
    join(scratch, "fixture.txt"),
    `token=${"ghp_"}${"a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8"}\n`,
  );
  await expectExit(leakArgs, 1);
  await rm(join(scratch, "fixture.txt"));
  const dockerfile = join(scratch, "Dockerfile");
  const configArgs = [
    "trivy",
    "config",
    "--config",
    join(root, "trivy.yaml"),
    ".",
  ];
  await writeFile(
    dockerfile,
    "FROM scratch\nUSER 65532:65532\nHEALTHCHECK NONE\n",
  );
  await expectExit(configArgs, 0);
  await writeFile(dockerfile, "FROM scratch\nUSER root\nHEALTHCHECK NONE\n");
  await expectExit(configArgs, 1);
  console.log(
    "Security fixtures passed: clean inputs accepted and policy, secret, and misconfiguration findings rejected.",
  );
} finally {
  await rm(scratch, { recursive: true, force: true });
}
