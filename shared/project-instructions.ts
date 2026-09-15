import { FABRICATION_DOWNLOADS } from "./fabrication-downloads";

export const INSTRUCTION_SECTIONS = [
  { id: "dimensions", label: "Dimensions" },
  { id: "make", label: "Make" },
  { id: "large-sculpture", label: "Large wood" },
  { id: "pack", label: "Pack" },
  { id: "send", label: "Send" },
] as const;

export const PROJECT_PATHS = [
  {
    number: "01",
    title: "Letter the poem",
    summary:
      "Create the full-size paper originals from the row templates, preserving every word, punctuation mark, split, and row ID.",
    steps: [
      "Download or print the hand-lettering guide at 100% scale; do not fit the template to the page.",
      "Warm up on the style-sample and hard-words sheets, then letter each numbered master row in your own copperplate on the baseline beneath its printed words. Keep the row ID with every original.",
      "Write at a comfortable size and keep rows from touching; hairline weight, size normalisation, and spacing are handled digitally after the scan.",
      "Let the ink dry fully, check every finished row against the canonical poem, then make a high-resolution scan and row-by-row inventory before packing the originals flat.",
    ],
    downloads: [
      {
        label: "Printable lettering guide",
        href: "/guide/calligraphy-guide.pdf",
      },
      { label: "Print-ready web guide", href: "/guide/calligraphy-guide.html" },
      {
        label: "Canonical poem text",
        href: "/editions/much-ado-about-one-side.txt",
      },
    ],
  },
  {
    number: "02",
    title: "Build the 180 mm study",
    summary:
      "Print the smooth maquette first, then mark and fit the separate foil kit made for that exact 180 mm form.",
    steps: [
      "Print the STL upright on its integrated base. The file is already in millimetres and Z-up.",
      "Generate supports from the build plate for the jaw, chin, and overhangs, and inspect every sliced layer before printing.",
      "Test the 2.5 mm lettering coupon and paper-fit the foil pieces before marking the complete set.",
      "Mark the foil flat, trim it after the paper fit, and apply it to the printed form only after the material tests pass.",
    ],
    downloads: [
      {
        label: "180 mm printable maquette (STL)",
        href: "/fabrication/print/muchado-maquette-180mm.stl",
      },
      {
        label: "Complete 180 mm foil kit",
        href: FABRICATION_DOWNLOADS.smallKit,
      },
      {
        label: "180 mm lettering test coupon",
        href: "/fabrication/small-foil/test-coupon.svg",
      },
      {
        label: "Print notes",
        href: "/fabrication/print/README.txt",
      },
    ],
  },
  {
    number: "03",
    title: "Fit aluminum to the large wood sculpture",
    summary:
      "Plan varied aluminum scale plates on iani’s actual prepared wood, with individually fitted paper patterns and measured room for every added layer.",
    steps: [
      "Measure the prepared support for each scale. Record local backing or leveling, adhesive, metal, finish, and any overlap, then check the jaw and crossing with the complete planned build-up.",
      "Paper-fit a small neighboring group of body, tight-turn, and custom edge scales. Give every piece an ID, orientation, contour, and measured joint margin. The existing triangular panel kit is a conceptual reference, not the new scale layout.",
      "Keep body and jaw artwork separate. Map the complete poem across the approved scale layout, keeping visible lettering clear of cut edges and any hidden overlap margins.",
      "Test the actual aluminum, prepared wood, attachment, and edge joints as a marked group before choosing final plate sizes or producing the full set.",
    ],
    downloads: [
      {
        label: "Representative fit kit",
        href: FABRICATION_DOWNLOADS.largeFitKit,
      },
      {
        label: "Full-scale conceptual panel kit",
        href: FABRICATION_DOWNLOADS.largeKit,
      },
      { label: "Body marking master", href: FABRICATION_DOWNLOADS.bodyMaster },
      { label: "Jaw marking master", href: FABRICATION_DOWNLOADS.jawMaster },
    ],
  },
] as const;

export const PACKING_GROUPS = [
  {
    title: "Paper originals",
    items: [
      "Keep every sheet flat between two clean, rigid archival boards larger than the artwork.",
      "Place the board sandwich in a moisture-resistant sleeve or bag before it enters the shipping box.",
      "Use corner guards or paper bands outside the image area. Put no tape, labels, clips, or adhesive on the artwork.",
      "Enclose a row inventory and sender contact and state whether the originals should be returned after scanning or production.",
    ],
  },
  {
    title: "Marked or unmarked foil",
    items: [
      "Keep foil pieces flat and separate, with a smooth rigid backing and interleaving that cannot emboss the surface.",
      "Protect edges and marked faces from rubbing. Do not fold, roll, crease, or stack loose hardware on the foil.",
      "Label parts on their protective sleeves or backing boards, never on the foil itself.",
    ],
  },
  {
    title: "180 mm maquette",
    items: [
      "Support the sculpture at its integrated base inside a fitted inner cradle.",
      "Place the supported cradle in a fitted inner box, then cushion that box inside a larger outer shipping box and pad every gap so it cannot shift.",
      "Place no packing load on the jaw or tail. Immobilize the base instead of pressing fragile forms into foam.",
      "If CoLab iani agrees to a staged inspection, make the inner box easy to lift out layer by layer. Do not test the packed artwork by shaking it.",
    ],
  },
] as const;

export const HANDOFF_CHECKLIST = [
  "Recipient name and confirmed CoLab iani mailing address entered",
  "Receiving date or delivery window confirmed with the recipient",
  "Contents photographed and itemized before closing the box",
  "Lettering ink fully dry; scan backup and row inventory retained",
  "Paper originals protected flat with no tape on artwork",
  "Foil protected flat, separately backed, and free of folds or creases",
  "Maquette secured at its base with no load on jaw or tail",
  "Inner object dimensions recorded before padding",
  "Finished package measured and weighed after all padding is in place",
  "Packing slip, contents inventory, sender contact, and return preference enclosed; a copy retained",
] as const;
