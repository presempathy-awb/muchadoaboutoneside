import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, FileDown, FileText } from "lucide-react";
import { useMemo } from "react";
import { GuideBlocks } from "@/components/calligraphy/blocks";
import { GuideProvider } from "@/components/calligraphy/guide-context";
import { usePoemVersion } from "@/lib/poem-version";
import { guideForVersion, WORKING } from "../../shared/calligraphy-guide";
import "../foil.css";
import "../calligraphy.css";
import "../site-guide.css";

export default function CalligraphyGuide({ chapter }: { chapter: string }) {
  const { version } = usePoemVersion();
  const guide = useMemo(() => guideForVersion(version), [version]);
  const current = guide.chapterById(chapter) ?? guide.chapters[0];
  if (!current) return null;
  const position = guide.chapters.indexOf(current);
  const previous = guide.chapters[position - 1];
  const next = guide.chapters[position + 1];
  const unknown = guide.chapterById(chapter) === undefined;

  return (
    <GuideProvider guide={guide}>
      <div className="foil-page guide guide-site">
        <header className="guide-header">
          <div>
            <span className="guide-kicker">
              Lettering brief · for Jill · {version.label.toLowerCase()} wording
            </span>
            <h1>
              Hand-lettering <em>the inscription.</em>
            </h1>
            <p className="guide-lede">{guide.subtitle}</p>
          </div>
          <div className="guide-header-aside">
            <a className="guide-download" href={guide.pdfPath} download>
              <FileDown size={18} strokeWidth={1.5} aria-hidden="true" />
              <span className="guide-download-copy">
                <strong>Printable guide (PDF)</strong>
                <small>
                  All five chapters and every template sheet · version{" "}
                  {guide.guideVersion}
                </small>
              </span>
            </a>
            <a className="guide-download" href={guide.htmlPath}>
              <FileText size={18} strokeWidth={1.5} aria-hidden="true" />
              <span className="guide-download-copy">
                <strong>Print-ready web version</strong>
                <small>
                  Same document as one page; print it from the browser
                </small>
              </span>
            </a>
            <a className="guide-download" href={version.scriptPdfPath} download>
              <FileDown size={18} strokeWidth={1.5} aria-hidden="true" />
              <span className="guide-download-copy">
                <strong>Poem sheet in the substitute script (PDF)</strong>
                <small>
                  The {version.label.toLowerCase()} wording set in Great Vibes
                  for reading; not a lettering target
                </small>
              </span>
            </a>
            <p className="guide-spec-strip">
              {guide.masterRows.length} rows · your own copperplate · x-height
              about {WORKING.xHeightMm} mm · hairlines thickened after the scan
            </p>
          </div>
        </header>

        <Link to="/instructions" hash="pack" className="guide-handoff-link">
          <span>
            <strong>Sending your originals to CoLab iani?</strong> Keep the
            sheets flat. Read the packaging and mailing checklist.
          </span>
          <ArrowRight size={18} aria-hidden="true" />
        </Link>

        <nav className="guide-chapters" aria-label="Guide chapters">
          {guide.chapters.map((item) => (
            <Link
              key={item.id}
              to={
                item.id === "overview"
                  ? "/calligraphy"
                  : "/calligraphy/$chapter"
              }
              params={item.id === "overview" ? undefined : { chapter: item.id }}
              className={item.id === current.id ? "is-active" : undefined}
              aria-current={item.id === current.id ? "page" : undefined}
            >
              <span>{item.index}</span>
              {item.title}
            </Link>
          ))}
        </nav>

        {unknown && (
          <p className="guide-unknown" role="status">
            That chapter does not exist; showing the overview.
          </p>
        )}

        <article className="guide-chapter" key={`${version.id}-${current.id}`}>
          <header className="guide-chapter-head">
            <span className="guide-kicker">
              {current.index} · {current.kicker}
            </span>
            <h2>{current.title}</h2>
            <p className="guide-chapter-summary">{current.summary}</p>
          </header>
          <div className="guide-body">
            <GuideBlocks blocks={current.blocks} />
          </div>
        </article>

        <nav className="guide-pager" aria-label="Previous and next chapter">
          {previous ? (
            <Link
              to={
                previous.id === "overview"
                  ? "/calligraphy"
                  : "/calligraphy/$chapter"
              }
              params={
                previous.id === "overview"
                  ? undefined
                  : { chapter: previous.id }
              }
            >
              <ArrowLeft size={15} aria-hidden="true" />
              <span>
                <small>Previous</small>
                {previous.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link to="/calligraphy/$chapter" params={{ chapter: next.id }}>
              <span>
                <small>Next</small>
                {next.title}
              </span>
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          ) : (
            <Link to="/">
              <span>
                <small>Back to</small>
                The foil edition
              </span>
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          )}
        </nav>
      </div>
    </GuideProvider>
  );
}
