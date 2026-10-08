/** A concise, attributed piece of calligraphy guidance. */
export interface CalligraphyKnowledgeEntry {
  id: string;
  title: string;
  topics: readonly string[];
  text: string;
  url: string;
}

/** Curated guidance for the studio assistant and its local fallback. */
export const CALLIGRAPHY_KNOWLEDGE: readonly CalligraphyKnowledgeEntry[] = [
  {
    id: "pointed-pen-pressure",
    title: "Pointed-pen pressure starts with contrast",
    topics: ["beginner", "pointed pen", "pressure", "strokes", "practice"],
    text: "Use a very light touch for hairline upstrokes and add smooth, controlled pressure while pulling downstrokes. A sudden hard press can spread the tines unevenly or catch paper fibres, so practise the pressure change before building letters.",
    url: "https://thebrushandnib.com/posts/how-much-pressure-to-use-in-pointed-pen-calligraphy",
  },
  {
    id: "pointed-pen-drill-order",
    title: "Build letters from a short stroke sequence",
    topics: ["beginner", "drills", "strokes", "practice", "pointed pen"],
    text: "Warm up with straight downstrokes and hairline upstrokes, then practise overturns, underturns, compound curves, ovals and loops. Work in deliberate rows and stop when control falls away; a focused short session is more useful than filling a page while tense.",
    url: "https://thebrushandnib.com/posts/pointed-pen-calligraphy-drills-for-beginners",
  },
  {
    id: "broad-edge-nib-guides",
    title: "Scale broad-edge guides from the actual nib",
    topics: ["broad edge", "nib", "nib width", "x-height", "guides", "italic"],
    text: "Broad-edge hands use nib width as a physical unit. Jane's classroom Italic preset uses 4:5:4 nib widths for ascender, x-height and descender, plus a 2.5-width gap. Her generator's suggested Foundational preset uses 3:4:3 plus a 3-width gap; its suggested Textura preset uses 2:5:2 plus a 2-width gap. Treat these named presets as starting proportions and scale them from the mark made by your actual nib.",
    url: "https://www.calligraphyarts.co.uk/janes-new-guideline-generator/",
  },
  {
    id: "pointed-pen-guide-proportions",
    title: "Pointed-pen guides describe proportions, not nib width",
    topics: ["pointed pen", "copperplate", "guides", "x-height", "slant"],
    text: "For a flexible pointed nib, set the x-height and ascender or descender proportions directly; the nib does not impose a fixed broad-edge unit. Keep the chosen slant and vertical zones consistent across the sheet, and change one measurement at a time when tuning for your hand.",
    url: "https://www.calligraphyarts.co.uk/janes-new-guideline-generator/",
  },
  {
    id: "print-actual-size",
    title: "Calibrate every physical worksheet at 100 percent",
    topics: ["print", "printer", "calibration", "paper", "guides", "scale"],
    text: "Print at 100% or Actual Size rather than Fit to Page, then measure a known calibration line with a physical ruler. Printer margins and driver scaling can change real guide dimensions even when the screen preview looks correct.",
    url: "https://www.calligraphyarts.co.uk/janes-new-guideline-generator/",
  },
  {
    id: "vellum-is-a-surface-choice",
    title: "Translucent vellum is smooth tracing paper",
    topics: ["paper", "vellum", "tracing", "surface", "underlay"],
    text: "Modern drafting vellum is a translucent paper, not animal skin. A smooth translucent sheet can reveal an underlay clearly, but ink flow and drying still depend on its finish. Test hairlines, shaded strokes, drying and show-through on the exact stock before committing a finished piece.",
    url: "https://us.canson.com/artist-series-vidalon-vellum",
  },
  {
    id: "light-box-underlay",
    title: "Reuse guides with a light box or bright window",
    topics: ["paper", "underlay", "light box", "tracing", "guides"],
    text: "Place a reusable guide beneath sufficiently translucent practice paper and illuminate it from below. This keeps guide marks off the final sheet. Check that the light remains comfortable and that the paper does not shift while writing.",
    url: "https://thepostmansknock.com/need-light-box-includes-giveaway/",
  },
  {
    id: "graphite-transfer",
    title: "Transfer a layout onto opaque paper",
    topics: ["paper", "transfer", "graphite", "layout", "opaque"],
    text: "For opaque stock, place graphite transfer paper beneath a printed layout and trace the essential lines with controlled pressure. Transfer only the marks needed for placement, then test erasing on a scrap so the finished surface is not burnished or damaged.",
    url: "https://alvalyn.com/how-to-use-graphite-paper-to-transfer-drawings/",
  },
  {
    id: "drawing-ink-colour-test",
    title: "Measure repeatable colour tests within one ink range",
    topics: ["ink", "mixing", "colour", "recipe", "swatch"],
    text: "Winsor & Newton says its Drawing Ink colours are intermixable. Work in a separate cup, record drops or measured parts, and let a swatch dry on the project paper before adjusting. A ratio is a repeatable experiment, not a screen-accurate colour prediction.",
    url: "https://www.winsornewton.com/products/drawing-ink-gold",
  },
  {
    id: "drawing-ink-metallic-safety",
    title: "Do not store gold-and-silver drawing-ink mixtures",
    topics: [
      "ink",
      "mixing",
      "gold",
      "silver",
      "metallic",
      "compatibility",
      "safety",
    ],
    text: "Winsor & Newton advises adding its Gold or Silver Drawing Inks only in small quantities because they thicken a mixture, and says mixtures containing Gold and Silver should not be stored because an adverse reaction may occur. Mix only a session-sized sample and follow the current product label.",
    url: "https://www.winsornewton.com/products/drawing-ink-gold",
  },
  {
    id: "acrylic-ink-dilution",
    title: "Dilute acrylic ink as a tested wash",
    topics: ["ink", "mixing", "acrylic", "dilution", "wash", "surface"],
    text: "Daler-Rowney describes FW Acrylic Inks as intermixable within the range and water-soluble while working, with diluted washes drying to a water-resistant film. Add water gradually to a small sample, prepare the surface, and test it before using it in a calligraphy piece.",
    url: "https://daler-rowney.com/product/fw-acrylic-ink/",
  },
  {
    id: "gum-arabic-watercolour",
    title: "Use gum arabic for watercolour or gouache flow tests",
    topics: ["ink", "mixing", "gum arabic", "watercolour", "gouache", "binder"],
    text: "Winsor & Newton identifies gum arabic as a watercolour binder that can control flow, slow drying and increase gloss, transparency and viscosity. Add only a small amount to a separate watercolour or gouache test; do not assume it is compatible with every bottled ink formulation.",
    url: "https://eu.winsornewton.com/en-row/products/watercolour-medium-gum-arabic-v2",
  },
  {
    id: "ink-paper-compatibility",
    title: "Compatibility is a nib, ink and paper test",
    topics: ["ink", "paper", "nib", "compatibility", "testing", "swatch"],
    text: "Test the complete combination you intend to use: fine hairline, broad shaded stroke, crossing strokes and a small pool. Let it dry fully, inspect feathering and bleed-through, and keep the labelled swatch with the recipe. Do not combine unrelated media or additives unless their makers say they are compatible.",
    url: "https://daler-rowney.com/product/fw-acrylic-ink/",
  },
  {
    id: "font-template-capture",
    title: "Capture every marker on the font template",
    topics: ["font", "scan", "photo", "template", "calligraphr"],
    text: "Use the marked Calligraphr template rather than a free-form alphabet page. Fill it with a dark pen, keep all four corner markers in the scan or photo, light the page evenly, avoid shadows and photograph it as square-on as possible before reviewing detected characters.",
    url: "https://www.calligraphr.com/en/docs/tutorial1/",
  },
  {
    id: "font-scan-quality",
    title: "Scan with detail and without binary dithering",
    topics: ["font", "scan", "photo", "dpi", "template", "calligraphr"],
    text: "Calligraphr recommends a clean 300–600 dpi scan and warns against binary monochrome scanning because dithering can create dots and guide-line artefacts. A well-lit modern phone photo can work when all markers are visible and the page is flat.",
    url: "https://www.calligraphr.com/en/docs/faq/",
  },
  {
    id: "font-character-variants",
    title: "Draw variants for frequent handwritten letters",
    topics: ["font", "variants", "alternates", "handwriting", "calligraphr"],
    text: "Multiple drawings of the same character can reduce mechanical repetition in a handwriting font. Start with frequent letters, review each imported shape, and keep one reliable default. Variant counts and automatic use depend on the font-building plan and the software that renders the resulting OpenType features.",
    url: "https://www.calligraphr.com/en/docs/tutorial2/",
  },
  {
    id: "font-spacing-and-kerning",
    title: "Set side bearings before fixing difficult pairs",
    topics: ["font", "spacing", "side bearings", "kerning", "glyphr"],
    text: "Give each glyph sensible left and right side bearings first; that establishes ordinary spacing. Then test real words and kern only pairs whose shapes still look too open or tight, such as diagonals. Class-based kerning can share one adjustment across groups with similar edges.",
    url: "https://www.glyphrstudio.com/help/pages/kerning.html",
  },
  {
    id: "font-ligature-strategy",
    title: "Reserve ligatures for connections that need a custom drawing",
    topics: ["font", "ligatures", "connections", "cursive", "glyphr"],
    text: "A ligature replaces a typed character sequence with one designed glyph when the text application enables that feature. For a cursive font, first make common joins work at a shared connection point, then add ligatures for the awkward or distinctive pairs; designing every possible pair grows rapidly.",
    url: "https://www.glyphrstudio.com/help/pages/ligatures.html",
  },
  {
    id: "svg-font-metrics",
    title: "Align imported SVG outlines in FontForge",
    topics: [
      "font",
      "svg",
      "metrics",
      "side bearings",
      "advance width",
      "fontforge",
      "import",
    ],
    text: "FontForge imports an SVG outline into an individual character slot. Scale and position it in the font design space; check the baseline, lowercase height, side bearings and advance width consistently across the alphabet. Proof real words before export. One SVG supplies a glyph outline, not a complete installable font.",
    url: "https://fontforge.org/docs/tutorial/importexample.html",
  },
  {
    id: "fontforge-font-export",
    title: "Validate the assembled font before exporting TTF or OTF",
    topics: [
      "fontforge",
      "font",
      "export",
      "ttf",
      "otf",
      "validate",
      "ligatures",
    ],
    text: "Use FontForge's Generate Fonts dialog after reviewing the alphabet and spacing. It supports TrueType and OpenType (CFF), with a validation option before saving. Include the layout tables needed for kerning and ligatures, then test the exported font in the software that will render or print it; feature support varies between applications.",
    url: "https://fontforge.org/docs/ui/dialogs/generate.html",
  },
  {
    id: "vecglypher-reviewed-proposals",
    title: "Use VecGlypher to propose missing glyphs, then review them",
    topics: [
      "vecglypher",
      "font",
      "missing",
      "glyphs",
      "reference",
      "images",
      "svg",
    ],
    text: "VecGlypher's documented inputs include style text or reference glyph images plus a target character, with SVG output. In this workflow, treat each missing-letter result as a proposal: compare its weight, counters and joins with the original samples before font assembly. SVG generation alone does not provide character mapping, spacing, ligatures or an installable font. Studio availability depends on a configured model profile.",
    url: "https://github.com/xk-huang/VecGlypher",
  },
  {
    id: "comfortable-writing-posture",
    title: "Arrange the work so the body can stay easy",
    topics: ["posture", "desk", "paper position", "ergonomics", "comfort"],
    text: "Set the paper, chair and writing surface so the forearms can be supported and the writing area is easy to see without hunching. Historical manuals prescribe exact poses, but bodies and mobility differ: prefer a stable, relaxed position, change it when discomfort begins and seek qualified ergonomic advice for persistent pain.",
    url: "https://www.gutenberg.org/cache/epub/47089/pg47089-images.html#chap03",
  },
  {
    id: "broad-pen-writing-angle",
    title: "Keep the broad edge at a deliberate angle",
    topics: ["broad edge", "pen angle", "nib", "thick thin", "stroke"],
    text: "A broad-edged pen makes thick and thin strokes mainly through the fixed relationship between its edge and the writing line. Practise parallel strokes and turns while keeping that edge angle steady; rotating the holder mid-stroke changes the contrast and structure of the letters.",
    url: "https://www.gutenberg.org/cache/epub/47089/pg47089-images.html#chap03",
  },
  {
    id: "broad-nib-troubleshooting",
    title: "Diagnose the whole tool-and-surface chain",
    topics: [
      "broad edge",
      "nib",
      "troubleshooting",
      "skipping",
      "ragged",
      "paper fibres",
      "ink flow",
    ],
    text: "If a broad nib catches fibres, skips or makes ragged edges, stop before forcing it. Check that the edge is clean and undamaged, the reservoir is not overloaded, the ink can flow, the paper is smooth enough and the hand is not pressing excessively. Change one factor, make a labelled test row and compare it after drying.",
    url: "https://www.gutenberg.org/cache/epub/47089/pg47089-images.html#chap02",
  },
  {
    id: "two-scale-practice",
    title: "Practise form large and rhythm near working size",
    topics: ["practice", "drills", "scale", "letterforms", "rhythm"],
    text: "Use some large, careful writing to expose the construction of each form, then a separate passage at a smaller and more fluent working size to practise joins, spacing and page rhythm. Large study and practical writing answer different questions, so keep both in a session.",
    url: "https://www.gutenberg.org/cache/epub/47089/pg47089-images.html#chap05",
  },
  {
    id: "broad-nib-reveals-errors",
    title: "Use a broad nib to make faults visible",
    topics: ["practice", "broad edge", "nib", "diagnosis", "beginner"],
    text: "Early broad-edge practice makes stroke direction, pen angle and malformed joins easier to see than very fine writing. Work slowly enough to observe the cause of a fault, but judge the result in words as well as isolated letters.",
    url: "https://www.gutenberg.org/cache/epub/47089/pg47089-images.html#chap05",
  },
  {
    id: "study-model-construction",
    title: "Study how a model was made, not only its outline",
    topics: ["model", "exemplar", "letter construction", "ductus", "study"],
    text: "A useful exemplar shows more than a silhouette. Trace the likely stroke order, direction, pen angle, joins, proportions and rhythm, then compare those decisions with your result. Copying an outline without the tool logic can reproduce the contour while losing the character of the writing.",
    url: "https://www.gutenberg.org/cache/epub/47089/pg47089-images.html#chap04",
  },
  {
    id: "letter-spacing-by-counterspace",
    title: "Balance spaces rather than measuring equal gaps",
    topics: ["spacing", "letters", "counterspace", "optical", "layout"],
    text: "Equal ruler distances do not look equal around round, straight and diagonal forms. Set neighbouring letters by comparing the shapes of the spaces between and inside them, then read the word at normal viewing distance. Adjust the pair while preserving the letterforms.",
    url: "https://www.gutenberg.org/cache/epub/47089/pg47089-images.html#p237",
  },
  {
    id: "word-spacing-rhythm",
    title: "Make word spaces clear without breaking the line",
    topics: ["spacing", "words", "rhythm", "legibility", "layout"],
    text: "A word space should separate words immediately while still belonging to the line. Test a repeated short phrase: if the gaps become holes, reduce them; if words run together, increase them. Judge the whole texture rather than one isolated gap.",
    url: "https://www.gutenberg.org/cache/epub/47089/pg47089-images.html#chap04",
  },
  {
    id: "line-spacing-texture",
    title: "Tune line spacing from the finished texture",
    topics: [
      "spacing",
      "lines",
      "leading",
      "ascender",
      "descender",
      "legibility",
    ],
    text: "Allow enough vertical space that ascenders and descenders do not collide and the eye can return to the next line. Dense formal writing may use tighter leading than a teaching sheet. Test several complete lines, because isolated alphabets do not reveal the page texture.",
    url: "https://www.gutenberg.org/cache/epub/47089/pg47089-images.html#chap04",
  },
  {
    id: "manuscript-page-proportions",
    title: "Plan the written block and margins together",
    topics: [
      "manuscript",
      "page",
      "margins",
      "columns",
      "layout",
      "proportion",
    ],
    text: "Choose page shape, writing size, line count, column width and margins as one composition. Mock the written block before ruling every line. Margins need room for handling and visual rest, and the bottom margin often benefits from more depth than the top, but the text and binding method should decide the final proportions.",
    url: "https://www.gutenberg.org/cache/epub/47089/pg47089-images.html#chap06",
  },
  {
    id: "prose-poetry-layout",
    title: "Let the text form guide the page",
    topics: [
      "layout",
      "poetry",
      "prose",
      "line breaks",
      "manuscript",
      "composition",
    ],
    text: "Preserve meaningful poetic line breaks and stanza structure rather than treating a poem like justified prose. For prose, test the average words per line and rag before committing. Make a small layout trial with the actual text, script and writing size.",
    url: "https://www.gutenberg.org/cache/epub/47089/pg47089-images.html#chap05",
  },
  {
    id: "layout-dry-run",
    title: "Make a full-content layout trial",
    topics: ["layout", "planning", "draft", "fitting", "proof", "composition"],
    text: "Count or rough-write the actual text before beginning a finished sheet. Mark line endings, initials and reserved decoration, and test the longest or least flexible parts first. A miniature or pencil proof exposes fitting problems while changes are still cheap.",
    url: "https://www.gutenberg.org/cache/epub/47089/pg47089-images.html#p237",
  },
  {
    id: "lettering-quality-priorities",
    title: "Judge lettering by legibility, form and character",
    topics: ["lettering", "legibility", "beauty", "character", "evaluation"],
    text: "Decorative energy does not excuse unreadable or weak construction. Review a piece at reading distance for legibility, at close range for consistent forms and spacing, and as a whole for a character appropriate to its text and setting.",
    url: "https://www.gutenberg.org/cache/epub/47089/pg47089-images.html#p237",
  },
  {
    id: "rubrication-hierarchy",
    title: "Use colour to clarify hierarchy",
    topics: [
      "rubrication",
      "colour",
      "hierarchy",
      "initials",
      "headings",
      "layout",
    ],
    text: "A second colour can distinguish headings, initials, stanza marks or navigation without filling every available space. Decide the hierarchy before writing and repeat the colour rule consistently. Test the dried colour beside the body ink on the final paper.",
    url: "https://www.gutenberg.org/cache/epub/47089/pg47089-images.html#chap08",
  },
  {
    id: "illumination-start-simple",
    title: "Build illumination from the writing outward",
    topics: [
      "illumination",
      "decoration",
      "penwork",
      "colour",
      "gold",
      "beginner",
    ],
    text: "Begin with writing that already has a clear page structure, then add a limited system of initials, penwork or colour. Reserve metal leaf and unfamiliar historical preparations for separate material study; modern products and safety guidance take priority over an old recipe.",
    url: "https://www.gutenberg.org/cache/epub/47089/pg47089-images.html#chap11",
  },
  {
    id: "movement-warmup",
    title: "Warm up movement before detailed letters",
    topics: ["warmup", "movement", "drills", "ovals", "rhythm", "handwriting"],
    text: "Start with a brief row of easy repeated strokes or ovals at a comfortable size. Aim for loose, repeatable movement and even rhythm rather than a perfect decorative result. Move to letters while control is improving, and stop or reset if the hand becomes tense.",
    url: "https://www.gutenberg.org/cache/epub/66476/pg66476-images.html",
  },
  {
    id: "short-deliberate-practice",
    title: "Give each practice row one purpose",
    topics: ["practice", "drills", "goal", "review", "handwriting"],
    text: "Choose one observable target for a row—such as slant, spacing, oval shape or baseline—and keep the other variables steady. Circle one useful result, write the next adjustment in words and repeat. Speed is useful only after the intended movement and form stay legible.",
    url: "https://www.gutenberg.org/cache/epub/66476/pg66476-images.html",
  },
  {
    id: "paper-position-during-writing",
    title: "Move the paper to protect the writing position",
    topics: [
      "paper position",
      "posture",
      "movement",
      "baseline",
      "handwriting",
    ],
    text: "Reposition the sheet as work advances so the active area remains comfortably in front of the writing hand. Turning or sliding the paper can support a consistent slant and prevent reaching across the desk. Secure underlays and wet work before moving them.",
    url: "https://www.gutenberg.org/cache/epub/66476/pg66476-images.html",
  },
  {
    id: "historical-manual-limitations",
    title: "Read historical manuals as evidence, not universal ergonomics",
    topics: [
      "history",
      "manual",
      "posture",
      "ergonomics",
      "safety",
      "limitations",
    ],
    text: "Older writing manuals preserve valuable drills, tools and design thinking, but their classroom discipline, body assumptions, material recipes and health claims reflect their time. Adapt their craft observations to the writer, use current product instructions and stop when a technique causes pain or unsafe exposure.",
    url: "https://www.gutenberg.org/ebooks/66476",
  },
  {
    id: "script-tradition-boundaries",
    title: "Learn each script tradition from its own models and teachers",
    topics: [
      "Arabic",
      "Chinese",
      "Japanese",
      "non-Latin",
      "script tradition",
      "limitations",
      "cultural context",
    ],
    text: "A Latin broad-edge or pointed-pen worksheet does not transfer automatically to Arabic-script or East Asian brush calligraphy. Those traditions have their own tools, stroke orders, proportions, languages, histories and teaching lineages. Use this studio's Latin advice only where it fits, and seek tradition-specific exemplars and instruction for other scripts.",
    url: "https://www.loc.gov/collections/selections-of-arabic-persian-and-ottoman-calligraphy/about-this-collection/",
  },
  {
    id: "arabic-calligraphy-tools-training",
    title: "Arabic-script calligraphy joins tools, script and apprenticeship",
    topics: [
      "Arabic",
      "Islamic calligraphy",
      "reed pen",
      "qalam",
      "training",
      "non-Latin",
    ],
    text: "Museum teaching material describes Arabic-script calligraphy as a long-trained practice in which the reed pen is cut to suit a particular script and paper, ink and layout are prepared together. Treat the qalam and proportional systems as tradition-specific tools rather than substitutes for a Latin broad-edge preset.",
    url: "https://www.metmuseum.org/-/media/files/learn/for%20educators/publications%20for%20educators/islamic%20teacher%20resource/unit2.pdf",
  },
  {
    id: "chinese-calligraphy-four-treasures",
    title: "Chinese brush calligraphy uses a distinct material system",
    topics: [
      "Chinese",
      "brush",
      "inkstone",
      "inkstick",
      "paper",
      "Four Treasures",
      "non-Latin",
    ],
    text: "Chinese calligraphy traditionally coordinates brush, ink, paper and inkstone, often called the Four Treasures of the Scholar's Studio. Script families and prescribed stroke sequences require specific study; a fountain or broad-nib practice path cannot stand in for brush handling and character knowledge.",
    url: "https://asia.si.edu/education/educator-resources/teaching-china-with-the-smithsonian/lesson-plans/understanding-chinese-characters/",
  },
] as const;

