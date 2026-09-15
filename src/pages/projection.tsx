import {
  ArrowDownToLine,
  ArrowUpRight,
  AudioLines,
  Focus,
  Sparkles,
} from "lucide-react";
import {
  PROJECTION_ASSETS,
  PROJECTION_CHIMERAS,
  PROJECTION_CUE_URI,
  PROJECTION_INTRO,
  PROJECTION_MOVEMENTS,
  PROJECTION_OPEN_DECISIONS,
  PROJECTION_PHASES,
  PROJECTION_PLAN_URI,
  PROJECTION_RIG,
  PROJECTION_SOURCES,
  PROJECTION_STATUS,
  PROJECTION_TITLE,
  PROJECTION_WORKFLOW,
} from "../../shared/projection-plan";
import "../projection.css";

const sections = [
  ["movements", "Six movements"],
  ["chimeras", "The creatures"],
  ["projectors", "Projector plan"],
  ["score", "Letters & score"],
  ["burn", "Burn cues"],
  ["production", "Production brief"],
] as const;

function InteriorStudy() {
  return (
    <figure className="projection-study">
      <svg
        viewBox="0 0 420 360"
        role="img"
        aria-labelledby="projection-study-title projection-study-desc"
      >
        <title id="projection-study-title">
          Ice, an imagined ocean, and an emerging angular chimera
        </title>
        <desc id="projection-study-desc">
          An original concept sketch: fractured ice above a dark ocean, drifting
          triangular fragments, and a black-draped silhouette with elongated
          arms and legs. The creature is fictional.
        </desc>
        <rect width="420" height="360" rx="6" fill="#14262f" />
        <path
          d="M0 0H420V77L376 88 346 69 320 96 278 79 256 112 216 76 182 100 145 81 118 108 85 85 53 104 28 86 0 101Z"
          fill="#d7e6df"
        />
        <path
          d="M53 0 70 40 53 69 85 85M192 0 180 36 211 55 216 76M323 0 306 31 324 53 320 96"
          fill="none"
          stroke="#72979d"
          strokeWidth="3"
        />
        <path
          d="M0 142Q105 121 210 142T420 142M0 186Q105 165 210 186T420 186M0 235Q105 211 210 235T420 235M0 289Q105 270 210 289T420 289"
          fill="none"
          stroke="#60868e"
          strokeWidth="1"
          opacity="0.5"
        />
        <path
          d="M0 360V325L50 301 102 320 132 307 181 331 231 314 290 331 350 306 420 321V360Z"
          fill="#233941"
        />
        <g fill="#a7c8c5">
          <path
            d="m63 172 17-25 11 30Zm62 67 17-18 5 26Zm199-95 15-27 12 29Zm35 66 20-20 3 31Z"
            opacity="0.6"
          />
          <circle cx="100" cy="120" r="2" />
          <circle cx="292" cy="189" r="2" />
          <circle cx="59" cy="255" r="2" />
          <circle cx="356" cy="269" r="2" />
          <circle cx="240" cy="112" r="2" />
          <circle cx="160" cy="171" r="2" />
        </g>
        <g
          fill="#0c151d"
          stroke="#9bbab9"
          strokeWidth="1.5"
          strokeLinejoin="round"
        >
          <path d="m215 112 14 11-6 18-18-5Z" />
          <path d="m213 139-29 86 49 7 18-12-26-77Z" />
          <path d="m209 143-35 37-51 85 9 4 56-72 29-39Z" />
          <path d="m228 145 42 31 53 77-8 6-62-68-33-31Z" />
          <path d="m188 226 10 2-25 88-15 8 15-18Z" />
          <path d="m225 231 11-4 22 91 14 8-23-2Z" />
        </g>
        <path
          d="M185 292q23-40 52 0M191 285q18-30 40 0"
          fill="none"
          stroke="#bb9b72"
          strokeWidth="1"
          opacity="0.65"
        />
      </svg>
      <figcaption>
        Original concept sketch · interior reconstruction and fictional creature
      </figcaption>
    </figure>
  );
}

