import { cp, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import {
  PRIVATE_REFERENCE_NAMES,
  PRIVATE_REFERENCE_SHA256,
} from "../shared/publication";

const root = resolve(import.meta.dir, "..");
const archivedAssets = [
  "manifest.json",
  "snake_build.glb",
  "snake_build.obj",
  "snake_build.stl",
  "snake_build_viewer.html",
] as const;

function outputArgument() {
  const index = Bun.argv.indexOf("--output");
  const value = index >= 0 ? Bun.argv[index + 1] : undefined;
  if (!value || value.startsWith("--")) {
    throw new Error(
      "usage: bun deploy/package-release.ts --output <release-parent>",
    );
  }
  return resolve(value);
}

function gitCommand(args: string[]) {
  const result = Bun.spawnSync(["git", ...args], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(
      result.stderr.toString().trim() || `git ${args.join(" ")} failed`,
    );
  }
  return result.stdout.toString().trim();
}

function gitState() {
  const sha = gitCommand(["rev-parse", "HEAD"]);
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error(`unexpected git SHA: ${JSON.stringify(sha)}`);
  }

  const clean =
    gitCommand(["status", "--porcelain", "--untracked-files=all"]) === "";
  if (!clean && !Bun.argv.includes("--allow-dirty")) {
    throw new Error(
      "refusing to package a dirty source tree; commit the release or use --allow-dirty only for local smoke testing",
    );
  }
  return { clean, sha };
}

async function requireDirectory(path: string) {
  if (!(await stat(path)).isDirectory()) {
    throw new Error(`required directory is unavailable: ${path}`);
  }
}

async function walk(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(child)));
    else files.push(child);
  }
  return files;
}

const outputRoot = outputArgument();
const { clean, sha } = gitState();
const releaseDir = resolve(outputRoot, sha);

if (!releaseDir.startsWith(`${outputRoot}${sep}`)) {
  throw new Error("release path escaped its output parent");
}

const frontend = Bun.spawnSync([process.execPath, "run", "build"], {
  cwd: root,
  stdout: "inherit",
  stderr: "inherit",
});
if (frontend.exitCode !== 0) throw new Error("frontend build failed");

await requireDirectory(resolve(root, "dist"));
await requireDirectory(resolve(root, "source/assets"));
await mkdir(outputRoot, { recursive: true });
await mkdir(releaseDir);
await mkdir(resolve(releaseDir, "server"));

const build = await Bun.build({
  entrypoints: [resolve(root, "server/index.ts")],
  outdir: resolve(releaseDir, "server"),
  target: "bun",
  format: "esm",
  sourcemap: "none",
  minify: false,
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
});
if (!build.success) {
  throw new AggregateError(build.logs, "server bundle failed");
}

await cp(resolve(root, "dist"), resolve(releaseDir, "dist"), {
  recursive: true,
});
await mkdir(resolve(releaseDir, "source/assets"), { recursive: true });
for (const asset of archivedAssets) {
  await cp(
    resolve(root, "source/assets", asset),
    resolve(releaseDir, "source/assets", asset),
  );
  if (!(await stat(resolve(releaseDir, "source/assets", asset))).isFile()) {
    throw new Error(`archived asset missing from release: ${asset}`);
  }
}

const releaseFiles = await walk(releaseDir);
const forbidden = releaseFiles.find(
  (path) =>
    path.includes(`${sep}source${sep}reference${sep}`) ||
    PRIVATE_REFERENCE_NAMES.has(path.split(sep).at(-1) ?? ""),
);
if (forbidden) {
  throw new Error(
    `private reference entered release: ${relative(releaseDir, forbidden)}`,
  );
}
for (const path of releaseFiles) {
  const hash = new Bun.CryptoHasher("sha256")
    .update(await Bun.file(path).arrayBuffer())
    .digest("hex");
  if (hash === PRIVATE_REFERENCE_SHA256)
    throw new Error(
      `private reference bytes entered release: ${relative(releaseDir, path)}`,
    );
}

await writeFile(
  resolve(releaseDir, "release.json"),
  `${JSON.stringify(
    {
      gitSha: sha,
      sourceTreeClean: clean,
      createdAt: new Date().toISOString(),
      entrypoint: "server/index.js",
      contents: ["dist", "server/index.js", "source/assets"],
    },
    null,
    2,
  )}\n`,
);

console.log(releaseDir);
