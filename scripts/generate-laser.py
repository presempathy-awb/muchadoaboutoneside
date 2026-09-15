#!/usr/bin/env python3
"""Generate outlined laser-marking art and exact-facet manual trim templates."""

from __future__ import annotations

import hashlib
import json
import math
import shutil
import sys
import zipfile
from dataclasses import dataclass
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape

import numpy as np
import uharfbuzz as hb
from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont
from shapely import affinity
from shapely.geometry import GeometryCollection, Polygon, box
from shapely.ops import unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "public" / "fabrication" / "laser"
FONT_PATH = ROOT / "public" / "fonts" / "GreatVibes-Regular.ttf"
PUBLIC_LICENSES = ROOT / "public" / "licenses"
LICENSE_FILES = {
    "LICENSE-MIT.txt": PUBLIC_LICENSES / "LICENSE-MIT.txt",
    "LICENSE-APACHE.txt": PUBLIC_LICENSES / "LICENSE-APACHE.txt",
    "REUSE.txt": PUBLIC_LICENSES / "REUSE.txt",
    "OFL.txt": ROOT / "public" / "fonts" / "OFL.txt",
}
MM_PER_INCH = 25.4
MASTER_WIDTH = 8192.0
MASTER_HEIGHT = 2048.0
STOCK_WIDTH = 304.8
STOCK_HEIGHT = 508.0
STOCK_MARGIN = 10.0
PANEL_GAP = 6.0
FLATTEN_TOLERANCE_MASTER = 0.35
COORDINATE_DECIMALS = 3
PRODUCER = "muchadoaboutoneside/scripts/generate-laser.py@1"


def fmt(value: float) -> str:
    rounded = round(value, COORDINATE_DECIMALS)
    if abs(rounded) < 0.0005:
        rounded = 0.0
    return f"{rounded:.{COORDINATE_DECIMALS}f}".rstrip("0").rstrip(".")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def polygon_path(geometry) -> str:
    parts: list[str] = []
    polygons = []
    if geometry.is_empty:
        return ""
    if geometry.geom_type == "Polygon":
        polygons = [geometry]
    elif geometry.geom_type == "MultiPolygon":
        polygons = list(geometry.geoms)
    elif geometry.geom_type == "GeometryCollection":
        polygons = [item for item in geometry.geoms if item.geom_type == "Polygon"]
    for polygon in polygons:
        for ring in [polygon.exterior, *polygon.interiors]:
            points = list(ring.coords)
            if len(points) < 4:
                continue
            parts.append("M" + " ".join(f"{fmt(x)},{fmt(y)}" for x, y in points[:-1]) + "Z")
    return "".join(parts)


def svg_document(width: float, height: float, title: str, desc: str, content: str, *, view_box: tuple[float, float] | None = None) -> str:
    vb_width, vb_height = view_box or (width, height)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{fmt(width)}mm" height="{fmt(height)}mm" '
        f'viewBox="0 0 {fmt(vb_width)} {fmt(vb_height)}" role="img" aria-labelledby="title desc">\n'
        f'<title id="title">{title}</title><desc id="desc">{desc}</desc>\n'
        f"{content}\n</svg>\n"
    )


class FlattenPen(BasePen):
    def __init__(self, glyph_set, tolerance: float):
        super().__init__(glyph_set)
        self.tolerance = tolerance
        self.contours: list[list[tuple[float, float]]] = []
        self.current: list[tuple[float, float]] = []

    def _moveTo(self, point):
        if self.current:
            self._closePath()
        self.current = [tuple(point)]

    def _lineTo(self, point):
        self.current.append(tuple(point))

    @staticmethod
    def _distance_to_line(point, start, end) -> float:
        dx, dy = end[0] - start[0], end[1] - start[1]
        denominator = math.hypot(dx, dy)
        if denominator == 0:
            return math.hypot(point[0] - start[0], point[1] - start[1])
        return abs(dy * point[0] - dx * point[1] + end[0] * start[1] - end[1] * start[0]) / denominator

    def _curveToOne(self, p1, p2, p3):
        p0 = self.current[-1]

        def flatten(a, b, c, d, depth=0):
            flatness = max(self._distance_to_line(b, a, d), self._distance_to_line(c, a, d))
            if flatness <= self.tolerance or depth >= 16:
                self.current.append(tuple(d))
                return
            ab = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            bc = ((b[0] + c[0]) / 2, (b[1] + c[1]) / 2)
            cd = ((c[0] + d[0]) / 2, (c[1] + d[1]) / 2)
            abc = ((ab[0] + bc[0]) / 2, (ab[1] + bc[1]) / 2)
            bcd = ((bc[0] + cd[0]) / 2, (bc[1] + cd[1]) / 2)
            middle = ((abc[0] + bcd[0]) / 2, (abc[1] + bcd[1]) / 2)
            flatten(a, ab, abc, middle, depth + 1)
            flatten(middle, bcd, cd, d, depth + 1)

        flatten(p0, p1, p2, p3)

    def _qCurveToOne(self, p1, p2):
        p0 = self.current[-1]
        cubic1 = (p0[0] + 2 * (p1[0] - p0[0]) / 3, p0[1] + 2 * (p1[1] - p0[1]) / 3)
        cubic2 = (p2[0] + 2 * (p1[0] - p2[0]) / 3, p2[1] + 2 * (p1[1] - p2[1]) / 3)
        self._curveToOne(cubic1, cubic2, p2)

    def _closePath(self):
        if len(self.current) >= 3:
            self.contours.append(self.current)
        self.current = []

    def _endPath(self):
        self._closePath()


