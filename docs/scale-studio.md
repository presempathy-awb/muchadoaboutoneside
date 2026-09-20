# 3D scale studio and reference images

The homepage puts the scale surface, model resizer, working versions, and lettering
proof together. `/scales` opens the same study with the detailed construction
controls; both use the same browser draft. The continuous foil edition remains at
`/foil`. `/references` preserves the three supplied reference originals, with
download links and an inventory of byte counts and SHA-256 fingerprints.

## Geometry and lettering

The archival conforming study follows the existing body and separate jaw surface. Plates
have irregular, seeded outlines and staggered divisions; their triangulated
faces follow the source surface instead of bridging each curved region with a
single fan. Planar faces remain an explicit alternative. Local relief may be
reduced where the requested offset would invert a face. The page reports that
adjustment. Neither mode is a measured reconstruction of the photographs or a
certified flat cutting pattern.

The model selector keeps the archival wood construction and the actual printable
maquette separate. The six-foot preset uses the archival proportions. The 180 mm
preset uses the boolean-unioned print mesh, including its integrated plinth.
Connected charts derived from that exact STL provide the maquette's mapping;
writing rectangles stay inside the covered triangle regions. Resizing the preview
does not regenerate or certify the previously published STL or foil kit.
Creases and tiny boolean facets add seams, so the maquette's density controls
are targets rather than a promise of the archival model's plate count. Its
plate dimensions are remeasured from emitted geometry. Excessive metric
variation or shear makes a face unsuitable for lettering; that face stays
visible, receives no text, and contributes to the reported unletterable count.
The current suitable-face tolerance is 5% axis variation and a 0.03 shear cosine.
Curved surface previews remain physical-size estimates, not flat marking masters.

Target height and percentage controls rescale the substrate first. Stock,
adapters, relief, text size, and margins remain in real physical units. A larger
model gains writing room; changing its font or its plates recalculates the fit.
If fixed layers fold a small surface, the page retains the last valid preview and
asks for thinner stock or a larger model. The thin-prototype action is explicit.
Wood, printed, and hybrid construction choices and joint notes travel with the
saved study. Printed adapters still require measured mating surfaces and a fit test.

Local body width and depth can each be adjusted from 0.5 to 2 times the source
cross-section. They start linked, so one edit changes both; turn linking off to
tune them independently. These controls change the thickness around the snake's
fixed centerline, rather than stretching the entire sculpture along a global
axis. The archival base retains its source footprint. The maquette keeps its
integrated base fixed and uses smooth transition collars at the body/base union.
Uniform height resizing remains a separate control. Body edits preserve physical
stock, raised scale depth, lettering size, margins, and the current wording and
font. Old saved studies without body factors load with identity factors of 1.

Body edits regenerate the bare surface, scales and safe writing regions, then
recalculate text assignment with the same deterministic, non-AI allocator. Actual
bounds are measured from the emitted deformed vertices. Neither the local body
controls nor the scale preview generate a newly validated manufacturing model;
the preserved STL and published fabrication patterns remain historical artifacts
with their original dimensions.

The maquette's derived radial map is generated offline with
`python3 scripts/generate-scale-body.py`; use `--check` to verify it without
writing files. The dependency-free generator projects onto the original tube
operands and records source and generator hashes, which the regular test suite
checks. It writes only `shared/scale-maquette-body.json`.

The generator runs in a disposable module worker. A newer request terminates
the previous worker, and an old response cannot replace the current result.
The last successful preview remains available while the next one is computed.

Text assignment is deterministic and runs locally without AI. Font shaping or
measured scanned-ink spans feed the allocator, which walks the poem in reading
order and fits complete words inside each plate's safe writing rectangle.
Changed geometry, wording, type size, margins, font or scan metrics trigger a
new layout. Geometry-cache keys include every normalized shape setting, including
both body factors; cached geometry never substitutes for fitting the current text. Excess words remain
explicit overflow rather than being omitted or rewritten.

## Tunable plate shapes and the photographs

