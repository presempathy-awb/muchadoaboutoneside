import { lstat, mkdir, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import {
  isPublicSourcePath,
  PRIVATE_REFERENCE_SHA256,
} from "../shared/publication";

const root = await realpath(resolve(import.meta.dir, ".."));
const argument = process.argv.indexOf("--output");
const destination = process.argv[argument + 1];
if (argument < 0 || !destination || destination.startsWith("--"))
  throw new Error("Usage: bun run export:public --output <new-directory>");
const requested = resolve(destination);
const output = resolve(await realpath(dirname(requested)), basename(requested));
if (output === root || output.startsWith(`${root}/`))
  throw new Error("Public export must be outside the private checkout");

function git(args: string[]) {
  const result = Bun.spawnSync(["git", "-c", "core.fsmonitor=false", ...args], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
  return result.stdout.toString();
}

if (git(["status", "--porcelain"]).trim())
  throw new Error("Commit the reviewed source before exporting it publicly");
const commit = git(["rev-parse", "HEAD"]).trim();
const paths = git(["ls-files", "-z"]).split("\0").filter(Boolean);
const inventory: Array<{ path: string; bytes: number; sha256: string }> = [];

// Validate the complete selection before creating any publishable output.
for (const path of paths.filter(isPublicSourcePath).sort()) {
  const source = resolve(root, path);
  if (!(await lstat(source)).isFile())
    throw new Error(
      `Only regular files may enter the public snapshot: ${path}`,
    );
  const bytes = await Bun.file(source).arrayBuffer();
  const sha256 = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
  if (sha256 === PRIVATE_REFERENCE_SHA256)
    throw new Error(`Private reference bytes found in public source: ${path}`);
  inventory.push({ path, bytes: bytes.byteLength, sha256 });
}
for (const required of [
  "LICENSE",
  "LICENSE-MIT",
  "LICENSE-APACHE",
  "REUSE.md",
  "package.json",
  ".github/workflows/site.yml",
])
  if (!inventory.some((entry) => entry.path === required))
    throw new Error(`Required public source file is missing: ${required}`);

// No history, remotes, environment files, or existing destination is copied.
await mkdir(output);
for (const entry of inventory) {
  const bytes = await Bun.file(resolve(root, entry.path)).arrayBuffer();
  const hash = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
  if (hash !== entry.sha256)
    throw new Error(`Source changed during public export: ${entry.path}`);
  const target = resolve(output, entry.path);
  await mkdir(resolve(target, ".."), { recursive: true });
  await writeFile(target, new Uint8Array(bytes), { flag: "wx" });
}
if (
  git(["rev-parse", "HEAD"]).trim() !== commit ||
  git(["status", "--porcelain"]).trim()
)
  throw new Error(
    "Source checkout changed during public export; discard this snapshot",
  );
await writeFile(
  resolve(output, "PUBLIC_SNAPSHOT.json"),
  `${JSON.stringify(
    {
      sourceCommit: commit,
      license: "MIT OR Apache-2.0",
      excludesPrivateHistory: true,
      files: inventory,
    },
    null,
    2,
  )}\n`,
);
console.log(
  `Public source snapshot: ${output} (${inventory.length} verified files; source ${commit})`,
);
