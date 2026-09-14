#!/usr/bin/env python3
"""Generate and validate the 180 mm printable Much Ado maquette.

Reproducible setup:
  python3 -m venv /tmp/muchado-print-venv
  /tmp/muchado-print-venv/bin/pip install -r scripts/print/requirements.txt
  /tmp/muchado-print-venv/bin/python scripts/generate-print.py
  /tmp/muchado-print-venv/bin/python scripts/generate-print.py --check
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

import numpy as np
import trimesh


ROOT = Path(__file__).resolve().parents[1]
SECTIONS_PATH = ROOT / "shared" / "foil-sections.json"
OUTPUT_DIR = ROOT / "public" / "fabrication" / "print"
MANIFEST_PATH = ROOT / "shared" / "print-manifest.json"
STL_NAME = "muchado-maquette-180mm.stl"
GLB_NAME = "muchado-maquette-180mm.glb"
TARGET_HEIGHT_MM = 180.0
BASE_HEIGHT_MM = 4.0
BASE_OVERLAP_MM = 0.8
MIN_RADIUS_MM = 1.2
RING_VERTICES = 32
SUBDIVISIONS_PER_SPAN = 2


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def orient(points: np.ndarray) -> np.ndarray:
    """Map the source X/Y/Z (inches, Y-up) to X/Y/Z millimetres, Z-up."""
    return points[:, [0, 2, 1]]


def prepared_rings(
    sections: list[dict[str, Any]], scale: float, translation: np.ndarray
) -> list[np.ndarray]:
    rings: list[np.ndarray] = []
    for section in sections:
        center = orient(np.asarray([section["center"]], dtype=np.float64))[0]
        ring = orient(np.asarray(section["perimeter"], dtype=np.float64))
        if len(ring) != RING_VERTICES:
            raise ValueError("Every source section must contain 32 perimeter samples")
        center *= scale
        ring *= scale
        radial = ring - center
        distances = np.linalg.norm(radial, axis=1)
        smallest = float(distances.min())
        if smallest < MIN_RADIUS_MM:
            radial *= MIN_RADIUS_MM / smallest
        rings.append(center + radial + translation)
    return rings


def interpolate_rings(rings: list[np.ndarray]) -> list[np.ndarray]:
    sampled: list[np.ndarray] = []
    for first, second in zip(rings, rings[1:]):
        for step in range(SUBDIVISIONS_PER_SPAN):
            amount = step / SUBDIVISIONS_PER_SPAN
            sampled.append(first + (second - first) * amount)
    sampled.append(rings[-1])
    return sampled


def loft_mesh(rings: list[np.ndarray]) -> trimesh.Trimesh:
    sampled = interpolate_rings(rings)
    vertices = np.vstack(sampled)
    faces: list[list[int]] = []
    for ring_index in range(len(sampled) - 1):
        first_offset = ring_index * RING_VERTICES
        second_offset = first_offset + RING_VERTICES
        for index in range(RING_VERTICES):
            following = (index + 1) % RING_VERTICES
            faces.append([first_offset + index, first_offset + following, second_offset + following])
            faces.append([first_offset + index, second_offset + following, second_offset + index])
    first_center = len(vertices)
    last_center = first_center + 1
    vertices = np.vstack((vertices, sampled[0].mean(axis=0), sampled[-1].mean(axis=0)))
    last_offset = (len(sampled) - 1) * RING_VERTICES
    for index in range(RING_VERTICES):
        following = (index + 1) % RING_VERTICES
        faces.append([first_center, following, index])
        faces.append([last_center, last_offset + index, last_offset + following])
    mesh = trimesh.Trimesh(vertices=vertices, faces=np.asarray(faces), process=True)
    trimesh.repair.fix_normals(mesh, multibody=False)
    if mesh.volume < 0:
        mesh.invert()
    if not mesh.is_watertight or mesh.volume <= 0:
        raise ValueError("A generated section loft is not a positive watertight solid")
    return mesh


def build_mesh() -> tuple[trimesh.Trimesh, dict[str, Any]]:
    data = json.loads(SECTIONS_PATH.read_text())
    source_groups = [data["sections"], data["upperHeadSections"], data["jawSections"]]
    source_points = np.asarray(
        [point for group in source_groups for section in group for point in section["perimeter"]],
        dtype=np.float64,
    )
    oriented = orient(source_points)
    source_height = float(np.ptp(oriented[:, 2]))
    sculpture_height = TARGET_HEIGHT_MM - (BASE_HEIGHT_MM - BASE_OVERLAP_MM)
    scale = sculpture_height / source_height

    scaled = oriented * scale
    x_center = float((scaled[:, 0].min() + scaled[:, 0].max()) / 2.0)
    y_center = float((scaled[:, 1].min() + scaled[:, 1].max()) / 2.0)
    translation = np.asarray(
        [-x_center, -y_center, BASE_HEIGHT_MM - BASE_OVERLAP_MM - scaled[:, 2].min()]
    )

    body_and_head = prepared_rings(
        data["sections"] + data["upperHeadSections"], scale, translation
    )
    jaw = prepared_rings(data["jawSections"], scale, translation)
    operands = [loft_mesh(body_and_head), loft_mesh(jaw)]

    # A low elliptical cylinder gives the upright planar sculpture a predictable,
    # broad contact patch while leaving the silhouette unobscured.
    base = trimesh.creation.cylinder(radius=1.0, height=BASE_HEIGHT_MM, sections=64)
    base.apply_scale([42.0, 23.0, 1.0])
    base.apply_translation([0.0, 0.0, BASE_HEIGHT_MM / 2.0])
    operands.append(base)

    result = trimesh.boolean.union(operands, engine="manifold", check_volume=True)
    if isinstance(result, trimesh.Scene):
        result = result.to_geometry()
    result.remove_unreferenced_vertices()
    trimesh.repair.fix_normals(result, multibody=False)
    if result.volume < 0:
        result.invert()

    bounds = result.bounds
    # Remove tiny numerical drift from the boolean engine at the build plate.
    result.apply_translation([0.0, 0.0, -bounds[0, 2]])
    final_height = float(result.bounds[1, 2] - result.bounds[0, 2])
    result.apply_scale(TARGET_HEIGHT_MM / final_height)
    result.apply_translation([0.0, 0.0, -result.bounds[0, 2]])

    build = {
        "sourceHeightInches": source_height,
        "sourceToMillimetresScale": scale,
        "booleanOperandCount": len(operands),
        "booleanEngine": "manifold3d",
        "minimumModeledRadiusMm": MIN_RADIUS_MM,
    }
    return result, build


def validate_mesh(mesh: trimesh.Trimesh) -> dict[str, Any]:
    bounds = np.asarray(mesh.bounds, dtype=np.float64)
    dimensions = bounds[1] - bounds[0]
    parents = np.arange(len(mesh.vertices), dtype=np.int64)

    def find(vertex: int) -> int:
        while parents[vertex] != vertex:
            parents[vertex] = parents[parents[vertex]]
            vertex = int(parents[vertex])
        return vertex

    def union(first: int, second: int) -> None:
        first_root = find(first)
        second_root = find(second)
        if first_root != second_root:
            parents[second_root] = first_root

    for face in mesh.faces:
        union(int(face[0]), int(face[1]))
        union(int(face[1]), int(face[2]))
    referenced = np.unique(mesh.faces.reshape(-1))
    component_count = len({find(int(vertex)) for vertex in referenced})
    edge_counts = np.bincount(mesh.edges_unique_inverse)
    contact_vertices = int(np.count_nonzero(np.isclose(mesh.vertices[:, 2], 0.0, atol=1e-5)))
    intersection_count = count_nonadjacent_triangle_intersections(mesh)
    checks = {
        "watertight": bool(mesh.is_watertight),
        "windingConsistent": bool(mesh.is_winding_consistent),
        "connectedComponents": component_count,
        "everyEdgeIncidentToTwoFaces": bool(len(edge_counts) > 0 and np.all(edge_counts == 2)),
        "positiveVolume": bool(mesh.volume > 0),
        "degenerateFaceCount": int(np.count_nonzero(mesh.area_faces <= 1e-10)),
        "duplicateFaceCount": int(len(mesh.faces) - np.count_nonzero(mesh.unique_faces())),
        "nonAdjacentTriangleIntersectionCount": intersection_count,
        "buildPlateContactVertexCount": contact_vertices,
        "minimumZMm": float(bounds[0, 2]),
        "heightMm": float(dimensions[2]),
    }
    failures = []
    if not checks["watertight"]:
        failures.append("mesh is not watertight")
    if not checks["windingConsistent"]:
        failures.append("face winding is inconsistent")
    if checks["connectedComponents"] != 1:
        failures.append("mesh is not one connected component")
    if not checks["everyEdgeIncidentToTwoFaces"]:
        failures.append("an edge does not have exactly two incident faces")
    if not checks["positiveVolume"]:
        failures.append("mesh volume is not positive")
    if checks["degenerateFaceCount"] != 0 or checks["duplicateFaceCount"] != 0:
        failures.append("mesh contains degenerate or duplicate faces")
    if checks["nonAdjacentTriangleIntersectionCount"] != 0:
        failures.append("nonadjacent triangles intersect")
    if contact_vertices < 16 or abs(checks["minimumZMm"]) > 1e-5:
        failures.append("mesh does not have a stable flat build-plate contact")
    if abs(checks["heightMm"] - TARGET_HEIGHT_MM) > 0.01:
        failures.append("mesh height is not 180 mm")
    if failures:
        raise ValueError("; ".join(failures))
    return checks


def count_nonadjacent_triangle_intersections(mesh: trimesh.Trimesh) -> int:
    """Count geometric surface intersections after excluding topological neighbors.

    Broad phase uses an X-axis AABB sweep. Narrow phase uses the separating-axis
    theorem with triangle face normals, all edge cross-products, and in-plane
    edge normals for the coplanar case. Any touch between triangles that do not
    share an indexed vertex is treated as an intersection.
    """
    triangles = np.asarray(mesh.triangles, dtype=np.float64)
    faces = np.asarray(mesh.faces, dtype=np.int64)
    minimum = triangles.min(axis=1)
    maximum = triangles.max(axis=1)
    order = np.argsort(minimum[:, 0], kind="stable")
    tolerance = max(float(np.ptp(mesh.vertices, axis=0).max()) * 1e-8, 1e-9)
    intersections = 0

    def share_vertex(first: np.ndarray, second: np.ndarray) -> bool:
        return bool(
            first[0] == second[0]
            or first[0] == second[1]
            or first[0] == second[2]
            or first[1] == second[0]
            or first[1] == second[1]
            or first[1] == second[2]
            or first[2] == second[0]
            or first[2] == second[1]
            or first[2] == second[2]
        )

    def triangles_intersect(first: np.ndarray, second: np.ndarray) -> bool:
        first_edges = np.roll(first, -1, axis=0) - first
        second_edges = np.roll(second, -1, axis=0) - second
        first_normal = np.cross(first_edges[0], first_edges[1])
        second_normal = np.cross(second_edges[0], second_edges[1])
        axes = [first_normal, second_normal]
        axes.extend(np.cross(a, b) for a in first_edges for b in second_edges)
        # The standard 3-D triangle SAT axes collapse for coplanar triangles.
        # These in-plane edge normals supply the missing 2-D separation axes.
        axes.extend(np.cross(first_normal, edge) for edge in first_edges)
        axes.extend(np.cross(second_normal, edge) for edge in second_edges)
        for axis in axes:
            length = float(np.linalg.norm(axis))
            if length <= 1e-15:
                continue
            first_projection = first @ axis
            second_projection = second @ axis
            margin = tolerance * length
            if (
                first_projection.max() < second_projection.min() - margin
                or second_projection.max() < first_projection.min() - margin
            ):
                return False
        return True

    for sorted_position, first_index_value in enumerate(order):
        first_index = int(first_index_value)
        first_maximum = maximum[first_index]
        for second_index_value in order[sorted_position + 1 :]:
            second_index = int(second_index_value)
            if minimum[second_index, 0] > first_maximum[0] + tolerance:
                break
            if share_vertex(faces[first_index], faces[second_index]):
                continue
            if np.any(minimum[second_index, 1:] > first_maximum[1:] + tolerance):
                continue
            if np.any(minimum[first_index, 1:] > maximum[second_index, 1:] + tolerance):
                continue
            if triangles_intersect(triangles[first_index], triangles[second_index]):
                intersections += 1
    return intersections


def artifact_record(
    path: Path, mesh: trimesh.Trimesh, *, units: str, up_axis: str
) -> dict[str, Any]:
    return {
        "path": path.relative_to(ROOT).as_posix(),
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
        "vertices": int(len(mesh.vertices)),
        "triangles": int(len(mesh.faces)),
        "coordinateSystem": {"units": units, "upAxis": up_axis},
    }


def manifest_for(mesh: trimesh.Trimesh, build: dict[str, Any], checks: dict[str, Any]) -> dict[str, Any]:
    bounds = np.asarray(mesh.bounds)
    dimensions = bounds[1] - bounds[0]
    stl_path = OUTPUT_DIR / STL_NAME
    glb_path = OUTPUT_DIR / GLB_NAME
    return {
        "schemaVersion": 1,
        "edition": "Much Ado About One Side — printable maquette",
        "source": {
            "path": SECTIONS_PATH.relative_to(ROOT).as_posix(),
            "sha256": sha256(SECTIONS_PATH),
            "derivation": "Closed sweep solids from the stored body, upper-head, and jaw section perimeters; overlapping pieces and plinth resolved by a Manifold boolean union.",
        },
        "coordinateSystems": {
            "printStl": {"units": "millimetres", "upAxis": "+Z"},
            "previewGlb": {"units": "metres", "upAxis": "+Y"},
        },
        "dimensionsMm": {
            "x": round(float(dimensions[0]), 4),
            "y": round(float(dimensions[1]), 4),
            "z": round(float(dimensions[2]), 4),
        },
        "boundsMm": {
            "minimum": {
                axis: round(float(value), 4)
                for axis, value in zip(("x", "y", "z"), bounds[0])
            },
            "maximum": {
                axis: round(float(value), 4)
                for axis, value in zip(("x", "y", "z"), bounds[1])
            },
        },
        "volumeMm3": round(float(mesh.volume), 4),
        "build": build,
        "generator": {
            "script": {
                "path": "scripts/generate-print.py",
                "sha256": sha256(ROOT / "scripts" / "generate-print.py"),
            },
            "requirements": {
                "path": "scripts/print/requirements.txt",
                "sha256": sha256(ROOT / "scripts" / "print" / "requirements.txt"),
            },
            "testedPython": "CPython 3.9.6",
        },
        "validation": checks,
        "artifacts": {
            "printStl": artifact_record(
                stl_path, mesh, units="millimetres", up_axis="+Z"
            ),
            "previewGlb": artifact_record(
                glb_path, mesh, units="metres", up_axis="+Y"
            ),
        },
        "fabrication": {
            "targetPrinter": "denhac Prusa MK4S, 250 × 210 × 220 mm build volume",
            "orientation": "Print upright on the integrated oval plinth; the files are already Z-up and in millimetres.",
            "startingProfile": "Prusa MK4S HF 0.4 mm / PLA / 0.20 mm layers / 3 perimeters / 15% gyroid infill.",
            "supports": "Generate organic supports from the build plate for the jaw, chin, and other overhangs, then inspect every layer in PrusaSlicer before printing.",
            "gcode": "Not supplied. Slice for the specific denhac printer and loaded filament; submit the resulting standard G-code through the shop's current workflow.",
            "lettering": "The printed plastic is a smooth substrate, without embossed calligraphy. Apply the corresponding 180 mm marked-foil kit after printing: /fabrication/small-foil/foil-kit-180mm.zip. Test the lettering and foil fit on the chosen stock before marking the complete set.",
            "minimumModeledDiameterMm": MIN_RADIUS_MM * 2,
        },
        "limitations": [
            "This is a section-derived printable interpretation, not the archival source STL relabeled as print-ready.",
            "Manifold union removes internal overlaps and crossing self-intersections; it also softens some faceted construction details into a continuous printable shell.",
            "Support placement, first-layer adhesion, and final slicer collision review remain operator responsibilities.",
        ],
    }


def load_single_mesh(path: Path) -> trimesh.Trimesh:
    loaded = trimesh.load(path, force="mesh", process=True)
    if isinstance(loaded, trimesh.Scene):
        loaded = loaded.to_geometry()
    return loaded


def check_existing() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text())
    for key in ("printStl", "previewGlb"):
        record = manifest["artifacts"][key]
        path = ROOT / record["path"]
        if sha256(path) != record["sha256"]:
            raise ValueError(f"{path} does not match its recorded SHA-256")
    stl = load_single_mesh(ROOT / manifest["artifacts"]["printStl"]["path"])
    glb = load_single_mesh(ROOT / manifest["artifacts"]["previewGlb"]["path"])
    # Convert the standard glTF Y-up metre preview back to the slicer-space
    # Z-up millimetres before comparing it with the STL.
    glb.vertices = glb.vertices[:, [0, 2, 1]] * np.asarray([1000.0, -1000.0, 1000.0])
    trimesh.repair.fix_normals(glb, multibody=False)
    stl_checks = validate_mesh(stl)
    glb_checks = validate_mesh(glb)
    if not np.allclose(stl.bounds, glb.bounds, atol=1e-4):
        raise ValueError("STL and GLB bounds differ")
    if len(stl.faces) != len(glb.faces):
        raise ValueError("STL and GLB triangle counts differ")
    if abs(stl.volume - glb.volume) > 0.1:
        raise ValueError("STL and GLB volumes differ")
    print(json.dumps({"status": "ok", "stl": stl_checks, "glb": glb_checks}, indent=2))


def generate() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    mesh, build = build_mesh()
    checks = validate_mesh(mesh)
    stl_path = OUTPUT_DIR / STL_NAME
    glb_path = OUTPUT_DIR / GLB_NAME
    mesh.export(stl_path, file_type="stl")
    preview = mesh.copy()
    preview.vertices = preview.vertices[:, [0, 2, 1]] * np.asarray([0.001, 0.001, -0.001])
    trimesh.repair.fix_normals(preview, multibody=False)
    preview.visual.vertex_colors = np.tile(
        np.asarray([174, 178, 181, 255], dtype=np.uint8),
        (len(preview.vertices), 1),
    )
    preview.export(glb_path, file_type="glb")
    manifest = manifest_for(mesh, build, checks)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n")
    check_existing()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="validate committed artifacts without regenerating")
    args = parser.parse_args()
    if args.check:
        check_existing()
    else:
        generate()


if __name__ == "__main__":
    main()
