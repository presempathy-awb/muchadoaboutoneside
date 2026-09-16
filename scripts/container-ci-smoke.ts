import { resolve } from "node:path";
import { project } from "../server/project";

const index = Bun.argv.indexOf("--image");
const image = index >= 0 ? Bun.argv[index + 1] : undefined;
if (!image || image.startsWith("--"))
  throw new Error(
    "usage: bun scripts/container-ci-smoke.ts --image <built-image>",
  );
const name = `muchado-ci-smoke-${crypto.randomUUID()}`;
let created = false;
async function docker(args: string[]) {
  const child = Bun.spawn(["docker", ...args], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, err, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0) throw new Error(`docker ${args[0]} failed: ${err || out}`);
  return out.trim();
}
try {
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
  created = true;
  const state = JSON.parse(await docker(["inspect", name]))[0];
  if (
    state.Config.User !== "1000:1000" ||
    !state.HostConfig.ReadonlyRootfs ||
    !state.HostConfig.CapDrop.includes("ALL") ||
    !state.HostConfig.SecurityOpt.includes("no-new-privileges:true") ||
    state.NetworkSettings.Ports["3001/tcp"]?.[0]?.HostIp !== "127.0.0.1"
  )
    throw new Error("Container hardening or loopback binding missing");
  // The runner may be in a bridge network: execute HTTP checks in the target
  // container instead of assuming its host loopback is reachable from CI.
  console.log(
    await docker([
      "exec",
      name,
      "/usr/local/bin/bun",
      "-e",
      `
    const origin = 'http://127.0.0.1:3001';
    let ready = false;
    for (let attempt=0; attempt<40; attempt++) {
      try { const r=await fetch(origin+'/api/health'); if(r.ok && (await r.json()).status==='ok') { ready=true; break; } } catch {}
      await Bun.sleep(500);
    }
    if (!ready) throw new Error('Container API did not become healthy');
    for (const path of ['/', '/instructions', '/six-foot', '/projection']) {
      const r=await fetch(origin+path);
      if(!r.ok || !(await r.text()).includes('<div id="root"></div>')) throw new Error('Route failed: '+path);
    }
    const assets=${JSON.stringify(project.assets)};
    for(const asset of assets) {
      const r=await fetch(origin+asset.url);
      const hash=new Bun.CryptoHasher('sha256').update(await r.arrayBuffer()).digest('hex');
      if(!r.ok || hash!==asset.sha256) throw new Error('Original download failed: '+asset.name);
    }
    for(const path of ['/guide/calligraphy-guide.pdf', '/fabrication/laser/panel-kit.zip', '/fonts/OFL.txt']) {
      const r=await fetch(origin+path);
      if(!r.ok || !Buffer.from(await r.arrayBuffer()).equals(Buffer.from(await Bun.file('/app/dist'+path).arrayBuffer()))) throw new Error('Generated download failed: '+path);
    }
    for(const path of ['/api/assets/jill-calligraphy.jpg', '/source/reference/jill-calligraphy.jpg', '/api/missing'])
      if((await fetch(origin+path)).status!==404) throw new Error('Private or missing path exposed: '+path);
    const drafts=await fetch(origin+'/api/collab/status').then(r=>r.json());
    if(drafts.enabled!==false || drafts.rooms.length!==0) throw new Error('Draft persistence enabled');
    try { await Bun.write('/app/unexpected-write','test'); throw new Error('Runtime filesystem is writable'); }
    catch(e) { if(e.code!=='EROFS' && e.code!=='EACCES') throw e; }
    const {readdir}=await import('node:fs/promises');
    if(JSON.stringify(await readdir('/app/source'))!==JSON.stringify(['assets'])) throw new Error('Unexpected runtime source');
    const names=(await readdir('/app/source/assets')).sort();
    if(JSON.stringify(names)!==JSON.stringify(['manifest.json', ...assets.map(a=>a.name)].sort())) throw new Error('Unexpected runtime assets');
    console.log('CI container HTTP smoke passed: routes, download hashes, privacy, drafts off, read-only filesystem.');
  `,
    ]),
  );
  let healthy = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    const health = JSON.parse(await docker(["inspect", name]))[0].State.Health;
    if (health?.Status === "healthy") {
      healthy = true;
      break;
    }
    await Bun.sleep(500);
  }
  if (!healthy) throw new Error("Docker HEALTHCHECK failed");
  console.log(
    "CI runtime gate passed: Docker healthcheck, UID1000, capabilities dropped, no new privileges, loopback binding.",
  );
} finally {
  if (created) await docker(["rm", "--force", name]);
}
