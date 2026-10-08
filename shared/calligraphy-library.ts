/** A downloadable file retained with a calligraphy library item. */
export interface CalligraphyLibraryFile {
  href: string;
  mediaType: "text/plain; charset=utf-8";
  sha256: string;
}

/** A complete guide that can be read locally and cited by the studio. */
export interface CalligraphyLibraryItem {
  id: string;
  title: string;
  author: string;
  description: string;
  sourceUrl: string;
  localFiles: readonly CalligraphyLibraryFile[];
  rights: string;
  topics: readonly string[];
}

/** Public-domain complete texts retained for offline calligraphy study. */
export const CALLIGRAPHY_LIBRARY: readonly CalligraphyLibraryItem[] = [
  {
    id: "johnston-writing-illuminating-lettering",
    title: "Writing & Illuminating, & Lettering",
    author: "Edward Johnston",
    description:
      "A complete 1906 handbook on formal hands, broad-edge tools, spacing, manuscript planning, illumination, and lettering. The historical recipes require modern material and safety checks.",
    sourceUrl: "https://www.gutenberg.org/ebooks/47089",
    localFiles: [
      {
        href: "/guide/library/writing-illuminating-lettering.txt",
        mediaType: "text/plain; charset=utf-8",
        sha256:
          "686f9e448be1c627985f669ce153ac89f902021e2ddd1f9d2a23ce6a1ac91e5e",
      },
    ],
    rights:
      "Public domain in the USA. Project Gutenberg license and redistribution terms are included in the downloaded text.",
    topics: [
      "broad edge",
      "formal hands",
      "illumination",
      "layout",
      "lettering",
      "manuscript",
      "spacing",
    ],
  },
  {
    id: "palmer-method-business-writing",
    title: "The Palmer Method of Business Writing",
    author: "A. N. Palmer",
    description:
      "A complete historical course in practical handwriting, posture, movement drills, rhythm, and legibility. Its prescriptive classroom claims are historical rather than modern ergonomic or medical guidance.",
    sourceUrl: "https://www.gutenberg.org/ebooks/66476",
    localFiles: [
      {
        href: "/guide/library/palmer-method-business-writing.txt",
        mediaType: "text/plain; charset=utf-8",
        sha256:
          "dab0e10710659b723371dc8ae880f7820afdf17eccb062a463f877f6ad3f7f8b",
      },
    ],
    rights:
      "Public domain in the USA. Project Gutenberg license and redistribution terms are included in the downloaded text.",
    topics: [
      "business writing",
      "drills",
      "handwriting",
      "movement",
      "posture",
      "rhythm",
    ],
  },
] as const;
