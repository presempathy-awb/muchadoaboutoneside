import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { CALLIGRAPHY_LIBRARY } from "../shared/calligraphy-library";

interface SourceSection {
  id: string;
  title: string;
  sourceUrl: string;
  text: string;
}

interface GeneratedPassage {
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

const root = resolve(import.meta.dir, "..");
const outputPath = resolve(root, "server/calligraphy-book-passages.json");
const MAX_PASSAGE_CHARACTERS = 900;
const MIN_PASSAGE_CHARACTERS = 120;
const excludedMaterial =
  /(?:^|[^a-z0-9])(?:ammonia|arsenic|burnish(?:ed|ing)?|corrosive|formalin|gilding|gold[- ]leaf|lead white|mercury|nitric|poison(?:ous)?|scalpel|sulphuric)(?=$|[^a-z0-9])/i;

const johnstonSections = [
  {
    id: "formal-hand-methods",
    title: "Acquiring a Formal Hand: Methods",
    anchor: "chap03",
    start: " CHAPTER III\n",
    end: " CHAPTER IV\n",
  },
  {
    id: "formal-hand-models",
    title: "Acquiring a Formal Hand: Models",
    anchor: "chap04",
    start: " CHAPTER IV\n",
    end: " CHAPTER V\n",
  },
  {
    id: "formal-hand-practice",
    title: "Acquiring a Formal Hand: Practice",
    anchor: "chap05",
    start: " CHAPTER V\n",
    end: " CHAPTER VI\n",
  },
  {
    id: "manuscript-books",
    title: "Manuscript Books",
    anchor: "chap06",
    start: " CHAPTER VI\n",
    end: " CHAPTER VII\n",
  },
  {
    id: "good-lettering",
    title: "Good Lettering: Construction and Arrangement",
    anchor: "p237",
    start: " CHAPTER XIV\n",
    end: " CHAPTER XV\n",
  },
  {
    id: "roman-alphabet",
    title: "The Roman Alphabet and Its Derivatives",
    anchor: "chap15",
    start: " CHAPTER XV\n",
    end: " APPENDIX A\n",
  },
] as const;

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function between(source: string, start: string, end: string): string {
  const startAt = source.indexOf(start);
  if (startAt < 0) throw new Error(`Missing section marker: ${start.trim()}`);
  const endAt = source.indexOf(end, startAt + start.length);
  if (endAt < 0) throw new Error(`Missing section marker: ${end.trim()}`);
  return source.slice(startAt + start.length, endAt);
}

function normalizeParagraph(value: string): string {
  return value
    .replace(/\[p(?:age )?[xiv\d-]+\]/gi, " ")
    .replace(/^\s*\[Illustration[^\]]*\]\s*$/gim, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitLongParagraph(paragraph: string): readonly string[] {
  if (paragraph.length <= MAX_PASSAGE_CHARACTERS) return [paragraph];
  const sentences = paragraph.match(/[^.!?]+[.!?]+(?:[”’"']+)?|[^.!?]+$/g) ?? [
    paragraph,
  ];
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences.map((value) => value.trim())) {
    if (!sentence) continue;
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= MAX_PASSAGE_CHARACTERS) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    if (sentence.length <= MAX_PASSAGE_CHARACTERS) {
      current = sentence;
      continue;
    }
    const words = sentence.split(/\s+/);
    current = "";
    for (const word of words) {
      const wordCandidate = current ? `${current} ${word}` : word;
      if (wordCandidate.length <= MAX_PASSAGE_CHARACTERS)
        current = wordCandidate;
      else {
        if (current) chunks.push(current);
        current = word.slice(0, MAX_PASSAGE_CHARACTERS);
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function passagesForSection(
  bookId: string,
  bookTitle: string,
  section: SourceSection,
): readonly GeneratedPassage[] {
  const paragraphs = section.text
    .split(/\n\s*\n+/)
    .map(normalizeParagraph)
    .filter(
      (paragraph) =>
        paragraph.length >= MIN_PASSAGE_CHARACTERS &&
        !excludedMaterial.test(paragraph),
    )
    .flatMap(splitLongParagraph)
    .filter((paragraph) => paragraph.length >= MIN_PASSAGE_CHARACTERS);
  return paragraphs.map((text, index) => ({
    id: `${bookId}:${section.id}:p${String(index + 1).padStart(4, "0")}`,
    bookId,
    bookTitle,
    sectionId: section.id,
    sectionTitle: section.title,
    paragraph: index + 1,
    text,
    sourceUrl: section.sourceUrl,
    historical: true,
  }));
}

function johnstonBookSections(source: string): readonly SourceSection[] {
  return johnstonSections.map((section) => ({
    id: section.id,
    title: section.title,
    sourceUrl: `https://www.gutenberg.org/cache/epub/47089/pg47089-images.html#${section.anchor}`,
    text: between(source, section.start, section.end),
  }));
}

function palmerBookSections(source: string): readonly SourceSection[] {
  const headings = [...source.matchAll(/^\s+LESSON (\d+)\s*$/gm)];
  const bodyStart = source.indexOf(
    "*** START OF THE PROJECT GUTENBERG EBOOK THE PALMER METHOD OF BUSINESS WRITING ***",
  );
  const bodyEnd = source.indexOf(
    "*** END OF THE PROJECT GUTENBERG EBOOK THE PALMER METHOD OF BUSINESS WRITING ***",
  );
  if (bodyStart < 0 || bodyEnd < 0 || !headings[0]?.index)
    throw new Error("Palmer ebook body markers are missing.");
  const introduction: SourceSection = {
    id: "introduction",
    title: "Introduction",
    sourceUrl: "https://www.gutenberg.org/ebooks/66476",
    text: source.slice(bodyStart, headings[0].index),
  };
  const lessons = headings.map((match, index) => {
    const lesson = Number(match[1]);
    const start = (match.index ?? 0) + match[0].length;
    const end = headings[index + 1]?.index ?? bodyEnd;
    return {
      id: `lesson-${lesson}`,
      title: `Lesson ${lesson}`,
      sourceUrl:
        "https://www.gutenberg.org/cache/epub/66476/pg66476-images.html",
      text: source.slice(start, end),
    };
  });
  return [introduction, ...lessons];
}

async function generate(): Promise<string> {
  const sourceDefinitions = [
    {
      bookId: "johnston-writing-illuminating-lettering",
      bookTitle: "Writing & Illuminating, & Lettering",
      path: resolve(
        root,
        "public/guide/library/writing-illuminating-lettering.txt",
      ),
      sections: johnstonBookSections,
    },
    {
      bookId: "palmer-method-business-writing",
      bookTitle: "The Palmer Method of Business Writing",
      path: resolve(
        root,
        "public/guide/library/palmer-method-business-writing.txt",
      ),
      sections: palmerBookSections,
    },
  ] as const;
  const sources: Array<{ bookId: string; sha256: string }> = [];
  const passages: GeneratedPassage[] = [];
  for (const sourceDefinition of sourceDefinitions) {
    const bytes = await readFile(sourceDefinition.path);
    const hash = sha256(bytes);
    const library = CALLIGRAPHY_LIBRARY.find(
      ({ id }) => id === sourceDefinition.bookId,
    );
    if (!library?.localFiles.some((file) => file.sha256 === hash))
      throw new Error(
        `Source hash is not declared: ${sourceDefinition.bookId}`,
      );
    const source = bytes.toString("utf8").replaceAll("\r\n", "\n");
    sources.push({ bookId: sourceDefinition.bookId, sha256: hash });
    for (const section of sourceDefinition.sections(source))
      passages.push(
        ...passagesForSection(
          sourceDefinition.bookId,
          sourceDefinition.bookTitle,
          section,
        ),
      );
  }
  return `${JSON.stringify({ version: 1, sources, passages }, null, 2)}\n`;
}

const generated = await generate();
if (Bun.argv.includes("--check")) {
  const existing = await readFile(outputPath, "utf8").catch(() => "");
  if (existing !== generated)
    throw new Error(
      "server/calligraphy-book-passages.json is stale; run bun scripts/generate-calligraphy-library.ts",
    );
} else await writeFile(outputPath, generated);