class Outliner:
    def __init__(self, font_path: Path):
        self.font_path = font_path
        self.font = TTFont(font_path)
        self.glyph_set = self.font.getGlyphSet()
        self.glyph_order = self.font.getGlyphOrder()
        font_bytes = font_path.read_bytes()
        self.face = hb.Face(font_bytes)
        self.hb_font = hb.Font(self.face)
        self.hb_font.scale = (self.face.upem, self.face.upem)
        self.cache: dict[tuple[int, float], list[list[tuple[float, float]]]] = {}

    def contours(self, glyph_id: int, maximum_scale: float = 40.0) -> list[list[tuple[float, float]]]:
        key = (glyph_id, maximum_scale)
        if key not in self.cache:
            pen = FlattenPen(self.glyph_set, FLATTEN_TOLERANCE_MASTER * self.face.upem / maximum_scale)
            self.glyph_set[self.glyph_order[glyph_id]].draw(pen)
            pen._endPath()
            self.cache[key] = pen.contours
        return self.cache[key]

    def shape(self, text: str, font_size: float, x: float, baseline: float, target_width: float | None = None):
        buffer = hb.Buffer()
        buffer.add_str(text)
        buffer.guess_segment_properties()
        hb.shape(self.hb_font, buffer, {"kern": True, "liga": True, "calt": True})
        infos = buffer.glyph_infos
        positions = buffer.glyph_positions
        advance = sum(position.x_advance for position in positions)
        scale_y = font_size / self.face.upem
        scale_x = scale_y if target_width is None else target_width / advance
        # Preserve the established small-kit precision, and tighten it when
        # larger or horizontally expanded lettering would exceed the stated
        # output-space tolerance. Cache each precision separately.
        maximum_scale = max(40.0, scale_x * self.face.upem, font_size)
        cursor_x = 0.0
        cursor_y = 0.0
        geometries = []
        for info, position in zip(infos, positions):
            contours = self.contours(info.codepoint, maximum_scale)
            rings = []
            origin_x = x + (cursor_x + position.x_offset) * scale_x
            origin_y = baseline - (cursor_y + position.y_offset) * scale_y
            for contour in contours:
                points = [(origin_x + px * scale_x, origin_y - py * scale_y) for px, py in contour]
                if len(points) >= 3:
                    candidate = Polygon(points)
                    if candidate.area > 1e-7:
                        rings.append(candidate)
            if rings:
                glyph = rings[0]
                for ring in rings[1:]:
                    glyph = glyph.symmetric_difference(ring)
                if not glyph.is_valid:
                    glyph = glyph.buffer(0)
                if not glyph.is_empty:
                    geometries.append(glyph)
            cursor_x += position.x_advance
            cursor_y += position.y_advance
        return geometries


@dataclass
class Facet:
    identifier: str
    source_identifier: str
    surface: str
    xyz: np.ndarray
    uv: np.ndarray
    flat: np.ndarray | None = None
    sheet: int = -1
    offset: tuple[float, float] = (0.0, 0.0)
    rotated: bool = False


def distance(a, b) -> float:
    return float(np.linalg.norm(a - b))


def unfold(xyz: np.ndarray) -> np.ndarray:
    a = distance(xyz[0], xyz[1]) * MM_PER_INCH
    b = distance(xyz[1], xyz[2]) * MM_PER_INCH
    c = distance(xyz[2], xyz[0]) * MM_PER_INCH
    if a <= 0:
        raise ValueError("Degenerate triangle edge")
    x = (c * c + a * a - b * b) / (2 * a)
    y_squared = max(0.0, c * c - x * x)
    return np.array([[0.0, 0.0], [a, 0.0], [x, math.sqrt(y_squared)]])


def normalized_flat(xyz: np.ndarray) -> np.ndarray:
    flat = unfold(xyz)
    flat[:, 0] -= np.min(flat[:, 0])
    flat[:, 1] -= np.min(flat[:, 1])
    return flat


def fits(flat: np.ndarray) -> bool:
    width = float(np.max(flat[:, 0]))
    height = float(np.max(flat[:, 1]))
    usable_width = STOCK_WIDTH - 2 * STOCK_MARGIN
    usable_height = STOCK_HEIGHT - 2 * STOCK_MARGIN
    return (width <= usable_width and height <= usable_height) or (height <= usable_width and width <= usable_height)


def split_facet(facet: Facet, suffix="") -> list[Facet]:
    flat = normalized_flat(facet.xyz)
    if fits(flat):
        facet.flat = flat
        facet.identifier += suffix
        return [facet]
    raise ValueError(
        f"{facet.identifier} does not fit {STOCK_WIDTH} × {STOCK_HEIGHT} mm stock; "
        "increase shared geometry sampling so the preview and exporter remain identical"
    )


def facets_for_mesh(mesh: dict, surface: str) -> list[Facet]:
    positions = np.array(mesh["positions"], dtype=float).reshape(-1, 3)
    uvs = np.array(mesh["uvs"], dtype=float).reshape(-1, 2)
    facets: list[Facet] = []
    for number, start in enumerate(range(0, len(mesh["indices"]), 3), 1):
        indexes = mesh["indices"][start:start + 3]
        identifier = f"{surface}-T{number:04d}"
        facet = Facet(identifier, identifier, surface, positions[indexes], uvs[indexes])
        facets.extend(split_facet(facet))
    return facets


def choose_orientation(facet: Facet):
    flat = facet.flat.copy()
    width = float(np.max(flat[:, 0]))
    height = float(np.max(flat[:, 1]))
    if width > STOCK_WIDTH - 2 * STOCK_MARGIN or (height > width and height <= STOCK_WIDTH - 2 * STOCK_MARGIN):
        flat = np.column_stack((-flat[:, 1], flat[:, 0]))
        flat[:, 0] -= np.min(flat[:, 0])
        flat[:, 1] -= np.min(flat[:, 1])
        facet.rotated = True
    facet.flat = flat


