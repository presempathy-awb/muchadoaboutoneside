import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

type Point = [number, number, number];
interface Gltf {
  nodes: Array<{
    matrix?: number[];
    translation?: number[];
    rotation?: number[];
    scale?: number[];
  }>;
  meshes: Array<{
    primitives: Array<{
      attributes: Record<string, number>;
      indices: number;
      mode: number;
      material: number;
    }>;
  }>;
  accessors: Array<{
    componentType: number;
    type: string;
    bufferView: number;
    byteOffset?: number;
    count: number;
  }>;
  bufferViews: Array<{
    byteOffset?: number;
    byteLength: number;
    byteStride?: number;
  }>;
  materials: Array<{
    pbrMetallicRoughness: {
      baseColorTexture: { index: number };
      metallicFactor: number;
      roughnessFactor: number;
    };
  }>;
  textures: Array<{ source: number }>;
  images: Array<{ bufferView: number; mimeType: string }>;
}

function at<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined) throw new Error(`Missing entry at index ${index}`);
  return value;
}

function orientedFace(ids: number[]) {
  return ids
    .map((_, start) => [...ids.slice(start), ...ids.slice(0, start)].join(","))
    .sort()[0];
}

describe("small foil GLB independent binary verification", () => {
  test("renders every original STL triangle with the same orientation and embedded foil artwork", async () => {
    const stl = await readFile(
      new URL(
        "../public/fabrication/print/muchado-maquette-180mm.stl",
        import.meta.url,
      ),
    );
    const glb = await readFile(
      new URL(
        "../public/fabrication/small-foil/muchado-foil-180mm.glb",
        import.meta.url,
      ),
    );
    expect(glb.toString("ascii", 0, 4)).toBe("glTF");
    expect(glb.readUInt32LE(4)).toBe(2);
    expect(glb.readUInt32LE(8)).toBe(glb.length);
    expect(glb.readUInt32LE(16)).toBe(0x4e4f534a);
    const jsonLength = glb.readUInt32LE(12);
    const doc: Gltf = JSON.parse(glb.toString("utf8", 20, 20 + jsonLength));
    const binaryHeader = 20 + jsonLength;
    expect(glb.readUInt32LE(binaryHeader + 4)).toBe(0x004e4942);
    const binary = glb.subarray(binaryHeader + 8);

    // The exported coordinates are already Y-up metres. A hidden node transform
    // would invalidate a comparison of the raw vertex data with the print STL.
    for (const node of doc.nodes) {
      expect(
        node.matrix ?? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      ).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      expect(node.translation ?? [0, 0, 0]).toEqual([0, 0, 0]);
      expect(node.rotation ?? [0, 0, 0, 1]).toEqual([0, 0, 0, 1]);
      expect(node.scale ?? [1, 1, 1]).toEqual([1, 1, 1]);
    }
    expect(doc.meshes).toHaveLength(1);
    expect(doc.meshes[0]?.primitives).toHaveLength(1);
    const primitive = doc.meshes[0]?.primitives[0];
    if (!primitive) throw new Error("Foil mesh primitive missing");
    expect(primitive.mode).toBe(4);

    function accessor(index: number | undefined, components: number) {
      if (index === undefined) throw new Error("Required GLB accessor missing");
      const item = doc.accessors[index];
      if (!item) throw new Error("Invalid GLB accessor index");
      const view = doc.bufferViews[item.bufferView];
      if (!view) throw new Error("Invalid GLB buffer view");
      expect(item.type).toBe(components === 1 ? "SCALAR" : `VEC${components}`);
      const bytes = item.componentType === 5123 ? 2 : 4;
      expect([5123, 5125, 5126]).toContain(item.componentType);
      const stride = view.byteStride ?? components * bytes;
      const offset = (view.byteOffset ?? 0) + (item.byteOffset ?? 0);
      return Array.from({ length: item.count }, (_, row) =>
        Array.from({ length: components }, (_, column) => {
          const position = offset + row * stride + column * bytes;
          return item.componentType === 5126
            ? binary.readFloatLE(position)
            : item.componentType === 5123
              ? binary.readUInt16LE(position)
              : binary.readUInt32LE(position);
        }),
      );
    }

    const positions = accessor(primitive.attributes.POSITION, 3);
    const uv = accessor(primitive.attributes.TEXCOORD_0, 2);
    const indices = accessor(primitive.indices, 1).flat();
    const triangleCount = stl.readUInt32LE(80);
    expect(triangleCount).toBe(5_490);
    expect(indices).toHaveLength(triangleCount * 3);
    expect(positions).toHaveLength(triangleCount * 3);
    expect(uv).toHaveLength(positions.length);

    const tolerance = 0.01;
    const vertices: Point[] = [];
    const exactIds = new Map<string, number>();
    const cells = new Map<string, number[]>();
    const cell = (point: number[]) =>
      point.map((value) => Math.floor(value / tolerance));
    const originalFaces: string[] = [];
    for (let face = 0; face < triangleCount; face++) {
      const ids: number[] = [];
      for (let corner = 0; corner < 3; corner++) {
        const offset = 84 + face * 50 + 12 + corner * 12;
        const point: Point = [
          stl.readFloatLE(offset),
          stl.readFloatLE(offset + 4),
          stl.readFloatLE(offset + 8),
        ];
        const key = point.join(",");
        let id = exactIds.get(key);
        if (id === undefined) {
          id = vertices.length;
          vertices.push(point);
          exactIds.set(key, id);
          const bucket = cell(point).join(",");
          cells.set(bucket, [...(cells.get(bucket) ?? []), id]);
        }
        ids.push(id);
      }
      originalFaces.push(orientedFace(ids) ?? "");
    }
    const mapped = positions.map((position) => {
      const point = [
        at(position, 0) * 1000,
        -at(position, 2) * 1000,
        at(position, 1) * 1000,
      ];
      const bucket = cell(point);
      let nearest = -1;
      let distance = Number.POSITIVE_INFINITY;
      for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
          for (let z = -1; z <= 1; z++) {
            const key = [
              at(bucket, 0) + x,
              at(bucket, 1) + y,
              at(bucket, 2) + z,
            ].join(",");
            for (const id of cells.get(key) ?? []) {
              const candidate = at(vertices, id);
              const delta = Math.hypot(
                ...point.map((value, axis) => value - at(candidate, axis)),
              );
              if (delta < distance) {
                nearest = id;
                distance = delta;
              }
            }
          }
        }
      }
      expect(distance).toBeLessThan(tolerance);
      return nearest;
    });
    const renderedFaces: string[] = [];
    for (let offset = 0; offset < indices.length; offset += 3) {
      const face = indices.slice(offset, offset + 3);
      renderedFaces.push(
        orientedFace(face.map((index) => at(mapped, index))) ?? "",
      );
      const coordinates = face.map((index) => at(uv, index));
      for (const pair of coordinates) {
        expect(pair.every(Number.isFinite)).toBeTrue();
        expect(pair[0]).toBeGreaterThanOrEqual(-0.05);
        expect(pair[0]).toBeLessThanOrEqual(1.05);
        expect(pair[1]).toBeGreaterThanOrEqual(0);
        expect(pair[1]).toBeLessThanOrEqual(1);
      }
      // A seam triangle may cross U=1 slightly, but must not interpolate
      // across most of the poem atlas to get there.
      expect(
        Math.max(...coordinates.map((pair) => at(pair, 0))) -
          Math.min(...coordinates.map((pair) => at(pair, 0))),
      ).toBeLessThan(0.2);
    }
    expect(renderedFaces.sort()).toEqual(originalFaces.sort());

    const material = doc.materials[primitive.material]?.pbrMetallicRoughness;
    if (!material) throw new Error("Metallic foil material missing");
    expect(material.metallicFactor).toBeGreaterThan(0.5);
    expect(material.roughnessFactor).toBeGreaterThan(0);
    expect(material.roughnessFactor).toBeLessThan(1);
    const image = at(
      doc.images,
      at(doc.textures, material.baseColorTexture.index).source,
    );
    expect(image.mimeType).toBe("image/png");
    const imageView = at(doc.bufferViews, image.bufferView);
    const png = binary.subarray(
      imageView.byteOffset ?? 0,
      (imageView.byteOffset ?? 0) + imageView.byteLength,
    );
    expect(
      png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    ).toBeTrue();
    expect(png.toString("ascii", 12, 16)).toBe("IHDR");
    expect(png.readUInt32BE(16)).toBeGreaterThanOrEqual(2048);
    expect(png.readUInt32BE(20)).toBeGreaterThanOrEqual(64);
    expect(png[24]).toBe(8);
    expect([2, 6]).toContain(png.readUInt8(25));
  });
});
