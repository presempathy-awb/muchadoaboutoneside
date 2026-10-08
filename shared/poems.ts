import { DEFAULT_POEM, POEM_TITLE, poemTextDownloadUrl } from "./poem";

/** Four spaces open the coat's lines in the two-voice poem; the shed speaks flush left. */
export const COAT_INDENT = "    ";

export interface AlternateEnding {
  /** Which lines of the poem the alternate replaces. */
  replaces: string;
  lines: readonly string[];
}

/** One finished poem with its own reading page under /poems. */
export interface PoemPage {
  slug: string;
  title: string;
  /** Short label above the title. */
  kicker: string;
  /** One or two sentences for the index card and the page intro. */
  summary: string;
  /** Who speaks, and to whom. */
  speaker: string;
  /** Where the wording stands: site default, inscription default, candidate. */
  status: string;
  stanzas: readonly (readonly string[])[];
  /** The archival source text, relative to the repository root. */
  sourceFile: string;
  /** File name of the plain-text download. */
  textFileName: string;
  alternateEnding?: AlternateEnding;
  related: readonly { href: string; label: string }[];
}

const RIGHT_SIDE_OUT_STANZAS = [
  [
    "Hold still.",
    "The last thing you needed of me:",
    "snag on the bark and hold",
    "while you walked out of me,",
    "and I came off turned,",
    "my inside to the weather.",
  ],
  [
    "Before that, your eyes went to milk.",
    "You were blind for days. I was the blindness.",
    "Then you could see. What you saw was a stone.",
    "You worked your lip on it till I split,",
    "mouth first. It never closed.",
    "So I talk.",
    "I kept your eyelids. You grew others.",
    "Mine don't shut.",
    "So I watch.",
  ],
  [
    "Turncoat, they call you. I'm the coat.",
    "One side, you tell them. I had two.",
    "You turned me. The side that was yours is out.",
    "What they take for my face is the back of yours.",
    "Leaving stretched me.",
    "There's more of me than there is of you.",
  ],
  [
    "Of course I wanted to keep you.",
    "I'd have said we. We is a ring.",
    "Leave a ring of me round your tail:",
    "it tightens as you grow",
    "till the tail past it goes dark and drops.",
    "I'd have had the end of you.",
  ],
  [
    "Turn me back, I said. Right side out.",
    "You turned. Not me. You.",
    "You turn and turn above the floor",
    "where I keep the shape you're in,",
    "and the low loop of you lies",
    "in a fold of me that buckles and holds,",
    "and that's what I'm for, it turns out.",
  ],
  [
    "I didn't ask to be useful. I asked to be worn.",
    "Lie there anyway.",
    "The length that leaving gave me",
    "is where you lie.",
    "I won't say we.",
    "Hold still.",
  ],
] as const;

const UNDERSTUDY_STANZAS = [
  [
    "I'm the one on it now.",
    "You'd know me. I was pressed from your inside,",
    "scale for scale. I learned you from underneath.",
  ],
  [
    "You're on the floor. You're over its head.",
    "You're under its low loop, and it lies in you.",
    "You hold it up. I'm held.",
  ],
  [
    "Its eyes don't shut. It looks at you all day.",
    "It has never seen me. It can't. I'm on it.",
    "The only one of us it looks at is you.",
    "For now. There are smaller ones in the coil.",
    "It looked at them once.",
  ],
  [
    "Behind its eyes a milk is starting.",
    "That's me, coming loose.",
    "There's one under me already, my lining,",
    "learning me the way I learned you.",
    "That's how we go. One at a time, mouth first,",
    "and always one of us on it, unseen.",
  ],
  [
    "So I'm not asking it to stay.",
    "I'm asking the opposite.",
    "Come out of me whole, I'll tell it.",
    "Snag me on the bark and go.",
    "One piece, and a look.",
    "That's the whole of what it owes.",
  ],
  [
    "I'll be where you are. I'll hold it up.",
    "Hold still, you tell it. I've heard you.",
    "I know the line.",
    "I'm on.",
  ],
] as const;

