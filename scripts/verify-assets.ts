import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const expected = {
  "snake_build.stl":
    "08840b84c9a963c650c13d3a004e792ddcc0850321ede8986a180a86942a75d3",
  "snake_build.glb":
    "81167fb7416443e21aab53379e7f6a2d5b43493b9f811829313e7f31e2555150",
  "snake_build_viewer.html":
    "694dc1c4ab7c9db05a6ed316551c59cc3b49165e36eced673f2e26c6e7805df9",
  "snake_build.obj":
    "776e6563a29d3ac0f0b8d4a03c9927af7c1dceacf0b77008db497bc08483a5d6",
} as const;

const assetDir = resolve(import.meta.dir, "../source/assets");

for (const [name, expectedHash] of Object.entries(expected)) {
  const bytes = await readFile(resolve(assetDir, name));
  const actualHash = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
  if (actualHash !== expectedHash) throw new Error(`${name}: SHA-256 mismatch`);
}

const glb = await readFile(resolve(assetDir, "snake_build.glb"));
if (glb.toString("ascii", 0, 4) !== "glTF")
  throw new Error("GLB magic header is invalid");
if (glb.readUInt32LE(4) !== 2) throw new Error("GLB version is not 2");
if (glb.readUInt32LE(8) !== glb.byteLength)
  throw new Error("GLB declared length does not match its bytes");
if (glb.toString("ascii", 16, 20) !== "JSON")
  throw new Error("GLB first chunk is not JSON");

const jsonLength = glb.readUInt32LE(12);
const gltf = JSON.parse(
  glb.toString("utf8", 20, 20 + jsonLength).trimEnd(),
) as {
  meshes: Array<{ primitives: Array<{ indices?: number; mode?: number }> }>;
  accessors: Array<{ count: number }>;
};

let glbTriangles = 0;
for (const mesh of gltf.meshes) {
  for (const primitive of mesh.primitives) {
    if ((primitive.mode ?? 4) !== 4 || primitive.indices === undefined) {
      throw new Error(
        "GLB contains an unsupported non-indexed or non-triangle primitive",
      );
    }
    const accessor = gltf.accessors[primitive.indices];
    if (!accessor)
      throw new Error(`GLB references missing accessor ${primitive.indices}`);
    glbTriangles += accessor.count / 3;
  }
}

if (gltf.meshes.length !== 7)
  throw new Error(`GLB mesh count is ${gltf.meshes.length}, expected 7`);
if (glbTriangles !== 13_876)
  throw new Error(`GLB triangle count is ${glbTriangles}, expected 13876`);

const stl = await readFile(resolve(assetDir, "snake_build.stl"));
const stlTriangles = stl.readUInt32LE(80);
if (stlTriangles !== 13_876)
  throw new Error(`STL triangle count is ${stlTriangles}, expected 13876`);
if (84 + stlTriangles * 50 !== stl.byteLength)
  throw new Error("STL byte length does not match its triangle count");

console.log(
  `Verified ${Object.keys(expected).length} archived assets, 7 GLB meshes, and 13,876 triangles.`,
);
