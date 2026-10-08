import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Download,
  Search,
} from "lucide-react";
import { type JSX, useMemo, useState } from "react";
import { CALLIGRAPHY_KNOWLEDGE } from "../../../shared/calligraphy-knowledge";
import { CALLIGRAPHY_LIBRARY } from "../../../shared/calligraphy-library";
import "../../calligraphy-library.css";

const PAGE_SIZE = 6;
const topicShortcuts = ["practice", "spacing", "layout", "ink", "font"];

/** Browse the same sourced guidance available to the studio assistant. */
export function CalligraphyKnowledgeLibrary(): JSX.Element {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const matches = useMemo(() => {
    const terms = query.toLocaleLowerCase("en-US").trim().split(/\s+/);
    return CALLIGRAPHY_KNOWLEDGE.filter((entry) => {
      const text =
        `${entry.title} ${entry.topics.join(" ")} ${entry.text}`.toLocaleLowerCase(
          "en-US",
        );
      return terms.every((term) => text.includes(term));
    });
  }, [query]);
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const shown = matches.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );
  function search(value: string): void {
    setQuery(value);
    setPage(0);
  }
  return (
    <section className="ck-knowledge" aria-labelledby="ck-knowledge-title">
      <header>
        <BookOpen size={24} aria-hidden="true" />
        <div>
          <h2 id="ck-knowledge-title">Knowledge &amp; guides</h2>
          <p>Keep a good teacher within reach.</p>
        </div>
      </header>
      <p className="ck-knowledge-intro">
        {CALLIGRAPHY_KNOWLEDGE.length} concise, sourced notes for your hand,
        tools and page. Studio chat retrieves from this same collection when
        answering a question.
      </p>
      <details className="ck-source-books">
        <summary>Source books · read or download</summary>
        {CALLIGRAPHY_LIBRARY.map((book) => (
          <article key={book.id}>
            <h3>{book.title}</h3>
            <p>
              {book.author} · {book.description}
            </p>
            <p className="ck-source-rights">{book.rights}</p>
            <div className="ck-source-links">
              <a href={book.sourceUrl} target="_blank" rel="noreferrer">
                Read original <span className="ws-sr-only">(new tab)</span>
              </a>
              {book.localFiles.map((file) => (
                <a key={file.href} href={file.href} download>
                  <Download size={16} aria-hidden="true" />
                  {file.mediaType.includes("html")
                    ? "Download HTML"
                    : "Download text"}
                </a>
              ))}
            </div>
          </article>
        ))}
        <p>
          Downloaded editions keep their source notices. Historical books
          describe historical tools and practices; use current product guidance
          for materials.
        </p>
      </details>
      <label className="ck-knowledge-search">
        <span>Find a topic</span>
        <div>
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => search(event.target.value)}
            placeholder="Try spacing, nib angle, or feathering"
          />
        </div>
      </label>
      <fieldset
        className="ck-knowledge-topics"
        aria-label="Suggested knowledge topics"
      >
        <button type="button" aria-pressed={!query} onClick={() => search("")}>
          All notes
        </button>
        {topicShortcuts.map((topic) => (
          <button
            key={topic}
            type="button"
            aria-pressed={query === topic}
            onClick={() => search(topic)}
          >
            {topic}
          </button>
        ))}
      </fieldset>
      <p className="ck-knowledge-count" role="status">
        {matches.length === 0
          ? "No matching notes. Try fewer words or a different term."
          : `${matches.length} notes · page ${currentPage + 1} of ${pages}`}
      </p>
      <div className="ck-knowledge-notes" key={`${query}-${currentPage}`}>
        {shown.map((entry) => (
          <details key={entry.id}>
            <summary>{entry.title}</summary>
            <p>{entry.text}</p>
            <a href={entry.url} target="_blank" rel="noreferrer">
              Source{" "}
              <span className="ws-sr-only">for {entry.title} (new tab)</span>
            </a>
          </details>
        ))}
      </div>
      <nav className="ck-knowledge-pages" aria-label="Knowledge pages">
        <button
          type="button"
          disabled={currentPage === 0}
          onClick={() => setPage(currentPage - 1)}
        >
          <ArrowLeft size={17} aria-hidden="true" /> Previous
        </button>
        <button
          type="button"
          disabled={currentPage >= pages - 1}
          onClick={() => setPage(currentPage + 1)}
        >
          Next <ArrowRight size={17} aria-hidden="true" />
        </button>
      </nav>
    </section>
  );
}
