import { resolve } from "node:path";
import { createApp } from "../server/app";
import { project } from "../server/project";
import { FABRICATION_DOWNLOADS } from "../shared/fabrication-downloads";
import { REFERENCE_IMAGES } from "../shared/reference-gallery";

const app = createApp({
  staticDir: resolve(import.meta.dir, "../dist"),
}).listen({
  hostname: "127.0.0.1",
  port: 0,
});
const server = app.server;
if (!server) throw new Error("Smoke server did not start");
const origin = `http://127.0.0.1:${server.port}`;
const stableCache = "no-store";
const immutableCache = "public, max-age=31536000, immutable";
const versionedFabricationDownloads = new Map(
  Object.values(FABRICATION_DOWNLOADS).map((url) => [
    new URL(url, origin).pathname,
    url,
  ]),
);

try {
  let html = "";
  for (const route of [
    "/",
    "/foil",
    "/scales",
    "/references",
    "/studio",
    "/assembly",
    "/archive",
    "/instructions",
    "/poem",
    "/projection",
    "/six-foot",
    "/calligraphy",
    "/calligraphy/practice",
    "/calligraphy/steps",
    "/calligraphy/templates",
    "/calligraphy/quick",
    "/calligraphy/details",
  ]) {
    const response = await fetch(`${origin}${route}`);
    if (!response.ok) throw new Error(`${route} returned ${response.status}`);
    if (response.headers.get("cache-control") !== stableCache)
      throw new Error(`${route} has an unsafe cache policy`);
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
    if (response.headers.get("cache-control") !== immutableCache)
      throw new Error(`Built asset is not immutable: ${asset}`);
  }
  const metadata = await fetch(`${origin}/api/project`).then((response) =>
    response.json(),
  );
  if (metadata.assets.length !== 4)
    throw new Error("Project metadata unavailable");
  for (const asset of project.assets) {
    const response = await fetch(`${origin}${asset.url}?v=${asset.sha256}`);
    const hash = new Bun.CryptoHasher("sha256")
      .update(await response.arrayBuffer())
      .digest("hex");
    if (!response.ok || hash !== asset.sha256)
      throw new Error(`Download mismatch: ${asset.name}`);
    if (response.headers.get("cache-control") !== stableCache)
      throw new Error(`Download has an unsafe cache policy: ${asset.name}`);
  }
  for (const [path, type] of [
    ["/fonts/GreatVibes-Regular.ttf", "font/ttf"],
    ["/fonts/OFL.txt", "text/plain"],
    ["/editions/endless-inscription-study.svg", "image/svg+xml"],
    ["/editions/much-ado-about-one-side.txt", "text/plain"],
    ["/editions/much-ado-about-one-side-script.pdf", "application/pdf"],
    ["/editions/endless-inscription-study-extended.svg", "image/svg+xml"],
    ["/editions/much-ado-about-one-side-extended.txt", "text/plain"],
    [
      "/editions/much-ado-about-one-side-extended-script.pdf",
      "application/pdf",
    ],
    ["/fabrication/laser/marking-master.svg", "image/svg+xml"],
    ["/fabrication/laser/jaw-marking-master.svg", "image/svg+xml"],
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
    ["/guide/calligraphy-guide.pdf", "application/pdf"],
    ["/guide/copperplate-24-lines.pdf", "application/pdf"],
    ["/guide/copperplate-maker.html", "text/html"],
    ["/guide/calligraphy-guide.html", "text/html"],
    ["/guide/calligraphy-guide-extended.pdf", "application/pdf"],
    ["/guide/calligraphy-guide-extended.html", "text/html"],
    ["/licenses/LICENSE-MIT.txt", "text/plain"],
    ["/licenses/LICENSE-APACHE.txt", "text/plain"],
    ["/licenses/REUSE.txt", "text/plain"],
    ["/licenses/THIRD-PARTY-NOTICES.txt", "text/plain"],
  ] as const) {
    const expected = await Bun.file(
      resolve(import.meta.dir, `../public${path}`),
    ).arrayBuffer();
    const requestPath = versionedFabricationDownloads.get(path) ?? path;
    if (path.endsWith(".zip") && requestPath === path)
      throw new Error(`ZIP lacks a versioned download URL: ${path}`);
    const response = await fetch(`${origin}${requestPath}`);
    const downloaded = await response.arrayBuffer();
    if (
      !response.ok ||
      !response.headers.get("content-type")?.includes(type ?? "") ||
      !Buffer.from(downloaded).equals(Buffer.from(expected)) ||
      response.headers.get("cache-control") !== stableCache
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
  for (const reference of REFERENCE_IMAGES) {
    const response = await fetch(`${origin}${reference.path}`);
    const bytes = await response.arrayBuffer();
    const hash = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
    if (
      !response.ok ||
      hash !== reference.sha256 ||
      bytes.byteLength !== reference.bytes ||
      !response.headers.get("content-type")?.includes(reference.mediaType)
    )
      throw new Error(`Reference original mismatch: ${reference.file}`);
  }
  const collab = await fetch(`${origin}/api/collab/status`);
  if (
    !collab.ok ||
    collab.headers.get("cache-control") !== stableCache ||
    JSON.stringify(await collab.json()) !==
      JSON.stringify({ enabled: false, rooms: [] })
  )
    throw new Error("Live poem drafts must stay off without COLLAB_DIR");
  if (
    (await fetch(`${origin}/api/collab/rooms/poem-canonical/text`)).status !==
    404
  )
    throw new Error("Draft rooms are exposed without COLLAB_DIR");
  const missingApi = await fetch(`${origin}/api/missing`);
  if (
    missingApi.status !== 404 ||
    !missingApi.headers.get("content-type")?.includes("application/json")
  )
    throw new Error("API fallback is incorrect");
  console.log(
    "Production HTTP smoke passed: page routes, bundled entries, metadata, original downloads, inscription/fabrication/guide/license assets, private-path rejection, drafts off, API 404.",
  );
} finally {
  await app.stop();
}