const DEFAULT_ENTRY_IDS = [
  "pointed-pen-pressure",
  "broad-edge-nib-guides",
  "ink-paper-compatibility",
  "print-actual-size",
  "font-template-capture",
] as const;

const MAX_RESULTS = 8;
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "can",
  "do",
  "for",
  "how",
  "i",
  "in",
  "is",
  "it",
  "my",
  "of",
  "on",
  "or",
  "should",
  "the",
  "to",
  "with",
]);

function lexicalTokens(value: string): readonly string[] {
  return [
    ...new Set(
      value
        .toLocaleLowerCase("en-US")
        .normalize("NFKD")
        .replace(/\p{M}+/gu, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .split(/\s+/)
        .filter((token) => token.length > 1 && !STOP_WORDS.has(token)),
    ),
  ];
}

function entryScore(
  entry: CalligraphyKnowledgeEntry,
  queryTokens: readonly string[],
): number {
  const titleTokens = new Set(lexicalTokens(entry.title));
  const topicTokens = new Set(lexicalTokens(entry.topics.join(" ")));
  const textTokens = new Set(lexicalTokens(entry.text));

  return queryTokens.reduce((score, token) => {
    if (topicTokens.has(token)) return score + 5;
    if (titleTokens.has(token)) return score + 3;
    if (textTokens.has(token)) return score + 1;
    return score;
  }, 0);
}

/** Select deterministic, bounded local context for a calligraphy question. */
export function selectCalligraphyKnowledge(
  question: string,
  limit = 5,
): readonly CalligraphyKnowledgeEntry[] {
  const resultLimit = Math.min(MAX_RESULTS, Math.max(0, Math.floor(limit)));
  if (resultLimit === 0) return [];

  const queryTokens = lexicalTokens(question.slice(0, 2_000));
  if (queryTokens.length === 0) {
    const boundary = CALLIGRAPHY_KNOWLEDGE.find(
      ({ id }) => id === "script-tradition-boundaries",
    );
    return boundary ? [boundary] : [];
  }
  const ranked = CALLIGRAPHY_KNOWLEDGE.map((entry, index) => ({
    entry,
    index,
    score: entryScore(entry, queryTokens),
  }))
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) => right.score - left.score || left.index - right.index,
    );

  if (ranked.length > 0) {
    return ranked.slice(0, resultLimit).map(({ entry }) => entry);
  }

  const defaults = new Set<string>(DEFAULT_ENTRY_IDS);
  return CALLIGRAPHY_KNOWLEDGE.filter(({ id }) => defaults.has(id)).slice(
    0,
    resultLimit,
  );
}