The shape controls are available beside the homepage resizer as well as in the
studio. Choose clipped wood plates, rectangles, diamonds, or the original plate
outline. Cover mode keeps the complete surface cell and uses the requested
width-to-height as an approximate course-layout target. The archival generator
adapts the number of real courses within the rows × columns cell budget, then
redistributes column spacing from physical distances along each course. It does
not shrink faces to enforce an exact aspect, avoiding broad strips of empty
surface. The maquette retains its existing chart topology and clipping while
adjusting the cell grid to the requested face aspect.
Inset mode fits an exact physical face-aspect target by shrinking inside the
original cell; zero keeps the cell proportions. New archival inset shapes use
128 distance samples to redistribute column spacing, while legacy shapes bypass
that redistribution. Both modes preserve repeatable variation and disjoint cells.
Strong aspect changes in inset mode can expose larger gaps between plates.
Corner cut adjusts clipped corners, taper changes the
relative widths of the opposite ends, and seeded variation produces repeatable
irregularity. Changing these settings regenerates the geometry and the lettering
layout together for both the archival surface and the actual maquette. Writing
stays within the regenerated safe region; a narrower or more pointed face can
leave less room for a word.

A fresh study starts with clipped wood plates, a 1.3 width-to-height target,
0.04 corner cut, 0.025 taper, 100 × 4 target cells, a 0.02 gap, 0.3 variation,
1.05 inches maximum relief, and a matte warm-wood preview color. Cover mode is
the new-study default; the aspect is approximate rather than an exact face ratio. These are editable visual assumptions. The supplied photographs show
chunky short rectangles and trapezoids with clipped corners and stepped edges.
Many near-facing faces appear roughly 1.1–1.7 times as long as their short edge,
but camera perspective changes that ratio. The 1.3 starting value is a visual
interpretation, not calibration of the photographed construction. Neither image
contains a complete orthogonal view or a usable dimensional reference.

The comparison panel shows cropped views of the sculpture using the unchanged
original screenshots. It reports generated face aspect and relief-to-short-edge
ratios beside actual bare and clad geometry bounds. Opening a reference still
shows the complete original. A saved schema-1 study without the new controls
loads the original outline and cell proportions; its existing relief, layers,
wording, font, and colors are retained. Missing old color settings retain the
former gray. Saving or exporting a tuned study carries all shape controls, including cover or
inset mode. Studies and history saved before this mode existed load as inset;
custom gaps, relief, body factors and lettering settings are retained.

Both models render a solid bare body underneath the plates, so gaps reveal the
underlying support rather than the scene behind the sculpture. The preview uses
matte wood shading. Fresh reference settings target 90–95% coverage: measured
plate footprints cover about 92.1% of the archival body and jaw, and 95.0% of
the eligible print-model surface. Tests also check resized bodies. These are
surface-area measurements with relief removed, so raised plate sides cannot
inflate the coverage. Archival faces are compared with the matching supported
body and jaw; print faces are compared directly with the bare chart surface at
zero support offset. Custom gaps and outlines can change
the result. Coverage is evaluated on the mapped body surface; the
original archival base and the maquette's unmapped base underside are outside
that comparison. A coverage percentage describes the generated study and is not
a fabrication-clearance or installation guarantee.

## Browsing working versions

The version browser offers nine geometry presets: four actual-print
studies at 180, 240, 360, and 720 mm, plus 36-inch wood, 72-inch curved wood,
72-inch planar hybrid, and full archival-height studies, plus a photo-reference
clipped-wood study. The original eight retain their earlier outlines, gaps, variation, counts and
relief settings, using inset mode. The photo-reference version applies the new geometry defaults. Each
preset states its support, metal, and relief assumptions. Choosing one applies those construction
settings while preserving the current wording, font, colors, and notes. A valid
geometry preset does not guarantee that arbitrary lettering will fit or that a
physical assembly has adequate clearances.

