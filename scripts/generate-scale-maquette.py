#!/usr/bin/env python3
"""Rebuild exact-STL hinge charts for the interactive scale study, without dependencies."""

import argparse
import hashlib
import json
import math
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
STL = ROOT / "public/fabrication/print/muchado-maquette-180mm.stl"
MANIFEST = ROOT / "public/fabrication/small-foil/manifest.json"
OUTPUT = ROOT / "shared/scale-maquette.json"


def distance(a, b):
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def generate():
    source = STL.read_bytes()
    manifest = json.loads(MANIFEST.read_text())
    source_hash = hashlib.sha256(source).hexdigest()
    if source_hash != manifest["source"]["stlSha256"]:
        raise ValueError("The physical chart manifest does not match the STL")
    count = struct.unpack_from("<I", source, 80)[0]
    vertices, faces, ids = [], [], {}
    for face in range(count):
        indices = []
        for corner in range(3):
            point = struct.unpack_from("<3f", source, 84 + face * 50 + 12 + corner * 12)
            if point not in ids:
                ids[point] = len(vertices)
                vertices.append(point)
            indices.append(ids[point])
        faces.append(indices)

    charts, covered = [], set()
    for patch in manifest["patches"]:
        first = faces[patch["faceIds"][0]]
        a, b, c = (vertices[index] for index in first)
        ab, ac, bc = distance(a, b), distance(a, c), distance(b, c)
        x = (ac * ac + ab * ab - bc * bc) / (2 * ab)
        flat = {first[0]: (0.0, 0.0), first[1]: (ab, 0.0), first[2]: (x, math.sqrt(max(0, ac * ac - x * x)))}
        accepted = [first]
        for face_id in patch["faceIds"][1:]:
            face = faces[face_id]
            shared = [index for index in face if index in flat]
            unknown = [index for index in face if index not in flat]
            if len(shared) != 2 or len(unknown) != 1:
                raise ValueError(f"{patch['id']} is not the recorded connected hinge chart")
            ia, ib = shared
            third = unknown[0]
            parent = next(prior for prior in accepted if ia in prior and ib in prior)
            opposite = next(index for index in parent if index not in shared)
            a, b = flat[ia], flat[ib]
            length = distance(a, b)
            da, db = distance(vertices[ia], vertices[third]), distance(vertices[ib], vertices[third])
            along = (da * da + length * length - db * db) / (2 * length)
            height = math.sqrt(max(0, da * da - along * along))
            dx, dy = (b[0] - a[0]) / length, (b[1] - a[1]) / length
            opposite_point = flat[opposite]
            side = dx * (opposite_point[1] - a[1]) - dy * (opposite_point[0] - a[0])
            sign = -1 if side > 0 else 1
            flat[third] = (a[0] + dx * along - dy * height * sign, a[1] + dy * along + dx * height * sign)
            accepted.append(face)

        local_ids = list(flat)
        lookup = {value: index for index, value in enumerate(local_ids)}
        minimum = [min(point[axis] for point in flat.values()) for axis in range(2)]
        dimensions = [max(point[axis] for point in flat.values()) - minimum[axis] for axis in range(2)]
        uvs = [[(flat[index][0] - minimum[0]) / dimensions[0], 1 - (flat[index][1] - minimum[1]) / dimensions[1]] for index in local_ids]
        indices = [lookup[index] for face_id in patch["faceIds"] for index in faces[face_id]]
        for offset in range(0, len(indices), 3):
            a, b, c = (uvs[index] for index in indices[offset:offset + 3])
            if (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) >= 0:
                raise ValueError("Physical chart orientation is inconsistent")
        if covered.intersection(patch["faceIds"]):
            raise ValueError("Duplicate source faces")
        covered.update(patch["faceIds"])
        charts.append({"id": patch["id"], "vertices": local_ids, "uvs": [round(value, 12) for uv in uvs for value in uv], "indices": indices, "widthMm": dimensions[0], "heightMm": dimensions[1]})
    if len(covered) != manifest["coverage"]["exposedTriangleCount"]:
        raise ValueError("Chart coverage changed")
    return {"schema": 1, "stlSha256": source_hash, "chartManifestSha256": hashlib.sha256(MANIFEST.read_bytes()).hexdigest(), "sourceHeightMm": 180, "coveredTriangles": len(covered), "excludedUndersideTriangles": count - len(covered), "positionsMm": [value for x, y, z in vertices for value in (x, z, -y)], "indices": [index for face in faces for index in face], "charts": charts}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify the committed derived asset without modifying it")
    args = parser.parse_args()
    expected = json.dumps(generate(), separators=(",", ":")) + "\n"
    if args.check:
        if OUTPUT.read_text() != expected:
            raise SystemExit("scale-maquette.json is stale; run scripts/generate-scale-maquette.py")
        print("Exact STL scale charts are current")
    else:
        OUTPUT.write_text(expected)
        print(f"Wrote {OUTPUT.relative_to(ROOT)} ({len(expected)} bytes)")
