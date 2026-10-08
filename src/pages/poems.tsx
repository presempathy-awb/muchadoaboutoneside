import {
  COAT_INDENT,
  isCoatLine,
  POEM_PAGES,
  type PoemPage,
  poemPageBySlug,
  poemPageDownloadUrl,
  poemWordCount,
} from "../../shared/poems";
import "../poems.css";

/** Stable keys for repeated lines or stanzas without leaning on array positions. */
function withKeys<T>(items: readonly T[], text: (item: T) => string) {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const base = text(item);
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return { key: count === 1 ? base : `${base} ·${count}`, item };
  });
}

function PoemLines({ stanzas }: { stanzas: PoemPage["stanzas"] }) {
  return (
    <div className="poems-text">
      {withKeys(stanzas, (stanza) => stanza.join("\n")).map(
        ({ key, item: stanza }) => (
          <p className="poems-stanza" key={key}>
            {withKeys(stanza, (line) => line).map(({ key: lineKey, item }) =>
              isCoatLine(item) ? (
                <span className="poems-line poems-line-coat" key={lineKey}>
                  {item.slice(COAT_INDENT.length)}
                </span>
              ) : (
                <span className="poems-line" key={lineKey}>
                  {item}
                </span>
              ),
            )}
          </p>
        ),
      )}
    </div>
  );
}

export function PoemPageView({ slug }: { slug: string }) {
  const page = poemPageBySlug(slug);
  if (!page) {
    return (
      <div className="poems-page">
        <div className="empty-state">
          <h1>Poem not found</h1>
          <a href="/poems">See the finished poems</a>
        </div>
      </div>
    );
  }
  const lineCount = page.stanzas.reduce(
    (sum, stanza) => sum + stanza.length,
    0,
  );
  const others = POEM_PAGES.filter((other) => other.slug !== page.slug);

  return (
    <article className="poems-page">
      <header className="poems-hero">
        <p className="poems-kicker">{page.kicker}</p>
        <h1>{page.title}</h1>
        <p className="poems-summary">{page.summary}</p>
        <dl className="poems-facts">
          <div>
            <dt>Speaker</dt>
            <dd>{page.speaker}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{page.status}</dd>
          </div>
          <div>
            <dt>Length</dt>
            <dd>
              {poemWordCount(page)} words in {lineCount} lines and{" "}
              {page.stanzas.length} stanzas
            </dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>
              <code>{page.sourceFile}</code>
            </dd>
          </div>
        </dl>
        <div className="poems-actions">
          <a
            className="poems-download"
            href={poemPageDownloadUrl(page)}
            download={page.textFileName}
          >
            <span aria-hidden="true">↓</span>
            Download the text
          </a>
          <a className="poems-back" href="/poems">
            All finished poems
          </a>
        </div>
      </header>

      <PoemLines stanzas={page.stanzas} />

      {page.alternateEnding ? (
        <section
          className="poems-alternate"
          aria-labelledby="poems-alternate-title"
        >
          <h2 id="poems-alternate-title">Alternate ending</h2>
          <p>Replaces {page.alternateEnding.replaces}.</p>
          <PoemLines stanzas={[page.alternateEnding.lines]} />
        </section>
      ) : null}

      <nav className="poems-related" aria-label="Related pages">
        {page.related.map(({ href, label }) => (
          <a href={href} key={href}>
            {label}
          </a>
        ))}
        {others
          .filter(
            (other) =>
              !page.related.some(({ href }) => href.endsWith(other.slug)),
          )
          .map((other) => (
            <a href={`/poems/${other.slug}`} key={other.slug}>
              {other.title}
            </a>
          ))}
      </nav>
    </article>
  );
}

export default function PoemsIndex() {
  return (
    <div className="poems-page">
      <header className="poems-hero poems-hero-index">
        <p className="poems-kicker">Reading pages</p>
        <h1>The finished poems</h1>
        <p className="poems-summary">
          Each major poem on its own page, in its finished wording, with the
          text to download. The living snake carries the first; the other three
          are candidates for the shed skin of the Turncoat study.
        </p>
      </header>
      <div className="poems-cards">
        {POEM_PAGES.map((page) => (
          <a
            className="poems-card"
            href={`/poems/${page.slug}`}
            key={page.slug}
          >
            <p className="poems-kicker">{page.kicker}</p>
            <h2>{page.title}</h2>
            <p className="poems-card-opening">
              {page.stanzas[0]
                ?.slice(0, 2)
                .map((line) => line.trim())
                .join(" ")}
            </p>
            <p className="poems-card-summary">{page.summary}</p>
            <span className="poems-card-meta">
              {poemWordCount(page)} words · read the poem
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
