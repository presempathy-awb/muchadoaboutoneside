# Calligraphy font dependency and security record

Verified 2026-09-17. This record covers the calligraphy studio's curated font
packages and shaping engine. It separates observed package and asset evidence
from recommended controls that may still need implementation.

## Selected dependencies

The approved exact pins are:

- `harfbuzzjs@1.6.1`
- `@fontsource/pinyon-script@5.3.0`
- `@fontsource/imperial-script@5.3.0`
- `@fontsource/italianno@5.3.0`
- `@fontsource/herr-von-muellerhoff@5.3.0`
- `@fontsource/mrs-saint-delafield@5.3.0`
- `@fontsource/great-vibes@5.3.0`

Keep the existing `pdf-lib@1.17.1` and `@pdf-lib/fontkit@1.1.1` pins.
HarfBuzz supplements Fontkit; it does not replace the Fontkit interface that
`pdf-lib` uses to embed custom fonts.

All seven newly selected npm packages have no install or postinstall script and
no runtime dependencies. Fontsource packages are OFL-1.1. `harfbuzzjs` is MIT.
The lockfile is the canonical record of each registry SHA-512 integrity value.

Supply-chain evidence:

- `harfbuzzjs@1.6.1` has npm SLSA v1 provenance, a GitHub OIDC trusted
  publisher, and source `gitHead` `8aa047b90387790b255b118cf45ad11691a38910`.
  Its `v1.6.1` tag is signed and verified.
- All six Fontsource packages have npm SLSA v1 provenance and source `gitHead`
  `02b28c06b126c852a5b966b44aef777ca923f6f6`.
- `npm audit signatures` verified 214 registry signatures and 113 provenance
  attestations for the installed dependency graph.
- `bun audit` returned `{}`, meaning no advisory matches were reported for the
  installed lockfile at verification time.