def pack_facets(facets: list[Facet]) -> int:
    for facet in facets:
        choose_orientation(facet)
    ordered = sorted(facets, key=lambda item: float(np.max(item.flat[:, 1])), reverse=True)
    sheets: list[dict] = []
    for facet in ordered:
        width = float(np.max(facet.flat[:, 0]))
        height = float(np.max(facet.flat[:, 1]))
        placed = False
        for sheet_number, sheet in enumerate(sheets):
            x, y, row_height = sheet["x"], sheet["y"], sheet["row_height"]
            if x + width <= STOCK_WIDTH - STOCK_MARGIN and y + height <= STOCK_HEIGHT - STOCK_MARGIN:
                facet.sheet, facet.offset = sheet_number, (x, y)
                sheet["x"] = x + width + PANEL_GAP
                sheet["row_height"] = max(row_height, height)
                placed = True
                break
            next_y = y + row_height + PANEL_GAP
            if STOCK_MARGIN + width <= STOCK_WIDTH - STOCK_MARGIN and next_y + height <= STOCK_HEIGHT - STOCK_MARGIN:
                facet.sheet, facet.offset = sheet_number, (STOCK_MARGIN, next_y)
                sheet.update(x=STOCK_MARGIN + width + PANEL_GAP, y=next_y, row_height=height)
                placed = True
                break
        if not placed:
            facet.sheet, facet.offset = len(sheets), (STOCK_MARGIN, STOCK_MARGIN)
            sheets.append({"x": STOCK_MARGIN + width + PANEL_GAP, "y": STOCK_MARGIN, "row_height": height})
    return len(sheets)


def affine_coefficients(source: np.ndarray, target: np.ndarray) -> list[float]:
    matrix = np.array([[source[0, 0], source[0, 1], 1.0], [source[1, 0], source[1, 1], 1.0], [source[2, 0], source[2, 1], 1.0]])
    x_values = target[:, 0]
    y_values = target[:, 1]
    ax, bx, xoff = np.linalg.solve(matrix, x_values)
    dx, ex, yoff = np.linalg.solve(matrix, y_values)
    return [float(ax), float(bx), float(dx), float(ex), float(xoff), float(yoff)]


def translated_flat(facet: Facet) -> np.ndarray:
    result = facet.flat.copy()
    result[:, 0] += facet.offset[0]
    result[:, 1] += facet.offset[1]
    return result


def edge_key(a: np.ndarray, b: np.ndarray) -> str:
    points = sorted([tuple(round(float(value), 6) for value in a), tuple(round(float(value), 6) for value in b)])
    return json.dumps(points, separators=(",", ":"))


def build_edge_matches(facets: list[Facet]):
    uses: dict[str, list[tuple[str, int]]] = {}
    for facet in facets:
        for edge, (a, b) in enumerate(((0, 1), (1, 2), (2, 0)), 1):
            uses.setdefault(edge_key(facet.xyz[a], facet.xyz[b]), []).append((facet.identifier, edge))
    matches = {}
    for facet in facets:
        entries = []
        for edge, (a, b) in enumerate(((0, 1), (1, 2), (2, 0)), 1):
            peers = [f"{identifier}:E{peer_edge}" for identifier, peer_edge in uses[edge_key(facet.xyz[a], facet.xyz[b])] if identifier != facet.identifier]
            if len(peers) != 1:
                raise ValueError(f"Expected one reciprocal mate for {facet.identifier}:E{edge}; found {peers}")
            entries.append(peers)
        matches[facet.identifier] = entries
    return matches


def triangle_area_3d(xyz: np.ndarray) -> float:
    return float(np.linalg.norm(np.cross(xyz[1] - xyz[0], xyz[2] - xyz[0])) / 2) * MM_PER_INCH * MM_PER_INCH


