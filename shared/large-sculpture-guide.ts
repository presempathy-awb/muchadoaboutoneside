import { FABRICATION_GEOMETRY_OPTIONS } from "./fabrication";
import { FABRICATION_DOWNLOADS } from "./fabrication-downloads";

export const LARGE_SCULPTURE_TITLE =
  "Fitting aluminum scale plates to the large wooden sculpture";

export const LARGE_SCULPTURE_INTRO =
  "For iani: develop varied aluminum scale plates from the actual prepared sculpture, beginning with a small neighboring group of paper templates. Fit and record each plate, test the complete material stack, then install one fully supported piece at a time. The separate 180 mm kit belongs to the printed study.";

export const LARGE_SCULPTURE_STATUS =
  "This is a proposed workshop sequence. Plate shapes, thickness, overlap, finish, and attachment still require successful physical samples on matching materials before production.";

export const LARGE_SCULPTURE_REFERENCE_NOTE = `The source dimensions are archival construction-model bounds. The current large preview and triangular reference surface add ${FABRICATION_GEOMETRY_OPTIONS.radiusOffsetInches} in (${FABRICATION_GEOMETRY_OPTIONS.radiusOffsetInches * 25.4} mm) to each local section radius as a conceptual allowance. That allowance has no measured construction-layer specification. Use the old kit to study poem flow and difficult regions; derive production scale patterns and their remaining layer allowance from the actual prepared support surface.`;

export const LARGE_SCULPTURE_DECISION = {
  title: "Confirm the support and setting first",
  body: "Before buying metal or adhesive, document the actual stepped wood, gaps, finish, structural members, and whether the sculpture will live indoors or outdoors. Agree which surfaces may receive local backing or leveling without removing or loading structural timber. Those answers determine the plate, attachment, edge, and protection system.",
  openStructure:
    "Gaps and open areas: each thin-metal plate needs continuous supported contact beneath its working area. Add only an approved local backing or leveling solution; do not span a gap with foil or pull the sculpture flat by force.",
  continuousSurface:
    "Supported wood: check steps, high points, open joints, loose finish, and access for pressing each plate. A sound existing finish is the bonding surface. Test preparation on matching scrap before altering the sculpture.",
} as const;

export const LARGE_SCULPTURE_LAYERS = [
  {
    layer: "Marked aluminum and finish",
    note: "A fitted decorative plate, protected as required for the confirmed setting; it does not stabilize or strengthen the sculpture.",
  },
  {
    layer: "Extra plate thickness at any overlap",
    note: "Count this local buildup only where an overlap is planned and tested. Keep hidden margins clear of every letter; check that the adjoining plate stays supported.",
  },
  {
    layer: "Approved adhesive or adhesive backing",
    note: "Chosen for the confirmed aluminum, prepared support surface, wood finish, and display conditions.",
  },
  {
    layer: "Local backing or leveling where needed",
    note: "Provides continuous contact under each plate without concealing a structural problem or forcing the sculpture out of shape.",
  },
  {
    layer: "Prepared wood support",
    note: "The measured, stable surface from which each paper template and the complete installed buildup are developed.",
  },
] as const;

export const LARGE_SCULPTURE_PLATE_FAMILIES = [
  {
    title: "Broad supported body areas",
    note: "Use broader plates only where the prepared support remains continuous and the paper template settles without force.",
  },
  {
    title: "Smaller tight-turn pieces",
    note: "Reduce the template around abrupt steps, compound turns, and the tight crossing until it fits cleanly with supported edges.",
  },
  {
    title: "Custom edge, tail, and jaw pieces",
    note: "Develop these separately around their actual boundaries and installation access; do not carry a blanket panel across the jaw, head/tail separation, or crossing.",
  },
] as const;

export const LARGE_SCULPTURE_PLATE_RECORD = [
  "Plate ID and sculpture region",
  "Top/orientation arrow and poem reading direction",
  "Neighboring plate IDs on every shared edge",
  "Actual-size paper contour, maximum flat width and height, and measurement units",
  "Prepared support condition and any approved local backing or leveling",
  "Reference surface and measured thickness of each remaining adhesive, metal, finish, or overlap layer",
  "Minimum and maximum local buildup from that reference surface",
  "Joint or tested overlap margins, including the hidden margin",
  "Wood joints and the tested allowance for movement",
  "Minimum installed clearance from nearby plates, edges, and moving or separate regions",
  "Poem segment, first and last words, and entry/exit reading direction proofed",
] as const;

