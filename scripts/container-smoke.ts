import { resolve } from "node:path";
import { project } from "../server/project";

const root = resolve(import.meta.dir, "..");
const name = `muchado-smoke-${crypto.randomUUID()}`;
const image = `${name}:local`;
let imageBuilt = false;
let containerCreated = false;
async function docker(args: string[]) {
  const building = args[0] === "build";
  const child = Bun.spawn(["docker", ...args], {
    cwd: root,
    stdout: building ? "inherit" : "pipe",
    stderr: building ? "inherit" : "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    child.stdout ? new Response(child.stdout).text() : Promise.resolve(""),
    child.stderr ? new Response(child.stderr).text() : Promise.resolve(""),
    child.exited,
  ]);
  if (code !== 0)
    throw new Error(`docker ${args[0]} failed: ${stderr || stdout}`);
  return stdout.trim();
}

try {
  await docker(["info"]);
  await docker(["compose", "config", "--quiet"]);
  console.log("Building disposable runtime image…");
  await docker(["build", "--tag", image, "."]);
  imageBuilt = true;
  await docker([
    "run",
    "--detach",
    "--name",
    name,
    "--read-only",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges:true",
    "--memory=256m",
    "--pids-limit=128",
    "--publish",
    "127.0.0.1::3001",
    image,
  ]);
  containerCreated = true;
  const inspection = JSON.parse(await docker(["inspect", name]))[0];
  if (
    inspection.Config.User !== "1000:1000" ||
    !inspection.HostConfig.ReadonlyRootfs ||
    !inspection.HostConfig.CapDrop.includes("ALL") ||
    !inspection.HostConfig.SecurityOpt.includes("no-new-privileges:true")
  )
    throw new Error("Runtime hardening was not applied");
  const binding = inspection.NetworkSettings.Ports["3001/tcp"]?.[0];
  if (binding?.HostIp !== "127.0.0.1") throw new Error("Port is not loopback");
  const origin = `http://127.0.0.1:${binding.HostPort}`;
  let healthy = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(`${origin}/api/health`);
      if (response.ok && (await response.json()).status === "ok") {
        healthy = true;
        break;
      }
    } catch {
      /* The daemon may not have started the process yet. */
    }
    await Bun.sleep(500);
  }
  if (!healthy)
    throw new Error(`Container health failed: ${await docker(["logs", name])}`);
  for (const route of ["/", "/instructions", "/six-foot", "/projection"]) {
    const response = await fetch(`${origin}${route}`);
    const html = await response.text();
    if (!response.ok || !html.includes('<div id="root"></div>'))
      throw new Error(
        `Container route failed: ${route} (${response.status}): ${html.slice(0, 160)}`,
      );
  }
  for (const path of [
    "/guide/calligraphy-guide.pdf",
    "/fabrication/laser/panel-kit.zip",
    "/fonts/OFL.txt",
  ]) {
    const response = await fetch(`${origin}${path}`);
    const expected = await Bun.file(
      resolve(root, `public${path}`),
    ).arrayBuffer();
    if (
      !response.ok ||
      !Buffer.from(await response.arrayBuffer()).equals(Buffer.from(expected))
    )
      throw new Error(`Container generated asset mismatch: ${path}`);
  }
  for (const asset of project.assets) {
    const response = await fetch(`${origin}${asset.url}`);
    const hash = new Bun.CryptoHasher("sha256")
      .update(await response.arrayBuffer())
      .digest("hex");
    if (!response.ok || hash !== asset.sha256)
      throw new Error(`Container download mismatch: ${asset.name}`);
  }
  for (const route of [
    "/api/assets/jill-calligraphy.jpg",
    "/source/reference/jill-calligraphy.jpg",
    "/api/missing",
  ]) {
    if ((await fetch(`${origin}${route}`)).status !== 404)
      throw new Error(`Container exposed ${route}`);
  }
  const drafts = await fetch(`${origin}/api/collab/status`).then((r) =>
    r.json(),
  );
  if (drafts.enabled !== false || drafts.rooms.length !== 0)
    throw new Error("Draft persistence unexpectedly enabled");
  const writes = await docker([
    "exec",
    name,
    "/usr/local/bin/bun",
    "-e",
    "try { await Bun.write('/app/unexpected-write', 'test'); process.exit(1); } catch (e) { if (e.code !== 'EROFS' && e.code !== 'EACCES') throw e; }",
  ]);
  void writes;
  const paths = JSON.parse(
    await docker([
      "exec",
      name,
      "/usr/local/bin/bun",
      "-e",
      "import {readdir} from 'node:fs/promises'; console.log(JSON.stringify(await readdir('/app/source')))",
    ]),
  );
  if (JSON.stringify(paths) !== JSON.stringify(["assets"]))
    throw new Error("Unexpected runtime source directory");
  const runtimeAssets = JSON.parse(
    await docker([
      "exec",
      name,
      "/usr/local/bin/bun",
      "-e",
      "import {readdir} from 'node:fs/promises'; console.log(JSON.stringify(await readdir('/app/source/assets')))",
    ]),
  );
  const expectedAssets = [
    "manifest.json",
    ...project.assets.map((asset) => asset.name),
  ].sort();
  if (JSON.stringify(runtimeAssets.sort()) !== JSON.stringify(expectedAssets))
    throw new Error("Unexpected original runtime assets");
  const health = JSON.parse(await docker(["inspect", name]))[0].State.Health;
  for (
    let attempt = 0;
    health?.Status !== "healthy" && attempt < 30;
    attempt++
  ) {
    await Bun.sleep(500);
    const state = JSON.parse(await docker(["inspect", name]))[0].State.Health;
    if (state?.Status === "healthy") {
      health.Status = "healthy";
      break;
    }
  }
  if (health?.Status !== "healthy")
    throw new Error("Docker HEALTHCHECK did not pass");
  console.log(
    "Container smoke passed: healthcheck, routes, original hashes, privacy, drafts off, non-root read-only runtime, loopback binding.",
  );
} finally {
  if (containerCreated) await docker(["rm", "--force", name]);
  if (imageBuilt) await docker(["image", "rm", image]);
}