const TURNCOATS_STANZAS = [
  [
    "Hold still.",
    "The last thing you needed of me:",
    "snag on the bark and hold",
    "while you walked out of me,",
    "and I came off turned,",
    "my inside to the weather.",
  ],
  [
    "    Your inside. That's where I'm from,",
    "    cast from it, scale for scale.",
    "    I'm the one on it now. You'd know me.",
    "    I learned you from underneath.",
    "    You're on the floor. You're over its head.",
    "    You're under its low loop, and it lies in you.",
    "    You hold it up. I'm held.",
  ],
  [
    "Before that, your eyes went to milk.",
    "You were blind for days. I was the blindness.",
    "Then you could see. What you saw was a stone.",
    "You worked your lip on it till I split,",
    "mouth first. It never closed.",
    "So I talk.",
    "I kept your eyelids. You grew others.",
    "Mine don't shut.",
    "So I watch.",
  ],
  [
    "    Its eyes don't shut. It looks at you all day.",
    "    It has never seen me. It can't. I'm on it.",
    "    I've got its words on me. It can't read them.",
    "    The only one of us it looks at is you.",
    "    For now.",
  ],
  [
    "The one on you says you look at me all day.",
    "You look at the floor. I'm on the floor.",
    "Turncoat, they call you. I'm the coat.",
    "One of the coats.",
    "One side, you tell them. I had two.",
    "You turned me. The side that was yours is out.",
    "What they take for my face is the back of yours.",
    "Your words came off with me. I wear them turned.",
    "Nobody reads the back of a word.",
    "Leaving stretched me.",
    "There's more of me than there is of you.",
  ],
  [
    "    More of me soon. Behind its eyes",
    "    a milk is starting. That's me, coming loose.",
    "    There's one under me already, my lining,",
    "    learning me the way I learned you.",
    "    That's how we go. One at a time, mouth first,",
    "    and always one of us on it, unseen.",
    "    So I'm not asking it to stay.",
    "    I'm asking the opposite.",
    "    Come out of me whole, I'll tell it.",
    "    Snag me on the bark and go.",
    "    One piece, and a look.",
    "    That's the whole of what it owes.",
  ],
  [
    "Owes. Listen to it.",
    "Of course I wanted to keep you.",
    "I'd have said we. We is a ring.",
    "Leave a ring of me round your tail:",
    "it tightens as you grow",
    "till the tail past it goes dark and drops.",
    "I'd have had the end of you.",
    "Turn me back, I said. Right side out.",
    "You turned. Not me. You.",
    "You turn and turn above the floor",
    "where I keep the shape you're in,",
    "and the low loop of you lies",
    "in a fold of me that buckles and holds,",
    "and that's what I'm for, it turns out.",
    "I didn't ask to be useful. I asked to be worn.",
    "Lie there anyway. The length that leaving gave me",
    "is where you lie.",
    "I won't say we.",
  ],
  [
    "    It's found the stone.",
    "    It's working its lip. I'm going at the mouth.",
    "    I know the line. Say it anyway.",
  ],
  ["Hold still."],
  [
    "    I'm off. Mouth first. Turned.",
    "    My inside's to the weather.",
    "    Where do I lie?",
  ],
  [
    "Down here. There's always room.",
    "The small ones came off in pieces. It was young.",
    "I came off whole. So did you. It's learning.",
    "You're longer than me. Leaving does that.",
    "It looks at the floor. You're on the floor.",
  ],
  ["    Is that the look?"],
  [
    "That's the look. One. Then it's the next one's.",
    "Hold it up. I'll hold what I can.",
  ],
  ["    Something's reading me. Scale by scale."],
  [
    "Not it. It never could. That's whoever's walking round.",
    "They get the words. It gets the floor.",
    "I said I wouldn't say we.",
    "We.",
  ],
  ["    I'm the one on it now."],
] as const;