export default function Projection() {
  return (
    <div className="projection-page">
      <header className="projection-hero">
        <div>
          <span className="projection-kicker">
            Projection & score / performance plan
          </span>
          <h1>{PROJECTION_TITLE}</h1>
          <p className="projection-intro">{PROJECTION_INTRO}</p>
          <div className="projection-downloads">
            <a
              href={PROJECTION_PLAN_URI}
              download="muchado-projection-plan.txt"
            >
              <ArrowDownToLine size={17} aria-hidden="true" /> Production plan
            </a>
            <a
              href={PROJECTION_CUE_URI}
              download="muchado-score-cue-worksheet.csv"
            >
              <AudioLines size={17} aria-hidden="true" /> Score cue worksheet
            </a>
          </div>
          <p className="projection-status">{PROJECTION_STATUS}</p>
        </div>
        <InteriorStudy />
      </header>

      <nav className="projection-nav" aria-label="On this page">
        {sections.map(([id, label], index) => (
          <a key={id} href={`#${id}`}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            {label}
          </a>
        ))}
      </nav>

      <section
        id="movements"
        className="projection-section"
        aria-labelledby="movements-title"
      >
        <header className="projection-section-head">
          <span>01 / Visual treatment</span>
          <h2 id="movements-title">A journey through the ice</h2>
        </header>
        <div className="projection-movements">
          {PROJECTION_MOVEMENTS.map((movement) => (
            <article className="projection-movement" key={movement.id}>
              <header>
                <span className="projection-cue-id">{movement.id}</span>
              </header>
              <h3>{movement.title}</h3>
              <p className="projection-scene">{movement.scene}</p>
              <p className="projection-science-note">{movement.science}</p>
              <dl>
                <div>
                  <dt>Letters</dt>
                  <dd>{movement.letters}</dd>
                </div>
                <div>
                  <dt>Score direction</dt>
                  <dd>{movement.score}</dd>
                </div>
                <div>
                  <dt>Transition</dt>
                  <dd>{movement.transition}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section
        id="chimeras"
        className="projection-section projection-creatures"
        aria-labelledby="chimeras-title"
      >
        <header className="projection-section-head">
          <span>02 / Original creature language</span>
          <h2 id="chimeras-title">Dark cloth. Long limbs. Slow emergence.</h2>
        </header>
        <ul>
          {PROJECTION_CHIMERAS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section
        id="projectors"
        className="projection-section"
        aria-labelledby="projectors-title"
      >
        <header className="projection-section-head">
          <span>03 / Full-sculpture coverage</span>
          <h2 id="projectors-title">
            <Focus size={27} aria-hidden="true" /> Choose positions before
            lenses
          </h2>
        </header>
        <div className="projection-grid">
          {PROJECTION_RIG.map(({ title, body }) => (
            <article className="projection-card" key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="score"
        className="projection-section"
        aria-labelledby="score-title"
      >
        <header className="projection-section-head">
          <span>04 / Mapping & music</span>
          <h2 id="score-title">Give every phrase its moment</h2>
        </header>
        <ol className="projection-workflow">
          {PROJECTION_WORKFLOW.map(({ title, body }) => (
            <li key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
        <div className="projection-worksheet">
          <AudioLines size={25} aria-hidden="true" />
          <div>
            <h3>A worksheet for the future score</h3>
            <p>
              Movement IDs are ready; score version, bar/beat, timecode, and
              poem-row assignments remain blank. Fill these with the composer
              and playback operator after the score and mapping are approved.
              This worksheet is a planning document.
            </p>
            <a
              href={PROJECTION_CUE_URI}
              download="muchado-score-cue-worksheet.csv"
            >
              Download the cue worksheet{" "}
              <ArrowDownToLine size={15} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <section
        id="burn"
        className="projection-section"
        aria-labelledby="burn-title"
      >
        <header className="projection-section-head">
          <span>05 / Operator-led performance</span>
          <h2 id="burn-title">Let the plan change with the fire</h2>
        </header>
        <ol className="projection-phases">
          {PROJECTION_PHASES.map(
            ({ title, condition, visual, operator }, index) => (
              <li key={title}>
                <span className="projection-phase-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3>{title}</h3>
                  <dl>
                    <div>
                      <dt>Condition</dt>
                      <dd>{condition}</dd>
                    </div>
                    <div>
                      <dt>Projection</dt>
                      <dd>{visual}</dd>
                    </div>
                    <div>
                      <dt>Operator</dt>
                      <dd>{operator}</dd>
                    </div>
                  </dl>
                </div>
              </li>
            ),
          )}
        </ol>
      </section>

      <section
        id="production"
        className="projection-section"
        aria-labelledby="production-title"
      >
        <header className="projection-section-head">
          <span>06 / Production handoff</span>
          <h2 id="production-title">
            <Sparkles size={25} aria-hidden="true" /> What the video and score
            teams need
          </h2>
        </header>
        <div className="projection-grid">
          {PROJECTION_ASSETS.map(({ title, body }) => (
            <article className="projection-card" key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
        <aside className="projection-decisions">
          <h3>Decisions to make at the site survey</h3>
          <ul>
            {PROJECTION_OPEN_DECISIONS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </aside>
        <div className="projection-related">
          <a href="/instructions#large-sculpture">
            Aluminum scale-plate guide{" "}
            <ArrowUpRight size={16} aria-hidden="true" />
          </a>
          <a href="/calligraphy">
            Calligraphy brief <ArrowUpRight size={16} aria-hidden="true" />
          </a>
          <a href="/editions/much-ado-about-one-side.txt" download>
            Canonical poem <ArrowDownToLine size={16} aria-hidden="true" />
          </a>
        </div>
      </section>

      <section
        className="projection-section projection-sources"
        aria-labelledby="projection-sources-title"
      >
        <header className="projection-section-head">
          <span>Research & references</span>
          <h2 id="projection-sources-title">
            Ground the science and the setup
          </h2>
        </header>
        <ul>
          {PROJECTION_SOURCES.map(({ label, href, note }) => (
            <li key={href}>
              <a href={href} target="_blank" rel="noreferrer">
                {label} <ArrowUpRight size={14} aria-hidden="true" />
              </a>
              <p>{note}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