See the [npm provenance documentation](https://docs.npmjs.com/viewing-package-provenance/),
the [Fontsource publishing workflow](https://github.com/fontsource/font-files/blob/main/.github/workflows/manual-run.yml),
and the [`harfbuzzjs` v1.6.1 release](https://github.com/harfbuzz/harfbuzzjs/releases/tag/v1.6.1).

## HarfBuzz version and advisory review

`harfbuzzjs@1.6.1` embeds HarfBuzz 14.4.0 at full upstream commit
[`36cb489cb02ce4b92099669ba9f9bea348eff93f`](https://github.com/harfbuzz/harfbuzz/commit/36cb489cb02ce4b92099669ba9f9bea348eff93f).
That release includes fixes for malformed-font crashes and hangs, glyph-position
overflow, and unbounded memory use in a COLR path.

The embedded version is newer than the affected ranges in the reviewed upstream
advisories:

- [GHSA-q4gc-p4hh-3765](https://github.com/harfbuzz/harfbuzz/security/advisories/GHSA-q4gc-p4hh-3765):
  heap over-read before HarfBuzz 14.0.0.
- [GHSA-xvjr-f2r9-c7ww](https://github.com/harfbuzz/harfbuzz/security/advisories/GHSA-xvjr-f2r9-c7ww):
  null dereference before HarfBuzz 12.3.0.
- [GHSA-p965-5rr7-9mhq](https://github.com/harfbuzz/harfbuzz/security/advisories/GHSA-p965-5rr7-9mhq):
  debug-message buffer overflow through HarfBuzz 11.2.1.
- [GHSA-qmp9-xqm5-jh6m](https://github.com/harfbuzz/harfbuzz/security/advisories/GHSA-qmp9-xqm5-jh6m):
  an older Cairo integration overflow affecting HarfBuzz 8.5.0 through 10.0.1.
  The tiny WebAssembly build does not include the Cairo backend.

An exact-version [OSV API](https://google.github.io/osv.dev/api/) batch query on
2026-09-17 returned no npm advisory records for the seven new packages,
`pdf-lib@1.17.1`, `@pdf-lib/fontkit@1.1.1`, or its locked `pako@1.0.11`
dependency. An empty advisory query is evidence about published records, not a
proof that a parser has no undiscovered vulnerability.

## Runtime and transfer budgets

The inspected `harfbuzzjs@1.6.1` package contains:

| Artifact | Raw bytes | Approximate Brotli bytes |
| --- | ---: | ---: |
| `harfbuzz.wasm` | 426,620 | 142,327 |
| HarfBuzz runtime wrapper | 31,763 | 5,841 |
| Main JavaScript API | 82,693 | 14,220 |
| `harfbuzz-subset.wasm` | 622,493 | not required |

Importing `harfbuzzjs` initializes its WASM through top-level await. It must be
loaded with a memoized dynamic import after a feature or export operation needs
it. The production build should not emit the unused `harfbuzz-subset.wasm`.

The six Fontsource Latin WOFF2 assets total 191,424 bytes. Individual files are
17,720 to 42,800 bytes. The six complete Google Fonts TTF files total 1,083,296
bytes; the largest is Great Vibes at 457,588 bytes. The implemented loading
policy is:

- no new font or WASM transfer on the initial site or studio route;
- opening the optional visual gallery loads its six small WOFF2 samples,
  191,424 bytes total, with cached per-family promises;
- one complete selected TTF, at most 457,588 bytes, when example text or its
  estimate needs measurement; the explicit six-font comparison loads all six;
- the HarfBuzz core only when that engine is selected and text needs shaping, approximately
  162 KiB Brotli for WASM and its JavaScript runtime.

The application self-hosts these assets and makes no runtime request to Google
Fonts, Fontsource, unpkg, or another font CDN. Full TTF requests carry their
pinned SHA-256 in the URL; the server caches only a matching catalog digest
immutably, and the client verifies the downloaded bytes. Unversioned or
incorrect-digest URLs retain the site's no-store policy. Gallery WOFF2 and WASM
use Vite's hashed immutable asset URLs.

## Font source and feature parity

The complete TTF files are pinned to `google/fonts` commit
`a54f7446f84a1125ef6bf08baa46f3639e8905e0`:

| File | SHA-256 |
| --- | --- |
| `PinyonScript-Regular.ttf` | `4aab130a6ed27f8b8117738c84a5602edf9300cdcc0651a9a65bf96f451ac29a` |
| `ImperialScript-Regular.ttf` | `fa040ae596cde82559c3bcf056ac216a94efa904b848382ab85740d38df4bab7` |
| `Italianno-Regular.ttf` | `f6ae96dea0da46c73370eb0575848ab0eda190315bdfda3f5b252bba3dc9173c` |
| `HerrVonMuellerhoff-Regular.ttf` | `ba8ac10807a79462b7c8265b2eebb8419e5017fdc1a5828b1a071d9e8478772e` |
| `MrsSaintDelafield-Regular.ttf` | `67a7abc298ce9d368b2c00fcbff52ec54be948889b8a59032ae80ca3322e5b34` |
| `GreatVibes-Regular.ttf` | `8d509802186f1b51572531ecf313e8098f9a5bfdfaca93f0c9b34467f9982d15` |

The corresponding Fontsource WOFF2 and Google TTF files were parsed with the
existing Fontkit. Every pair matched on PostScript name, full name, internal
font version, and units per em.

The Fontsource Latin subsets deliberately prune glyphs and some OpenType
features. For example, the complete Italianno TTF has `aalt`, `dlig`, `hlig`,
`salt`, `smcp`, and `ss01` through `ss03` features that its Latin WOFF2 does
not retain. The complete Great Vibes TTF similarly retains `aalt`, `dlig`,
`salt`, `ss01` through `ss04`, `subs`, and `sups` features omitted from its
Latin WOFF2.

Use Fontsource WOFF2 for ordinary browser text. Feature discovery, alternate
letters, flourishes, exact shaped preview, and PDF export must use the complete
pinned TTF so screen and PDF glyph choices agree.

## Remaining risk and recommended controls

Bundled fonts are pinned, reviewed data. User-imported fonts remain untrusted
binary parser input. WebAssembly limits native-process exposure, but malformed
fonts can still consume browser CPU and memory, trap the module, or freeze an
interactive task.

Implemented safeguards include a 2 MiB decoded font limit, uncompressed TTF/OTF
signature and table-directory checks, bounded table and glyph counts, finite
metrics, input and glyph-path limits, and both count and byte limits for shaped
run caches. Font files remain in the browser; neither parser uploads them.
The font gallery, selected shaper, and export surface errors without replacing
the saved draft.

The remaining recommendations are not claimed as implemented by this record:

- Parse and shape imported fonts in a dedicated Web Worker.
- Terminate the worker on a shaping timeout and surface a recoverable error.

The current synchronous shaping path uses the browser main thread. Structural
validation cannot guarantee that every malicious internally cyclic font is
safe; a killable parser timeout needs a worker boundary.

## License record

The six curated fonts are licensed under OFL-1.1. Keep each family copyright
and OFL text with redistributed font assets. Keep the Google TTF and Fontsource
WOFF2 files unmodified; additional subsetting counts as modification and can
trigger Reserved Font Name requirements. See the
[Google Fonts repository license guidance](https://github.com/google/fonts/blob/main/README.md)
and the [SIL OFL guidance](https://software.sil.org/oflt/).

Include both the `harfbuzzjs` MIT license and the upstream HarfBuzz Old MIT
notice. The upstream notice is pinned at
[`COPYING`](https://github.com/harfbuzz/harfbuzz/blob/36cb489cb02ce4b92099669ba9f9bea348eff93f/COPYING).

Bickham Script is not part of this dependency set. A visitor-facing generator
that applies it to user-supplied text requires a license explicitly covering
that product use; an ordinary Adobe Fonts subscription should not be assumed
to grant it. Acquisition needs a separately reviewed, qualified license and
explicit purchase authorization. See [Adobe Fonts licensing](https://helpx.adobe.com/fonts/using/font-licensing.html).
