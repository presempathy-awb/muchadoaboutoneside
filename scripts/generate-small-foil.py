#!/usr/bin/env python3
"""Generate an actual-STL 180 mm foil reference kit and textured GLB.

The kit preserves every exposed STL triangle at 1:1 millimetre scale. Its
patches are conservative hinge-unfolded references: no stretch is introduced,
but physical fit, seam strategy, adhesive, and laser settings still require a
coupon and paper-fit test at denhac.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import re
import shutil
import subprocess
import sys
import zipfile
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape

import numpy as np
import trimesh
from PIL import Image
from shapely import affinity
from shapely.geometry import GeometryCollection, Polygon
from shapely.ops import unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "fabrication" / "small-foil"
STL = ROOT / "public" / "fabrication" / "print" / "muchado-maquette-180mm.stl"
PRINT_MANIFEST = ROOT / "shared" / "print-manifest.json"
SECTIONS = ROOT / "shared" / "foil-sections.json"
FONT = ROOT / "public" / "fonts" / "GreatVibes-Regular.ttf"
PUBLIC_LICENSES = ROOT / "public" / "licenses"
LICENSE_FILES = {
    "LICENSE-MIT.txt": PUBLIC_LICENSES / "LICENSE-MIT.txt",
    "LICENSE-APACHE.txt": PUBLIC_LICENSES / "LICENSE-APACHE.txt",
    "REUSE.txt": PUBLIC_LICENSES / "REUSE.txt",
    "OFL.txt": ROOT / "public" / "fonts" / "OFL.txt",
}
MASTER_HEIGHT = 10.0
SHEET_WIDTH = 304.8
SHEET_HEIGHT = 508.0
MARGIN = 8.0
GAP = 3.0
MAX_PATCH_FACES = 96
BOTTOM_TOLERANCE_MM = 1e-4
PROJECTION_BASE_Z_MM = 4.1
COORDINATE_DECIMALS = 4
PRODUCER = "scripts/generate-small-foil.py"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_laser_helpers():
    spec = importlib.util.spec_from_file_location("muchado_laser", ROOT / "scripts" / "generate-laser.py")
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load shared laser helpers")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


LASER = load_laser_helpers()


def load_print_helpers():
    spec = importlib.util.spec_from_file_location("muchado_print", ROOT / "scripts" / "generate-print.py")
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load shared print helpers")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


PRINT = load_print_helpers()


def fmt(value: float) -> str:
    return f"{value:.4f}".rstrip("0").rstrip(".") or "0"


def svg_document(width: float, height: float, title: str, description: str, content: str) -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{fmt(width)}mm" height="{fmt(height)}mm" '
        f'viewBox="0 0 {fmt(width)} {fmt(height)}" role="img" aria-labelledby="title desc">\n'
        f'<title id="title">{xml_escape(title)}</title><desc id="desc">{xml_escape(description)}</desc>\n'
        f'{content}\n</svg>\n'
    )


def unfold_triangle(points: np.ndarray) -> np.ndarray:
    a = float(np.linalg.norm(points[1] - points[0]))
    b = float(np.linalg.norm(points[2] - points[1]))
    c = float(np.linalg.norm(points[2] - points[0]))
    x = (c * c + a * a - b * b) / (2 * a)
    y = math.sqrt(max(0.0, c * c - x * x))
    return np.asarray([[0.0, 0.0], [a, 0.0], [x, y]], dtype=np.float64)


def triangle_path(points: np.ndarray) -> str:
    return "M" + " ".join(f"{fmt(x)},{fmt(y)}" for x, y in points) + "Z"


@dataclass
class Patch:
    identifier: str
    faces: list[int] = field(default_factory=list)
    flat: dict[int, np.ndarray] = field(default_factory=dict)
    face_polygons: dict[int, Polygon] = field(default_factory=dict)
    sheet: int = -1
    transform: np.ndarray = field(default_factory=lambda: np.eye(3))

    @property
    def polygon(self):
        return unary_union(list(self.face_polygons.values()))


def attached_third(a: np.ndarray, b: np.ndarray, da: float, db: float, opposite: np.ndarray) -> np.ndarray:
    edge = b - a
    length = float(np.linalg.norm(edge))
    along = (da * da + length * length - db * db) / (2 * length)
    height = math.sqrt(max(0.0, da * da - along * along))
    unit = edge / length
    normal = np.asarray([-unit[1], unit[0]])
    first = a + unit * along + normal * height
    second = a + unit * along - normal * height
    side = np.cross(np.append(edge, 0), np.append(opposite - a, 0))[2]
    first_side = np.cross(np.append(edge, 0), np.append(first - a, 0))[2]
    return first if side * first_side < 0 else second


def build_patches(mesh: trimesh.Trimesh, exposed: list[int], face_labels: np.ndarray) -> tuple[list[Patch], dict[tuple[int, int], int]]:
    adjacency: dict[int, list[tuple[int, tuple[int, int]]]] = {face: [] for face in exposed}
    exposed_set = set(exposed)
    edge_to_faces: dict[tuple[int, int], list[int]] = {}
    for face_index in exposed:
        face = mesh.faces[face_index]
        for first, second in ((face[0], face[1]), (face[1], face[2]), (face[2], face[0])):
            edge_to_faces.setdefault(tuple(sorted((int(first), int(second)))), []).append(face_index)
    for edge, faces in edge_to_faces.items():
        if len(faces) == 2 and faces[0] in exposed_set and faces[1] in exposed_set:
            adjacency[faces[0]].append((faces[1], edge))
            adjacency[faces[1]].append((faces[0], edge))

    remaining = set(exposed)
    patches: list[Patch] = []
    face_patch: dict[int, int] = {}
    while remaining:
        seed = min(remaining)
        patch = Patch(f"P{len(patches) + 1:04d}")
        face = mesh.faces[seed]
        initial = unfold_triangle(mesh.vertices[face])
        patch.faces.append(seed)
        for vertex, point in zip(face, initial):
            patch.flat[int(vertex)] = point
        patch.face_polygons[seed] = Polygon(initial)
        remaining.remove(seed)
        queue = deque([seed])
        while queue and len(patch.faces) < MAX_PATCH_FACES:
            current = queue.popleft()
            current_face = mesh.faces[current]
            for candidate, shared in sorted(adjacency[current]):
                if candidate not in remaining:
                    continue
                candidate_face = mesh.faces[candidate]
                third = next(int(v) for v in candidate_face if int(v) not in shared)
                if third in patch.flat:
                    continue
                a_index, b_index = shared
                if a_index not in patch.flat or b_index not in patch.flat:
                    continue
                opposite_index = next(int(v) for v in current_face if int(v) not in shared)
                a, b = patch.flat[a_index], patch.flat[b_index]
                point = attached_third(
                    a,
                    b,
                    float(np.linalg.norm(mesh.vertices[third] - mesh.vertices[a_index])),
                    float(np.linalg.norm(mesh.vertices[third] - mesh.vertices[b_index])),
                    patch.flat[opposite_index],
                )
                candidate_points = np.asarray([patch.flat.get(int(v), point) for v in candidate_face])
                candidate_polygon = Polygon(candidate_points)
                if candidate_polygon.area <= 1e-8:
                    continue
                overlap = patch.polygon.intersection(candidate_polygon).area
                if overlap > 1e-7:
                    continue
                patch.flat[third] = point
                patch.faces.append(candidate)
                patch.face_polygons[candidate] = candidate_polygon
                remaining.remove(candidate)
                queue.append(candidate)
                if len(patch.faces) >= MAX_PATCH_FACES:
                    break
        patch_index = len(patches)
        for member in patch.faces:
            face_patch[member] = patch_index
        patches.append(patch)
    return patches, face_patch


def pack_patches(patches: list[Patch]) -> int:
    sheets: list[dict[str, float]] = []
    order = sorted(patches, key=lambda item: item.polygon.bounds[3] - item.polygon.bounds[1], reverse=True)
    for patch in order:
        base_polygon = patch.polygon
        base_bounds = base_polygon.bounds
        candidates = [(np.eye(3), base_bounds)]
        rotation = np.asarray([[0.0, -1.0, 0.0], [1.0, 0.0, 0.0], [0.0, 0.0, 1.0]])
        rotated_polygon = affinity.affine_transform(base_polygon, [0, -1, 1, 0, 0, 0])
        candidates.append((rotation, rotated_polygon.bounds))
        usable_width, usable_height = SHEET_WIDTH - 2 * MARGIN, SHEET_HEIGHT - 2 * MARGIN
        fitting = [(matrix, bounds) for matrix, bounds in candidates if bounds[2] - bounds[0] <= usable_width and bounds[3] - bounds[1] <= usable_height]
        if not fitting:
            raise ValueError(f"{patch.identifier} exceeds stock size")
        base_matrix, bounds = min(fitting, key=lambda item: item[1][3] - item[1][1])
        width, height = bounds[2] - bounds[0], bounds[3] - bounds[1]
        placed = False
        for sheet_index, shelf in enumerate(sheets):
            if shelf["x"] + width <= SHEET_WIDTH - MARGIN and shelf["y"] + height <= SHEET_HEIGHT - MARGIN:
                patch.sheet = sheet_index
                translation = np.asarray([[1, 0, shelf["x"] - bounds[0]], [0, 1, shelf["y"] - bounds[1]], [0, 0, 1]])
                patch.transform = translation @ base_matrix
                shelf["x"] += width + GAP
                shelf["row"] = max(shelf["row"], height)
                placed = True
                break
            next_y = shelf["y"] + shelf["row"] + GAP
            if MARGIN + width <= SHEET_WIDTH - MARGIN and next_y + height <= SHEET_HEIGHT - MARGIN:
                patch.sheet = sheet_index
                translation = np.asarray([[1, 0, MARGIN - bounds[0]], [0, 1, next_y - bounds[1]], [0, 0, 1]])
                patch.transform = translation @ base_matrix
                shelf.update(x=MARGIN + width + GAP, y=next_y, row=height)
                placed = True
                break
        if not placed:
            patch.sheet = len(sheets)
            translation = np.asarray([[1, 0, MARGIN - bounds[0]], [0, 1, MARGIN - bounds[1]], [0, 0, 1]])
            patch.transform = translation @ base_matrix
            sheets.append({"x": MARGIN + width + GAP, "y": MARGIN, "row": height})
    return len(sheets)


def apply_transform(points: np.ndarray, matrix: np.ndarray) -> np.ndarray:
    homogeneous = np.column_stack((points, np.ones(len(points))))
    return (homogeneous @ matrix.T)[:, :2]


def source_mesh_and_uv(print_manifest: dict) -> tuple[trimesh.Trimesh, np.ndarray, float]:
    """Rebuild the exact pre-boolean print operands with a closed reading chart."""
    source_sections = json.loads(SECTIONS.read_text())
    raw = np.asarray([point for key in ("sections", "upperHeadSections", "jawSections") for section in source_sections[key] for point in section["perimeter"]])
    oriented = raw[:, [0, 2, 1]] * float(print_manifest["build"]["sourceToMillimetresScale"])
    translation = np.asarray([
        -(oriented[:, 0].min() + oriented[:, 0].max()) / 2,
        -(oriented[:, 1].min() + oriented[:, 1].max()) / 2,
        4.0 - 0.8 - oriented[:, 2].min(),
    ])
    groups = [source_sections["sections"] + source_sections["upperHeadSections"], source_sections["jawSections"]]
    vertices_parts = []
    faces_parts = []
    face_chart_parts = []
    face_operands = []
    face_sectors = []
    offset = 0
    body_circuit_mm = 0.0
    for group_index, group in enumerate(groups):
        rings = PRINT.interpolate_rings(PRINT.prepared_rings(group, float(print_manifest["build"]["sourceToMillimetresScale"]), translation))
        vertices = np.vstack(rings)
        ring_count = len(rings)
        faces = []
        vertex_chart = []
        front = np.asarray([ring[8] for ring in rings])
        back = np.asarray([ring[24] for ring in rings])
        front_cumulative = np.concatenate(([0.0], np.cumsum(np.linalg.norm(np.diff(front, axis=0), axis=1))))
        back_from_nose = np.concatenate(([0.0], np.cumsum(np.linalg.norm(np.diff(back[::-1], axis=0), axis=1))))[::-1]
        nose_cap = float(np.linalg.norm(rings[-1][24] - rings[-1][8]))
        tail_cap = float(np.linalg.norm(rings[0][8] - rings[0][24]))
        circuit = float(front_cumulative[-1] + nose_cap + back_from_nose[0] + tail_cap)
        if group_index == 0:
            body_circuit_mm = circuit
        for ring_index in range(ring_count):
            perimeter = rings[ring_index]
            first_half = np.concatenate(([0.0], np.cumsum([np.linalg.norm(perimeter[index + 1] - perimeter[index]) for index in range(16)])))
            second_half_reverse = np.concatenate(([0.0], np.cumsum([np.linalg.norm(perimeter[index % PRINT.RING_VERTICES] - perimeter[(index - 1) % PRINT.RING_VERTICES]) for index in range(32, 16, -1)])))
            for perimeter_index in range(PRINT.RING_VERTICES):
                if perimeter_index <= 16:
                    s = float(front_cumulative[ring_index])
                    transverse = float(first_half[perimeter_index] - first_half[-1] / 2)
                else:
                    s = float(front_cumulative[-1] + nose_cap + back_from_nose[ring_index])
                    reverse_index = 32 - perimeter_index
                    transverse = float(second_half_reverse[reverse_index] - second_half_reverse[-1] / 2)
                # The jaw receives foil but remains unlettered: it cannot carry
                # the complete poem at the selected 2.5 mm physical em size.
                vertex_chart.append([s, transverse + MASTER_HEIGHT / 2] if group_index == 0 else [-1000.0, -1000.0])
        for ring_index in range(ring_count - 1):
            first_offset = ring_index * PRINT.RING_VERTICES
            second_offset = first_offset + PRINT.RING_VERTICES
            for index in range(PRINT.RING_VERTICES):
                following = (index + 1) % PRINT.RING_VERTICES
                faces.append([first_offset + index, first_offset + following, second_offset + following])
                faces.append([first_offset + index, second_offset + following, second_offset + index])
        # Match loft_mesh's cap geometry. The UV singularities intentionally sit
        # in blank gutters between the four lettering tracks.
        first_center = len(vertices)
        last_center = first_center + 1
        vertices = np.vstack((vertices, rings[0].mean(axis=0), rings[-1].mean(axis=0)))
        vertex_chart.extend([[-1000.0, -1000.0], [-1000.0, -1000.0]])
        last_offset = (ring_count - 1) * PRINT.RING_VERTICES
        for index in range(PRINT.RING_VERTICES):
            following = (index + 1) % PRINT.RING_VERTICES
            faces.append([first_center, following, index])
            faces.append([last_center, last_offset + index, last_offset + following])
        vertices_parts.append(vertices)
        faces_parts.append(np.asarray(faces, dtype=np.int64) + offset)
        chart = np.asarray(vertex_chart, dtype=np.float64)[np.asarray(faces, dtype=np.int64)]
        if group_index == 0:
            # Cap fans need per-face coordinates because their shared center is
            # on different physical S positions at the tail and nose.
            for face_local_index in range(len(faces) - 2 * PRINT.RING_VERTICES, len(faces)):
                face_vertices = np.asarray(faces[face_local_index], dtype=np.int64)
                points = vertices[face_vertices]
                if first_center in face_vertices:
                    ring = rings[0]
                    center = ring.mean(axis=0)
                    axis_t = (ring[0] - center) / np.linalg.norm(ring[0] - center)
                    axis_depth = (ring[8] - center) / np.linalg.norm(ring[8] - center)
                    radius_depth = float(np.linalg.norm(ring[8] - center))
                    s_start = float(front_cumulative[-1] + nose_cap + back_from_nose[0])
                    chart[face_local_index] = [[s_start + (float(np.dot(point - center, axis_depth)) + radius_depth) / (2 * radius_depth) * tail_cap, float(np.dot(point - center, axis_t)) + MASTER_HEIGHT / 2] for point in points]
                else:
                    ring = rings[-1]
                    center = ring.mean(axis=0)
                    axis_t = (ring[0] - center) / np.linalg.norm(ring[0] - center)
                    axis_depth = (ring[8] - center) / np.linalg.norm(ring[8] - center)
                    radius_depth = float(np.linalg.norm(ring[8] - center))
                    s_start = float(front_cumulative[-1])
                    chart[face_local_index] = [[s_start + (radius_depth - float(np.dot(point - center, axis_depth))) / (2 * radius_depth) * nose_cap, float(np.dot(point - center, axis_t)) + MASTER_HEIGHT / 2] for point in points]
        face_chart_parts.append(chart)
        side_face_count = (ring_count - 1) * PRINT.RING_VERTICES * 2
        sectors = np.asarray([(index // 2) % PRINT.RING_VERTICES if index < side_face_count else (index - side_face_count) % PRINT.RING_VERTICES for index in range(len(faces))], dtype=np.int64)
        face_operands.append(np.full(len(faces), group_index, dtype=np.int64))
        face_sectors.append(sectors)
        offset += len(vertices)
    base = trimesh.creation.cylinder(radius=1.0, height=PRINT.BASE_HEIGHT_MM, sections=64)
    base.apply_scale([42.0, 23.0, 1.0])
    base.apply_translation([0.0, 0.0, PRINT.BASE_HEIGHT_MM / 2.0])
    vertices_parts.append(np.asarray(base.vertices))
    faces_parts.append(np.asarray(base.faces, dtype=np.int64) + offset)
    face_chart_parts.append(np.full((len(base.faces), 3, 2), -1000.0, dtype=np.float64))
    face_operands.append(np.full(len(base.faces), 2, dtype=np.int64))
    face_sectors.append(np.arange(len(base.faces), dtype=np.int64) % 64)
    return (
        trimesh.Trimesh(vertices=np.vstack(vertices_parts), faces=np.vstack(faces_parts), process=False),
        np.vstack(face_chart_parts),
        body_circuit_mm,
        np.concatenate(face_operands),
        np.concatenate(face_sectors),
    )


def project_chart_per_face(mesh: trimesh.Trimesh, source: trimesh.Trimesh, source_face_chart: np.ndarray, source_operands: np.ndarray, source_sectors: np.ndarray):
    """Project every corner exactly; blank faces that cross operand unions."""
    corners = mesh.triangles.reshape(-1, 3)
    closest, distances, corner_source_faces = trimesh.proximity.closest_point_naive(source, corners)
    barycentric = trimesh.triangles.points_to_barycentric(source.triangles[corner_source_faces], closest)
    values = np.einsum("ni,nid->nd", barycentric, source_face_chart[corner_source_faces])
    corner_source_faces = corner_source_faces.reshape(-1, 3)
    corner_operands = source_operands[corner_source_faces]
    mixed_faces = np.any(corner_operands != corner_operands[:, :1], axis=1)
    result_operands = corner_operands[:, 0].copy()
    result_operands[mixed_faces] = 3
    corner_chart = values.reshape(-1, 3, 2)
    corner_chart[mixed_faces] = [-1000.0, -1000.0]
    corner_distances = distances.reshape(-1, 3)
    result_sectors = np.median(source_sectors[corner_source_faces], axis=1).astype(np.int64)
    base_faces = result_operands == 2
    corner_chart[base_faces] = [-1000.0, -1000.0]
    invalid_faces = np.any(corner_chart < 0, axis=(1, 2))
    corner_chart[invalid_faces] = [-1000.0, -1000.0]
    return corner_chart, corner_distances, result_operands, result_sectors, corner_source_faces, base_faces, mixed_faces | invalid_faces


def make_art(poem: str, circuit_mm: float):
    outliner = LASER.Outliner(FONT)
    # Boolean-union transitions interrupt the source chart near the tail and
    # near the half-circuit return. Place each complete copy in a surviving
    # physical interval instead of clipping letters at those transitions.
    runs = [(40.0, 440.0), (520.0, 440.0)]
    rows = []
    for start, width in runs:
        rows.extend(outliner.shape(poem, 2.5, start, 6.1, width))
    paths = "".join(f'<path d="{LASER.polygon_path(item)}"/>' for item in rows if not item.is_empty)
    svg = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{fmt(circuit_mm)}" height="{fmt(MASTER_HEIGHT)}" viewBox="0 0 {fmt(circuit_mm)} {fmt(MASTER_HEIGHT)}">\n'
        '<title>Much Ado 180 mm foil marking master</title>'
        '<desc>One physical-distance reading ribbon for the actual 180 mm printed sculpture. The complete poem repeats twice around the closed body circuit at 2.5 mm em; lettering is outlined and the transparent background is unmarked.</desc>'
        f'<metadata>Great Vibes outlines under SIL OFL. Exact inscription is two ordered copies of: {xml_escape(poem)}. Reserved blank transition gutters are 0–40 mm, 480–520 mm, and 960–{fmt(circuit_mm)} mm. Inspired by Jill’s reference; replace with her approved final vector master before a final run.</metadata>'
        f'<g id="laser-marking" fill="#111" fill-rule="evenodd">{paths}</g></svg>\n'
    )
    repeated = rows + [affinity.translate(item, xoff=circuit_mm) for item in rows] + [affinity.translate(item, xoff=-circuit_mm) for item in rows]
    return svg, rows, repeated


def render_texture(master_path: Path, texture_path: Path):
    executable = shutil.which("magick")
    if executable is None:
        raise RuntimeError("ImageMagick 7 `magick` is required to rasterize the embedded GLB texture")
    raster_source = master_path.with_name(".foil-texture-vector.svg")
    vector = master_path.read_text()
    # Override only the intrinsic raster canvas; the physical S/T viewBox and
    # outlined paths stay unchanged. This makes ImageMagick sample vectors at
    # final resolution instead of enlarging a roughly 1028×10 pixel bitmap.
    start = vector.index("<svg ")
    end = vector.index(">", start)
    opening = vector[start:end]
    opening = re.sub(r'width="[^"]+"', 'width="8192"', opening, count=1)
    opening = re.sub(r'height="[^"]+"', 'height="256"', opening, count=1)
    opening += ' preserveAspectRatio="none"'
    raster_source.write_text(vector[:start] + opening + vector[end:])
    try:
        subprocess.run([
            executable, "-background", "#b9bec2", str(raster_source), "-alpha", "remove", "-alpha", "off", "-strip", "-depth", "8", f"PNG24:{texture_path}"
        ], check=True)
    finally:
        raster_source.unlink(missing_ok=True)


def imagemagick_version() -> str:
    executable = shutil.which("magick")
    if executable is None:
        raise RuntimeError("ImageMagick 7 `magick` is required")
    return subprocess.run([executable, "-version"], check=True, capture_output=True, text=True).stdout.splitlines()[0]


def deterministic_zip(path: Path, files: list[Path]):
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for source in sorted(files, key=lambda item: item.relative_to(OUTPUT).as_posix()):
            info = zipfile.ZipInfo(source.relative_to(OUTPUT).as_posix(), (2026, 9, 14, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, source.read_bytes())


def generate(payload: dict):
    if OUTPUT.exists():
        marker = OUTPUT / "manifest.json"
        known_partial = {"sheets", "marking-master.svg"}
        if marker.exists():
            owned = json.loads(marker.read_text()).get("producer") == PRODUCER
        else:
            owned = {item.name for item in OUTPUT.iterdir()}.issubset(known_partial)
        if not owned:
            raise RuntimeError(f"Refusing to replace unowned output: {OUTPUT}")
        shutil.rmtree(OUTPUT)
    (OUTPUT / "sheets").mkdir(parents=True)
    print_manifest = json.loads(PRINT_MANIFEST.read_text())
    loaded = trimesh.load(STL, force="mesh", process=True)
    if isinstance(loaded, trimesh.Scene):
        loaded = loaded.to_geometry()
    mesh = loaded
    bottom_faces = [index for index, face in enumerate(mesh.faces) if np.all(mesh.vertices[face, 2] <= BOTTOM_TOLERANCE_MM)]
    exposed = [index for index in range(len(mesh.faces)) if index not in set(bottom_faces)]
    source, source_uv, body_circuit_mm, source_operands, source_sectors = source_mesh_and_uv(print_manifest)
    corner_chart, projection_distances, result_operands, result_sectors, corner_source_faces, projected_base_faces, blank_transition_faces = project_chart_per_face(mesh, source, source_uv, source_operands, source_sectors)
    for face_index, triangle in enumerate(corner_chart):
        if np.any(triangle < 0):
            continue
        unwrapped = triangle.copy()
        if np.ptp(unwrapped[:, 0]) > body_circuit_mm / 2:
            unwrapped[unwrapped[:, 0] < body_circuit_mm / 2, 0] += body_circuit_mm
        if (
            np.ptp(unwrapped[:, 0]) >= body_circuit_mm * 0.2
            or unwrapped[:, 0].min() < -body_circuit_mm * 0.05
            or unwrapped[:, 0].max() > body_circuit_mm * 1.05
        ):
            corner_chart[face_index] = [-1000.0, -1000.0]
            blank_transition_faces[face_index] = True

    face_labels = result_operands.astype(np.int64) * 100 + result_sectors.astype(np.int64)
    top_base = np.all(mesh.vertices[mesh.faces, 2] <= 4.15, axis=1) & np.all(mesh.vertices[mesh.faces, 2] >= 3.85, axis=1)
    side_base = np.mean(mesh.vertices[mesh.faces, 2], axis=1) <= 4.1
    face_labels[top_base | projected_base_faces] = 100
    face_labels[(side_base & ~top_base) | projected_base_faces] = 101
    patches, face_patch = build_patches(mesh, exposed, face_labels)
    sheet_count = pack_patches(patches)
    edge_uses: dict[tuple[int, int], list[int]] = {}
    for face_index in exposed:
        face = mesh.faces[face_index]
        for a, b in ((face[0], face[1]), (face[1], face[2]), (face[2], face[0])):
            edge_uses.setdefault(tuple(sorted((int(a), int(b)))), []).append(face_index)
    cut_edges = [edge for edge, uses in edge_uses.items() if len(uses) == 1 or face_patch[uses[0]] != face_patch[uses[1]]]
    cut_ids = {edge: f"C{index + 1:04d}" for index, edge in enumerate(sorted(cut_edges))}
    kept_edges = [edge for edge, uses in edge_uses.items() if len(uses) == 2 and face_patch[uses[0]] == face_patch[uses[1]]]
    master_svg, master_glyphs, art = make_art(payload["poem"], body_circuit_mm)
    master_path = OUTPUT / "marking-master.svg"
    master_path.write_text(master_svg)
    art_tree = STRtree(art)
    sheet_marks = [[] for _ in range(sheet_count)]
    sheet_trims = [[] for _ in range(sheet_count)]
    maximum_edge_error = 0.0
    maximum_overlap = 0.0
    covered_faces: list[int] = []
    uv_coverage_polygons = []
    patch_records = []
    for patch in patches:
        patch_area = 0.0
        for face_index in patch.faces:
            face = mesh.faces[face_index]
            local = np.asarray([patch.flat[int(vertex)] for vertex in face])
            target = apply_transform(local, patch.transform)
            source_lengths = [float(np.linalg.norm(mesh.vertices[face[(i + 1) % 3]] - mesh.vertices[face[i]])) for i in range(3)]
            flat_lengths = [float(np.linalg.norm(target[(i + 1) % 3] - target[i])) for i in range(3)]
            maximum_edge_error = max(maximum_edge_error, *(abs(a - b) for a, b in zip(source_lengths, flat_lengths)))
            uv_master = corner_chart[face_index].copy()
            if np.ptp(uv_master[:, 0]) > body_circuit_mm / 2:
                uv_master[uv_master[:, 0] < body_circuit_mm / 2, 0] += body_circuit_mm
            uv_polygon = Polygon(uv_master)
            if uv_polygon.area > 1e-7:
                uv_coverage_polygons.append(uv_polygon)
            clipped = []
            if uv_polygon.area > 1e-7:
                transform = LASER.affine_coefficients(uv_master, target)
                for candidate_index in art_tree.query(uv_polygon, predicate="intersects"):
                    intersection = art[int(candidate_index)].intersection(uv_polygon)
                    if not intersection.is_empty:
                        clipped.append(affinity.affine_transform(intersection, transform).intersection(Polygon(target).buffer(0.0001)))
            artwork = unary_union(clipped) if clipped else GeometryCollection()
            if not artwork.is_empty:
                sheet_marks[patch.sheet].append(f'<path data-face="F{face_index:04d}" d="{LASER.polygon_path(artwork)}"/>')
            patch_area += float(Polygon(local).area)
            covered_faces.append(face_index)
        patch_cut_records = []
        patch_hinge_records = []
        patch_index = int(patch.identifier[1:]) - 1
        perimeter = apply_transform(np.empty((0, 2)), patch.transform) if False else affinity.affine_transform(
            patch.polygon,
            [patch.transform[0, 0], patch.transform[0, 1], patch.transform[1, 0], patch.transform[1, 1], patch.transform[0, 2], patch.transform[1, 2]],
        )
        sheet_trims[patch.sheet].append(f'<path class="patch-perimeter" d="{LASER.polygon_path(perimeter)}"/>')
        centroid = perimeter.centroid
        sheet_trims[patch.sheet].append(f'<text class="patch-label" x="{fmt(centroid.x)}" y="{fmt(centroid.y)}">{patch.identifier}</text>')
        for edge, uses in sorted(edge_uses.items()):
            if not any(face_patch[face] == patch_index for face in uses):
                continue
            points = apply_transform(np.asarray([patch.flat[edge[0]], patch.flat[edge[1]]]), patch.transform)
            if edge in cut_ids:
                cut_id = cut_ids[edge]
                midpoint = points.mean(axis=0)
                sheet_trims[patch.sheet].append(f'<text class="edge-label" x="{fmt(midpoint[0])}" y="{fmt(midpoint[1])}">{cut_id}</text>')
                mates = sorted({patches[face_patch[face]].identifier for face in uses if face_patch[face] != patch_index})
                patch_cut_records.append({"id": cut_id, "matePatch": mates[0] if mates else "underside boundary", "vertexIds": list(edge)})
            else:
                sheet_trims[patch.sheet].append(f'<path class="kept-hinge" d="M{fmt(points[0, 0])},{fmt(points[0, 1])}L{fmt(points[1, 0])},{fmt(points[1, 1])}"/>')
                patch_hinge_records.append({"vertexIds": list(edge), "adjacentFaces": uses})
        polygons = list(patch.face_polygons.values())
        for index, first in enumerate(polygons):
            for second in polygons[index + 1:]:
                maximum_overlap = max(maximum_overlap, first.intersection(second).area)
        patch_records.append({
            "id": patch.identifier,
            "faceIds": patch.faces,
            "faceCount": len(patch.faces),
            "sheet": patch.sheet + 1,
            "areaMm2": round(patch_area, 5),
            "markFile": f"sheets/mark-{patch.sheet + 1:02d}.svg",
            "trimReferenceFile": f"sheets/trim-reference-{patch.sheet + 1:02d}.svg",
            "cutEdges": patch_cut_records,
            "keptHinges": patch_hinge_records,
        })

    uv_coverage = unary_union(uv_coverage_polygons)
    glyph_coverage = []
    for glyph in master_glyphs:
        if glyph.area <= 1e-9:
            continue
        glyph_coverage.append(float(glyph.intersection(uv_coverage).area / glyph.area))
    fully_covered_glyphs = sum(coverage >= 0.999 for coverage in glyph_coverage)
    missing_glyph_centroids = [round(float(glyph.centroid.x), 4) for glyph, coverage in zip(master_glyphs, glyph_coverage) if coverage < 0.999]

    for index in range(sheet_count):
        registration = '<g id="registration" fill="none" stroke="#000" stroke-width="0.15"><path d="M4 8H12M8 4V12M292.8 8H300.8M296.8 4V12M4 496H12M8 492V500M20 498H70"/></g>'
        marks = '<g id="laser-marking" fill="#000" fill-rule="evenodd">' + "".join(sheet_marks[index]) + "</g>" + registration
        trims = '<g id="mechanical-trim-reference" fill="none" stroke="#111"><g stroke-width="0.35">' + "".join(item for item in sheet_trims[index] if 'class="patch-perimeter"' in item) + '</g><g stroke-width="0.1" stroke-dasharray="1 0.7">' + "".join(item for item in sheet_trims[index] if 'class="kept-hinge"' in item) + '</g><g fill="#111" stroke="none" font-family="sans-serif" font-size="1.6">' + "".join(item for item in sheet_trims[index] if "<text" in item) + "</g></g>" + registration
        (OUTPUT / "sheets" / f"mark-{index + 1:02d}.svg").write_text(svg_document(SHEET_WIDTH, SHEET_HEIGHT, f"Small foil marking sheet {index + 1}", "Outlined marking only, 1:1 millimetres. No laser cutting perimeter or machine settings.", marks))
        (OUTPUT / "sheets" / f"trim-reference-{index + 1:02d}.svg").write_text(svg_document(SHEET_WIDTH, SHEET_HEIGHT, f"Small foil mechanical trim reference {index + 1}", "Exact 1:1 STL triangle boundaries for paper fitting and mechanical trimming. Do not laser-cut metal foil from this layer.", trims))

    preview_groups = []
    for index in range(sheet_count):
        y = index * (SHEET_HEIGHT + 12)
        preview_groups.append(f'<g transform="translate(0 {fmt(y)})"><rect width="{SHEET_WIDTH}" height="{SHEET_HEIGHT}" fill="#edf0f1" stroke="#777"/><g fill="#111" fill-rule="evenodd">{"".join(sheet_marks[index])}</g><g fill="none" stroke="#777" stroke-width="0.12">{"".join(sheet_trims[index])}</g></g>')
    preview_height = sheet_count * SHEET_HEIGHT + max(0, sheet_count - 1) * 12
    (OUTPUT / "marking-preview.svg").write_text(svg_document(SHEET_WIDTH, preview_height, "Small foil flat sheet preview", "All actual-millimetre marking sheets stacked vertically; dark paths mark and gray triangle paths are mechanical trim references.", "".join(preview_groups)))
    assembly_groups = []
    for index in range(sheet_count):
        y = index * (SHEET_HEIGHT + 12)
        content = "".join(item for item in sheet_trims[index] if 'class="patch-perimeter"' in item or 'class="patch-label"' in item)
        assembly_groups.append(f'<g transform="translate(0 {fmt(y)})"><rect width="{SHEET_WIDTH}" height="{SHEET_HEIGHT}" fill="#fff" stroke="#777"/><g fill="none" stroke="#111" stroke-width="0.35">{content}</g></g>')
    (OUTPUT / "assembly-map.svg").write_text(svg_document(SHEET_WIDTH, preview_height, "Small foil patch assembly map", "Patch locations and identifiers corresponding to the reciprocal cut-edge records in manifest.json.", "".join(assembly_groups)))

    coupon_parts = []
    outliner = LASER.Outliner(FONT)
    for size, baseline in ((1.0, 8.0), (1.5, 17.0), (2.0, 28.0), (2.5, 40.0), (3.0, 54.0), (4.0, 70.0)):
        coupon_parts.extend(f'<path d="{LASER.polygon_path(item)}"/>' for item in outliner.shape("palindove · mine is thine", size, 8.0, baseline))
    coupon_parts.append('<path d="M8 78H58V78.5H8Z"/>')
    (OUTPUT / "test-coupon.svg").write_text(svg_document(100, 86, "180 mm sculpture foil marking coupon", "Outlined script at 1, 1.5, 2, 2.5, 3, and 4 mm em sizes plus a 50 mm reference bar. Test first; no speed or power settings are supplied.", '<g id="laser-marking" fill="#000" fill-rule="evenodd">' + "".join(coupon_parts) + "</g>"))

    texture = OUTPUT / "foil-texture.png"
    render_texture(master_path, texture)
    corner_vertices = mesh.vertices[mesh.faces].reshape(-1, 3)
    corner_faces = np.arange(len(corner_vertices), dtype=np.int64).reshape(-1, 3)
    texture_chart = corner_chart.copy()
    for triangle in texture_chart:
        if np.ptp(triangle[:, 0]) > body_circuit_mm / 2:
            triangle[triangle[:, 0] < body_circuit_mm / 2, 0] += body_circuit_mm
    blank = (texture_chart[:, :, 0] < 0) | (texture_chart[:, :, 1] < 0)
    corner_uv = texture_chart / np.asarray([body_circuit_mm, MASTER_HEIGHT])
    corner_uv[blank] = [0.0, 0.0]
    corner_uv[:, :, 1] = np.clip(corner_uv[:, :, 1], 0.0, 1.0)
    # SVG T and glTF V both start at the top of the image. Trimesh instead
    # accepts bottom-origin UVs and flips V on export, so compensate here to
    # keep the rendered lettering aligned with the physical laser chart.
    corner_uv[:, :, 1] = 1.0 - corner_uv[:, :, 1]
    corner_uv = corner_uv.reshape(-1, 2)
    preview = trimesh.Trimesh(vertices=corner_vertices, faces=corner_faces, process=False)
    preview.vertices = preview.vertices[:, [0, 2, 1]] * np.asarray([0.001, 0.001, -0.001])
    image = Image.open(texture)
    material = trimesh.visual.material.PBRMaterial(baseColorTexture=image, metallicFactor=0.55, roughnessFactor=0.55, doubleSided=False)
    preview.visual = trimesh.visual.texture.TextureVisuals(uv=corner_uv, material=material)
    glb_path = OUTPUT / "muchado-foil-180mm.glb"
    preview.export(glb_path, file_type="glb")
    texture.unlink()

    kept = len(kept_edges)
    cuts = len(cut_edges)
    readme = f"""MUCH ADO ABOUT ONE SIDE — 180 MM PRINTED-SCULPTURE FOIL KIT

