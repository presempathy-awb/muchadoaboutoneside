import {
  SIX_FOOT_DECISIONS,
  SIX_FOOT_INTRO,
  SIX_FOOT_OPTIONS,
  SIX_FOOT_PLAN_URI,
  SIX_FOOT_PRICES,
  SIX_FOOT_SOURCES,
  SIX_FOOT_STATUS,
  SIX_FOOT_STEPS,
  SIX_FOOT_TITLE,
} from "../../shared/six-foot-guide";
import { SIX_FOOT_STUDY } from "../../shared/six-foot-study";
import "../six-foot.css";

const sectionLinks = [
  ["measurements", "Measurements"],
  ["materials", "Material options"],
  ["prices", "Price examples"],
  ["workflow", "Build decisions"],
  ["next-sample", "Next sample"],
] as const;

function inches(value: number) {
  return `${value.toFixed(1)} in`;
}

export default function SixFoot() {
  const [areaLow = 0, areaHigh = 0] = SIX_FOOT_STUDY.skinAreaSqFt;
  const leadingOptions = SIX_FOOT_OPTIONS.filter(({ fit }) =>
    fit.startsWith("Leading option"),
  );

  return (
    <div className="six-foot-page">
      <header className="six-foot-hero">
        <div className="six-foot-hero-copy">
          <p className="six-foot-kicker">Material study / indoor edition</p>
          <h1>{SIX_FOOT_TITLE}</h1>
          <p className="six-foot-intro">{SIX_FOOT_INTRO}</p>
          <p className="six-foot-status">{SIX_FOOT_STATUS}</p>
          <a
            className="six-foot-download"
            href={SIX_FOOT_PLAN_URI}
            download="muchado-six-foot-indoor-plan.txt"
          >
            <span aria-hidden="true">↓</span>
            Download the indoor planning brief
          </a>
        </div>

        <aside
          className="six-foot-brief"
          aria-labelledby="six-foot-brief-title"
        >
          <p id="six-foot-brief-title">Working brief</p>
          <dl>
            <div>
              <dt>Setting</dt>
              <dd>Indoor</dd>
            </div>
            <div>
              <dt>Contact</dt>
              <dd>Ordinary touch</dd>
            </div>
            <div>
              <dt>Loading</dt>
              <dd>No climbing</dd>
            </div>
            <div>
              <dt>Scale</dt>
              <dd>{SIX_FOOT_STUDY.scale.toFixed(3)}×</dd>
            </div>
          </dl>
          <div className="six-foot-height-mark" aria-hidden="true">
            <span>
              {inches(SIX_FOOT_STUDY.targetHeightInches)} finished target
            </span>
          </div>
        </aside>
      </header>

      <nav className="six-foot-nav" aria-label="On this page">
        {sectionLinks.map(([id, label], index) => (
          <a key={id} href={`#${id}`}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            {label}
          </a>
        ))}
      </nav>

      <section
        id="measurements"
        className="six-foot-section"
        aria-labelledby="six-foot-measurements-title"
      >
        <header className="six-foot-section-head">
          <p>01 / Scale before material</p>
          <h2 id="six-foot-measurements-title">
            Keep the finished height separate from the reference geometry.
          </h2>
        </header>
        <div className="six-foot-measurements">
          <article className="six-foot-measurement six-foot-measurement-target">
            <p>Finished target</p>
            <strong>{inches(SIX_FOOT_STUDY.targetHeightInches)}</strong>
            <span>Overall height after the chosen layers are resolved.</span>
          </article>
          <article className="six-foot-measurement">
            <p>Reference body</p>
            <strong>
              {inches(SIX_FOOT_STUDY.bodyWidthInches)} ×{" "}
              {inches(SIX_FOOT_STUDY.bodyDepthInches)}
            </strong>
            <span>Width × depth before added skin or finish layers.</span>
          </article>
          <article className="six-foot-measurement six-foot-measurement-caution">
            <p>Original reference base</p>
            <strong>
              {inches(SIX_FOOT_STUDY.referenceBaseWidthInches)} ×{" "}
              {inches(SIX_FOOT_STUDY.referenceBaseDepthInches)}
            </strong>
            <span>Width × depth reference only; not a recommended base.</span>
          </article>
          <article className="six-foot-measurement">
            <p>Conceptual skin area</p>
            <strong>
              {areaLow.toFixed(1)}–{areaHigh.toFixed(1)} sq ft
            </strong>
            <span>Approximate body and jaw coverage; base excluded.</span>
          </article>
        </div>
        <p className="six-foot-measurement-note">
          These numbers are planning references. Added layers change the final
          outside dimensions, so confirm them with a physical sample before
          preparing full-scale parts.
        </p>
      </section>

      <section
        id="materials"
        className="six-foot-section"
        aria-labelledby="six-foot-materials-title"
      >
        <header className="six-foot-section-head">
          <p>02 / Compare six paths</p>
          <h2 id="six-foot-materials-title">
            Choose by touch, finish, and making process.
          </h2>
        </header>

        <aside
          className="six-foot-leading"
          aria-labelledby="six-foot-leading-title"
        >
          <p id="six-foot-leading-title">Two directions to sample first</p>
          <p>
            {leadingOptions.map(({ title }) => title).join(" and ")} are the
            current leading directions for this indoor, ordinary-touch brief.
            Both remain conditional on a small physical sample, finish tests,
            and a resolved support and base design.
          </p>
        </aside>

        <div className="six-foot-options">
          {SIX_FOOT_OPTIONS.map((option, index) => {
            const isLeading = leadingOptions.some(({ id }) => id === option.id);
            return (
              <article
                className={`six-foot-option${isLeading ? " six-foot-option-leading" : ""}`}
                key={option.id}
              >
                <header>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <p>{isLeading ? "Sample first" : "Comparison option"}</p>
                    <h3>{option.title}</h3>
                  </div>
                </header>
                <dl>
                  <div>
                    <dt>Benefit</dt>
                    <dd>{option.benefit}</dd>
                  </div>
                  <div>
                    <dt>Tradeoff</dt>
                    <dd>{option.tradeoff}</dd>
                  </div>
                  <div>
                    <dt>Best fit</dt>
                    <dd>{option.fit}</dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      </section>

      <section
        id="prices"
        className="six-foot-section"
        aria-labelledby="six-foot-prices-title"
      >
        <header className="six-foot-section-head">
          <p>03 / Supplier snapshot</p>
          <h2 id="six-foot-prices-title">
            Dated price examples, not a project total.
          </h2>
        </header>
        <p className="six-foot-section-lede">
          Examples checked around September 15, 2026. Stock, price, usable area,
          shipping, tax, waste, fasteners, and finishing supplies can all change
          the eventual cost.
        </p>
        <div className="six-foot-prices">
          {SIX_FOOT_PRICES.map((example) => (
            <article key={`${example.title}-${example.stock}`}>
              <p>{example.title}</p>
              <h3>{example.stock}</h3>
              <dl>
                <div>
                  <dt>Listed price</dt>
                  <dd>{example.price}</dd>
                </div>
                <div>
                  <dt>Listed area</dt>
                  <dd>{example.area}</dd>
                </div>
              </dl>
              <p className="six-foot-price-note">{example.note}</p>
              <a href={example.href} target="_blank" rel="noreferrer">
                View supplier example <span aria-hidden="true">↗</span>
              </a>
            </article>
          ))}
        </div>
      </section>

      <section
        id="workflow"
        className="six-foot-section"
        aria-labelledby="six-foot-workflow-title"
      >
        <header className="six-foot-section-head">
          <p>04 / Build-decision workflow</p>
          <h2 id="six-foot-workflow-title">
            Let each test answer one practical question.
          </h2>
        </header>
        <ol className="six-foot-steps">
          {SIX_FOOT_STEPS.map((step, index) => (
            <li key={step.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section
        id="next-sample"
        className="six-foot-section six-foot-next"
        aria-labelledby="six-foot-next-title"
      >
        <div>
          <header className="six-foot-section-head">
            <p>05 / Open choices</p>
            <h2 id="six-foot-next-title">
              What the next sample needs to settle.
            </h2>
          </header>
          <ul>
            {SIX_FOOT_DECISIONS.map((decision) => (
              <li key={decision}>{decision}</li>
            ))}
          </ul>
        </div>
        <aside>
          <p>Next sample</p>
          <h3>Make a touchable corner, edge, and jaw transition.</h3>
          <p>
            Use it to compare the two leading material directions at the actual
            layer thickness and intended finish. Record what changes, then
            revise dimensions and quantities before full-scale layout.
          </p>
          <a
            href={SIX_FOOT_PLAN_URI}
            download="muchado-six-foot-indoor-plan.txt"
          >
            Download the sample checklist <span aria-hidden="true">↓</span>
          </a>
        </aside>
      </section>

      <section
        className="six-foot-related"
        aria-labelledby="six-foot-related-title"
      >
        <div>
          <p>Continue planning</p>
          <h2 id="six-foot-related-title">Related project guides</h2>
        </div>
        <div className="six-foot-related-links">
          <a href="/instructions">
            <strong>Fabrication & handoff</strong>
            <span>Dimensions, making paths, packing, and delivery →</span>
          </a>
          <a href="/projection">
            <strong>Projection & score</strong>
            <span>A separate performance and burn plan →</span>
          </a>
        </div>
      </section>

      <section
        className="six-foot-section six-foot-sources"
        aria-labelledby="six-foot-sources-title"
      >
        <header className="six-foot-section-head">
          <p>References</p>
          <h2 id="six-foot-sources-title">
            Sources behind this planning page.
          </h2>
        </header>
        <ul>
          {SIX_FOOT_SOURCES.map((source) => (
            <li key={source.href}>
              <a href={source.href} target="_blank" rel="noreferrer">
                {source.label} <span aria-hidden="true">↗</span>
              </a>
              <p>{source.note}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
