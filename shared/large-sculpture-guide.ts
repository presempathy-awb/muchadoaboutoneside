import { FABRICATION_DOWNLOADS } from "./fabrication-downloads";

export const LARGE_SCULPTURE_TITLE =
  "Attaching marked aluminum to the large wooden sculpture";

export const LARGE_SCULPTURE_INTRO =
  "For iani: start with the actual wooden sculpture, fit paper patterns, test the aluminum and attachment on scrap, then install one supported panel at a time. The large reference files help map the poem; the separate 180 mm kit belongs to the printed study.";

export const LARGE_SCULPTURE_STATUS =
  "Use this proposed fitting sequence to develop an attachment method on the actual sculpture. Final panel shapes and the adhesive system need a successful physical sample before installation.";

export const LARGE_SCULPTURE_DECISION = {
  title: "Confirm the support and setting first",
  body: "Before buying metal or adhesive, confirm whether the sculpture has open ribs or laths or a continuous finished wood surface, and whether it will live indoors or outdoors. Those answers determine the backing, attachment, edge, and protection system.",
  openStructure:
    "Open ribs or laths: agree on smooth, continuously supported backing panels and how they attach to the wood before fitting thin aluminum. Decorative foil needs support beneath the working area; it is not a structural skin.",
  continuousSurface:
    "Continuous wood: check for bumps, open joints, loose finish, and access for pressing each panel. With a sound existing finish, that finish is the bonding surface. Test preparation on matching scrap before altering the artwork.",
} as const;

export const LARGE_SCULPTURE_LAYERS = [
  {
    layer: "Marked aluminum",
    note: "Decorative skin only; it does not stabilize or strengthen the sculpture.",
  },
  {
    layer: "Tested adhesive or adhesive backing",
    note: "Chosen for this aluminum, the actual wood finish, and the display conditions; tested on matching scrap.",
  },
  {
    layer: "Continuous supported surface",
    note: "A smooth backing that supports the thin metal and the pressure used to attach it.",
  },
  {
    layer: "Wood structure",
    note: "Stabilized by its own structure before any decorative cladding work begins.",
  },
] as const;

export const LARGE_SCULPTURE_STEPS = [
  {
    title: "Survey and stabilize the actual sculpture",
    body: "Support the sculpture at its base and structural members so it stays steady while you work. Keep loads off the jaw and tail. Measure the actual wood, curves, openings, and tight crossing; the digital surface is a conceptual envelope and has no completed physical fit test.",
  },
  {
    title: "Resolve the support surface",
    body: "On continuous wood, identify a smooth supported area for every panel. Over open ribs or laths, first fit smooth backing panels under a separate woodwork and attachment plan agreed with iani. Resolve bumps, gaps, and access on that backing before applying aluminum; thin foil alone cannot provide the working support.",
  },
  {
    title: "Paper-fit and map every region",
    body: "Begin with the representative jaw fit kit. Print dimensioned fit sheets at 100% and check their scale with a ruler, then adapt paper patterns directly on the wood. Label each pattern with its location, panel ID, adjoining edges, and reading-direction arrow. Use tape only after testing it on the finish. Adjust paper until it lies comfortably, and photograph the fitted map.",
  },
  {
    title: "Split difficult geometry deliberately",
    body: "Keep the jaw separate and paper-test the nose turn, tail return, side seams, and tight crossing before choosing the installation order. Preserve clearance and keep the head and tail physically separate. Place seams in clear margins; if they cut a letter or the paper buckles, revise the panel split and lettering proof before marking metal.",
  },
  {
    title: "Choose metal for the confirmed setting",
    body: "The proposed stock is unbacked 0.005 in (0.127 mm) AlumaMark; confirm the actual product and lot before ordering the full set. Its manufacturer intends it for indoor use and offers optional adhesive backing. For outdoors, confirm compatible UV-blocking protection and test the complete wood, metal, finish, and attachment system for that setting.",
  },
  {
    title: "Make a same-stock curve and finish test",
    body: "Bend an unmarked offcut from the actual stock around a representative tight curve. Then attach it to scrap with the same wood, finish, backing, and proposed adhesive. After the manufacturer’s full bond-development or cure period, check springback, wrinkles, edge lift, slipping, stains, and finish damage. If it fails, change the panel shape or attachment process and repeat before marking the batch.",
  },
  {
    title: "Approve one attachment process",
    body: "Choose an adhesive whose manufacturer supports the actual metal and wood finish. For pressure-sensitive adhesive (PSA), confirm the exact supplied backing. Follow its preparation, working-time, pressure, and handling instructions. Keep the bonding surface sound, clean, and dry; only sand, seal, or prime where the tested process and iani’s finish plan require it.",
  },
  {
    title: "Mark flat and trim away from the sculpture",
    body: "Have the shop approve the stock and a marking coupon using the approved lettering. Form and attach that marked sample with the tested process, including any planned UV protection, and inspect the lettering and coating before the full run. Then mark unbacked aluminum flat and add attachment materials afterward; adhesive-backed stock needs separate shop approval. Transfer the approved paper shape, then trim on a protected bench away from the sculpture with suitable snips and hand/eye protection. Smooth sharp edges without abrading the marked face.",
  },
  {
    title: "Fit and attach panel by panel",
    body: "Gently pre-form each piece over a clean, smooth former as in the successful sample. Dry-fit it with its neighbors and check the reading arrows before adhesive touches the wood. For approved PSA, align one edge, peel back a small section of release liner, and progressively press onto solid support with a clean soft pad or roller. For wet adhesive, follow the tested spreading, placement, and holding method. Stop and re-pattern a piece that needs force or wrinkles.",
  },
  {
    title: "Cure, inspect, and document",
    body: "Leave the piece supported for the adhesive’s specified bond-development or cure time before handling or transport. Inspect every edge for sharpness or lift, check side seams and crossing clearance, and follow the poem across every panel join and turn. Photograph the finished map and retain labeled offcuts, stock details, and adhesive records for later repairs.",
  },
] as const;

