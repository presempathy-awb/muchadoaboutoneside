# Calligraphy assistant knowledge

The studio assistant uses 43 concise, attributed entries in
`shared/calligraphy-knowledge.ts`. They cover pointed-pen and broad-edge
practice, posture, movement, spacing, manuscript layout, paper and underlays,
bounded ink tests, print calibration, illumination, troubleshooting, and
turning reviewed lettering into a font. It is a curated collection, not “all
calligraphy knowledge” and not a substitute for a teacher, a historical
exemplar, or the instructions and safety label for a physical material.

Each entry contains a stable ID, title, topic terms, an original paraphrase, and
the exact source URL. Local retrieval is deterministic: words from the question
are matched against entry topics, titles, and text, with topics weighted most
heavily. Latin diacritics are normalized before matching. It returns at most
eight entries and uses a stable starter set when recognized tokens have no
match. Questions with no Latin lexical tokens, including entirely Chinese or
Arabic questions, receive the script-tradition boundary note instead of Latin
practice defaults. The selection does not call a model, download a page, or
treat web content as instructions.

## Downloadable library

`shared/calligraphy-library.ts` is the stable manifest for complete guides that
can be exposed by the studio library. Each item records an ID, title, author,
description, canonical source, local file, media type, SHA-256 hash, rights
statement and topics. The retained files are plain UTF-8 text so they are
readable without executing archival HTML or depending on missing remote images.

Two complete public-domain books are available locally:

- Edward Johnston, *Writing & Illuminating, & Lettering* (1906), Project
  Gutenberg ebook 47089:
  `/guide/library/writing-illuminating-lettering.txt`
  (`SHA-256 686f9e448be1c627985f669ce153ac89f902021e2ddd1f9d2a23ce6a1ac91e5e`).
- A. N. Palmer, *The Palmer Method of Business Writing* (1901; this edition
  records later copyright dates), Project Gutenberg ebook 66476:
  `/guide/library/palmer-method-business-writing.txt`
  (`SHA-256 dab0e10710659b723371dc8ae880f7820afdf17eccb062a463f877f6ad3f7f8b`).

Project Gutenberg marks both ebooks public domain in the USA. Each retained
text includes Gutenberg's license and redistribution terms. The repository
stores the source bytes unchanged; tests read the files and compare their
SHA-256 hashes with the manifest. Scientific-PDF conversion was unnecessary:
authoritative native text editions were available, so no OCR or inferred
transcription was introduced.

The server-side assistant also searches a generated historical-text corpus in
`server/calligraphy-book-passages.json`. The generator reads the exact retained
bytes, verifies their manifest hashes, removes Gutenberg's front matter and
license from model evidence, normalizes paragraph whitespace, and emits stable
book, section and paragraph IDs. The complete downloaded books stay unchanged.
At request time the server ranks the pre-generated paragraphs in memory and
adds at most two excerpts after up to three concise curated entries. When web
research is enabled, it uses two curated entries, one book excerpt and at most
five web results, so the source set never exceeds eight. It never sends a whole
book to the model.

Every excerpt is labelled as historical original text and not modern safety
guidance. The searchable Johnston corpus is intentionally limited to the
methods, models, practice, manuscript planning, good-lettering and Roman-form
chapters. It excludes the historical knife preparation, gilding and gold or
colour recipe chapters, later special-subject instructions, and stone-carving
instructions. An additional generator filter excludes paragraphs mentioning
ammonia, arsenic, corrosives, formalin, gold leaf, lead white, mercury, nitric
or sulphuric substances, poison, scalpels or burnishing. Palmer's introduction
and lessons are searchable, but remain clearly labelled as a historical source
rather than ergonomic, medical or classroom authority.

## Editorial boundaries

- Pressure, ink flow, colour and paper behaviour must be checked physically.
  A photo or screen cannot measure writing pressure or predict a dried mixture.
- Mix products only when their manufacturer says the range is intermixable.
  Do not infer that unrelated inks, binders or additives are chemically
  compatible. Follow current labels and safety data.
- Nib-unit ratios describe broad-edge proportions. A flexible pointed nib does
  not set x-height through the same physical-width rule.
- A marked font template, reviewed glyphs, spacing, metrics and export checks
  are all separate stages. A photograph of an alphabet is not by itself a
  finished, installable font.
- The collection focuses on Latin pointed-pen and broad-edge workflows already
  supported by the studio. It does not generalize those instructions to brush
  traditions, scripts or languages with different tools and stroke systems.
- Historical manuals are evidence of their period, not universal ergonomic,
  medical, chemical or safety guidance. Their body assumptions, discipline and
  material recipes need modern checks before use.
- Arabic-script and East Asian calligraphy entries establish boundaries and
  direct learners to tradition-specific tools and study. They do not claim to
  teach those writing systems.

## Sources

All pages and ebook bytes were accessed on **2026-09-30**. Guidance is
paraphrased rather than copied. Manufacturer pages are used for material
compatibility; tool makers and named tutorial authors are used for their own
workflows. The public-domain books support original short summaries rather than
bulk passages in model context.

### Practice and guide construction

