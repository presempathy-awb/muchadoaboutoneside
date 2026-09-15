# Much Ado About One Side

A sculpture studio for the figure-eight snake, with an aluminum-foil inscription edition: explore the original model, follow the poem around its covered surface, inspect the component groups, and download the preserved source files.

**3D design by [iani schrodinger](https://www.facebook.com/profile.php?id=100009324056794).**

- Public source: [presempathy-awb/muchadoaboutoneside on GitHub](https://github.com/presempathy-awb/muchadoaboutoneside)
- Canonical project archive (sign-in required): [awb/muchadoaboutoneside on Gitea](https://git.telpher.stream/awb/muchadoaboutoneside)
- Public site: [muchadoaboutoneside.com](https://muchadoaboutoneside.com)
- Public foil edition: [muchadoaboutoneside.com](https://muchadoaboutoneside.com) (`/foil` remains an alias)
- Source conversation: [Claude share](https://claude.ai/share/f424ef86-dcac-4e63-aecb-a017ed781b5b)

## Make something of your own

Artists, makers, teachers, and curious people are welcome to use any part of the project: remix the poem, change the geometry, build a sculpture, exhibit it, sell your work, or use the code in another project. Commercial use is welcome. Linking back is appreciated, but is not an extra license condition.

Project-authored code, poem, designs, artwork, fabrication files, and documentation are dual licensed **MIT OR Apache-2.0**, at your option. Choose one license and follow its terms, including its required notices. See [reuse guidance](REUSE.md), [MIT](LICENSE-MIT), and [Apache 2.0](LICENSE-APACHE). Third-party components keep their own licenses: the bundled Great Vibes font is OFL-1.1, and [third-party notices](THIRD_PARTY_NOTICES.md) accompany the dependencies. This does not require the generated calligraphy artwork to use OFL.

- [Download the complete public source](https://github.com/presempathy-awb/muchadoaboutoneside/archive/refs/heads/main.zip)
- [Large sculpture foil kit](https://muchadoaboutoneside.com/fabrication/laser/panel-kit.zip?v=0a253226337f873b23fd82ac9a43844e39f2dbc516a8b2a1a0fce2f38d66184e)
- [180 mm foil kit](https://muchadoaboutoneside.com/fabrication/small-foil/foil-kit-180mm.zip?v=9d99556ff16a270cd652e0a79ca71421394e6b156c155a502ecc9af135ea1f71)
- [Printable 180 mm STL](https://muchadoaboutoneside.com/fabrication/print/muchado-maquette-180mm.stl)
- [Editable sculpture OBJ](https://muchadoaboutoneside.com/api/assets/snake_build.obj)
- [Poem text](https://muchadoaboutoneside.com/editions/much-ado-about-one-side.txt)

The public repository includes the working website, generators, tests, and original model assets. Private reference photography, browser-retrieval captures, private Git history, and host-specific deployment configuration remain in the maintainer's private archive.

## Run locally

Use Bun **1.4.2** or newer. `mise.toml` pins Bun 1.4.2 and a compatible Node 22 runtime for tools with Node shebangs; `mise install` is optional if those runtimes are already available.

```sh
bun install --frozen-lockfile
bun run dev
```

Open [the sculpture studio](http://127.0.0.1:5173). One command starts Vite on `127.0.0.1:5173` and Elysia on `127.0.0.1:3001`; `/api` requests are proxied by Vite. Ctrl-C stops both processes. Development uses these fixed ports and fails if they are occupied.

```sh
bun run build
bun run start
```

The production server serves the Vite build and the API together at [127.0.0.1:3001](http://127.0.0.1:3001). `HOST` and `PORT` can override production defaults. You can host your own copy using these commands or create a slim deployable bundle with [the release packager](deploy/package-release.ts): `bun deploy/package-release.ts --output /tmp/muchado-releases`. Configure your own process manager, reverse proxy, and domain around that bundle. The hosted example is [muchadoaboutoneside.com](https://muchadoaboutoneside.com).

## Site views

- **Project instructions** (`/instructions`): compare the source sculpture, 180 mm maquette, and Letter-landscape paper masters with millimetre/inch display controls. Follow the making steps, protect paper, foil, and the maquette separately, then arrange the CoLab iani handoff. Section links (`#dimensions`, `#make`, `#pack`, `#send`) open the relevant step directly. A printable packing slip has blank recipient and shipment fields; confirm the address and receiving arrangements directly before mailing.
- **Endless inscription** (`/`, with `/foil` alias): a silver skin follows the original body and head. Four rows repeat the complete poem around closed reading paths on the large body. Taller lettering in its UV master compensates for the long surface path so the script reads clearly on the foil. The shorter lower jaw keeps a separate eighteen-row inscription master. The page also shows the 180 mm printed form covered in marked foil. A scale selector switches the flat artwork between the large UV master and the small dimensioned marking sheet. Workshop downloads are grouped by scale, with separate foil kits and a smooth STL substrate for printing the small model.
- **Sculpture studio** (`/studio`): Babylon.js loads the original GLB. Orbit, zoom, select parts, hide/show components, toggle wireframe or rotation, and reset the view. Reduced-motion preferences are respected. A model download remains available if WebGL cannot start.
- **Assembly map** (`/assembly`): React Flow shows the seven named component groups. Drag nodes, select a component, and open it in the studio. Edges represent model membership, not engineering connections or construction order.
- **Files & source** (`/archive`): download each original file and inspect its SHA-256 checksum. The standalone HTML viewer is served as an attachment.
- **Calligraphy guide** (`/calligraphy`, with `/calligraphy/steps`, `/calligraphy/templates`, `/calligraphy/quick`, and `/calligraphy/details`): the hand-lettering brief for Jill in five chapters, with a downloadable printable PDF (`/guide/calligraphy-guide.pdf`) that contains the same content plus Letter-landscape template sheets.

TanStack Router handles navigation and TanStack Query retrieves project metadata from Elysia. The UI uses generated shadcn Button, Badge, and Card components, Radix primitives, and Tailwind 4.

The homepage links directly to making, lettering, and packing, with in-page navigation for the sculpture, dimensions, artwork, and downloads. The inscription can be read in either script or plain type. Navigation and model controls retain readable labels on small screens; route changes update the page title and browser back navigation restores the scroll position.

### Dimensions and handoff content

`shared/dimensions.ts` reads the original model dimensions from the source manifest, the maquette dimensions from the print manifest, and the paper size from the lettering guide. It converts units only for display. The original model remains in source inches; the separate print stays Z-up in millimetres. Dimensions are labeled by height, width, and depth to avoid confusing the print's Z axis with the source model's Y axis. Rounded display values are for reference, not a replacement for the original files.

`shared/project-instructions.ts` holds the making and packing checklists. The CoLab iani destination is not verified in the source material. The site supplies preparation instructions and a blank handoff sheet; it does not collect or store shipping details. The packing slip prints independently from the rest of the page. Website-only typography for the calligraphy chapters lives in `src/site-guide.css`, so the shared physical template layout and committed PDF stay unchanged.

## Fabrication exports

The wrapped preview and laser reference archive share the sampling in `shared/fabrication.ts`. The lettering is shaped from the bundled Great Vibes font and converted to closed vector contours; the body and jaw each use their own outlined master for both the wrapped texture and the corresponding laser panels. The flat preview shows the body master. The original editable SVG is retained as a design source. The normalized UV master has no physical cutting scale. The separate marking coupon and developed facets use explicit millimeter dimensions.

Denhac documents an operational [OMTech Pro Quantum 60 W RF CO₂ laser](https://denhac.org/wiki/laser-cutter-ultra-secret) with a 600 × 1000 mm working area. Its [material policy](https://denhac.org/wiki/allowed-laser-cutter-materials) supports specified aluminum marking workflows, rather than establishing bare household foil as suitable. The proposed stock is unbacked 0.005-inch (0.127 mm) silver AlumaMark, a [manufacturer-documented CO₂-markable aluminum](https://alumamark.com/wp-content/uploads/2024/10/alumamark-brochure.pdf). Confirm the exact product, shop acceptance, and a successful coupon on that lot before preparing the full set. Mark it flat, mechanically trim it, and apply attachment materials afterward. The files do not contain validated machine settings or an aluminum laser-cut job.

The complete facet archive is a reference and fit-test kit. Its scale follows the original viewer's inch interpretation, and the conceptual envelope still has unresolved crossing and seam-fit constraints. Exact triangle development proves edge lengths and artwork placement; it does not establish that the full outside blanket can be installed without adjustments. Do not order or mark the complete full-scale material quantity before a representative fit test.

The separate 180 mm display maquette is a smooth printed substrate for its own foil kit, including the visible integrated base. STL coordinates are millimeters and Z-up; GLB previews use meters and Y-up. Its dimensions fit Denhac's documented [Prusa MK4S](https://denhac.org/wiki/prusa-3d-printer). Review supports and layers in the actual printer profile before printing, then apply the marked foil. The calligraphy is carried by the foil rather than embossed into the plastic. The small patterns use the actual printable surface, which differs from a scaled copy of the large conceptual skin. They do not replace the preserved source STL.

Small-pattern dimensions and digital surface coverage can be verified before fabrication; the material still needs a physical marking and fit test. In particular, the print's minimum modeled diameter is 2.4 mm, so test the proposed 0.127 mm aluminum stock around the narrow tail before marking the whole kit. Follow the small kit's separate marking and mechanical-trim instructions; attachment is applied after marking.

Generation uses isolated Python environments; the running site has no Python dependency:

```sh
python3.14 -m venv /tmp/muchado-laser-venv
/tmp/muchado-laser-venv/bin/pip install -r scripts/laser-requirements.txt
FABRICATION_PYTHON=/tmp/muchado-laser-venv/bin/python bun run generate:laser

# Print generator (validated with Python 3.9.6):
python3.9 -m venv /tmp/muchado-print-venv
/tmp/muchado-print-venv/bin/pip install -r scripts/print/requirements.txt
/tmp/muchado-print-venv/bin/python scripts/generate-print.py
/tmp/muchado-print-venv/bin/python scripts/generate-print.py --check

# Small foil generator (Python 3.14 and ImageMagick 7):
python3.14 -m venv /tmp/muchado-small-foil-venv
/tmp/muchado-small-foil-venv/bin/pip install -r scripts/small-foil/requirements.txt
SMALL_FOIL_PYTHON=/tmp/muchado-small-foil-venv/bin/python bun run generate:small-foil
SMALL_FOIL_PYTHON=/tmp/muchado-small-foil-venv/bin/python bun run generate:small-foil --check
```

Large laser artifacts and their manifest are in `public/fabrication/laser/`. The 180 mm foil patterns, textured GLB, and manifest are in `public/fabrication/small-foil/`; generate them with `SMALL_FOIL_PYTHON` set to an isolated Python environment containing `scripts/small-foil/requirements.txt`, then run `bun run generate:small-foil`. Print artifacts are in `public/fabrication/print/` with provenance in `shared/print-manifest.json`. Regenerate the printable model first if its generator or source geometry changes.

## Stack

Direct dependency versions were checked against the npm registry on **2026-09-14** and are pinned in `package.json`; `bun.lock` records the complete resolution.

| Tool | Version |
| --- | --- |
| Bun | 1.4.2 |
| TypeScript | 7.0.2 |
| Vite / React plugin | 8.3.0 / 6.1.1 |
| React / React DOM | 19.3.0 |
| Elysia | 1.4.30 |
| Babylon.js core / loaders | 9.26.1 |
| React Flow | 12.11.6 |
| TanStack Query / Router | 5.102.8 / 1.170.36 |
| Tailwind / Vite plugin | 4.3.3 |
| shadcn generator | 4.21.0 |
| Biome | 2.5.13 |

TypeScript 7 uses the ordinary `typescript` package and `tsc`; no native-preview package or compatibility compiler is required. The configuration omits the removed `baseUrl` option. shadcn components were generated from the official registry and use the local `cn` utility.

Telpher Things informed the Bun/Vite/Elysia development split. Gitea CI follows Telpher's `ubuntu-latest` runner and pinned checkout-action convention, with a pinned Bun setup action. This project has no runtime dependency on Telpher services.

## Foil and lettering study

Andrew's poem is preserved in `source/poem/much-ado-about-one-side.txt`; `shared/poem.ts` supplies the same wording to the page and lettering generators. The wrapped texture uses the outlined master produced by the laser generator. The final ellipsis returns to the opening line. Run `bun run generate:inscription` and `bun run generate:laser` after deliberate lettering changes; generation-only Python dependencies are described above.

`shared/calligraphy-guide.ts` is the hand-lettering brief for Jill: the measured Great Vibes proportions, the working size on paper (7 mm x-height, 19.6 mm em, 55° slant, 1 mm minimum stroke so hairlines survive the 2.5 mm em of the 180 mm maquette), the 23-row master plan, materials, and every chapter's text. `src/components/calligraphy/` renders that data both as the `/calligraphy` pages and as `public/guide/calligraphy-guide.html`; `bun run generate:guide` rewrites the HTML and renders `public/guide/calligraphy-guide.pdf` with a local headless Chrome (`CHROME_BIN` overrides the binary, `--no-pdf` skips it). The HTML is byte-checked by `bun run check`; the PDF is committed because Chrome stamps dates into it. The rendered script in the guide is the Great Vibes stand-in and is labelled as such; Jill's scanned rows replace it.

Jill's supplied photograph remains in the maintainer's private archive. Its song text is not the inscription. The public prototype uses locally bundled **Great Vibes** under the [SIL Open Font License](public/fonts/OFL.txt), chosen for its slanted script and flourished capitals. It is an editable substitute for Jill's eventual hand-lettered master, not a claim that the font is her handwriting. The photo is excluded from the public repository, website, and deployment package.

`shared/foil-sections.json` records sections recovered from the original GLB: 34 body ribs, four additional upper-head sections, and three lower-jaw sections. `src/lib/foil-geometry.ts` samples them into a capped surface, preserving the head and jaw's elliptical profiles. Each reading row travels tail-to-nose on one face, across the nose, back along the other face, and across the tail, with longitudinal UV coordinates proportional to that row's arc length. The central main reading circuit is approximately **1,135.0 source inches**. The original head and tail remain separate; no bridge is added. This is an orientable capped tube, not a Möbius strip.

The model remains a conceptual surface. UV seams converge at the side boundaries, head/tail caps distort lettering, and the one-inch skin allowance can overlap at the tight crossing. Watertight mesh tests do not establish collision-free construction. The new exact-facet kit develops the shared coarse mesh into dimensioned triangles; final panel grouping, overlaps, local lettering scale, surface clearances, and actual handwritten outlines still require fit and marking tests. The original `public/editions/endless-inscription-study.svg` retains editable text and an embedded font. The new `public/fabrication/laser/marking-master.svg` contains outlined UV artwork, and its separate marking sheets use physical millimeter coordinates. Denhac's documented laser and the proposed AlumaMark stock are identified above; the actual stock lot, material acceptance, settings, and Jill's final lettering master remain to be confirmed for a production run.

## Source archive

The four files Andrew supplied from Downloads are preserved byte for byte in `source/assets/`:

| File | Bytes | Use |
| --- | ---: | --- |
| `snake_build.glb` | 302,520 | Original 3D scene used by the new viewer |
| `snake_build.obj` | 422,696 | Named component geometry; inches, Y-up |
| `snake_build.stl` | 693,884 | Binary triangle mesh |
| `snake_build_viewer.html` | 343,578 | Original Three.js viewer with embedded geometry |

`source/assets/manifest.json` contains checksums and extraction provenance. Source metadata gives dimensions of **171 × 206.3 × 171 inches** (width × height × depth), with **13,876 triangles** across ribs, slats, spine, head, eyes, fangs, and base. The original viewer's palette is reproduced in the Babylon viewer. The archived HTML references an external Three.js CDN; the new site bundles Babylon locally.

**The Claude conversation transcript remains unimported.** The public page returned an application shell and the snapshot endpoint returned a browser-verification challenge. Retrieval evidence remains in the private archive. The supplied artifacts do not establish that every file or conversation in the surrounding Claude Project has been recovered.

## Validation

```sh
bun run check
bun run build
bun run smoke
```

`check` runs Biome's recommended rules, TypeScript 7, Bun tests, source-asset verification, generated-inscription verification, and generated-guide verification. Tests cover metadata, original download bytes, response headers, unknown-file rejection, production SPA routing, exact poem wording, the lettering brief's row plan and proportions, closed reading paths, valid mesh triangles, welded watertightness, source coordinate bounds, and print artifact provenance. Dimension tests check source-inch conversion, print-axis mapping, paper orientation, and feet-and-inches precision. Instruction tests verify the making and packing content and download targets. Laser tests verify geometry and poem provenance, source-triangle coverage, physical edge lengths against the actual preview mesh, reciprocal edge labels, clipped marking vertices, explicit millimeter units, and artifact/ZIP-entry hashes. Asset verification checks SHA-256, GLB structure and triangle totals, and binary STL size/count. `smoke` starts the production app on an ephemeral loopback port and checks all eleven routes, built entry assets, metadata, original downloads, inscription/font downloads, laser archives, the STL and GLB, private-source rejection, and API 404 behavior over HTTP. These checks do not substitute for browser/WebGL visual review or a physical fabrication test.

GitHub's `.github/workflows/site.yml` runs a frozen install, checks, build, and HTTP smoke tests on public pushes and pull requests. The private canonical archive also runs its Gitea workflow.

## Contributions

Pull requests and adaptations are welcome. Unless you explicitly state otherwise, contributions intentionally submitted by you for inclusion in this project are dual licensed MIT OR Apache-2.0 without additional terms or conditions.

## Maintainer publication

The public GitHub repository starts with a clean snapshot rather than the private archive's history. From a clean, reviewed commit in the canonical archive, run `bun run export:public --output /tmp/muchado-public-snapshot`. The exporter selects public source files, excludes private archives and host configuration, rejects symlinks and known private image bytes, and records the source commit and file hashes in `PUBLIC_SNAPSHOT.json`. It does not publish anything or copy Git history. Verify a frozen install, `bun run check`, `bun run build`, and `bun run smoke` in the exported snapshot before updating GitHub. Keep the GitHub checkout separate from the private archive; do not push the private repository's refs to GitHub.

## Layout

```text
src/                 React views, shadcn components, Babylon scene
shared/project.ts    Project/API types
shared/poem.ts       Exact inscription text shared by the UI and generator
shared/foil-sections.json  Cross sections recovered from the source model
server/              Elysia API and production static serving
scripts/             Dev process runner and source verification
public/editions/     Generated lettering SVG and poem download
public/fonts/        Licensed local script font
public/fabrication/  Outlined marking/reference files and printable maquette
source/assets/       Original model files and manifest
source/poem/         Original inscription wording
deploy/              Portable slim release packager
public/licenses/     Downloadable reuse terms and third-party notices
```
