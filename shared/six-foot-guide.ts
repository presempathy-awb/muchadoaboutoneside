import { SIX_FOOT_STUDY } from "./six-foot-study";

export const SIX_FOOT_TITLE = "Six-foot indoor sculpture options";

export const SIX_FOOT_INTRO =
  "A reusable indoor version approximately 72 inches tall overall, including its redesigned base and final cladding. Visitors may touch it, but it is not for climbing. Compare construction systems through full-size samples before choosing a frame, surface, joints, or finish.";

export const SIX_FOOT_STATUS =
  "Planning comparison only. No option has demonstrated final strength, stability, dent resistance, skin fit, or lowest total cost. A fabricator must design the structure, hardpoints, joints, panel attachment, and base for the finished sculpture and its actual indoor setting.";

export const SIX_FOOT_OPTIONS = [
  {
    id: "backedflash",
    title: "Fully backed thin aluminum flashing",
    benefit:
      "The lowest current raw-metal benchmark and a genuine aluminum surface. Narrow stock can suit many small, replaceable scales when every piece is fully supported.",
    tradeoff:
      "The 10-inch roll creates many seams. Thin stock can wrinkle, dent, or show backing defects, so smooth continuous support, safe edges, marking, joints, and ordinary-touch repairs need a physical sample.",
    fit: "Economy candidate for a maker willing to build the full backing and manage numerous fitted pieces; never use as unsupported skin.",
  },
  {
    id: "backedrealalu",
    title: "Plywood structure with supported aluminum sheet",
    benefit:
      "Familiar woodworking can carry smooth backing and replaceable real-aluminum plates. It suits broader curves plus smaller custom jaw and tail pieces.",
    tradeoff:
      "Both backing and metal require fitting. Framing, fairing, adhesives or fasteners, finished edges, and labor may cost more than the sheet itself.",
    fit: "Leading option where curved or varied scale plates and a real sheet-metal touch are priorities.",
  },
  {
    id: "ACMfacets",
    title: "Plywood hardpoints with aluminum-composite facets",
    benefit:
      "Three-millimeter panels have real aluminum faces over a plastic core. Their rigidity and finished face may avoid a separate smooth backing across each supported facet.",
    tradeoff:
      "Faceting, joint support, cut layout, core and edge finishing, freight, and remnants affect cost. The preliminary stock allowance exceeds one 4-by-8-foot sheet.",
    fit: "Leading option for fewer large facets plus smaller custom jaw, tail, edge, and tight-turn pieces.",
  },
  {
    id: "steel+alu",
    title: "Steel armature with supported aluminum skin",
    benefit:
      "A welded frame can provide compact structure and useful mounting points when skilled labor, tools, or scrap are available.",
    tradeoff:
      "Welding, corrosion control, dissimilar-metal details, weight, backing, and skin attachment add work. A strong frame does not prevent the aluminum from denting.",
    fit: "Request a comparative bid when local welding resources could outweigh added fabrication and finishing labor.",
  },
  {
    id: "allalu",
    title: "All-aluminum frame and skin",
    benefit:
      "A shop may develop a light metal-only frame, repeated parts, or a folded and riveted shell with integrated attachment details.",
    tradeoff:
      "Forming, joints, assembly sequence, rework, and shell behavior require specialist design. Conceptual thin cladding is not a demonstrated structural shell.",
    fit: "Worth a shop quote when aluminum fabrication help or suitable donated material is available.",
  },
  {
    id: "hardcoatedfoam",
    title: "Hard-coated foam with thin metal skin",
    benefit:
      "A maker experienced with this method can shape complicated volume with a relatively inexpensive bulk core and add metal or foil as the visible layer.",
    tradeoff:
      "Hard coat, durable hardpoints, bonding, finished edges, impact damage, and repair work can consume the core savings. Touch durability needs testing.",
    fit: "Secondary option for a shop already equipped to build durable coated-foam displays; keep it separate from the burn edition.",
  },
] as const;