Up to eight recently displayed working shapes are saved in this browser. This
small history contains body factors, plate shape and construction settings rather
than duplicate font files or text. Reopening an existing shape preserves the navigation order.
Only successfully prepared previews enter this history. The current complete
view remains visible while a new font, layout, or geometry is loading or fails.
The page automatically builds a recent-geometry cache as valid studies finish.
It reuses matching geometry when returning to a recent study, with at most four
entries and a 96 MiB conservative memory-estimate budget. Close-set archival
studies are large enough that only two typically fit. Every normalized
geometry setting, including body width and depth, participates in the key. The
cache is page-local; it is not a persistent mesh store or a server precomputation.
Reloading preserves the settings and history, then rebuilds the meshes.

Optional adaptive plate density uses a saved physical-size reference. Increasing
the model size requests more rows and columns; decreasing it requests fewer.
Local body width and depth additionally change the row target using the relative
perimeter of an ellipse formed by the two body factors. Columns stay tied to
uniform size because body edits leave the centerline fixed. This row response is
an estimated girth target: actual cross-sections vary along the sculpture.
Calculations always use the saved size and body-factor reference, so repeated
size or thickness changes do not accumulate rounding error. Editing the density
deliberately sets a new reference. Minimum counts and preview budgets still apply and are reported; the maquette's original
chart seams still establish a floor on its actual piece count. Material thickness,
relief, type size, and margins remain in physical units.

Camera movement uses a short eased transition and preserves orbit and relative
zoom during ordinary edits. Pointer, wheel, or keyboard input interrupts camera
animation. Archival fittings fade with the model: outgoing fittings retain their
previous size, and incoming fittings use the destination size from the start.
The renderer prepares each replacement before retiring the current
surface, with at most two skins during a short crossfade. Failed preparation
retains the previous skin. Rapid selections keep the active fade continuous and
coalesce to the latest requested replacement. Reduced-motion preferences complete transitions
immediately. A cancellable fade deadline also releases queued previews when a
background tab stops receiving animation frames. These controls improve continuity; actual frame rate still depends
on device, texture load, and the chosen density.

## Lettering

On a first homepage visit, the selected poem supplies the wording. A saved draft,
including intentionally empty wording, takes precedence. The detailed studio's
new draft starts empty. A poem selection copies its wording into the study without
editing the canonical poem. Whole words flow through ordered body and jaw
faces, within each face's safe rectangle and the chosen physical margins.
Automatic fitting uses the loaded embedded font's shaped outlines and ink bounds,
including glyph overhang, ligatures and vertical flourishes. Fontkit and HarfBuzz
are loaded on demand; the actual glyph paths used to measure are also drawn.
The system-font options use the browser's own canvas measurements and drawing.
A bounded search chooses between the requested and minimum type sizes.
Words that cannot fit are displayed explicitly. Type size is an em size in
millimetres, not a handwriting x-height.

All six bundled calligraphy fonts and embedded custom TTF/OTF fonts use the same
algorithm. Custom font files are limited to 2 MB and structurally validated by
the existing font loader. Unsupported glyphs and unsupported OpenType features
are reported explicitly. Metrics and glyph paths use bounded caches for the
current font and wording; an infinite catalog of font/text/size combinations is
not precomputed. A font's successful load does not imply that it covers every script.

Only lettered faces receive texture space. Rectangular atlas slots follow the
physical face proportions. Crisp detail targets 64 pixels per em; Balanced targets
24. The allocator respects the device's texture size, permits pages up to 4096
pixels on a side, and retains the existing 16,777,216 base-pixel total budget per
skin. It reports the achieved density when the target cannot fit that budget.
Mipmaps and anisotropic filtering reduce shimmer at oblique angles. A quality
change rebuilds the matching UV coordinates without changing physical lettering.

The close-up proof redraws the same font outlines or retained scan pixels used by
the texture. Fit, 100%, and 200% views, an expanded proof, and lettered-face
navigation make close inspection possible. The backing canvas follows device
pixel ratio within an eight-million-pixel cap. Zooming a source scan cannot recover
detail missing from its saved pixels.