export const LARGE_SCULPTURE_STEPS = [
  {
    title: "Survey and stabilize the actual sculpture",
    body: "Support the sculpture at its base and structural members so it stays steady while you work. Keep loads off the jaw and tail. Record the actual stepped blocks, curves, openings, gaps, finish, and tight crossing. Identify structural members and restraints before choosing working areas; changes to them belong to iani’s construction plan.",
  },
  {
    title: "Define each prepared support area",
    body: "Map where a plate can make continuous supported contact. Record the reference surface and local backing or leveling, adhesive, metal, finish, and overlap thickness; measure the complete buildup and remaining clearance. Identify wood joints that may move. Keep plate and backing boundaries clear of them unless the attachment detail is designed and tested for that movement. Avoid rigidly locking neighboring wood sections together through a plate or glued overlap.",
  },
  {
    title: "Develop a neighboring paper-template group",
    body: "Choose one representative area containing a broad supported face, a step or turn, and at least one shared edge. Fit a small group of actual-size paper templates directly to the prepared support. Record units and check a scale bar if a contour is scanned or reprinted. Use removable aids only after testing them on the finish. Adjust the group until every piece settles without force and all shared edges can be installed in sequence.",
  },
  {
    title: "Record every proposed plate before marking",
    body: "Complete the plate record for every template, including its contour, flat dimensions, local layer thicknesses, joints, margins, and clearance. Keep letters clear of cut edges and hidden overlap margins. Proof the group’s poem segment and its entry and exit before marking the sample. Approve the complete poem sequence across the full proposed layout before batch production.",
  },
  {
    title: "Resolve special regions and plate families",
    body: "Use broader plates only on broad continuously supported areas, smaller pieces at tight turns and steps, and custom pieces at edges, tail, head, jaw, and the tight crossing. Keep the jaw and head/tail separation independent. Revise any split that buckles, lacks supported contact, blocks installation access, or places a seam or overlap through lettering.",
  },
  {
    title: "Choose metal for the confirmed setting",
    body: "The current proposal is unbacked 0.005 in (0.127 mm) AlumaMark, subject to supplier and lot confirmation. That thin stock requires supported contact. A thicker stock needs new bend, edge, attachment, marking, buildup-clearance, and installation-access tests. AlumaMark is intended for indoor use. Exterior use requires compatible UV-blocking protection and a tested attachment system for the actual setting.",
  },
  {
    title: "Select a sample attachment and marking process",
    body: "Choose an adhesive whose manufacturer supports the confirmed aluminum and actual prepared finish. Follow its preparation, working-time, pressure, handling, and bond-development or cure instructions. Have the shop approve the stock and a marked coupon before the group test. Mark unbacked metal flat, then add attachment materials afterward; adhesive-backed stock needs separate shop approval. Trim and smooth edges on a protected bench away from the sculpture with hand and eye protection.",
  },
  {
    title: "Test the complete marked neighboring group",
    body: "Use same-stock aluminum and matching prepared wood, including the approved marked coupon, local backing or leveling, adhesive, planned protective finish, and optional overlap. Form and attach the marked pieces. After the specified bond-development or cure time, check fit, edge lift, springback, rubbing, support, clearance, and poem continuity. An overlap must settle without holding its neighbor off the support or damaging lettering. Test for the planned display conditions and record how joints accommodate wood movement; revise and repeat if needed.",
  },
  {
    title: "Produce from approved paper records",
    body: "Transfer only approved templates and their IDs, orientation, neighbors, margins, clearance, and poem segment. Gently pre-form each piece as in the successful sample. Dry-fit it with its neighbors on continuous support and verify the full reading proof before adhesive touches the sculpture. Stop and re-pattern any piece that needs force, spans a gap, wrinkles, or loses its recorded clearance.",
  },
  {
    title: "Attach, allow the bond to develop, and inspect",
    body: "Install in the tested sequence using soft tools over solid support. For approved PSA, progressively remove the liner; for wet adhesive, follow the selected product’s tested placement and holding method. Allow the specified bond-development or cure time before transport. Inspect every edge, joint, optional overlap, special-region clearance, finish, and poem transition. Measure the finished clad height, width, and depth before packaging. Photograph the installed ID map and retain templates, offcuts, stock details, and adhesive records for repairs.",
  },
] as const;

export const LARGE_SCULPTURE_CHECKLIST = [
  "Indoor or outdoor setting confirmed",
  "Wood structure stable; steps, gaps, finish, and actual prepared support recorded",
  "Local backing or leveling and continuous plate support approved",
  "Layer thicknesses, local buildup, joint movement, and remaining clearances measured",
  "Neighboring paper-template group fitted without force",
  "Every plate record completed before metal marking",
  "IDs, neighbors, orientation, poem arrows, joints or overlaps, and clearances proofed",
  "Jaw, head, tail, edges, and tight crossing resolved as custom fitted regions",
  "Exact metal thickness, finish, attachment, and protection system identified",
  "Complete marked neighboring-group test, including protective finish, passed after the specified bond-development or cure time",
  "Marked faces protected; all trimming completed off the sculpture with hand and eye protection",
  "Bonded edges, joints, clearances, finish, plate map, and poem readability inspected and documented",
  "Finished clad height, width, and depth measured before packaging",
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
    note: "Conceptual triangular reference; not a measured jaw scale pattern.",
  },
  {
    label: "Conceptual full-scale panel reference",
    href: FABRICATION_DOWNLOADS.largeKit,
    note: "Uses the conceptual radius allowance; not an as-built scale-plate set.",
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
  {
    label: "USDA Wood Handbook: moisture and dimensional change",
    href: "https://research.fs.usda.gov/download/treesearch/62243.pdf",
    note: "Chapter 4, pages 4–3 and 4–7: wood moves with moisture changes; coatings slow moisture exchange. Use that behavior when planning and testing plate boundaries and joints.",
  },
  {
    label: "3M: adhesive joint design",
    href: "https://www.3m.com/3M/en_US/bonding-and-assembly-us/resources/full-story/?storyid=a7373207-e0e3-4498-84ef-f749d380e910",
    note: "Manufacturer background on joint geometry and edge-peel loading. Any plate overlap still needs testing on the actual prepared support and material stack.",
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
    "CURRENT GEOMETRY STATUS",
    LARGE_SCULPTURE_REFERENCE_NOTE,
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
    "PLATE FAMILIES — FIT TO THE ACTUAL SUPPORT; NO FIXED SIZE IS ASSUMED",
    ...LARGE_SCULPTURE_PLATE_FAMILIES.map(
      ({ title, note }) => `- ${title}: ${note}`,
    ),
    "",
    "PLATE RECORD — COMPLETE BEFORE METAL MARKING",
    ...LARGE_SCULPTURE_PLATE_RECORD.map((item) => `[ ] ${item}: __________`),
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
