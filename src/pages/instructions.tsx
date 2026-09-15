import {
  ArrowDownToLine,
  Box,
  Check,
  ExternalLink,
  Layers,
  PackageCheck,
  Printer,
  Ruler,
  Send,
} from "lucide-react";
import { DimensionsOverview } from "@/components/dimensions-overview";
import { LargeSculptureGuide } from "@/components/large-sculpture-guide";
import {
  HANDOFF_CHECKLIST,
  INSTRUCTION_SECTIONS,
  PACKING_GROUPS,
  PROJECT_PATHS,
} from "../../shared/project-instructions";
import "../instructions.css";

const sectionIcons = {
  dimensions: Ruler,
  make: Check,
  "large-sculpture": Layers,
  pack: Box,
  send: Send,
} as const;

function PrintPackingSlip() {
  return (
    <section
      id="instructions-print"
      className="instructions-slip"
      aria-labelledby="slip-title"
    >
      <div className="instructions-slip-head">
        <div>
          <span className="instructions-kicker">Printable handoff sheet</span>
          <h3 id="slip-title">CoLab iani packing slip</h3>
          <p className="instructions-slip-intro">
            Fill these blanks by hand after printing. The site does not collect,
            send, or save recipient details.
          </p>
        </div>
        <button type="button" onClick={() => window.print()}>
          <Printer size={16} aria-hidden="true" />
          Print packing slip
        </button>
      </div>

      <fieldset className="instructions-fields">
        <legend>Blank shipment fields</legend>
        <p className="instructions-field-row">
          <strong>Recipient:</strong>{" "}
          <span className="instructions-field-line" />
        </p>
        <p className="instructions-field-row">
          <strong>Confirmed address:</strong>{" "}
          <span className="instructions-field-line" />
        </p>
        <p className="instructions-field-row">
          <strong>Receiving date / window:</strong>{" "}
          <span className="instructions-field-line" />
        </p>
        <p className="instructions-field-row">
          <strong>Sender:</strong> <span className="instructions-field-line" />
        </p>
        <p className="instructions-field-row">
          <strong>Carrier / service:</strong>{" "}
          <span className="instructions-field-line" />
        </p>
        <p className="instructions-field-row">
          <strong>Tracking:</strong>{" "}
          <span className="instructions-field-line" />
        </p>
      </fieldset>

      <div className="instructions-slip-grid">
        <div>
          <h4>Contents</h4>
          <p className="instructions-write-line">Item / quantity</p>
          <p className="instructions-write-line">Item / quantity</p>
          <p className="instructions-write-line">Item / quantity</p>
        </div>
        <div>
          <h4>Measurements after packing</h4>
          <p className="instructions-write-line">Package L × W × H</p>
          <p className="instructions-write-line">Package weight</p>
          <p className="instructions-write-line">Number of boxes</p>
        </div>
      </div>

      <div className="instructions-checklist">
        <h4>Final handoff check</h4>
        {HANDOFF_CHECKLIST.map((item) => (
          <div key={item} className="instructions-check-item">
            <span className="instructions-check-box" aria-hidden="true" />
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Instructions() {
  return (
    <div className="instructions-page">
      <header className="instructions-hero">
        <div>
          <span className="instructions-kicker">
            Project field guide / CoLab iani
          </span>
          <h1>
            Make it carefully.
            <br />
            <em>Send it safely.</em>
          </h1>
        </div>
        <div className="instructions-intro">
          <p>
            Jill’s paper lettering, the 180 mm printed study, and a practical
            fitting and attachment guide for aluminum on iani’s large wooden
            sculpture.
          </p>
          <span>Dimensions → make → fit the large sculpture → pack → send</span>
        </div>
      </header>

      <nav className="instructions-nav" aria-label="On this page">
        {INSTRUCTION_SECTIONS.map(({ id, label }, index) => {
          const Icon = sectionIcons[id];
          return (
            <a key={id} href={`#${id}`}>
              <span className="instructions-nav-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <Icon size={17} strokeWidth={1.5} aria-hidden="true" />
              {label}
            </a>
          );
        })}
      </nav>

      <div className="instructions-main">
        <section
          id="dimensions"
          className="instructions-section"
          aria-labelledby="dimensions-title"
        >
          <header className="instructions-section-head">
            <span className="instructions-section-index">01</span>
            <div>
              <p>Know the scale</p>
              <h2 id="dimensions-title">Dimensions before materials</h2>
            </div>
          </header>
          <DimensionsOverview compact />
          <aside className="instructions-note">
            <strong>
              Object size and box size are different measurements.
            </strong>
            Record the artwork or maquette first. Measure and weigh the shipping
            package again only after rigid boards, sleeves, cradles, cushioning,
            and the outer box are complete.
          </aside>
        </section>

        <section
          id="make"
          className="instructions-section"
          aria-labelledby="make-title"
        >
          <header className="instructions-section-head">
            <span className="instructions-section-index">02</span>
            <div>
              <p>Choose one path</p>
              <h2 id="make-title">From poem to physical work</h2>
            </div>
          </header>
          <div className="instructions-paths">
            {PROJECT_PATHS.map((path) => (
              <article key={path.number} className="instructions-path">
                <header>
                  <span>{path.number}</span>
                  <h3>{path.title}</h3>
                  <p className="instructions-path-summary">{path.summary}</p>
                </header>
                <ol>
                  {path.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <div className="instructions-downloads">
                  {path.downloads.map((download) => (
                    <a key={download.href} href={download.href} download>
                      <ArrowDownToLine size={15} aria-hidden="true" />
                      {download.label}
                    </a>
                  ))}
                </div>
              </article>
            ))}
          </div>
          <p className="instructions-caution">
            The full-scale panels preserve the poem and mapped geometry, but
            they are a conceptual fabrication reference. They do not supply
            final stock, adhesive, laser settings, or proof of physical fit.
          </p>
        </section>

        <LargeSculptureGuide />

        <section
          id="pack"
          className="instructions-section"
          aria-labelledby="pack-title"
        >
          <header className="instructions-section-head">
            <span className="instructions-section-index">04</span>
            <div>
              <p>Protect each material</p>
              <h2 id="pack-title">Pack for pressure, moisture, and motion</h2>
            </div>
          </header>
          <div className="instructions-pack-grid">
            {PACKING_GROUPS.map((group) => (
              <article key={group.title}>
                <PackageCheck size={22} strokeWidth={1.4} aria-hidden="true" />
                <h3>{group.title}</h3>
                <ul>
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section
          id="send"
          className="instructions-section"
          aria-labelledby="send-title"
        >
          <header className="instructions-section-head">
            <span className="instructions-section-index">05</span>
            <div>
              <p>Confirm before mailing</p>
              <h2 id="send-title">Arrange the CoLab iani handoff</h2>
            </div>
          </header>
          <div className="instructions-send-grid">
            <div>
              <p className="instructions-send-lede">
                Confirm the mailing address and receiving arrangements with
                CoLab iani before sending.
              </p>
              <ol>
                <li>
                  Confirm the recipient’s name, complete mailing address, and a
                  date or delivery window when someone can receive the work.
                </li>
                <li>
                  Ask whether the destination has current carrier, labeling,
                  loading-dock, or signature instructions.
                </li>
                <li>
                  Choose the carrier only after the final packed size, weight,
                  declared value, and delivery timing are known.
                </li>
                <li>
                  Send tracking to the confirmed recipient and keep photographs
                  of the contents and closed package.
                </li>
              </ol>
            </div>
            <aside>
              <ExternalLink size={19} aria-hidden="true" />
              <strong>Complete the handoff together.</strong>
              <p>
                Use the blank packing slip after CoLab iani confirms the
                recipient, address, receiving date, and any delivery notes.
              </p>
            </aside>
          </div>
          <PrintPackingSlip />
        </section>
      </div>
    </div>
  );
}