export const LARGE_SCULPTURE_CHECKLIST = [
  "Indoor or outdoor setting confirmed",
  "Open ribs or continuous wood surface confirmed",
  "Wood structure stable and actual surface measurements recorded",
  "Backing or support plan approved before metal fitting",
  "Panel IDs, orientation, poem arrows, and seam locations paper-fitted",
  "Jaw, head, tail, and tight crossing resolved as separate fitted regions",
  "Exact metal, finish, and attachment system identified",
  "Actual-stock curve sample and matching finished-wood scrap test passed after the specified bond-development or cure period",
  "Marked faces protected; all trimming completed off the sculpture with hand and eye protection",
  "Cured edges, seams, finish, and poem readability inspected and documented",
] as const;

export interface LargeSculptureFile {
  label: string;
  href: string;
  note?: string;
}

export const LARGE_SCULPTURE_FILES: readonly LargeSculptureFile[] = [
  {
    label: "Representative jaw fit kit",
    href: FABRICATION_DOWNLOADS.largeFitKit,
  },
  {
    label: "Conceptual full-scale panel reference",
    href: FABRICATION_DOWNLOADS.largeKit,
  },
  {
    label: "Normalized UV marking master",
    href: FABRICATION_DOWNLOADS.bodyMaster,
    note: "Artwork reference, not a physical cutter or proven fit pattern.",
  },
  {
    label: "Separate jaw marking master",
    href: FABRICATION_DOWNLOADS.jawMaster,
  },
];

export const LARGE_SCULPTURE_SOURCES = [
  {
    label: "AlumaMark material options and use conditions",
    href: "https://alumamark.com/",
    note: "Manufacturer source for listed thicknesses, optional 3M 467 backing, indoor intent, and compatible UV-blocking protection for exterior use.",
  },
  {
    label: "3M: understanding the bonding surface",
    href: "https://www.3m.com/3M/en_US/bonding-and-assembly-us/resources/full-story/?storyid=1d2481ca-5c8c-455d-952d-5ed90e04e8a7",
    note: "The finish is the bonding surface; roughness, porosity, and surface condition affect attachment.",
  },
  {
    label: "3M structural-adhesive FAQs",
    href: "https://www.3m.com/3M/en_US/bonding-and-assembly-us/structural-adhesives/faqs/",
    note: "The selected product, process, and test determine preparation, open time, handling, and cure.",
  },
] as const;

function linesForShopGuide() {
  return [
    LARGE_SCULPTURE_TITLE,
    "=".repeat(LARGE_SCULPTURE_TITLE.length),
    "",
    LARGE_SCULPTURE_INTRO,
    "https://muchadoaboutoneside.com/instructions#large-sculpture",
    "",
    LARGE_SCULPTURE_DECISION.title,
    LARGE_SCULPTURE_DECISION.body,
    `- ${LARGE_SCULPTURE_DECISION.openStructure}`,
    `- ${LARGE_SCULPTURE_DECISION.continuousSurface}`,
    "",
    "LAYERS UNDER THE ALUMINUM",
    ...LARGE_SCULPTURE_LAYERS.map(
      ({ layer, note }, index) => `${index + 1}. ${layer}: ${note}`,
    ),
    "",
    "SHOP SEQUENCE",
    ...LARGE_SCULPTURE_STEPS.flatMap(({ title, body }, index) => [
      `${index + 1}. ${title}`,
      `   ${body}`,
    ]),
    "",
    "FINAL CHECK",
    ...LARGE_SCULPTURE_CHECKLIST.map((item) => `[ ] ${item}`),
    "",
    "CURRENT REFERENCE FILES",
    ...LARGE_SCULPTURE_FILES.flatMap(({ label, href, ...file }) => [
      `- ${label}: https://muchadoaboutoneside.com${href}`,
      ...(file.note ? [`  ${file.note}`] : []),
    ]),
    "",
    "PRIMARY SOURCES",
    ...LARGE_SCULPTURE_SOURCES.flatMap(({ label, href, note }) => [
      `- ${label}: ${href}`,
      `  ${note}`,
    ]),
    "",
    LARGE_SCULPTURE_STATUS,
    "",
  ];
}

export const LARGE_SCULPTURE_SHOP_GUIDE_TEXT = linesForShopGuide().join("\n");

export const LARGE_SCULPTURE_SHOP_GUIDE_URI = `data:text/plain;charset=utf-8,${encodeURIComponent(LARGE_SCULPTURE_SHOP_GUIDE_TEXT)}`;
