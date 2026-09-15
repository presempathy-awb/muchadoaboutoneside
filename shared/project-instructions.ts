import { FABRICATION_DOWNLOADS } from "./fabrication-downloads";

export const INSTRUCTION_SECTIONS = [
  { id: "dimensions", label: "Dimensions" },
  { id: "make", label: "Make" },
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
      "Practice the alphabet, hard words, spacing, and punctuation before beginning the numbered master rows.",
      "Letter each row on its own baseline at the specified 7 mm x-height and 55° slant. Keep the row ID with every original.",
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
    title: "Study the full-scale surface",
    summary:
      "Use the large panel files as a conceptual mapping reference for the original sculpture geometry.",
    steps: [
      "Begin with the representative fit kit and confirm the surface mapping on paper.",
      "Use the body and jaw marking masters as separate artwork; keep the jaw seam and crossing clearance visible in planning.",
      "Treat the panel set as a dimensioned reference. It has geometric validation but no completed physical fit test.",
      "Choose stock, adhesive, machine settings, and final trimming only after shop review and physical coupons.",
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
