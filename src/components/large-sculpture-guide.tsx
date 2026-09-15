import {
  ArrowDownToLine,
  CheckCircle2,
  ExternalLink,
  Layers3,
  TriangleAlert,
} from "lucide-react";
import {
  LARGE_SCULPTURE_CHECKLIST,
  LARGE_SCULPTURE_DECISION,
  LARGE_SCULPTURE_FILES,
  LARGE_SCULPTURE_INTRO,
  LARGE_SCULPTURE_LAYERS,
  LARGE_SCULPTURE_SHOP_GUIDE_URI,
  LARGE_SCULPTURE_SOURCES,
  LARGE_SCULPTURE_STATUS,
  LARGE_SCULPTURE_STEPS,
  LARGE_SCULPTURE_TITLE,
} from "../../shared/large-sculpture-guide";

export function LargeSculptureGuide() {
  return (
    <section
      id="large-sculpture"
      className="instructions-section instructions-cladding"
      aria-labelledby="large-sculpture-title"
    >
      <header className="instructions-section-head">
        <span className="instructions-section-index">03</span>
        <div>
          <p>Large sculpture / workshop guide</p>
          <h2 id="large-sculpture-title">{LARGE_SCULPTURE_TITLE}</h2>
        </div>
      </header>

      <p className="instructions-cladding-intro">{LARGE_SCULPTURE_INTRO}</p>

      <div className="instructions-cladding-setup">
        <aside>
          <TriangleAlert size={21} strokeWidth={1.5} aria-hidden="true" />
          <h3>{LARGE_SCULPTURE_DECISION.title}</h3>
          <p>{LARGE_SCULPTURE_DECISION.body}</p>
          <ul>
            <li>{LARGE_SCULPTURE_DECISION.openStructure}</li>
            <li>{LARGE_SCULPTURE_DECISION.continuousSurface}</li>
          </ul>
        </aside>

        <div>
          <h3>
            <Layers3 size={20} strokeWidth={1.5} aria-hidden="true" />
            Layers under the aluminum
          </h3>
          <ol className="instructions-cladding-layers">
            {LARGE_SCULPTURE_LAYERS.map(({ layer, note }) => (
              <li key={layer}>
                <strong>{layer}</strong>
                <span>{note}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <ol className="instructions-cladding-steps">
        {LARGE_SCULPTURE_STEPS.map(({ title, body }) => (
          <li key={title}>
            <h3>{title}</h3>
            <p>{body}</p>
          </li>
        ))}
      </ol>

      <div className="instructions-downloads">
        {LARGE_SCULPTURE_FILES.map(({ label, href, ...file }) => (
          <a key={href} href={href} download>
            <ArrowDownToLine size={15} aria-hidden="true" />
            <span>
              {label}
              {file.note && <small>{file.note}</small>}
            </span>
          </a>
        ))}
      </div>

      <a
        className="instructions-cladding-download"
        href={LARGE_SCULPTURE_SHOP_GUIDE_URI}
        download="iani-large-wood-aluminum.txt"
      >
        <ArrowDownToLine size={17} aria-hidden="true" />
        Download the plain-text shop guide
      </a>

      <div className="instructions-cladding-checks">
        <h3>
          <CheckCircle2 size={20} strokeWidth={1.5} aria-hidden="true" />
          Final attachment check
        </h3>
        <ul>
          {LARGE_SCULPTURE_CHECKLIST.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="instructions-cladding-sources">
        <h3>Material and attachment sources</h3>
        <p>{LARGE_SCULPTURE_STATUS}</p>
        <ul>
          {LARGE_SCULPTURE_SOURCES.map(({ label, href, note }) => (
            <li key={href}>
              <a href={href} target="_blank" rel="noreferrer">
                {label}
                <ExternalLink size={13} aria-hidden="true" />
              </a>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
