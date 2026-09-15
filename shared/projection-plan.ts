export const PROJECTION_TITLE = "Inscription below the ice";

export const PROJECTION_INTRO =
  "A six-movement projection and future-score plan for the large sculpture at its burn. Enceladus ice and plumes lead into a reconstructed ocean, then fictional angular chimeras. Target the visible body, head, jaw, tail, and base; register letter light only where the approved handwriting is installed.";

export const PROJECTION_STATUS =
  "Working treatment. The score, projection media, installed-letter masks, and venue-approved equipment layout still need development and rehearsal. The chimeras and music will be original; itchy-O is an aesthetic reference for the dark ritual mood.";

export const PROJECTION_MOVEMENTS = [
  {
    id: "P01",
    title: "Archive / white silence",
    science:
      "Observed reference: Cassini images show bright ice, cratered regions, long shadows, and contrasting young terrain near the south pole.",
    scene:
      "Raking white light reveals ice texture while sparse grains drift through darkness. Keep the sculpture’s angular form instead of disguising it as a spherical moon.",
    letters:
      "Reveal one approved row or linked region at a time. Hold it at high contrast; leave completed rows as dim afterimages without changing order.",
    score:
      "Near-silence, brittle detail, distant low pressure, and space to read. Duration and pulse remain open.",
    transition: "Fine cracks gather along real edges, then connect into P02.",
  },
  {
    id: "P02",
    title: "Tiger stripes / tidal flex",
    science:
      "Observed and modeled reference: four prominent south-polar fissures vent plumes; warmer regions align with fractures influenced by tidal stress.",
    scene:
      "Send blue-white fissures over selected faces. Open grooves with light and shadow without claiming the sculpture reproduces Enceladus topography.",
    letters:
      "Keep independent letter masks above fractures. Light may follow strokes or a whole row; never break a word to follow a seam.",
    score:
      "Low flexing, brittle attacks, and widening spatial percussion in an original vocabulary.",
    transition: "Fissures brighten; narrow emissions rise into P03.",
  },
  {
    id: "P03",
    title: "Plume choir",
    science:
      "Observed reference: water vapor and ice grains emerge through south-polar fractures as jets or curtain-like activity.",
    scene:
      "Build upward strokes into vapor curtains and granular ice, using sculpture edges as projected launch points.",
    letters:
      "Echo ascenders, complete each poem passage before density peaks, and protect active rows with a low-detail window.",
    score:
      "Breath, filtered noise, granular ice, and rising bands with clear events for later operator cues.",
    transition: "The plume falls inward and opens a cutaway into P04.",
  },
  {
    id: "P04",
    title: "Ocean under ice",
    science:
      "Evidence-based reconstruction: measurements support a global saltwater ocean and evidence of water-rock interaction and hydrothermal activity. The interior is inferred; life has not been found.",
    scene:
      "Descend through ice into dark currents and suspended particles. Show the rocky core and hydrothermal circulation as an interpreted cutaway, not observed interior footage.",
    letters:
      "Use exact handwriting strokes as depth markers while continuing the approved route across all mapped regions.",
    score:
      "Submerged resonance, slow pressure pulses, mineral clicks, and deep circulation.",
    transition:
      "Particles form angular joints as the science layer recedes into fictional P05.",
  },
  {
    id: "P05",
    title: "Chimera foundry",
    science:
      "Fiction: the creatures, their behavior, and any inhabited interior are imagined. The measurements do not depict organisms.",
    scene:
      "Black chimeras assemble from ice shards and plate edges. Long stilt-like limbs unfold around triangular bodies in slow, asymmetrical, butoh-inspired animation.",
    letters:
      "Restore complete handwriting before each reading cue. Creatures may frame a row but never replace or reorder it.",
    score:
      "Angular ritual percussion, jointed accents, stretched silence, and low collective motion; all newly composed.",
    transition: "Chimeras become vectors along the poem route into P06.",
  },
  {
    id: "P06",
    title: "Proof / ejection / burn",
    science:
      "Observed reference returns: south-polar ice grains and vapor contribute to Saturn’s E ring. The burn is the artwork’s event, not science reconstruction.",
    scene:
      "Unify surface, fracture, plume, ocean, and chimera motifs. After the reading proof, letters become grains in a sparse plume, ready for immediate blackout.",
    letters:
      "Give the poem one uninterrupted approved-order pass, using final-handwriting overlays and rehearsed readable holds.",
    score:
      "Converge the sound families, then reduce to pulse, breath, and inscription. The score may cue projection only.",
    transition:
      "On the burn lead’s call, hold, use an approved broad effect, or black out immediately.",
  },
] as const;