export const SIX_FOOT_PRICES = [
  {
    title: "Amerimax aluminum flashing",
    stock: "0.0092 in thick, 10 in × 50 ft roll",
    price: "$49.98",
    area: "41.7 sq ft gross",
    note: "Narrow stock requires many seams and full backing; gross area is not a nesting result.",
    href: "https://www.homedepot.com/b/Building-Materials-Roofing-Roof-Flashing-Roll-Flashing/Aluminum/0092/N-5yc1vZas6dZ1z0ln8dZ1z0usgq",
  },
  {
    title: "5052-H32 aluminum sheet",
    stock: "0.032 in thick, 4 × 10 ft sheet",
    price: "$171.96",
    area: "40 sq ft gross",
    note: "Solid aluminum benchmark before cutting, backing, attachment, edges, finish, and freight.",
    href: "https://www.onlinemetals.com/en/buy/aluminum/0-032-aluminum-sheet-5052-h32/pid/7125",
  },
  {
    title: "Brushed aluminum-composite panel",
    stock: "3 mm thick, 4 × 8 ft sheet",
    price: "$119.95 each; two listed sheets $239.90",
    area: "32 sq ft each; 64 sq ft for two",
    note: "Real aluminum faces with a plastic core. The 35–40 sq ft budget allowance may require two sheets or suitable remnants; supplier lists pickup or delivery rather than parcel shipping.",
    href: "https://www.signsupply.com/Substrates/ACP.html",
  },
] as const;

export const SIX_FOOT_STEPS = [
  {
    title: "Set the finished envelope",
    body: "Keep the new skin, feet, and redesigned base inside the finished 72-inch height. The archived model is normalized to 72 inches before cladding; plywood thickness, joints, hardpoints, and stock are selected for this build rather than uniformly scaled.",
  },
  {
    title: "Shortlist by shape and shop resources",
    body: "Compare supported aluminum for smoother curved scales and aluminum-composite for larger facets. Include steel or all-aluminum bids when tools, skills, scrap, or donated labor make them competitive. No system is universally cheapest.",
  },
  {
    title: "Use fewer broad panels where they fit",
    body: "Favor fewer large, replaceable panels on broad supported regions, then make smaller custom plates for the jaw, tail, edges, steps, and tight turns. Support every joint and finish every reachable edge for ordinary hand contact.",
  },
  {
    title: "Build representative touch samples",
    body: "Make one marked plate, edge, corner, joint, and attachment in each shortlisted system. Compare hand pressure, denting, flex, wrinkles, glare, edge comfort, marking adhesion, cleaning, finish damage, and replacement without climbing loads.",
  },
  {
    title: "Rescale and reproof the inscription",
    body: "Rescale the exact approved poem layout to the chosen final panel map, then reproof reading order, stroke size, seams, hidden margins, and contrast. Run a shop marking test on the selected finish. Existing large reference files are not a six-foot cutting kit.",
  },
  {
    title: "Lay out full-size panels and price the system",
    body: "Create full-size outlines and a real nesting layout before buying sheets. Price frame, backing, panels, waste, edge treatment, hardware, adhesives, lettering, finish, redesigned base, freight, and labor together rather than comparing raw material alone.",
  },
  {
    title: "Resolve stability, touch, and transport",
    body: "Review base attachment, foreseeable sideways push, center of gravity, and all reachable surfaces with the fabricator. Plan doorway-sized transport splits and replaceable panels while preserving the designed load path. Keep this indoor display independent from burn materials and operations.",
  },
] as const;

export const SIX_FOOT_DECISIONS = [
  "Preferred surface language: smoother scales, larger facets, or a deliberate combination",
  "Available woodworking, welding, aluminum-fabrication, coating, and marking capabilities",
  "Actual indoor doorway, route, assembly space, display footprint, floor conditions, and anchoring permissions",
  "Required touch durability, cleaning method, repair access, and acceptable patina or denting",
  "Approved panel edge, corner, joint, attachment, and replacement sample",
  "Redesigned base, finished center of gravity, foreseeable push review, and no-climb presentation",
  "Final panel map, exact poem reproof, marked finish sample, nesting layout, and delivered quote",
];

