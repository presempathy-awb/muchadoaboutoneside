/** The complete printable guide as one HTML document, rendered by the generator. */
import { useMemo } from "react";
import {
  GUIDE_TITLE,
  guideForVersion,
  WORKING,
} from "../../../shared/calligraphy-guide";
import { CANONICAL_POEM, type PoemVersion } from "../../../shared/poem";
import { GuideBlocks } from "./blocks";
import { GuideProvider } from "./guide-context";

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
  /** Which wording of the poem the brief is for; the canonical one by default. */
  version?: PoemVersion;
}

export function PrintableGuide({
  css,
  fontUrl,
  version = CANONICAL_POEM,
}: PrintableGuideProps) {
  const guide = useMemo(() => guideForVersion(version), [version]);
  const fontFace = `@font-face { font-family: 'Great Vibes'; src: url('${fontUrl}') format('truetype'); font-weight: 400; font-style: normal; }`;
  const siteUrl =
    version.id === CANONICAL_POEM.id
      ? "muchadoaboutoneside.com/calligraphy"
      : `muchadoaboutoneside.com/calligraphy?poem=${version.id}`;
  return (
    <GuideProvider guide={guide}>
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <title>{`${GUIDE_TITLE} — ${guide.sheetTitle}`}</title>
          <meta name="author" content="Much Ado About One Side" />
          <style>{`${fontFace}\n${css}\n${PRINT_CSS}`}</style>
        </head>
        <body className="guide guide-print">
          <section className="guide-cover">
            <div>
              <span className="guide-kicker">
                Much Ado About One Side · lettering brief · {guide.guideVersion}
              </span>
              <h1>
                Hand-lettering <em>the inscription.</em>
              </h1>
              <p className="guide-lede">{guide.subtitle}</p>
              <p className="guide-cover-script">
                {version.lines[0]}
                <br />
                {version.lines[1]}
              </p>
              <ol className="guide-contents">
                {guide.chapters.map((chapter) => (
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
              {guide.masterRows.length} master rows in your own copperplate ·
              x-height about {WORKING.xHeightMm} mm · hairlines thickened after
              the scan · print every template sheet at 100 % and check its 100
              mm bar.
              <br />
              The rendered script in this guide is the substitute font Great
              Vibes (SIL Open Font License), shown for size and spacing only.
              Project text and artwork: MIT OR Apache-2.0. {siteUrl}
            </p>
          </section>
          {guide.chapters.map((chapter) => (
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
            {GUIDE_TITLE} · {guide.guideVersion} · generated from the public
            project source at github.com/presempathy-awb/muchadoaboutoneside.
            Questions go to Andrew.
          </footer>
        </body>
      </html>
    </GuideProvider>
  );
}

const SHEET_CSS = `
@page { size: Letter portrait; margin: 16mm 18mm; }
html { font-size: 13px; }
body { margin: 0; background: #fff; color: #211f1b; font-family: 'Avenir Next', 'Segoe UI', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.sheet-kicker { margin: 0 0 6px; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #8f8a82; }
.sheet-title { margin: 0 0 14px; font-family: 'Great Vibes', serif; font-size: 42px; font-weight: 400; line-height: 1.15; color: #3b3935; }
.sheet-poem { margin: 0; }
.sheet-poem.is-columns { columns: 2; column-gap: 26px; }
.sheet-poem p { margin: 0 0 22px; font-family: 'Great Vibes', serif; font-size: 26px; line-height: 1.4; break-inside: avoid; page-break-inside: avoid; }
.sheet-poem.is-columns p { margin-bottom: 16px; font-size: 23px; line-height: 1.32; }
.sheet-poem span { display: block; }
.sheet-loop { margin: 14px 0 0; font-size: 11px; line-height: 1.6; color: #6d6a63; break-inside: avoid; }
.sheet-footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid rgba(58,56,51,0.2); font-size: 10px; line-height: 1.6; color: #6d6a63; break-inside: avoid; }
`;

export interface PrintablePoemSheetProps {
  fontUrl: string;
  version: PoemVersion;
}

/** The poem alone, set in the substitute script for reading and review. */
export function PrintablePoemSheet({
  fontUrl,
  version,
}: PrintablePoemSheetProps) {
  const fontFace = `@font-face { font-family: 'Great Vibes'; src: url('${fontUrl}') format('truetype'); font-weight: 400; font-style: normal; }`;
  const columns = version.lines.length > 24;
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>{`${version.title} — ${version.label.toLowerCase()} wording in the substitute script`}</title>
        <meta name="author" content="Much Ado About One Side" />
        <style>{`${fontFace}\n${SHEET_CSS}`}</style>
      </head>
      <body>
        <p className="sheet-kicker">
          {version.label} wording · {version.lines.length} lines · the poem as
          one continuous ribbon
        </p>
        <h1 className="sheet-title">{version.title}</h1>
        <div className={columns ? "sheet-poem is-columns" : "sheet-poem"}>
          {version.stanzas.map((stanza) => (
            <p key={stanza[0]}>
              {stanza.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </p>
          ))}
        </div>
        <p className="sheet-loop">↻ {version.loopNote}</p>
        <p className="sheet-footer">
          Set in the substitute script Great Vibes (SIL Open Font License) for
          reading and review only, until Jill’s copperplate replaces it. Poem
          and layout: MIT OR Apache-2.0 · muchadoaboutoneside.com
        </p>
      </body>
    </html>
  );
}