export const PROJECTION_CHIMERAS = [
  "Create triangular bodies under black drapery, with extremely long, articulated stilt-like arms and legs and sparse icy edge light.",
  "Build original silhouettes from this sculpture’s plate edges, ice shards, and the tension of calligraphic strokes. Show fragments gathering, joints forming, cloth settling, and the first slow movement.",
  "Animate slow weight shifts, folded joints, and asymmetric butoh-inspired groups; label all creatures as fiction.",
  "Keep chimeras projected. This plan includes no live stilt or roaming performers near fire.",
  "Stage dark silhouettes against illuminated ice or a restrained rim. Projected black adds no light and cannot darken firelit aluminum; test the contrast on the actual surface.",
  "Preserve negative space around active writing; limbs may point along the route but never hide or reorder words.",
];

export const PROJECTION_RIG = [
  {
    title: "Survey the real scene",
    body: "Choose projector and operator stations outside the event-approved burn exclusion area before choosing lenses. Survey the actual sculpture, audience zones, emergency lanes, ground, and changing wind/smoke exposure. A short-throw lens does not authorize a closer position.",
  },
  {
    title: "Target every sculpture region",
    body: "Map body, head, jaw, tail, and base independently. Check every intended visible face, underside, step, and crossing from each station. Record lit, overlapping, shadowed, and unreadable patches in a coverage matrix; resolve blind spots before claiming full coverage. Projector count follows this test.",
  },
  {
    title: "Choose optics after the survey",
    body: "Throw ratio is lens-to-reference-plane distance divided by the full projected image width, using the same units. Use the exact manufacturer lens calculator, then test near/far depth, focus, overlap, pixel density, and brightness on the real scene. Short throw is one option; a longer throw may suit the permitted standoff better.",
  },
  {
    title: "Use a designed outdoor support system",
    body: "Use purpose-built projector stands, towers, or another mounting system selected by the event’s competent AV/rigging crew. Design for the projector, lens, enclosure, wind, ground, anchoring or ballast, and a protected footprint. Compare approved elevated mounts and stands for clear sightlines; follow the selected projector’s beam/viewing restrictions. A camera tripod’s weight rating alone is insufficient. Keep positions fixed during the burn.",
  },
  {
    title: "Plan power, weather protection, and blackout",
    body: "Have the event electrician plan distribution, weather-rated connections, cable routes or ramps, and protected power/data. An enclosure must preserve manufacturer ventilation and temperature limits. Provide a manufacturer-supported light-mute or shutter control independent of score playback; test failure and manual operation from the approved operator station.",
  },
  {
    title: "Calibrate masks and alignment",
    body: "Build an atlas with silhouette, regional, and letter masks plus blended overlaps. Crop source overscan with hard exclusion masks so light stays on approved surfaces and away from audience and safety areas. Include a neutral alignment pattern and a tested broad fallback.",
  },
  {
    title: "Test the actual marked surface",
    body: "Night-test still and moving scenes on the actual finished, marked aluminum from every audience zone. Record glare, unreadable strokes, shadowed patches, focus, color, and camera appearance. Flames add light, smoke blocks beams, and moving structure breaks alignment; full coverage and readable letters cannot be guaranteed during the burn. Any coating change needs material and burn-team approval plus retesting.",
  },
] as const;

export const PROJECTION_WORKFLOW = [
  {
    title: "Lock the handwriting source",
    body: "Trace only final approved handwriting. Preserve every stroke, row ID, word, and reading order; never generate substitute text.",
  },
  {
    title: "Map readable regions",
    body: "Register rows and letters to surveyed regional masks. Test scale, spacing, contrast, seams, occlusion, and region transitions. Keep an active-row contrast window.",
  },
  {
    title: "Build a silent proof first",
    body: "Run the complete poem without music or fire. Verify every approved row and regional handoff, including the separate jaw and tight crossing. Keep undecorated supports or base areas imagery-only; correct masks and holds before adding density.",
  },
  {
    title: "Compose and synchronize later",
    body: "Give the composer movement IDs, energy curve, visual vocabulary, and poem events. After playback is chosen, assign versioned bar/beat or timecode cues with composer and operator.",
  },
  {
    title: "Rehearse manual HOLD and BLACKOUT",
    body: "Configure and test blackout on sync or show-control loss; playback defaults differ. Provide manual HOLD and an independent, manufacturer-supported light-mute or shutter control. Resume a rehearsed manual fallback only on a fresh go. Keep score cues separate from ignition authority and preserve the burn lead’s calls and immediate blackout.",
  },
] as const;