export const SIX_FOOT_SOURCES = [
  {
    label: "Online Metals: 0.032-inch 5052-H32 aluminum sheet",
    href: "https://www.onlinemetals.com/en/buy/aluminum/0-032-aluminum-sheet-5052-h32/pid/7125",
    note: "Public 4-by-10-foot solid-sheet price benchmark checked September 15, 2026.",
  },
  {
    label: "Ordway Sign Supply: aluminum-composite panels",
    href: "https://www.signsupply.com/Substrates/ACP.html",
    note: "Public 3 mm brushed aluminum-composite price benchmark and supplier delivery information checked September 15, 2026.",
  },
  {
    label: "Home Depot: Amerimax aluminum flashing",
    href: "https://www.homedepot.com/b/Building-Materials-Roofing-Roof-Flashing-Roll-Flashing/Aluminum/0092/N-5yc1vZas6dZ1z0ln8dZ1z0usgq",
    note: "Public 10-inch-by-50-foot, 0.0092-inch flashing price benchmark checked September 15, 2026.",
  },
  {
    label: "3A Composites: DIBOND aluminum composite",
    href: "https://3acompositesusa.com/products/dibond/",
    note: "Manufacturer reference for aluminum-faced composite construction; total panel thickness does not state aluminum face thickness or sculpture performance.",
  },
] as const;

const [skinAreaLow = 0, skinAreaHigh = 0] = SIX_FOOT_STUDY.skinAreaSqFt;

const dimensionLines = [
  `Finished target height: ${SIX_FOOT_STUDY.targetHeightInches.toFixed(1)} in including new cladding and base`,
  `Archived-model normalization scale: ${SIX_FOOT_STUDY.scale.toFixed(3)}`,
  `Normalized non-base body: ${SIX_FOOT_STUDY.bodyWidthInches.toFixed(1)} in wide × ${SIX_FOOT_STUDY.bodyDepthInches.toFixed(1)} in deep`,
  `Normalized reference base: ${SIX_FOOT_STUDY.referenceBaseWidthInches.toFixed(1)} × ${SIX_FOOT_STUDY.referenceBaseDepthInches.toFixed(1)} in; reference only, not a recommended footprint`,
  `Conceptual body-and-jaw skin area: ${skinAreaLow.toFixed(1)}–${skinAreaHigh.toFixed(1)} sq ft, excluding base`,
  `Scaled legacy preview allowance: ${SIX_FOOT_STUDY.scale.toFixed(3)} in from the original 1 in radius offset; conceptual only, not a measured layer`,
  "Preliminary stock budget: 35–40 sq ft excluding base; allowance only, not a nesting result or skin guarantee",
];

const entryLines = (
  entries: readonly { readonly title: string; readonly body: string }[],
) =>
  entries.flatMap(({ title, body }, index) => [
    `${index + 1}. ${title}`,
    `   ${body}`,
  ]);

const section = (title: string, lines: readonly string[]) => [
  title,
  "-".repeat(title.length),
  ...lines,
  "",
];

export const SIX_FOOT_PLAN_TEXT = [
  SIX_FOOT_TITLE,
  "=".repeat(SIX_FOOT_TITLE.length),
  "",
  SIX_FOOT_INTRO,
  "",
  SIX_FOOT_STATUS,
  "",
  ...section("SOURCE-DERIVED DIMENSION STUDY", dimensionLines),
  ...section(
    "CONSTRUCTION OPTIONS",
    SIX_FOOT_OPTIONS.flatMap(({ title, benefit, tradeoff, fit }, index) => [
      `${index + 1}. ${title}`,
      `   Benefit: ${benefit}`,
      `   Tradeoff: ${tradeoff}`,
      `   Fit: ${fit}`,
    ]),
  ),
  ...section(
    "PUBLIC PRICE EXAMPLES",
    SIX_FOOT_PRICES.flatMap(({ title, stock, price, area, note, href }) => [
      `- ${title}: ${stock}; ${price}; ${area}`,
      `  ${note}`,
      `  ${href}`,
    ]),
  ),
  "Prices checked September 15, 2026. They are public U.S. examples, not local quotes. Tax, freight, cutting, waste, labor, frame, backing, hardware, base, lettering, and finish are extra.",
  "",
  ...section("PROPOSED DESIGN SEQUENCE", entryLines(SIX_FOOT_STEPS)),
  ...section(
    "DECISIONS TO CLOSE",
    SIX_FOOT_DECISIONS.map((decision) => `[ ] ${decision}`),
  ),
  ...section(
    "SOURCES",
    SIX_FOOT_SOURCES.flatMap(({ label, href, note }) => [
      `- ${label}: ${href}`,
      `  ${note}`,
    ]),
  ),
].join("\n");

export const SIX_FOOT_PLAN_URI = `data:text/plain;charset=utf-8,${encodeURIComponent(SIX_FOOT_PLAN_TEXT)}`;
