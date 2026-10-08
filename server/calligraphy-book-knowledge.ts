import corpus from "./calligraphy-book-passages.json";

export interface CalligraphyBookSource {
  bookId: string;
  sha256: string;
}

export interface CalligraphyBookPassage {
  id: string;
  bookId: string;
  bookTitle: string;
  sectionId: string;
  sectionTitle: string;
  paragraph: number;
  text: string;
  sourceUrl: string;
  historical: true;
}

export interface CalligraphyBookCorpus {
  version: 1;
  sources: readonly CalligraphyBookSource[];
  passages: readonly CalligraphyBookPassage[];
}

export const CALLIGRAPHY_BOOK_CORPUS = corpus as CalligraphyBookCorpus;

const MAX_RESULTS = 2;
const STOP_WORDS = new Set([
  "a",
  "about",
  "an",
  "and",
  "are",
  "do",
  "for",
  "how",
  "i",
  "in",
  "is",
  "it",
  "my",
  "please",
  "of",
  "on",
  "or",
  "should",
  "the",
  "tell",
  "to",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
]);

function lexicalTokens(value: string): readonly string[] {
  return [
    ...new Set(
      value
        .toLocaleLowerCase("en-US")
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .split(/\s+/)
        .filter((token) => token.length > 2 && !STOP_WORDS.has(token)),
    ),
  ];
}

const indexedPassages = CALLIGRAPHY_BOOK_CORPUS.passages.map(
  (passage, index) => ({
    passage,
    index,
    bookTokens: new Set(lexicalTokens(passage.bookTitle)),
    sectionTokens: new Set(
      lexicalTokens(`${passage.sectionTitle} ${passage.sectionId}`),
    ),
    textTokens: new Set(lexicalTokens(passage.text)),
  }),
);

/** Select at most two deterministic historical source passages. */
export function selectCalligraphyBookKnowledge(
  question: string,
  limit = MAX_RESULTS,
): readonly CalligraphyBookPassage[] {
  const resultLimit = Math.min(
    MAX_RESULTS,
    Math.max(0, Math.floor(Number.isFinite(limit) ? limit : 0)),
  );
  if (!resultLimit) return [];
  const queryTokens = lexicalTokens(question.slice(0, 2_000));
  if (!queryTokens.length) return [];
  return indexedPassages
    .map(({ passage, index, bookTokens, sectionTokens, textTokens }) => {
      const sectionMatches = queryTokens.filter((token) =>
        sectionTokens.has(token),
      ).length;
      const textMatches = queryTokens.filter((token) =>
        textTokens.has(token),
      ).length;
      const bookMatches = queryTokens.filter((token) =>
        bookTokens.has(token),
      ).length;
      return {
        passage,
        index,
        sectionMatches,
        textMatches,
        score: sectionMatches * 5 + bookMatches * 2 + textMatches,
      };
    })
    .filter(
      ({ score, sectionMatches, textMatches }) =>
        score > 0 &&
        (queryTokens.length === 1 ||
          sectionMatches > 0 ||
          textMatches >= Math.min(2, queryTokens.length)),
    )
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, resultLimit)
    .map(({ passage }) => passage);
}
