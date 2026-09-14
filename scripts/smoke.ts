import { resolve } from "node:path";
import { createApp } from "../server/app";
import { project } from "../server/project";

const app = createApp({
  staticDir: resolve(import.meta.dir, "../dist"),
}).listen({
  hostname: "127.0.0.1",
  port: 0,
});
const server = app.server;
if (!server) throw new Error("Smoke server did not start");
const origin = `http://127.0.0.1:${server.port}`;

try {
  let html = "";
  for (const route of ["/", "/foil", "/studio", "/assembly", "/archive"]) {
    const response = await fetch(`${origin}${route}`);
    if (!response.ok) throw new Error(`${route} returned ${response.status}`);
    html = await response.text();
    if (!html.includes('<div id="root"></div>'))
      throw new Error(`${route} did not serve the app`);
  }
  const entryAssets = [
    ...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g),
  ].map((match) => match[1]);
  if (entryAssets.length < 2)
    throw new Error("Production JS/CSS entries missing");
  for (const asset of entryAssets) {
    const response = await fetch(`${origin}${asset}`);
    if (!response.ok || !(await response.arrayBuffer()).byteLength)
      throw new Error(`Built asset unavailable: ${asset}`);
  }
  const metadata = await fetch(`${origin}/api/project`).then((response) =>
    response.json(),
  );
  if (metadata.assets.length !== 4)
    throw new Error("Project metadata unavailable");
  for (const asset of project.assets) {
    const response = await fetch(`${origin}${asset.url}`);
    const hash = new Bun.CryptoHasher("sha256")
      .update(await response.arrayBuffer())
      .digest("hex");
    if (!response.ok || hash !== asset.sha256)
      throw new Error(`Download mismatch: ${asset.name}`);
  }
  for (const [path, type] of [
    ["/fonts/GreatVibes-Regular.ttf", "font/ttf"],
    ["/fonts/OFL.txt", "text/plain"],
    ["/editions/endless-inscription-study.svg", "image/svg+xml"],
    ["/editions/much-ado-about-one-side.txt", "text/plain"],
    ["/fabrication/laser/marking-master.svg", "image/svg+xml"],
    ["/fabrication/laser/denhac-test-coupon.svg", "image/svg+xml"],
    ["/fabrication/laser/assembly-map.svg", "image/svg+xml"],
    ["/fabrication/laser/manifest.json", "application/json"],
    ["/fabrication/laser/panel-kit.zip", "application/zip"],
    ["/fabrication/laser/representative-fit-kit.zip", "application/zip"],
    ["/fabrication/laser/README.txt", "text/plain"],
    ["/fabrication/print/muchado-maquette-180mm.stl", "model/stl"],
    ["/fabrication/print/muchado-maquette-180mm.glb", "model/gltf-binary"],
    ["/fabrication/print/README.txt", "text/plain"],
    ["/fabrication/small-foil/marking-master.svg", "image/svg+xml"],
    ["/fabrication/small-foil/marking-preview.svg", "image/svg+xml"],
    ["/fabrication/small-foil/test-coupon.svg", "image/svg+xml"],
    ["/fabrication/small-foil/muchado-foil-180mm.glb", "model/gltf-binary"],
    ["/fabrication/small-foil/foil-kit-180mm.zip", "application/zip"],
    ["/fabrication/small-foil/manifest.json", "application/json"],
    ["/fabrication/small-foil/README.txt", "text/plain"],
    ["/licenses/LICENSE-MIT.txt", "text/plain"],
    ["/licenses/LICENSE-APACHE.txt", "text/plain"],
    ["/licenses/REUSE.txt", "text/plain"],
    ["/licenses/THIRD-PARTY-NOTICES.txt", "text/plain"],
  ]) {
    const response = await fetch(`${origin}${path}`);
    const downloaded = await response.arrayBuffer();
    const expected = await Bun.file(
      resolve(import.meta.dir, `../public${path}`),
    ).arrayBuffer();
    if (
      !response.ok ||
      !response.headers.get("content-type")?.includes(type ?? "") ||
      !Buffer.from(downloaded).equals(Buffer.from(expected))
    )
      throw new Error(`Inscription asset mismatch: ${path}`);
  }
  for (const path of [
    "/source/reference/jill-calligraphy.jpg",
    "/api/assets/jill-calligraphy.jpg",
    "/source/claude/share-shell.html",
  ]) {
    if ((await fetch(`${origin}${path}`)).status !== 404)
      throw new Error(`Private source path exposed: ${path}`);
  }
  const missingApi = await fetch(`${origin}/api/missing`);
  if (
    missingApi.status !== 404 ||
    !missingApi.headers.get("content-type")?.includes("application/json")
  )
    throw new Error("API fallback is incorrect");
  console.log(
    "Production HTTP smoke passed: 5 routes, bundled entries, metadata, 4 original downloads, 25 inscription/fabrication/license assets, private-path rejection, API 404.",
  );
} finally {
  await app.stop();
}