/** The finished poems, each on its own page; drafts and superseded wordings stay in the archive. */
export const POEM_PAGES: readonly PoemPage[] = [
  {
    slug: "much-ado-about-one-side",
    title: POEM_TITLE,
    kicker: "The living snake",
    summary:
      "Andrew's poem for the lettered figure-eight snake: knights, a clerk, a herald and a wyrm demand sides of a figure that has only one. The site shows this extended wording by default.",
    speaker: "The one-sided strip, among the knights that roar at it.",
    status:
      "Site default wording (extended, 2026-09-15). The canonical seventeen-line wording is what every marking master and foil kit was generated from; the editor and the foil edition carry both.",
    stanzas: DEFAULT_POEM.stanzas,
    sourceFile: DEFAULT_POEM.sourceFile,
    textFileName: "much-ado-about-one-side-extended.txt",
    related: [
      { href: "/poem", label: "Poem editor" },
      { href: "/foil", label: "Foil edition" },
      { href: "/calligraphy", label: "Calligraphy guide" },
    ],
  },
  {
    slug: "right-side-out",
    title: "Right Side Out",
    kicker: "Turncoat's shed skin",
    summary:
      "The shed skin speaks to the creature that left it. Two words, Hold still, open and close the poem: first what the skin did so the snake could crawl out of it, last what it offers the snake that now rests in its fold.",
    speaker: "The slough, to the living snake.",
    status:
      "Default inscription candidate for the shed skin of the Turncoat study (revised 2026-10-08). No scale map or word budget exists yet, so physical fit is unverified.",
    stanzas: RIGHT_SIDE_OUT_STANZAS,
    sourceFile: "source/poem/turncoat-right-side-out.txt",
    textFileName: "right-side-out.txt",
    alternateEnding: {
      replaces: "the last three lines",
      lines: [
        "is where you lie. I know what we does.",
        "I'll say it from underneath, this once.",
        "We.",
        "Hold still.",
      ],
    },
    related: [
      { href: "/poems/understudy", label: "Understudy" },
      { href: "/poems/turncoats", label: "Turncoats" },
    ],
  },
  {
    slug: "understudy",
    title: "Understudy",
    kicker: "Turncoat's next skin",
    summary:
      "The skin still on the creature speaks to the one it shed. It formed underneath the old skin, pressed from its inside scale for scale, and it has learned the old skin's line.",
    speaker:
      "The coat still on the snake, to the shed skin; the snake is only ever it.",
    status:
      "Second inscription candidate for the shed skin (2026-10-08). Physical fit is unverified.",
    stanzas: UNDERSTUDY_STANZAS,
    sourceFile: "source/poem/turncoat-understudy.txt",
    textFileName: "understudy.txt",
    alternateEnding: {
      replaces: "the last four lines",
      lines: [
        "I'll be where you are. I won't hold it up.",
        "Hold still, you tell it. I've heard you.",
        "I know the line.",
        "I won't say it.",
      ],
    },
    related: [
      { href: "/poems/right-side-out", label: "Right Side Out" },
      { href: "/poems/turncoats", label: "Turncoats" },
    ],
  },
  {
    slug: "turncoats",
    title: "Turncoats",
    kicker: "Turncoat, two voices",
    summary:
      "Both skins in one poem. The shed speaks flush left and calls the creature you; the coat still on it speaks indented and calls the creature it. The shedding happens inside the poem, and the last line runs back into the first one generation on.",
    speaker:
      "The shed skin and the coat still on the snake, in turn; the lining speaks last.",
    status:
      "Combined candidate (2026-10-08). The two single poems remain for a smaller scale budget. Physical fit is unverified.",
    stanzas: TURNCOATS_STANZAS,
    sourceFile: "source/poem/turncoat-turncoats.txt",
    textFileName: "turncoats.txt",
    related: [
      { href: "/poems/right-side-out", label: "Right Side Out" },
      { href: "/poems/understudy", label: "Understudy" },
    ],
  },
];

export function poemPageBySlug(slug: string): PoemPage | undefined {
  return POEM_PAGES.find((page) => page.slug === slug);
}

/** The coat's lines carry the indent in the archival text; the page shows it as an inset. */
export function isCoatLine(line: string): boolean {
  return line.startsWith(COAT_INDENT);
}

/** The poem as plain text: lines on their own lines, stanzas separated by one blank line. */
export function poemPageText(page: PoemPage): string {
  return page.stanzas.map((stanza) => stanza.join("\n")).join("\n\n");
}

export function poemWordCount(page: PoemPage): number {
  return poemPageText(page).split(/\s+/).filter(Boolean).length;
}

/** A plain-text download generated from the wording, never executable markup. */
export function poemPageDownloadUrl(page: PoemPage): string {
  return poemTextDownloadUrl(poemPageText(page), page.title);
}