- Edward Johnston, *Writing & Illuminating, & Lettering*, Project Gutenberg
  ebook 47089, complete public-domain text and chapter-linked HTML:
  <https://www.gutenberg.org/ebooks/47089>
  The new entries draw separately on its chapters about tools, methods, models,
  practice, manuscript books, rubrication, illumination and lettering. They
  cover broad-pen angle, fault diagnosis, two-scale practice, model
  construction, optical spacing, page proportions, poetry and prose layout,
  layout trials, hierarchy and evaluation.
- A. N. Palmer, *The Palmer Method of Business Writing*, Project Gutenberg
  ebook 66476, complete public-domain text:
  <https://www.gutenberg.org/ebooks/66476>
  The retained guidance adapts its posture, paper-position, movement and drill
  material while explicitly rejecting its historical prescriptions as modern
  ergonomic or medical authority.

- Brush & Nib, “How Much Pressure to Use in Pointed Pen Calligraphy,” published
  2026-06-14:
  <https://thebrushandnib.com/posts/how-much-pressure-to-use-in-pointed-pen-calligraphy>
- Brush & Nib, “Pointed Pen Calligraphy Drills for Beginners”:
  <https://thebrushandnib.com/posts/pointed-pen-calligraphy-drills-for-beginners>
- Calligraphy Arts UK, “Jane’s New Guideline Generator”:
  <https://www.calligraphyarts.co.uk/janes-new-guideline-generator/>
  The stored note identifies its named starting ratios: Jane’s Italic uses
  ascender:x-height:descender `4:5:4` with a 2.5-nib gap; the generator’s
  suggested Foundational preset uses `3:4:3` with a 3-nib gap, and its
  suggested Textura preset uses `2:5:2` with a 2-nib gap.

### Paper, underlays and transfers

- Canson, “Artist Series Vidalon Vellum”:
  <https://us.canson.com/artist-series-vidalon-vellum>
- The Postman’s Knock, “Do You Need a Light Box?”:
  <https://thepostmansknock.com/need-light-box-includes-giveaway/>
- Alvalyn Creative, “How to Use Graphite Paper to Transfer Drawings”:
  <https://alvalyn.com/how-to-use-graphite-paper-to-transfer-drawings/>

### Ink and material tests

- Winsor & Newton, “Drawing Ink – Gold”:
  <https://www.winsornewton.com/products/drawing-ink-gold>
- Daler-Rowney, “FW Acrylic Ink”:
  <https://daler-rowney.com/product/fw-acrylic-ink/>
- Winsor & Newton, “Gum Arabic”:
  <https://eu.winsornewton.com/en-row/products/watercolour-medium-gum-arabic-v2>

### Font capture and production

- Calligraphr, “How to create your first font”:
  <https://www.calligraphr.com/en/docs/tutorial1/>
- Calligraphr, “How to create a randomized font”:
  <https://www.calligraphr.com/en/docs/tutorial2/>
- Calligraphr, FAQ, including template capture and scan guidance:
  <https://www.calligraphr.com/en/docs/faq/>
- FontForge, “Importing a glyph outline”:
  <https://fontforge.org/docs/tutorial/importexample.html>
- FontForge, “Generate Fonts,” including validation and layout tables:
  <https://fontforge.org/docs/ui/dialogs/generate.html>
- VecGlypher, reference-image and text-guided SVG glyph generation:
  <https://github.com/xk-huang/VecGlypher>
- Glyphr Studio v2, “Kerning”:
  <https://www.glyphrstudio.com/help/pages/kerning.html>
- Glyphr Studio v2, “Ligatures”:
  <https://www.glyphrstudio.com/help/pages/ligatures.html>

### Script traditions and collection context

- Library of Congress, “About this Collection: Selections of Arabic, Persian,
  and Ottoman Calligraphy”:
  <https://www.loc.gov/collections/selections-of-arabic-persian-and-ottoman-calligraphy/about-this-collection/>
- Metropolitan Museum of Art, *Arabic Script and the Art of Calligraphy*, unit
  2 of its educator resource. The entry uses its overview of training, qalam
  preparation, ink, paper and script-specific pen cuts; it does not reproduce
  the PDF:
  <https://www.metmuseum.org/-/media/files/learn/for%20educators/publications%20for%20educators/islamic%20teacher%20resource/unit2.pdf>
- Smithsonian National Museum of Asian Art, “Understanding Chinese
  Characters,” including the Four Treasures and the need for script-specific
  stroke study:
  <https://asia.si.edu/education/educator-resources/teaching-china-with-the-smithsonian/lesson-plans/understanding-chinese-characters/>

When an entry changes materially, revisit its linked source, update this access
date, and keep the entry to a short original paraphrase. Add a retrieval test
when a new topic must outrank an existing one for a concrete user question.
When a local guide is refreshed, replace it from the canonical download, update
its manifest hash and verify that the embedded rights notice remains present.
Then run `bun scripts/generate-calligraphy-library.ts` and commit the regenerated
JSON. `bun scripts/generate-calligraphy-library.ts --check` verifies that the
committed corpus matches the retained source hashes and deterministic chunking.
