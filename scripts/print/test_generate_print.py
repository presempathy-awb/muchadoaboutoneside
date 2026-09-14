#!/usr/bin/env python3
"""Focused checks for the print generator's geometric intersection validator."""

from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

import numpy as np
import trimesh


GENERATOR_PATH = Path(__file__).resolve().parents[1] / "generate-print.py"
SPEC = importlib.util.spec_from_file_location("generate_print", GENERATOR_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Could not load the print generator")
GENERATOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(GENERATOR)


def triangle_pair(first: list[list[float]], second: list[list[float]]) -> trimesh.Trimesh:
    return trimesh.Trimesh(
        vertices=np.asarray(first + second, dtype=np.float64),
        faces=np.asarray([[0, 1, 2], [3, 4, 5]], dtype=np.int64),
        process=False,
    )


class TriangleIntersectionTests(unittest.TestCase):
    def test_detects_non_coplanar_crossing(self) -> None:
        mesh = triangle_pair(
            [[-1, -1, 0], [1, -1, 0], [0, 1, 0]],
            [[0, -0.5, -1], [0, -0.5, 1], [0, 0.5, 0]],
        )
        self.assertEqual(GENERATOR.count_nonadjacent_triangle_intersections(mesh), 1)

    def test_detects_coplanar_overlap(self) -> None:
        mesh = triangle_pair(
            [[-1, -1, 0], [1, -1, 0], [0, 1, 0]],
            [[-0.5, -0.5, 0], [0.5, -0.5, 0], [0, 0.5, 0]],
        )
        self.assertEqual(GENERATOR.count_nonadjacent_triangle_intersections(mesh), 1)

    def test_rejects_separated_triangles(self) -> None:
        mesh = triangle_pair(
            [[-1, -1, 0], [1, -1, 0], [0, 1, 0]],
            [[-1, -1, 2], [1, -1, 2], [0, 1, 2]],
        )
        self.assertEqual(GENERATOR.count_nonadjacent_triangle_intersections(mesh), 0)


if __name__ == "__main__":
    unittest.main()
