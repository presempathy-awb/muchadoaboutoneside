#!/usr/bin/env python3
"""Derive local radial deformation fields on the unchanged boolean-union STL.

Dependency-free; nearest *operand surface* barycentric projection avoids choosing
an unrelated centerline at a crossing. Base/contact vertices are fixed, and the
attachment blends into the tube over 4 mm. Union seams stay fixed within 1 mm
and blend through an 8 mm collar, preventing incompatible operand frames from
pulling tiny boolean slivers apart. This is preview metadata, not a new
certified printable solid.
"""

import argparse
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "shared/scale-maquette-body.json"


def sub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def add(a, b):
    return tuple(x + y for x, y in zip(a, b))


def mul(a, s):
    return tuple(x * s for x in a)


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def length(a):
    return math.sqrt(dot(a, a))


def mix(a, b, t):
    return add(mul(a, 1 - t), mul(b, t))


def closest(p, a, b, c):
    ab, ac, ap = sub(b, a), sub(c, a), sub(p, a)
    d1, d2 = dot(ab, ap), dot(ac, ap)
    if d1 <= 0 and d2 <= 0:
        return a, (1, 0, 0)
    bp = sub(p, b)
    d3, d4 = dot(ab, bp), dot(ac, bp)
    if d3 >= 0 and d4 <= d3:
        return b, (0, 1, 0)
    vc = d1 * d4 - d3 * d2
    if vc <= 0 and d1 >= 0 and d3 <= 0:
        v = d1 / (d1 - d3)
        return add(a, mul(ab, v)), (1 - v, v, 0)
    cp = sub(p, c)
    d5, d6 = dot(ab, cp), dot(ac, cp)
    if d6 >= 0 and d5 <= d6:
        return c, (0, 0, 1)
    vb = d5 * d2 - d1 * d6
    if vb <= 0 and d2 >= 0 and d6 <= 0:
        w = d2 / (d2 - d6)
        return add(a, mul(ac, w)), (1 - w, 0, w)
    va = d3 * d6 - d5 * d4
    if va <= 0 and d4 - d3 >= 0 and d5 - d6 >= 0:
        w = (d4 - d3) / ((d4 - d3) + (d5 - d6))
        return mix(b, c, w), (0, 1 - w, w)
    denominator = va + vb + vc
    if denominator <= 0:
        raise ValueError("Degenerate operand triangle")
    v, w = vb / denominator, vc / denominator
    return add(a, add(mul(ab, v), mul(ac, w))), (1 - v - w, v, w)