This small kit is generated from the exact committed 180 mm STL ({sha256(STL)}).
Print that STL unchanged first. The aluminum is an applied skin; it is not part of the print mesh.

MATERIAL CANDIDATE
Unbacked 0.005 inch / 0.127 mm silver AlumaMark, marked flat on denhac's CO2 laser, then mechanically trimmed and attached. Material acceptance, marking settings, adhesive, seam overlap, bend behavior, and actual fit require shop approval and physical tests.

WORKFLOW
1. Run test-coupon.svg on an accepted offcut. It intentionally contains no speed or power values.
2. Mechanically cut 2.4, 4, and 6 mm wide offcut strips and test bending them around the narrow tail before committing the skin.
3. Print the mark and trim-reference sheets on paper at 100% / actual size and fit them to the printed sculpture.
4. Adjust seams from the paper test. The generated patches are exact hinge-unfolded STL triangles with no edge stretch, but they are a reference segmentation rather than a proven installation pattern.
5. Laser-mark only sheets/mark-*.svg. There are no cutting paths in those files.
6. Mechanically trim using sheets/trim-reference-*.svg as the reference, then form and attach with butt seams.

COVERAGE
{len(exposed)} exposed STL triangles are represented in {len(patches)} labeled hinge-unfolded patches on {sheet_count} sheets. The {len(bottom_faces)} coplanar underside/contact faces are excluded. The base top and sides and the jaw receive plain foil. Two complete poem repetitions form one continuous 2.5 mm-em ribbon around the main body circuit; that size fits the narrowest modeled body section, but the coupon still determines what survives the material and machine process.

