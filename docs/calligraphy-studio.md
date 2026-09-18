# Calligraphy worksheet studio

The studio at `/calligraphy/practice` makes printable sheets and editable templates for a calligrapher. The starting sheet is US Letter **landscape**, 24 evenly spaced horizontal rules, no example text, and no slants. Existing inscription masters and canonical poem files remain separate.

## Delivery and acceptance

- Share one validated physical layout between the preview and vector PDF. Offer plain rules, Copperplate/italic zones, grid, optional slants, paper dimensions, margins, exact spacing, guide appearance, pages and a scale check.
- Keep a separate initially empty Yjs text editor. Load a copy of either poem wording on request, retain manual breaks, estimate wrap/rows/sheets, and provide font, size, color, alignment and width controls.
- Store the draft and named templates locally, synchronize tabs, report storage failures truthfully, and provide versioned digital backups. No publicly shared poem room receives worksheet text or photos. Accounts do not currently exist on this site; browser storage works without authentication and is not a cross-device account backup.
- Import photos locally, normalize image size, and require a known measurement for physical calibration. A photo is a reference, not OCR or automatic identification of a handwriting font. Reference printing is an explicit choice.
- Ordinary PDFs contain only selected visible content. Editable-PDF export explicitly includes a recognized template attachment; raw reference photos and uploaded font files are omitted from that attachment. Digital backups can contain these assets. Arbitrary third-party PDFs are not editable studio templates.
- Include techniques for underlays, light pads/windows, opaque-paper graphite transfer, pencil ruling and materials testing. Distinguish animal vellum from translucent drafting paper and vellum surface finishes.
- Verify generated geometry, font/text layout, persistence, template round trips, PDF structure, production HTTP, and browser interactions within approved computer-control scope. Open a canonical PR, pass CI and review, publish the sanitized public snapshot, then stage and deploy the exact reviewed release with a recorded rollback target.

## Dependencies and references

Existing Yjs, CodeMirror and browser storage supply editing and persistence. `pdf-lib@1.17.1` and `@pdf-lib/fontkit@1.1.1` provide font embedding, vector PDFs, and template attachments behind a lazy adapter. Both are MIT licensed and have old release dates; isolate PDF parsing, bound imports and keep digital JSON as the stable editable format. Do not execute imported PDF content.

## Fonts and physical lettering

The curated collection includes Great Vibes, Pinyon Script, Imperial Script,
Italianno, Herr Von Muellerhoff, and Mrs Saint Delafield. These are lettering
and design references; a decorative typeface does not teach Copperplate stroke
order or pressure. Keep dedicated hand-authored exercises and historical
exemplars distinct from font samples.

The font gallery loads the selected families' Latin-only Fontsource WOFF2 files
on demand. Worksheets use the complete, pinned Google Fonts TTFs, because the
small gallery subsets omit some alternate letters and stylistic features.
The same shaped outlines supply the worksheet preview and PDF for bundled and
uploaded fonts, including when HarfBuzz is selected. Outlined lettering stays
vector-sharp but is not ordinary selectable PDF text; the standard reference
serif, sans, and mono fonts retain a text fallback. Editable worksheet
attachments retain the original text.

Point sizing remains the default for existing templates. Lowercase-height mode
uses the font's x-height to calculate the point size for a physical measurement
in millimeters; the guide-matching action copies the worksheet guide height.
When font metadata is missing, an outline-derived height is an estimate.
Only features advertised by the selected full font appear in the alternate
letter controls. Feature overrides, shaping engine, lowercase height, and
practice pattern are saved with the draft and portable templates.

The model/trace/blank pattern reserves three writing rows per line of text:
one model, one faint tracing copy, and one blank practice row. Page estimates
include those rows. Ink-bound checks include flourishes, ascenders, descenders,
and horizontal width scaling; text that would leave the paper blocks export.
Overlapping neighboring rows are reported separately so the writer can adjust
spacing. The comparison download uses a common lowercase height across fonts
and does not replace the current worksheet draft.

Fontkit is the default shaper. HarfBuzz.js 1.6.1, containing HarfBuzz 14.4.0,
loads only when selected. The full TTFs, gallery subsets, and WASM come from
the same site, with no runtime font CDN requests. Exact source revisions and
hashes are in `public/fonts/worksheet-fonts.provenance.json`. The security
review, advisory scope, and remaining parser limitations are recorded in
[the font security review](calligraphy-font-security.md).

`bun run verify:worksheet-fonts` checks font provenance and dependency pins.
`bun run build` checks the manifest for lazy loading, six small WOFF2 previews,
one core WASM, and absence of the unused HarfBuzz subsetter. The server supplies
the correct WOFF2 and WASM MIME types.

Bickham Script is not bundled: a public tool where visitors apply a font to
their own text needs an appropriate generator license. An Adobe Fonts
subscription alone does not cover that use; see [Adobe's licensing FAQ](https://helpx.adobe.com/fonts/web/font-licensing/font-licensing.html).
No paid font files or licenses are purchased by this release.

- [pdf-lib document API](https://pdf-lib.js.org/docs/api/classes/pdfdocument)
- [pdf-lib attachment extraction discussion](https://github.com/Hopding/pdf-lib/issues/534)
- [CSS paged media](https://www.w3.org/TR/css-page-3/)
- [Logos Calligraphy guides](https://s3.amazonaws.com/kajabi-storefronts-production/file-uploads/sites/94612/themes/1600613/downloads/48010e4-c054-2f2a-6f7b-ad8a2484ea8_Copperplate_Guidesheet_Packet.pdf)
- [Canson translucent vellum](https://us.canson.com/artist-series-vidalon-vellum)
- [The Postman’s Knock: light boxes](https://thepostmansknock.com/need-light-box-includes-giveaway/)
- [Alvalyn Creative: graphite transfer](https://alvalyn.com/how-to-use-graphite-paper-to-transfer-drawings/)

Browser storage can be cleared or evicted. Saving a portable backup is the durable way to carry work to another browser or device. Physical printing still requires a ruler check at 100% scale.