export const PROJECTION_PHASES = [
  {
    title: "Pre-ignition precision",
    condition:
      "Sculpture intact, alignment verified, audience and burn team placed, and playback released by the burn lead.",
    visual:
      "Run precise lettering, surface detail, interior reconstruction, chimeras, and the complete poem proof. This is the strongest readability phase.",
    operator:
      "Watch alignment. HOLD for occlusion, alignment loss, or a pause; BLACKOUT on the burn lead’s call.",
  },
  {
    title: "Conditional stable early-burn effects",
    condition:
      "Only while the burn lead confirms stable structure, safe equipment, useful visibility, and no need to enter the exclusion area.",
    visual:
      "Use broad plume, fissure, grain, or color effects. Stop precise lettering when the surface moves, chars, flares, or is obscured.",
    operator:
      "Continue on manual go only. Never reposition or service equipment under active burn. HOLD or BLACKOUT when conditions change.",
  },
  {
    title: "Blackout and clearance",
    condition:
      "Any safety call, unstable geometry, unsafe site condition, control or sync loss, or planned endpoint.",
    visual:
      "Immediate black with no required transition; fire and safety operations take priority.",
    operator:
      "Black out, remain outside the active-burn area, and resume only on a new burn-lead go.",
  },
] as const;

export const PROJECTION_ASSETS = [
  {
    title: "Projection atlas and calibration pack",
    body: "Surveyed scene; projector-position records; regional maps and masks; row and letter overlays; occlusion matrix; alignment grid; blends; safe overscan; and fallback frame.",
  },
  {
    title: "Modular visual masters",
    body: "Clean layers and mattes for surface, fissures, plume, cutaway, ocean, core, chimeras, calligraphy, poem proof, and ejection. Render to the approved system’s native canvas and frame rate.",
  },
  {
    title: "Original score package",
    body: "Finished mix and stems for tidal pressure, percussion, ice, plume, ocean/core, chimeras, and inscription, plus score version, playback format, cues, and rehearsal track. Use original music only.",
  },
  {
    title: "Show worksheet and operator book",
    body: "Completed cue CSV, movement cards, poem cross-reference, score map, manual calls, sync fallback, equipment procedure, roles, notes, and approved burn conditions. The blank CSV is not show-control configuration.",
  },
  {
    title: "Review and rehearsal records",
    body: "Science review, silent poem proof, marked-sample test, full-scene and score rehearsals, mapping corrections, weather/mount review, and approved burn calls. Date every revision and score version.",
  },
] as const;

export const PROJECTION_OPEN_DECISIONS = [
  "Final approved handwriting files, poem row IDs, and cross-sculpture reading route",
  "Venue geometry, installed sculpture orientation, audience boundary, burn exclusion area, and approved survey access",
  "Burn lead, projection operator, playback operator, manual call language, and authority to hold or black out",
  "Final score, score versioning, playback system, synchronization method, and bar/beat or timecode convention",
  "Approved projector positions, coverage and occlusion matrix, equipment count, optics, focus, brightness, power, data, mounts, weather protection, and redundancy",
  "Results of projection tests on the actual marked aluminum and approved finish",
  "Burn-team review of the complete wood, aluminum, marking, backing, adhesive, and finish materials before authorizing a burn",
  "Which broad effects, if any, the burn lead permits during a stable early-burn phase",
  "Whether any live performers are proposed under a separate plan; this treatment includes projected chimeras only",
];

export const PROJECTION_SOURCES = [
  {
    label: "NASA Science: Cassini at Enceladus",
    href: "https://science.nasa.gov/mission/cassini/science/enceladus/",
    note: "Mission overview for observed surface terrain, tiger stripes, plumes, global ocean evidence, chemistry, and hydrothermal interpretation.",
  },
  {
    label: "NASA Science: Tiger Stripes on Enceladus",
    href: "https://science.nasa.gov/photojournal/tiger-stripes-on-enceladus-fracture-zones-and-plumes-sources/",
    note: "Cassini-derived topography and imagery of the south-polar fracture zones and plume sources; the published relief visualization is vertically exaggerated.",
  },
  {
    label: "NASA JPL: Cassini Finds Global Ocean",
    href: "https://www.jpl.nasa.gov/news/cassini-finds-global-ocean-in-saturns-moon-enceladus/",
    note: "Primary mission account of libration evidence for a global ocean and an official interior illustration whose layer thicknesses are not to scale.",
  },
  {
    label: "NASA JPL: Powering Saturn’s Active Ocean Moon",
    href: "https://www.jpl.nasa.gov/news/powering-saturns-active-ocean-moon/",
    note: "Research summary for a modeled porous rocky core, tidal heating, ocean circulation, and hydrothermal water-rock interaction.",
  },
  {
    label: "Christie: projection mapping",
    href: "https://www.christiedigital.com/solutions/projection-mapping/",
    note: "Manufacturer guidance on projection mapping, multiple projectors, warping and blending, ambient light, weather, and obstructions. The actual sculpture still needs a surveyed coverage test.",
  },
  {
    label: "BenQ: projector throw ratio",
    href: "https://www.benq.com/en-us/knowledge-center/knowledge/what-is-throw-ratio-for-projectors.html",
    note: "Defines throw ratio as distance divided by projected image width. Confirm the chosen projector/lens with its own calculator and field test.",
  },
  {
    label: "HSE: outdoor event equipment",
    href: "https://www.hse.gov.uk/event-safety/outdoor-equipment.htm",
    note: "Production guidance for suitable equipment, wind and ground assessment, supports, anchoring or ballast, and competent crews.",
  },
  {
    label: "HSE: event electrical safety",
    href: "https://www.hse.gov.uk/event-safety/electrical-safety.htm",
    note: "Guidance on planned power distribution, weather exposure, protected connections, and routing cables around people and vehicles.",
  },
  {
    label: "Burning Man: art-burn safety perimeters",
    href: "https://burningman.org/black-rock-city/bring-your-art/fire-art-guidelines/safety-perimeters/",
    note: "An example of a project-specific burn-perimeter and weather review process. This venue is not yet confirmed; its own approved burn plan and responsible authority determine the actual boundary.",
  },
  {
    label: "QLab: using timecode",
    href: "https://qlab.app/docs/v5/networking/using-timecode/",
    note: "One playback system’s configurable timecode stop and restart behavior. This illustrates why loss-of-sync actions must be selected and tested; no playback software is selected here.",
  },
  {
    label: "itchy-O official artist description",
    href: "https://itchyo.com/about-itchy-o-2/",
    note: "Official description of immersive percussion and spectacle, cited as a mood reference for this original dark ritual visual treatment.",
  },
] as const;