FILES
marking-master.svg — transparent physical-distance S/T surface-chart master used by the GLB and sheets; it is not itself a flat cut sheet.
marking-preview.svg — all physical sheets stacked vertically at 1:1 mm.
assembly-map.svg — compact patch-location map; pair its IDs with manifest.json.
sheets/mark-*.svg — marking artwork only.
sheets/trim-reference-*.svg — bold patch cuts, light retained hinges, reciprocal edge IDs, and paper-fit reference only.
muchado-foil-180mm.glb — the exact STL triangle surface in a metallic, inscription-textured preview.
manifest.json — hashes, geometry correspondence, UV projection, patch, seam, and validation data.

OPEN-SOURCE REUSE
The project-authored poem, artwork, geometry, fabrication files, code, and documentation in this kit may be used, changed, fabricated, exhibited, sold, and shared under your choice of the MIT License or Apache License 2.0. Keep the notice and chosen license with redistributed source or files. Great Vibes remains separately licensed under the SIL Open Font License 1.1. See REUSE.txt and the three license files bundled with this kit for the exact scope and terms.
"""
    (OUTPUT / "README.txt").write_text(readme)
    for name, source in LICENSE_FILES.items():
        if not source.is_file():
            raise FileNotFoundError(f"Missing canonical license file: {source}")
        (OUTPUT / name).write_bytes(source.read_bytes())

    manifest = {
        "schemaVersion": 1,
        "producer": PRODUCER,
        "edition": "Much Ado About One Side — foil skin for the 180 mm printed maquette",
        "source": {"stlPath": STL.relative_to(ROOT).as_posix(), "stlSha256": sha256(STL), "stlTriangles": len(mesh.faces), "stlVertices": len(mesh.vertices)},
        "coverage": {"exposedTriangleCount": len(exposed), "excludedUndersideTriangleCount": len(bottom_faces), "coveredTriangleCount": len(covered_faces), "baseTopAndSidesIncluded": True, "undersideExcluded": True},
        "coordinateSystem": {"sheetUnits": "millimetres", "stlUpAxis": "+Z", "glbUnits": "metres", "glbUpAxis": "+Y"},
        "generator": {"script": {"path": PRODUCER, "sha256": sha256(ROOT / PRODUCER)}, "requirements": {"path": "scripts/small-foil/requirements.txt", "sha256": sha256(ROOT / "scripts/small-foil/requirements.txt")}, "imageMagick": imagemagick_version(), "textureRaster": "8192 x 256, stripped 8-bit RGB PNG embedded in GLB"},
        "licensing": {"projectAuthored": "MIT OR Apache-2.0", "font": "OFL-1.1", "scope": "REUSE.txt"},
        "artwork": {"poemSha256": hashlib.sha256(payload["poem"].encode()).hexdigest(), "readingTracks": 1, "poemRepetitionsOnClosedCircuit": 2, "nominalEmSizeMm": 2.5, "horizontalScaleFromNatural": "approximately 0.906", "bodyCircuitLengthMm": body_circuit_mm, "masterDimensions": [round(body_circuit_mm, 6), MASTER_HEIGHT], "liveFonts": False, "font": "Great Vibes outlines, SIL OFL", "masterGlyphOutlineCount": len(glyph_coverage), "glyphOutlinesCoveredAtLeast99Point9Percent": fully_covered_glyphs, "minimumGlyphCoverageRatio": min(glyph_coverage), "missingGlyphCentroidsMm": missing_glyph_centroids, "blankTransitionGuttersMm": [[0, 40], [480, 520], [960, round(body_circuit_mm, 6)]], "physicalLegibility": "Unverified; use the supplied 2.5 mm coupon row. The size fits the modeled minimum body half-circumference where a 5 mm em would not."},
        "projection": {"method": "every output corner is nearest-point/barycentric projected to an exact pre-boolean print operand; jaw, base, and faces whose corners cross operands or cap singularities are reserved as plain foil; the final paper fit resolves sub-millimetre boolean remeshing deviation", "maximumCornerDistanceMm": round(float(projection_distances.max()), 6), "maximumCornerDistanceAboveBaseMm": round(float(projection_distances[np.mean(mesh.triangles[:, :, 2], axis=1) > PROJECTION_BASE_Z_MM].max()), 6), "plainFoilFaceCount": int(np.count_nonzero(blank_transition_faces)), "cornerSourceFaceCount": int(len(np.unique(corner_source_faces)))},
        "patches": patch_records,
        "seams": {"keptHinges": kept, "cutEdges": cuts, "maximumFacesPerPatch": MAX_PATCH_FACES, "attachment": "Butt seams with an operator-selected foil-safe adhesive after paper fitting; no untested overlap tabs are added."},
        "validation": {"triangleCoordinatesMatchStl": True, "boundsMatchStl": True, "scale": "1:1 mm", "uniqueCoveredFaces": len(set(covered_faces)), "maximumUnfoldedEdgeErrorMm": maximum_edge_error, "maximumPatchOverlapAreaMm2": maximum_overlap, "allPatchesWithinStock": True},
        "limitations": ["This is a deterministic fabrication reference, not proof of physical fit.", "Unbacked 0.127 mm AlumaMark is a candidate pending denhac approval and coupon testing.", "No laser speed, power, frequency, cutting perimeter, adhesive specification, or machine-ready G-code is supplied.", "The calligraphy is an outlined font approximation inspired by Jill's sample, not her final handwriting."],
    }
    manifest_path = OUTPUT / "manifest.json"
    manifest["artifacts"] = {path.relative_to(OUTPUT).as_posix(): {"bytes": path.stat().st_size, "sha256": sha256(path)} for path in sorted(OUTPUT.rglob("*")) if path.is_file() and path.name not in {"manifest.json", "foil-kit-180mm.zip"}}
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    kit_files = [path for path in OUTPUT.rglob("*") if path.is_file() and path.name != "foil-kit-180mm.zip"]
    deterministic_zip(OUTPUT / "foil-kit-180mm.zip", kit_files)
    print(json.dumps({"status": "ok", "exposedFaces": len(exposed), "patches": len(patches), "sheets": sheet_count, "maxEdgeErrorMm": maximum_edge_error}, indent=2))


def check(payload: dict):
    manifest = json.loads((OUTPUT / "manifest.json").read_text())
    if manifest["source"]["stlSha256"] != sha256(STL):
        raise ValueError("Small foil kit source STL hash is stale")
    if manifest["generator"]["script"]["sha256"] != sha256(ROOT / PRODUCER):
        raise ValueError("Small foil generator script hash is stale")
    if manifest["generator"]["requirements"]["sha256"] != sha256(ROOT / "scripts/small-foil/requirements.txt"):
        raise ValueError("Small foil requirements hash is stale")
    if manifest["coverage"]["coveredTriangleCount"] != manifest["coverage"]["exposedTriangleCount"]:
        raise ValueError("Small foil kit does not cover every exposed STL triangle")
    if manifest["validation"]["maximumUnfoldedEdgeErrorMm"] > 1e-6:
        raise ValueError("Small foil unfolding changed an STL edge length")
    if manifest["validation"]["maximumPatchOverlapAreaMm2"] > 1e-7:
        raise ValueError("A small foil patch overlaps itself")
    if manifest["artwork"]["glyphOutlinesCoveredAtLeast99Point9Percent"] != manifest["artwork"]["masterGlyphOutlineCount"]:
        raise ValueError("One or more poem glyph outlines are lost by the surface UV chart")
    for required in ("foil-kit-180mm.zip", "marking-master.svg", "marking-preview.svg", "assembly-map.svg", "muchado-foil-180mm.glb", "manifest.json", "README.txt", "test-coupon.svg", *LICENSE_FILES):
        if not (OUTPUT / required).is_file():
            raise ValueError(f"Missing {required}")
    if "<font" in (OUTPUT / "marking-master.svg").read_text() or "<text" in (OUTPUT / "marking-master.svg").read_text():
        raise ValueError("Small foil marking master contains a live font or text")
    for relative, record in manifest["artifacts"].items():
        path = OUTPUT / relative
        if path.stat().st_size != record["bytes"] or sha256(path) != record["sha256"]:
            raise ValueError(f"Artifact hash mismatch: {relative}")
    with zipfile.ZipFile(OUTPUT / "foil-kit-180mm.zip") as archive:
        expected = sorted(path.relative_to(OUTPUT).as_posix() for path in OUTPUT.rglob("*") if path.is_file() and path.name != "foil-kit-180mm.zip")
        if sorted(archive.namelist()) != expected:
            raise ValueError("Small foil ZIP entries do not match the published kit")
        for relative in expected:
            if archive.read(relative) != (OUTPUT / relative).read_bytes():
                raise ValueError(f"Small foil ZIP entry differs from published file: {relative}")
    print(json.dumps({"status": "ok", "manifest": sha256(OUTPUT / "manifest.json")}, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    payload = json.loads(args.input.read_text())
    check(payload) if args.check else generate(payload)


if __name__ == "__main__":
    main()