## Measurements without AI

The visibility report uses deterministic arithmetic and ink measurements, with no
model, OCR judgment, or external image upload. It checks the current wording's
placement count, measured safe-area overflow, configured ink/paper color contrast,
and available texture detail. Vector fonts use measured outline bounds; a font's
em size or line spacing is never substituted for lowercase x-height. Scans use the
retained alpha image to measure ink instead of assuming that a word's rectangular
selection is filled with writing.

The project's proof targets are 4.5:1 color contrast and 12 pixels of measured ink
or lowercase x-height. A measured stroke sample, when available, uses a 1.5-pixel
target. These are explicit diagnostic thresholds, not a guarantee that every
script is readable or a claim of WCAG compliance for a lit 3D object. Unknown
measurements are identified as such. Proof-color contrast does not model metallic
reflections, real lighting, transparent ink, or paper texture. Native scan detail
is reported separately because increasing an atlas cannot restore absent pixels.

Physical fit, texture detail, and screen size answer different questions. Making
the sculpture larger can provide more writing room while camera auto-framing makes
the same physical letters occupy fewer screen pixels. Use the close-up proof or
zoom for inspection, and make an actual-size material sample before fabrication.

**Enlarge until the words fit** searches supported sizes while keeping the requested
physical type size, margins, layer stack, and density policy. It tests a bounded
series of sizes, refines below a successful trial, and reports the smallest size it
successfully tested. It does not claim a global minimum: changes in chart topology
or adaptive plate density can make fit non-monotonic. Cancel or edit the study to
stop the search; an unsuccessful search retains the current design.

## Dimensions and added layers

The archival model is 206.3 inches high, 171 inches wide, and 171 inches deep,
including its base. Those are model dimensions, not a measurement of the
photographed finished sculpture. The available project history does not establish
which photographed construction layers were included in that model.

The old foil study's one-inch radial allowance was a modeling estimate. It is
exposed here as an editable additional support allowance. Enter only remaining
layers not already represented in the archived surface: support or wood,
backing or leveling, adhesive, metal, finish, and local overlap. Zero defaults
mean no allowance has been entered; they do not prove a layer is absent. The
0.127 mm metal default records the existing proposed stock, not a confirmed
purchase or installed thickness.

The section comparison applies the local body factors, then adds each allowance
to the two local ellipse semiaxes and numerically integrates its perimeter. The scale relief stage is a maximum
envelope estimate. It does not trace a tape measure across every gap and step.
Actual rendered cladding bounds are reported separately from the full model
including its base. The photo comparison uses bare body-and-jaw bounds without
the archival square base, then compares them with emitted plate faces and
sidewalls. That distinction avoids mistaking the 171-inch base footprint for
the curved body width or depth. The maquette comparison includes its integrated
plinth because it is part of the actual print solid. Adding twice the radial
buildup to the sculpture's overall height would be misleading, so the comparison uses the generated vertices.

Measure the actual prepared support, complete layer stack, jaw gaps, and crossing
clearances before making physical templates. The existing large-sculpture guide
covers neighboring paper templates, continuous support, edge margins, joint
movement, attachment samples, and installation records.

## Saving and publication

The current study is saved in this browser. A JSON download carries geometry and
body factors, layer assumptions, wording, selected font (including embedded custom bytes),
construction notes, colors, and fit settings to
another browser. Imports are bounded and normalized; they cannot load remote
fonts, scripts, or arbitrary asset URLs. Design imports are capped at 3 MB. This surface does not claim account
synchronization. The separately developed account-backed worksheet service has
its own deployment requirements.

The reference originals are site assets, included in source control and each
release rather than browser storage. Andrew explicitly approved publishing the
complete originals on September 18, 2026, including the surrounding windows in
the two screenshots. Publication permits only the reviewed image paths with
their matching hashes. Private source paths and unrelated archives remain
excluded. Third-party image and interface content retains its respective rights.
