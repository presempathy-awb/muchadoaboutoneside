MUCH ADO ABOUT ONE SIDE — DENHAC LASER REFERENCE KIT

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
marking-master.svg — transparent, unitless 8192 × 2048 normalized UV art for the body, with 4 complete poem circuits. The taller UV lettering compensates for the body's long reading path so it stays legible on the sculpture. It is not physically dimensioned.
jaw-marking-master.svg — separate normalized UV art for the shorter jaw, with 18 complete poem circuits. Jaw facets use this master, not the body's lettering proportions.
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
The shared preview/export sampling produces 3832 triangles (3596 body and 236 jaw), all of which fit the candidate stock directly. The archive keeps a one-to-one triangle identity on 446 stock sheets and fails generation if any triangle would require exporter-only subdivision. Every flat triangle is a rigid unfolding of its 3D triangle; maximum computed edge-length error is 0.000000000 mm and maximum error after SVG coordinate rounding is 0.001042 mm. Curves were flattened at 0.35 master units before clipping. SVG coordinates are rounded to 3 decimals.

READINESS BLOCKERS
- Source GLB has no unit metadata; millimetres assume the original viewer’s inch interpretation.
- The one-inch conceptual skin allowance intersects at the sculpture crossing; collision clearance is unresolved.
- This exact-facet archive preserves the coarse preview mesh, but it is not a certified continuous foil blanket or distortion-managed developable panelization.
- Panel seams, overlap tabs, adhesive, registration, and a practical assembly order require a physical mock-up.
- Replace the Great Vibes approximation with Jill’s approved final outlined handwriting before the final sculpture run.
- Denhac staff must approve the actual material and settings from a supervised coupon test; no machine job, power, speed, or G-code is supplied.
- Do not laser-cut bare aluminum foil or adhesive-backed material; mechanically trim intact marked sheet after the job.
