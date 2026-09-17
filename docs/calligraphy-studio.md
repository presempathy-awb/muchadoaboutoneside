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

- [pdf-lib document API](https://pdf-lib.js.org/docs/api/classes/pdfdocument)
- [pdf-lib attachment extraction discussion](https://github.com/Hopding/pdf-lib/issues/534)
- [CSS paged media](https://www.w3.org/TR/css-page-3/)
- [Logos Calligraphy guides](https://s3.amazonaws.com/kajabi-storefronts-production/file-uploads/sites/94612/themes/1600613/downloads/48010e4-c054-2f2a-6f7b-ad8a2484ea8_Copperplate_Guidesheet_Packet.pdf)
- [Canson translucent vellum](https://us.canson.com/artist-series-vidalon-vellum)
- [The Postman’s Knock: light boxes](https://thepostmansknock.com/need-light-box-includes-giveaway/)
- [Alvalyn Creative: graphite transfer](https://alvalyn.com/how-to-use-graphite-paper-to-transfer-drawings/)

Browser storage can be cleared or evicted. Saving a portable backup is the durable way to carry work to another browser or device. Physical printing still requires a ruler check at 100% scale.