const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;

const cueHeaders = [
  "cue_id",
  "movement",
  "score_version",
  "bar_beat",
  "timecode",
  "poem_row_ids",
  "letter_action",
  "visual_action",
  "operator_go",
  "hold_exit",
];

export const PROJECTION_CUE_CSV = [
  cueHeaders.map(csvCell).join(","),
  ...PROJECTION_MOVEMENTS.map(({ id, title }) =>
    [id, title, "", "", "", "", "", "", "", ""].map(csvCell).join(","),
  ),
].join("\n");

export const PROJECTION_CUE_URI = `data:text/csv;charset=utf-8,${encodeURIComponent(PROJECTION_CUE_CSV)}`;

const section = (title: string, lines: readonly string[]) => [
  title,
  "-".repeat(title.length),
  ...lines,
  "",
];

const numberedEntries = (
  entries: readonly { readonly title: string; readonly body: string }[],
) =>
  entries.flatMap(({ title, body }, index) => [
    `${index + 1}. ${title}`,
    `   ${body}`,
  ]);

export const PROJECTION_PLAN_TEXT = [
  PROJECTION_TITLE,
  "=".repeat(PROJECTION_TITLE.length),
  "",
  PROJECTION_INTRO,
  "",
  PROJECTION_STATUS,
  "",
  ...section(
    "SIX-MOVEMENT TREATMENT",
    PROJECTION_MOVEMENTS.flatMap(
      ({ id, title, science, scene, letters, score, transition }) => [
        `${id} — ${title}`,
        `Science: ${science}`,
        `Scene: ${scene}`,
        `Letters: ${letters}`,
        `Future score: ${score}`,
        `Transition: ${transition}`,
        "",
      ],
    ),
  ),
  ...section(
    "ORIGINAL PROJECTED CHIMERAS",
    PROJECTION_CHIMERAS.map((item) => `- ${item}`),
  ),
  ...section("FULL-SURFACE RIG PLAN", numberedEntries(PROJECTION_RIG)),
  ...section(
    "LETTERING, MAPPING, AND SCORE WORKFLOW",
    numberedEntries(PROJECTION_WORKFLOW),
  ),
  ...section(
    "BURN PHASES",
    PROJECTION_PHASES.flatMap(
      ({ title, condition, visual, operator }, index) => [
        `${index + 1}. ${title}`,
        `   Condition: ${condition}`,
        `   Visual: ${visual}`,
        `   Operator: ${operator}`,
      ],
    ),
  ),
  ...section("ASSET BRIEF", numberedEntries(PROJECTION_ASSETS)),
  ...section(
    "OPEN DECISIONS",
    PROJECTION_OPEN_DECISIONS.map((item) => `[ ] ${item}`),
  ),
  ...section("CUE WORKSHEET", [
    "The accompanying CSV is a blank planning worksheet, not show-control configuration. Score timing and poem-row IDs remain blank until the final handwriting, score, playback system, and operators are confirmed.",
    "",
    PROJECTION_CUE_CSV,
  ]),
  ...section(
    "PRIMARY AND OFFICIAL SOURCES",
    PROJECTION_SOURCES.flatMap(({ label, href, note }) => [
      `- ${label}: ${href}`,
      `  ${note}`,
    ]),
  ),
].join("\n");

export const PROJECTION_PLAN_URI = `data:text/plain;charset=utf-8,${encodeURIComponent(PROJECTION_PLAN_TEXT)}`;