def main(input_path: Path):
    payload = json.loads(input_path.read_text())
    geometry = payload["geometry"]
    layout = payload["layout"]
    jaw_layout = payload["jawLayout"]
    poem = payload["poem"]
    options = payload["options"]
    OUTPUT.mkdir(parents=True, exist_ok=True)
    existing = list(OUTPUT.iterdir())
    if existing:
        marker = OUTPUT / "manifest.json"
        if not marker.exists():
            raise RuntimeError(f"Refusing to clean unmarked output directory: {OUTPUT}")
        previous = json.loads(marker.read_text())
        if previous.get("producer") not in (None, PRODUCER) or previous.get("generatedFrom") != "shared/FABRICATION_GEOMETRY_OPTIONS + src/lib/foil-geometry.ts + shared/poem.ts":
            raise RuntimeError(f"Refusing to clean output not owned by this generator: {OUTPUT}")
        for name in ("README.txt", "marking-master.svg", "jaw-marking-master.svg", "denhac-test-coupon.svg", "assembly-map.svg", "panel-kit-manifest.json", "panel-kit.zip", "representative-fit-kit.zip", "manifest.json", *LICENSE_FILES):
            path = OUTPUT / name
            if path.exists():
                path.unlink()
        for name in ("panels", "manual-trim", "samples"):
            path = OUTPUT / name
            if path.exists():
                shutil.rmtree(path)

    outliner = Outliner(FONT_PATH)
    surface_masters = {"body": "marking-master.svg", "jaw": "jaw-marking-master.svg"}
    artwork_by_surface = {}
    for surface, surface_layout in (("body", layout), ("jaw", jaw_layout)):
        row_geometries = []
        for row in range(surface_layout["rows"]):
            baseline = surface_layout["firstBaseline"] + row * surface_layout["rowSpacing"]
            row_geometries.extend(outliner.shape(poem, surface_layout["fontSize"], surface_layout["left"], baseline, surface_layout["textWidth"]))
        if not all(box(0, 0, MASTER_WIDTH, MASTER_HEIGHT).covers(item) for item in row_geometries):
            raise ValueError(f"The {surface} inscription extends beyond its UV master")
        artwork_by_surface[surface] = (row_geometries, STRtree(row_geometries))

        first_row = outliner.shape(poem, surface_layout["fontSize"], surface_layout["left"], surface_layout["firstBaseline"], surface_layout["textWidth"])
        first_row_paths = "".join(f'<path d="{polygon_path(item)}"/>' for item in first_row if not item.is_empty)
        row_uses = "".join(
            f'<use href="#poem-row" transform="translate(0 {fmt(row * surface_layout["rowSpacing"])})"/>'
            for row in range(surface_layout["rows"])
        )
        master = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<svg xmlns="http://www.w3.org/2000/svg" width="4096" height="1024" viewBox="0 0 8192 2048" role="img" aria-labelledby="title desc">\n'
            f'<title id="title">Much Ado About One Side — {surface} outlined marking master</title>'
            f'<desc id="desc">Transparent normalized UV reference artwork for the {surface}, with {surface_layout["rows"]} complete poem circuits. Dimensions are intentionally unitless; use the millimetre panel sheets for physical output. All lettering is flattened to closed outlines with even-odd holes and no live fonts.</desc>\n'
            f'<metadata>Great Vibes outlines, SIL Open Font License. Curve flattening tolerance {FLATTEN_TOLERANCE_MASTER} master units. Exact shaped poem: {xml_escape(poem)} Inspired by Jill’s reference; replace with her approved final vector master before a final sculpture run.</metadata>\n'
            f'<defs><g id="poem-row">{first_row_paths}</g></defs><g fill="#151816" fill-rule="evenodd">{row_uses}</g>\n</svg>\n'
        )
        (OUTPUT / surface_masters[surface]).write_text(master)

    body_source_count = len(geometry["indices"]) // 3
    jaw_source_count = len(geometry["jawGeometry"]["indices"]) // 3
    source_count = body_source_count + jaw_source_count
    source_facets = facets_for_mesh(geometry, "body") + facets_for_mesh(geometry["jawGeometry"], "jaw")
    sheet_count = pack_facets(source_facets)
    edge_matches = build_edge_matches(source_facets)
    sheet_marks: list[list[str]] = [[] for _ in range(sheet_count)]
    sheet_trims: list[list[str]] = [[] for _ in range(sheet_count)]
    panel_records = []
    maximum_error = 0.0
    maximum_exported_error = 0.0
    total_area_3d = 0.0
    total_area_flat = 0.0
    total_exported_area = 0.0
    artwork_within_panels = True
    all_sheets_within_stock = True

    facet_artwork = {}
    facet_targets = {}
    for facet in source_facets:
        row_geometries, art_tree = artwork_by_surface[facet.surface]
        target = translated_flat(facet)
        uv_master = facet.uv * np.array([MASTER_WIDTH, MASTER_HEIGHT])
        uv_triangle = Polygon(uv_master)
        candidates = art_tree.query(uv_triangle, predicate="intersects")
        clipped = []
        transform = affine_coefficients(uv_master, target)
        for candidate_index in candidates:
            intersection = row_geometries[int(candidate_index)].intersection(uv_triangle)
            if not intersection.is_empty:
                mapped = affinity.affine_transform(intersection, transform)
                mapped = mapped.intersection(Polygon(target).buffer(0.0001))
                if not mapped.is_empty:
                    clipped.append(mapped)
        artwork = unary_union(clipped) if clipped else GeometryCollection()
        artwork_within_panels = artwork_within_panels and artwork.difference(Polygon(target).buffer(0.0002)).area < 1e-6
        all_sheets_within_stock = all_sheets_within_stock and box(0, 0, STOCK_WIDTH, STOCK_HEIGHT).buffer(1e-9).covers(Polygon(target))
        facet_artwork[facet.identifier] = artwork
        facet_targets[facet.identifier] = target
        art_path = polygon_path(artwork)
        if art_path:
            sheet_marks[facet.sheet].append(f'<path data-facet="{facet.identifier}" d="{art_path}"/>')
        triangle_d = "M" + " ".join(f"{fmt(x)},{fmt(y)}" for x, y in target) + "Z"
        centroid = np.mean(target, axis=0)
        labels = [f'<text x="{fmt(centroid[0])}" y="{fmt(centroid[1])}" font-size="2.4" text-anchor="middle">{facet.identifier}</text>']
        for edge_number, (a, b) in enumerate(((0, 1), (1, 2), (2, 0)), 1):
            midpoint = (target[a] + target[b]) / 2
            labels.append(f'<text x="{fmt(midpoint[0])}" y="{fmt(midpoint[1])}" font-size="1.8" text-anchor="middle">E{edge_number}</text>')
        sheet_trims[facet.sheet].append(f'<g id="{facet.identifier}"><path d="{triangle_d}"/><g fill="#000" stroke="none">{"".join(labels)}</g></g>')

        source_lengths = [distance(facet.xyz[a], facet.xyz[b]) * MM_PER_INCH for a, b in ((0, 1), (1, 2), (2, 0))]
        flat_lengths = [distance(target[a], target[b]) for a, b in ((0, 1), (1, 2), (2, 0))]
        errors = [abs(source - flat) for source, flat in zip(source_lengths, flat_lengths)]
        exported_target = np.round(target, COORDINATE_DECIMALS)
        exported_lengths = [distance(exported_target[a], exported_target[b]) for a, b in ((0, 1), (1, 2), (2, 0))]
        exported_errors = [abs(source - flat) for source, flat in zip(source_lengths, exported_lengths)]
        maximum_error = max(maximum_error, *errors)
        maximum_exported_error = max(maximum_exported_error, *exported_errors)
        area_3d = triangle_area_3d(facet.xyz)
        area_flat = Polygon(target).area
        area_exported = Polygon(exported_target).area
        total_area_3d += area_3d
        total_area_flat += area_flat
        total_exported_area += area_exported
        panel_records.append({
            "id": facet.identifier,
            "sourceTriangleId": facet.source_identifier,
            "surface": facet.surface,
            "artworkMaster": surface_masters[facet.surface],
            "sheet": facet.sheet + 1,
            "markFile": f"panels/mark-sheet-{facet.sheet + 1:03d}.svg",
            "manualTrimFile": f"manual-trim/trim-sheet-{facet.sheet + 1:03d}.svg",
            "edgeLengthsMm": [round(value, 6) for value in source_lengths],
            "maximumUnfoldingEdgeErrorMm": round(max(errors), 9),
            "maximumExportedEdgeErrorMm": round(max(exported_errors), 6),
            "areaMm2": round(area_3d, 6),
            "xyzSourceInches": [[round(float(value), 9) for value in point] for point in facet.xyz],
            "sheetXYMm": [[round(float(value), COORDINATE_DECIMALS) for value in point] for point in target],
            "edgeMatches": edge_matches[facet.identifier],
            "uv": [[round(float(x), 9), round(float(y), 9)] for x, y in facet.uv],
        })

    panels_dir = OUTPUT / "panels"
    trims_dir = OUTPUT / "manual-trim"
    panels_dir.mkdir()
    trims_dir.mkdir()
    for sheet_index in range(sheet_count):
        marks = '<g id="laser-marking" fill="#000" fill-rule="evenodd">' + "".join(sheet_marks[sheet_index]) + "</g>"
        mark_svg = svg_document(STOCK_WIDTH, STOCK_HEIGHT, f"Laser marking sheet {sheet_index + 1}", "Millimetre-scale outlined marking art clipped to exact unfolded surface facets. Contains marking artwork only; no perimeter cutting path.", marks)
        (panels_dir / f"mark-sheet-{sheet_index + 1:03d}.svg").write_text(mark_svg)
        trims = '<g id="manual-trim-only" fill="none" stroke="#000" stroke-width="0.18">' + "".join(sheet_trims[sheet_index]) + "</g>"
        trim_svg = svg_document(STOCK_WIDTH, STOCK_HEIGHT, f"Manual trim sheet {sheet_index + 1}", "Print or reference after laser marking for mechanical trimming. Triangle borders are documentation, not enabled laser cutting paths.", trims)
        (trims_dir / f"trim-sheet-{sheet_index + 1:03d}.svg").write_text(trim_svg)

    # A compact outlined coupon: five script scales plus a physical 100 mm reference mark.
    coupon_parts = []
    coupon_rows = [(4.0, 20.0), (6.0, 45.0), (8.0, 75.0), (10.0, 110.0), (14.0, 150.0)]
    for size, baseline in coupon_rows:
        geoms = outliner.shape("palindove · mine is thine", size, 15.0, baseline)
        coupon_parts.extend(f'<path d="{polygon_path(item)}"/>' for item in geoms)
    coupon_parts.append('<path d="M15 175H115V176H15Z"/>')
    coupon = svg_document(250.0, 190.0, "Denhac aluminum marking test coupon", "Outlined Great Vibes calligraphy at 4, 6, 8, 10, and 14 mm em sizes, followed by a 100 mm by 1 mm reference bar. No live fonts, cutting perimeter, power, or speed settings.", '<g id="laser-marking" fill="#000" fill-rule="evenodd">' + "".join(coupon_parts) + "</g>")
    (OUTPUT / "denhac-test-coupon.svg").write_text(coupon)

    # A small, real surface fit sample: eight adjacent source triangles from the jaw.
    sample_dir = OUTPUT / "samples"
    sample_dir.mkdir()
    sample_source_ids = {f"jaw-T{number:04d}" for number in range(61, 69)}
    sample_facets = [item for item in source_facets if item.source_identifier in sample_source_ids]
    if len(sample_facets) != 8:
        raise ValueError(f"Expected eight representative jaw facets, found {len(sample_facets)}")
    sample_x = STOCK_MARGIN
    sample_y = STOCK_MARGIN
    sample_row_height = 0.0
    sample_marks = []
    sample_trims = []
    sample_ids = []
    for facet in sample_facets:
        original = facet_targets[facet.identifier]
        width = float(np.max(original[:, 0]) - np.min(original[:, 0]))
        height = float(np.max(original[:, 1]) - np.min(original[:, 1]))
        if sample_x + width > STOCK_WIDTH - STOCK_MARGIN:
            sample_x = STOCK_MARGIN
            sample_y += sample_row_height + PANEL_GAP
            sample_row_height = 0.0
        if sample_y + height > STOCK_HEIGHT - STOCK_MARGIN:
            raise ValueError("Representative jaw fit sample does not fit one stock sheet")
        dx = sample_x - float(np.min(original[:, 0]))
        dy = sample_y - float(np.min(original[:, 1]))
        moved_triangle = affinity.translate(Polygon(original), xoff=dx, yoff=dy)
        moved_art = affinity.translate(facet_artwork[facet.identifier], xoff=dx, yoff=dy)
        moved_points = original + np.array([dx, dy])
        art_path = polygon_path(moved_art)
        if art_path:
            sample_marks.append(f'<path d="{art_path}"/>')
        trim_path = polygon_path(moved_triangle)
        center = moved_triangle.centroid
        edge_labels = []
        for edge_number, (a, b) in enumerate(((0, 1), (1, 2), (2, 0)), 1):
            midpoint = (moved_points[a] + moved_points[b]) / 2
            edge_labels.append(f'<text x="{fmt(midpoint[0])}" y="{fmt(midpoint[1])}" font-size="2" text-anchor="middle">E{edge_number}</text>')
        sample_trims.append(f'<g id="{facet.identifier}"><path d="{trim_path}"/><g fill="#000" stroke="none"><text x="{fmt(center.x)}" y="{fmt(center.y)}" font-size="2.4" text-anchor="middle">{facet.identifier}</text>{"".join(edge_labels)}</g></g>')
        sample_ids.append(facet.identifier)
        sample_x += width + PANEL_GAP
        sample_row_height = max(sample_row_height, height)
    fiducials = '<path d="M4 7H10M7 4V10M294.8 7H300.8M297.8 4V10" fill="none" stroke="#000" stroke-width="0.25"/>'
    sample_mark_svg = svg_document(STOCK_WIDTH, STOCK_HEIGHT, "Representative jaw fit sample — marking", "Millimetre-scale outlined marking art for eight adjacent jaw source triangles. Two outside-art crosshair marks register the separate manual trim document; no perimeter cutting paths are present.", '<g id="registration-marks">' + fiducials + '</g><g id="laser-marking" fill="#000" fill-rule="evenodd">' + "".join(sample_marks) + "</g>")
    sample_trim_svg = svg_document(STOCK_WIDTH, STOCK_HEIGHT, "Representative jaw fit sample — manual trim", "Mechanical trim and test-assembly reference for the separate representative marking sheet. Align its two crosshairs to the marks before mechanical trimming. Not an enabled laser-cut operation.", '<g id="registration-marks">' + fiducials + '</g><g id="manual-trim-only" fill="none" stroke="#000" stroke-width="0.18">' + "".join(sample_trims) + "</g>")
    (sample_dir / "representative-jaw-fit-mark.svg").write_text(sample_mark_svg)
    (sample_dir / "representative-jaw-fit-manual-trim.svg").write_text(sample_trim_svg)

    # UV assembly map. Text is documentation and deliberately absent from all marking files.
    map_items = []
    for facet in source_facets:
        points = " ".join(f"{fmt(x * MASTER_WIDTH)},{fmt(y * MASTER_HEIGHT)}" for x, y in facet.uv)
        center = np.mean(facet.uv * np.array([MASTER_WIDTH, MASTER_HEIGHT]), axis=0)
        map_items.append(f'<polygon points="{points}"/><text x="{fmt(center[0])}" y="{fmt(center[1])}">{facet.identifier}</text>')
    assembly = (
        '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="300" viewBox="0 0 8192 2048" role="img" aria-labelledby="title desc">'
        '<title id="title">Surface facet assembly map</title><desc id="desc">Normalized UV map tying every facet identifier to the sculpture surface. Consult manifest edgeMatches for adjacency.</desc>'
        '<style>polygon{fill:none;stroke:#222;stroke-width:2}text{font:8px sans-serif;fill:#555;text-anchor:middle}</style>' + "".join(map_items) + '</svg>\n'
    )
    (OUTPUT / "assembly-map.svg").write_text(assembly)

    geometry_digest = hashlib.sha256(json.dumps(geometry, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    blockers = [
        "Source GLB has no unit metadata; millimetres assume the original viewer’s inch interpretation.",
        "The one-inch conceptual skin allowance intersects at the sculpture crossing; collision clearance is unresolved.",
        "This exact-facet archive preserves the coarse preview mesh, but it is not a certified continuous foil blanket or distortion-managed developable panelization.",
        "Panel seams, overlap tabs, adhesive, registration, and a practical assembly order require a physical mock-up.",
        "Replace the Great Vibes approximation with Jill’s approved final outlined handwriting before the final sculpture run.",
        "Denhac staff must approve the actual material and settings from a supervised coupon test; no machine job, power, speed, or G-code is supplied.",
        "Do not laser-cut bare aluminum foil or adhesive-backed material; mechanically trim intact marked sheet after the job.",
    ]
    reciprocal_edges = True
    for facet_id, edge_groups in edge_matches.items():
        for edge_number, peers in enumerate(edge_groups, 1):
            if len(peers) != 1:
                reciprocal_edges = False
                continue
            peer_id, peer_edge_text = peers[0].rsplit(":E", 1)
            peer_edge = int(peer_edge_text)
            reciprocal_edges = reciprocal_edges and f"{facet_id}:E{edge_number}" in edge_matches[peer_id][peer_edge - 1]
    readme = f"""MUCH ADO ABOUT ONE SIDE — DENHAC LASER REFERENCE KIT

PURPOSE
This archive contains outlined vector artwork for supervised laser MARKING tests and an exact-facet reference atlas for the current coarse sculpture skin. The black filled paths in panels/ are the only intended laser-marking artwork. Files in manual-trim/ are documentation for mechanical trimming after marking; they are not laser cutting files.

SHOP AND MATERIAL CANDIDATE
Denhac currently documents the OMTech Pro Quantum 60 W Class 4 CO2 RF laser with a 600 × 1000 mm cutting area. A candidate stock for testing is unbacked silver AlumaMark sheet, 0.005 in / 0.127 mm thick, 304.8 × 508 mm. The manufacturer says sizes, thicknesses, finishes, and adhesive options vary, so verify that exact unbacked combination before buying. Confirm the stock, coating, ventilation, and shop rules with the laser area host before use.

Official references:
- Denhac machine and mandatory training notes: https://denhac.org/wiki/laser-cutter-ultra-secret
- Denhac allowed-material guidance: https://denhac.org/wiki/allowed-laser-cutter-materials
- AlumaMark manufacturer specifications: https://alumamark.com/
- AlumaMark manufacturer brochure: https://alumamark.com/wp-content/uploads/2024/10/alumamark-brochure.pdf

SAFE WORKFLOW
1. Open denhac-test-coupon.svg. It is 250 × 190 mm and contains outlined script at 4, 6, 8, 10, and 14 mm em sizes plus a 100 × 1 mm reference bar.
2. Have Denhac staff select marking settings for the actual material. This kit intentionally contains no power/speed preset or machine job.
3. Verify the 100 mm reference bar after import. Abort if the application changes scale.
4. Mark intact unbacked sheet. Do not laser-cut bare foil, adhesive, release liner, or perimeter paths from this kit.
5. Mechanically trim after marking using the separate manual-trim templates, then test fit a representative area before making the full archive.
6. Start with representative-fit-kit.zip: print the manual-trim page on paper first, confirm its 304.8 × 508 mm page and crosshair spacing, and dry-assemble jaw-T0061 through jaw-T0068. Then mark the companion SVG on a test sheet, align the two shared outside-art crosshairs, mechanically trim, and test fit. These are four adjacent surface quads from the actual jaw, not a generic drawing.

FILE ROLES
marking-master.svg — transparent, unitless 8192 × 2048 normalized UV art for the body, with {layout["rows"]} complete poem circuits. The taller UV lettering compensates for the body's long reading path so it stays legible on the sculpture. It is not physically dimensioned.
jaw-marking-master.svg — separate normalized UV art for the shorter jaw, with {jaw_layout["rows"]} complete poem circuits. Jaw facets use this master, not the body's lettering proportions.
denhac-test-coupon.svg — practical millimetre coupon with flattened, closed outlines and no fonts.
panels/mark-sheet-NNN.svg — 304.8 × 508 mm marking-only sheets. Artwork is clipped by the exact unfolded triangle boundary, but the boundary is absent from the laser layer.
manual-trim/trim-sheet-NNN.svg — separate triangle boundaries and IDs for mechanical trimming/reference. Never import these as a laser-cut operation.
assembly-map.svg — normalized UV diagram tying IDs to the displayed surface.
manifest.json — provenance, geometry checks, file hashes, facet/sheet associations, matching-edge IDs, and unresolved blockers.
samples/representative-jaw-fit-mark.svg — one-sheet marking-only fit sample drawn from eight adjacent jaw source triangles.
samples/representative-jaw-fit-manual-trim.svg — separate mechanical trim/reference companion for that sample.

OPEN-SOURCE REUSE
The project-authored poem, artwork, geometry, fabrication files, code, and documentation in this kit may be used, changed, fabricated, exhibited, sold, and shared under your choice of the MIT License or Apache License 2.0. Keep the notice and chosen license with redistributed source or files. Great Vibes remains separately licensed under the SIL Open Font License 1.1. See REUSE.txt and the three license files bundled with this kit for the exact scope and terms.

GEOMETRY
The shared preview/export sampling produces {source_count} triangles ({body_source_count} body and {jaw_source_count} jaw), all of which fit the candidate stock directly. The archive keeps a one-to-one triangle identity on {sheet_count} stock sheets and fails generation if any triangle would require exporter-only subdivision. Every flat triangle is a rigid unfolding of its 3D triangle; maximum computed edge-length error is {maximum_error:.9f} mm and maximum error after SVG coordinate rounding is {maximum_exported_error:.6f} mm. Curves were flattened at {FLATTEN_TOLERANCE_MASTER} master units before clipping. SVG coordinates are rounded to {COORDINATE_DECIMALS} decimals.

READINESS BLOCKERS
""" + "\n".join(f"- {blocker}" for blocker in blockers) + "\n"
    (OUTPUT / "README.txt").write_text(readme)

    internal_manifest = {
        "producer": PRODUCER,
        "schemaVersion": 1,
        "generatedFrom": "shared/FABRICATION_GEOMETRY_OPTIONS + src/lib/foil-geometry.ts + shared/poem.ts",
        "geometryDigestSha256": geometry_digest,
        "foilSectionsSha256": sha256(ROOT / "shared" / "foil-sections.json"),
        "geometryGeneratorSha256": sha256(ROOT / "src" / "lib" / "foil-geometry.ts"),
        "geometryOptions": options,
        "inscriptionLayout": layout,
        "jawInscriptionLayout": jaw_layout,
        "physicalScale": {"sourceCoordinateUnitAssumption": "inch", "millimetresPerSourceUnit": MM_PER_INCH, "sourceHasEmbeddedUnits": False},
        "stockMm": {"width": STOCK_WIDTH, "height": STOCK_HEIGHT, "margin": STOCK_MARGIN},
        "licensing": {"projectAuthored": "MIT OR Apache-2.0", "font": "OFL-1.1", "scope": "REUSE.txt"},
        "artwork": {"font": "Great Vibes", "fontSha256": sha256(FONT_PATH), "license": "SIL Open Font License", "liveFonts": False, "curveFlatteningToleranceMasterUnits": FLATTEN_TOLERANCE_MASTER, "masterViewBox": [0, 0, 8192, 2048], "surfaceMasters": surface_masters},
        "coverage": {"sourceTriangles": source_count, "bodySourceTriangles": body_source_count, "jawSourceTriangles": jaw_source_count, "generatedFacets": len(source_facets), "coveredSourceTriangleIds": len(set(item.source_identifier for item in source_facets)), "bodyGeneratedFacets": sum(1 for item in source_facets if item.surface == "body"), "jawGeneratedFacets": sum(1 for item in source_facets if item.surface == "jaw"), "stockSheets": sheet_count, "representativeFitSampleFacetIds": sample_ids},
        "inputDigestSha256": hashlib.sha256(json.dumps({"geometry": geometry, "layout": layout, "jawLayout": jaw_layout, "options": options, "poem": poem}, sort_keys=True, separators=(",", ":")).encode()).hexdigest(),
        "poemSha256": hashlib.sha256(poem.encode()).hexdigest(),
        "layoutSha256": hashlib.sha256(json.dumps(layout, sort_keys=True, separators=(",", ":")).encode()).hexdigest(),
        "jawLayoutSha256": hashlib.sha256(json.dumps(jaw_layout, sort_keys=True, separators=(",", ":")).encode()).hexdigest(),
        "verification": {"maximumUnfoldingEdgeErrorMm": maximum_error, "maximumExportedEdgeErrorMm": maximum_exported_error, "maximumAllowedExportedEdgeErrorMm": 0.01, "totalMeshAreaMm2": total_area_3d, "totalFlatAreaMm2": total_area_flat, "totalExportedAreaMm2": total_exported_area, "absoluteAreaErrorMm2": abs(total_area_3d - total_area_flat), "absoluteExportedAreaErrorMm2": abs(total_area_3d - total_exported_area), "allArtworkClippedToFacetBoundaries": artwork_within_panels, "allSheetsWithinStock": all_sheets_within_stock, "allAreasPositive": all(record["areaMm2"] > 0 for record in panel_records), "allSourceTrianglesCovered": len(set(item.source_identifier for item in source_facets)) == source_count, "edgeMatchesAreReciprocal": reciprocal_edges},
        "readiness": "REFERENCE_ONLY_NOT_PRODUCTION_CERTIFIED",
        "unresolvedBlockers": blockers,
        "panels": panel_records,
    }
    if maximum_exported_error > 0.01 or not artwork_within_panels or not all_sheets_within_stock or not internal_manifest["verification"]["allAreasPositive"] or not internal_manifest["verification"]["allSourceTrianglesCovered"] or not internal_manifest["verification"]["edgeMatchesAreReciprocal"]:
        raise RuntimeError(f"Laser artifact verification failed: {internal_manifest['verification']}")
    internal_manifest_bytes = (json.dumps(internal_manifest, indent=2) + "\n").encode()

    archive_path = OUTPUT / "panel-kit.zip"
    for name, source in LICENSE_FILES.items():
        if not source.is_file():
            raise FileNotFoundError(f"Missing canonical license file: {source}")
        (OUTPUT / name).write_bytes(source.read_bytes())
    archive_files = [OUTPUT / "README.txt", *[OUTPUT / name for name in LICENSE_FILES], *[OUTPUT / name for name in surface_masters.values()], OUTPUT / "denhac-test-coupon.svg", OUTPUT / "assembly-map.svg", *sorted(sample_dir.glob("*.svg")), *sorted(panels_dir.glob("*.svg")), *sorted(trims_dir.glob("*.svg"))]
    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        manifest_info = zipfile.ZipInfo("panel-kit-manifest.json", date_time=(2026, 9, 14, 0, 0, 0))
        manifest_info.compress_type = zipfile.ZIP_DEFLATED
        manifest_info.external_attr = 0o644 << 16
        archive.writestr(manifest_info, internal_manifest_bytes, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
        for path in archive_files:
            info = zipfile.ZipInfo(path.relative_to(OUTPUT).as_posix(), date_time=(2026, 9, 14, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)

    sample_id_set = set(sample_ids)
    internal_pairs = set()
    for facet_id in sample_ids:
        for edge_number, peers in enumerate(edge_matches[facet_id], 1):
            peer = peers[0]
            peer_id = peer.rsplit(":E", 1)[0]
            if peer_id in sample_id_set:
                internal_pairs.add(tuple(sorted((f"{facet_id}:E{edge_number}", peer))))
    if not internal_pairs:
        raise RuntimeError("Representative fit sample has no internal matching edges")
    internal_pairing_guide = "\n".join(
        f"- {left} ↔ {right}" for left, right in sorted(internal_pairs)
    )

    representative_readme = f"""REPRESENTATIVE JAW FIT SAMPLE

Selected actual surface facets: {', '.join(sample_ids)}. They form four adjacent quads on the jaw around the v=0.25–0.333 region. This README carries every matching edge internal to the sample; no external manifest is needed for the paper-first test.

PAPER FIRST
1. Print representative-jaw-fit-manual-trim.svg at 100% / actual size on tiled paper. The SVG page is 304.8 × 508 mm.
2. Confirm the two registration crosshairs are 290.8 mm apart horizontally and that the page was not scaled.
3. Cut the paper triangles by hand and tape their matching edges to check curvature and assembly order.
4. Only after that succeeds, have trained Denhac staff run representative-jaw-fit-mark.svg on approved test stock using settings established by the separate coupon.
5. The two crosshairs are marking/registration strokes outside the facet art. Align the manual trim reference to those marks, then mechanically trim. No metal perimeter cutting path is included or authorized.

INTERNAL MATCHING EDGES
{internal_pairing_guide}

Edges not listed above connect to facets outside this eight-facet sample and remain open during this local test. E1, E2, and E3 are printed beside each triangle edge on the manual-trim page.

The sample validates scale, registration, mark quality, manual trimming, and local fit only. It does not resolve the full sculpture crossing, global panel seams, overlap tabs, adhesive, or continuous blanket construction.

OPEN-SOURCE REUSE
The project-authored files may be used, changed, fabricated, exhibited, sold, and shared under your choice of MIT or Apache-2.0. Keep the notice and chosen license with redistributed files. Great Vibes remains under OFL-1.1. See REUSE.txt and the bundled license files.
"""
    representative_path = OUTPUT / "representative-fit-kit.zip"
    representative_files = [sample_dir / "representative-jaw-fit-mark.svg", sample_dir / "representative-jaw-fit-manual-trim.svg"]
    with zipfile.ZipFile(representative_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in [("README.txt", representative_readme.encode()), *[(name, path.read_bytes()) for name, path in LICENSE_FILES.items()], *[(path.name, path.read_bytes()) for path in representative_files]]:
            info = zipfile.ZipInfo(name, date_time=(2026, 9, 14, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)

    public_files = [path for path in sorted(OUTPUT.rglob("*")) if path.is_file() and path.name != "manifest.json"]
    public_manifest = dict(internal_manifest)
    public_manifest["files"] = [{"path": path.relative_to(OUTPUT).as_posix(), "bytes": path.stat().st_size, "sha256": sha256(path)} for path in public_files]
    public_manifest["archiveEntries"] = [{"path": "panel-kit-manifest.json", "bytes": len(internal_manifest_bytes), "sha256": hashlib.sha256(internal_manifest_bytes).hexdigest()}, *[{"path": path.relative_to(OUTPUT).as_posix(), "bytes": path.stat().st_size, "sha256": sha256(path)} for path in archive_files]]
    (OUTPUT / "manifest.json").write_text(json.dumps(public_manifest, indent=2) + "\n")

    print(f"Generated {len(source_facets)} exact facets on {sheet_count} stock sheets; max edge error {maximum_error:.9f} mm.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: generate-laser.py INPUT.json")
    main(Path(sys.argv[1]))
