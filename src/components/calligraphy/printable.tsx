/** The complete printable guide as one HTML document, rendered by the generator. */
import {
  CHAPTERS,
  GUIDE_SUBTITLE,
  GUIDE_TITLE,
  GUIDE_VERSION,
  MASTER_ROWS,
  WORKING,
} from "../../../shared/calligraphy-guide";
import { POEM_LINES, POEM_TITLE } from "../../../shared/poem";
import { GuideBlocks } from "./blocks";

const PRINT_CSS = `
@page { size: Letter portrait; margin: 16mm 16mm 18mm; }
@page sheet { size: Letter landscape; margin: 0; }
html { font-size: 13px; }
body { margin: 0; background: #fff; }
.guide-print { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.guide-cover { display: flex; flex-direction: column; justify-content: space-between; min-height: 235mm; page-break-after: always; }
.guide-cover-script { margin: 30px 0 0; font-family: 'Great Vibes', serif; font-size: 34px; line-height: 1.3; color: #3b3935; }
.guide-cover-meta { color: #6d6a63; font-size: 11px; line-height: 1.7; }
.guide-contents { margin: 28px 0 0; padding: 0; list-style: none; }
.guide-contents li { display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: 10px; padding: 9px 0; border-top: 1px solid rgba(58,56,51,0.2); font-size: 13px; }
.guide-contents li span:first-child { color: #8f8a82; font-weight: 650; letter-spacing: 1px; font-size: 10px; padding-top: 3px; }
.guide-contents li small { display: block; color: #6d6a63; font-size: 11px; line-height: 1.5; margin-top: 2px; }
.guide-chapter { page-break-before: always; }
.guide-chapter-head { margin: 0 0 22px; padding: 0 0 14px; border-bottom: 1px solid rgba(58,56,51,0.2); }
.guide-chapter-head .guide-kicker { margin-bottom: 12px; }
.guide-body { max-width: none; }
.guide-body > h3 { page-break-after: avoid; }
.guide-table, .guide-note, .guide-figure-inline, .guide-steps li, .guide-poem, .guide-checklist li, .guide-row-map > div, .guide-essentials li { page-break-inside: avoid; }
.guide-figure-inline svg { max-width: 100%; height: auto; }
.guide-figure-inline svg.guide-actual { width: 180mm; height: auto; }
.guide-figure-sheets { margin: 0; }
.guide-figure-sheets figcaption { display: none; }
.guide-steps li { padding: 12px 0; }
.guide-steps p { margin-bottom: 5px; }
.guide-table th, .guide-table td { padding: 5px 8px 5px 0; }
#quick .guide-body > ul { columns: 2; column-gap: 28px; }
#quick .guide-body > ul li { break-inside: avoid; }
.guide-sheet-page { page: sheet; page-break-before: always; page-break-after: always; margin: 0; width: 279.4mm; height: 215.9mm; overflow: hidden; }
.guide-sheet-page svg { display: block; width: 279.4mm; height: 215.9mm; border: 0; }
.guide-footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid rgba(58,56,51,0.2); color: #6d6a63; font-size: 10px; line-height: 1.6; }
`;

export interface PrintableGuideProps {
  css: string;
  fontUrl: string;
}

export function PrintableGuide({ css, fontUrl }: PrintableGuideProps) {
  const fontFace = `@font-face { font-family: 'Great Vibes'; src: url('${fontUrl}') format('truetype'); font-weight: 400; font-style: normal; }`;
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>{`${GUIDE_TITLE} — ${POEM_TITLE}`}</title>
        <meta name="author" content="Much Ado About One Side" />
        <style>{`${fontFace}\n${css}\n${PRINT_CSS}`}</style>
      </head>
      <body className="guide guide-print">
        <section className="guide-cover">
          <div>
            <span className="guide-kicker">
              Much Ado About One Side · lettering brief · {GUIDE_VERSION}
            </span>
            <h1>
              Hand-lettering <em>the inscription.</em>
            </h1>
            <p className="guide-lede">{GUIDE_SUBTITLE}</p>
            <p className="guide-cover-script">
              {POEM_LINES[0]}
              <br />
              {POEM_LINES[1]}
            </p>
            <ol className="guide-contents">
              {CHAPTERS.map((chapter) => (
                <li key={chapter.id}>
                  <span>{chapter.index}</span>
                  <span>
                    {chapter.title}
                    <small>{chapter.summary}</small>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <p className="guide-cover-meta">
            {MASTER_ROWS.length} master rows in your own copperplate · x-height
            about {WORKING.xHeightMm} mm · hairlines thickened after the scan ·
            print every template sheet at 100 % and check its 100 mm bar.
            <br />
            The rendered script in this guide is the substitute font Great Vibes
            (SIL Open Font License), shown for size and spacing only. Project
            text and artwork: MIT OR Apache-2.0.
            muchadoaboutoneside.com/calligraphy
          </p>
        </section>
        {CHAPTERS.map((chapter) => (
          <section className="guide-chapter" id={chapter.id} key={chapter.id}>
            <header className="guide-chapter-head">
              <span className="guide-kicker">
                {chapter.index} · {chapter.kicker}
              </span>
              <h2>{chapter.title}</h2>
              <p className="guide-chapter-summary">{chapter.summary}</p>
            </header>
            <div className="guide-body">
              <GuideBlocks blocks={chapter.blocks} />
            </div>
          </section>
        ))}
        <footer className="guide-footer">
          {GUIDE_TITLE} · {GUIDE_VERSION} · generated from the public project
          source at github.com/presempathy-awb/muchadoaboutoneside. Questions go
          to Andrew.
        </footer>
      </body>
    </html>
  );
}
