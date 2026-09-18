import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";

interface Chunk {
  file: string;
  src?: string;
  isEntry?: boolean;
  imports?: string[];
  assets?: string[];
}

const root = resolve(import.meta.dir, "..");
const dist = resolve(root, "dist");
const manifest: Record<string, Chunk> = JSON.parse(
  await readFile(resolve(dist, ".vite/manifest.json"), "utf8"),
);

function staticClosure(start: string): Set<string> {
  const visited = new Set<string>();
  const pending = [start];
  while (pending.length) {
    const key = pending.pop();
    if (!key || visited.has(key)) continue;
    assert(manifest[key], `Missing manifest dependency ${key}`);
    visited.add(key);
    pending.push(...(manifest[key].imports ?? []));
  }
  return visited;
}

const fontAssets = await readdir(resolve(dist, "assets"));
const wasm = fontAssets.filter((file) => file.endsWith(".wasm"));
assert.equal(
  wasm.length,
  1,
  "Ship exactly one HarfBuzz core WASM, no subsetter",
);
assert(!fontAssets.some((file) => /subset.*\.wasm$|\.woff$/.test(file)));
const wasmBytes = await readFile(resolve(dist, "assets", wasm[0] ?? ""));
const installedWasm = await readFile(
  resolve(root, "node_modules/harfbuzzjs/dist/harfbuzz.wasm"),
);
const digest = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
assert.equal(digest(wasmBytes), digest(installedWasm), "Unexpected WASM bytes");
assert(
  wasmBytes.length <= 450_000,
  "HarfBuzz WASM exceeded the reviewed budget",
);

const woff2 = fontAssets.filter((file) => file.endsWith(".woff2"));
assert.equal(woff2.length, 6, "Only six selected Latin font previews may ship");
let previewBytes = 0;
for (const file of woff2)
  previewBytes += (await stat(resolve(dist, "assets", file))).size;
assert(
  previewBytes <= 200_000,
  "Fontsource previews exceeded the reviewed budget",
);

const checkedRoots = Object.entries(manifest).filter(
  ([key, chunk]) => chunk.isEntry || key === "src/pages/copperplate.tsx",
);
assert(checkedRoots.some(([key]) => key === "src/pages/copperplate.tsx"));
for (const [start] of checkedRoots) {
  for (const key of staticClosure(start)) {
    const chunk = manifest[key];
    assert(chunk);
    assert(
      !/harfbuzz|fontkit|fontsource/i.test(`${key} ${chunk.file}`),
      `Typography parser or preview eagerly imported by ${start}: ${key}`,
    );
    assert(
      !(chunk.assets ?? []).some((asset) => /\.(?:wasm|woff2)$/.test(asset)),
      `Typography binary eagerly imported by ${start}: ${key}`,
    );
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      checkedRoots: checkedRoots.map(([key]) => key),
      harfbuzz: {
        bytes: wasmBytes.length,
        gzipBytes: gzipSync(wasmBytes).length,
        sha256: digest(wasmBytes),
      },
      fontsource: { files: woff2.length, bytes: previewBytes },
      unusedSubsetter: false,
    },
    null,
    2,
  ),
);