def generate():
    sections_path = ROOT / "shared/foil-sections.json"
    chart_path = ROOT / "shared/scale-maquette.json"
    source = json.loads(sections_path.read_text())
    data = json.loads(chart_path.read_text())
    raw = [
        p
        for key in ("sections", "upperHeadSections", "jawSections")
        for s in source[key]
        for p in s["perimeter"]
    ]
    scale = 176.8 / (max(p[1] for p in raw) - min(p[1] for p in raw))
    translation = (
        -(max(p[0] for p in raw) + min(p[0] for p in raw)) * scale / 2,
        -(max(p[2] for p in raw) + min(p[2] for p in raw)) * scale / 2,
        3.2 - min(p[1] for p in raw) * scale,
    )
    orient = lambda p: add(mul((p[0], p[2], p[1]), scale), translation)
    triangles = []
    for operand, group in enumerate(
        (source["sections"] + source["upperHeadSections"], source["jawSections"])
    ):
        rings = []
        centers = []
        for section in group:
            center = orient(section["center"])
            radial = [sub(orient(p), center) for p in section["perimeter"]]
            factor = max(1, 1.2 / min(length(p) for p in radial))
            rings.append([add(center, mul(p, factor)) for p in radial])
            centers.append(center)
        sampled = []
        for i in range(len(rings) - 1):
            for t in (0, 0.5):
                sampled.append(
                    (
                        [mix(a, b, t) for a, b in zip(rings[i], rings[i + 1])],
                        mix(centers[i], centers[i + 1], t),
                    )
                )
        sampled.append((rings[-1], centers[-1]))
        vertices = []
        widths = []
        depths = []
        for ring, center in sampled:
            axis = sub(ring[0], center)
            axis = (axis[0], 0, axis[2])
            axis = mul(axis, 1 / length(axis))
            for p in ring:
                radial = sub(p, center)
                vertices.append(p)
                widths.append(mul(axis, dot(radial, axis)))
                depths.append((0, radial[1], 0))
        faces = []
        for r in range(len(sampled) - 1):
            for i in range(32):
                j = (i + 1) % 32
                a = r * 32
                b = (r + 1) * 32
                faces.extend(((a + i, a + j, b + j), (a + i, b + j, b + i)))
        for end, ring in ((0, sampled[0][0]), (len(sampled) - 1, sampled[-1][0])):
            idx = len(vertices)
            vertices.append(tuple(sum(p[k] for p in ring) / 32 for k in range(3)))
            widths.append((0, 0, 0))
            depths.append((0, 0, 0))
            for i in range(32):
                faces.append((idx, end * 32 + i, end * 32 + (i + 1) % 32))
        for face in faces:
            points = [vertices[i] for i in face]
            bounds = [
                (min(p[k] for p in points), max(p[k] for p in points)) for k in range(3)
            ]
            triangles.append(
                (
                    points,
                    [widths[i] for i in face],
                    [depths[i] for i in face],
                    bounds,
                    operand,
                )
            )
    du = []
    dv = []
    fixed = []
    maximum = 0
    for index in range(len(data["positionsMm"]) // 3):
        x, z, negative_y = data["positionsMm"][index * 3 : index * 3 + 3]
        p = (x, -negative_y, z)
        if z <= 4.00001:
            du.extend((0, 0, 0))
            dv.extend((0, 0, 0))
            fixed.append(index)
            continue
        nearest = [float("inf"), float("inf")]
        choices = [[], []]
        for points, widths, depths, bounds, operand in triangles:
            best = nearest[operand]
            lower = sum(
                (low - v if v < low else v - high if v > high else 0) ** 2
                for v, (low, high) in zip(p, bounds)
            )
            if lower > best + 1e-9:
                continue
            q, bary = closest(p, *points)
            delta = sub(q, p)
            distance = dot(delta, delta)
            if distance < best - 1e-9:
                nearest[operand] = distance
                choices[operand] = []
            if distance <= nearest[operand] + 1e-9:
                choices[operand].append((widths, depths, bary))
        operand = 0 if nearest[0] <= nearest[1] else 1
        best = nearest[operand]
        candidates = choices[operand]
        maximum = max(maximum, math.sqrt(best))
        blend = min(1, max(0, (z - 4) / 4))
        blend = blend * blend * (3 - 2 * blend)
        # A fixed union seam with a broad smooth collar avoids incompatible
        # body/jaw radial frames pulling boolean sliver vertices apart.
        separation = max(0, math.sqrt(nearest[1 - operand]) - math.sqrt(best))
        junction = min(1, max(0, (separation - 1) / 8))
        blend *= junction * junction * (3 - 2 * junction)
        fields = []
        for slot in (0, 1):
            vector = tuple(
                sum(
                    sum(item[slot][j][k] * item[2][j] for j in range(3))
                    for item in candidates
                )
                / len(candidates)
                * blend
                for k in range(3)
            )
            fields.append((vector[0], vector[2], -vector[1]))
        du.extend(round(v, 10) for v in fields[0])
        dv.extend(round(v, 10) for v in fields[1])
    manifest = json.loads(
        (ROOT / "public/fabrication/small-foil/manifest.json").read_text()
    )
    if maximum > manifest["projection"]["maximumCornerDistanceAboveBaseMm"] + 1e-5:
        raise ValueError(
            f"Operand projection exceeded the existing remeshing tolerance: {maximum} mm"
        )
    return {
        "schema": 1,
        "generatorSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "stlSha256": data["stlSha256"],
        "sourceChartsSha256": hashlib.sha256(chart_path.read_bytes()).hexdigest(),
        "sourceSectionsSha256": hashlib.sha256(sections_path.read_bytes()).hexdigest(),
        "method": "nearest operand-surface barycentric radial fields; fixed plinth; smooth 4 mm attachment and fixed 1 mm union seam and smooth 8 mm operand-junction collars",
        "maximumProjectionDistanceMm": maximum,
        "fixedVertices": fixed,
        "widthDisplacementsMm": du,
        "depthDisplacementsMm": dv,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    expected = json.dumps(generate(), separators=(",", ":")) + "\n"
    if args.check:
        if OUTPUT.read_text() != expected:
            raise SystemExit("scale-maquette-body.json is stale")
        print("Local maquette radial fields are current")
    else:
        OUTPUT.write_text(expected)
        print(f"Wrote {OUTPUT.relative_to(ROOT)}")
