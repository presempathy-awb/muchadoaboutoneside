/** Renders the shared guide content for both the website and the printable. */
import {
  type FigureId,
  type GuideBlock,
  PUNCTUATION,
} from "../../../shared/calligraphy-guide";
import { POEM_STANZAS } from "../../../shared/poem";
import {
  AlphabetSheet,
  BlankSheet,
  GhostSheets,
  HardWordsSheet,
  LoopFigure,
  PipelineFigure,
  ProportionsFigure,
  RibbonSmallFigure,
  RibbonWorkingFigure,
  RowMapFigure,
  StrokeGaugeFigure,
} from "./templates";

/** Figures that are whole printable sheets rather than in-line diagrams. */
const SHEET_FIGURES: ReadonlySet<FigureId> = new Set<FigureId>([
  "sheetBlank",
  "sheetsGhost",
  "alphabet",
  "hardWords",
  "ribbonWorking",
]);

function Figure({ id }: { id: FigureId }) {
  switch (id) {
    case "loop":
      return <LoopFigure />;
    case "proportions":
      return <ProportionsFigure />;
    case "strokeGauge":
      return <StrokeGaugeFigure />;
    case "ribbonSmall":
      return <RibbonSmallFigure />;
    case "ribbonWorking":
      return (
        <div className="guide-sheet-page">
          <RibbonWorkingFigure />
        </div>
      );
    case "sheetBlank":
      return (
        <div className="guide-sheet-page">
          <BlankSheet />
        </div>
      );
    case "sheetsGhost":
      return <GhostSheets />;
    case "alphabet":
      return (
        <div className="guide-sheet-page">
          <AlphabetSheet />
        </div>
      );
    case "hardWords":
      return (
        <div className="guide-sheet-page">
          <HardWordsSheet />
        </div>
      );
    case "rowMap":
      return <RowMapFigure />;
    case "pipeline":
      return <PipelineFigure />;
    default:
      return null;
  }
}

function ExactPoem() {
  let line = 0;
  return (
    <div className="guide-poem">
      {POEM_STANZAS.map((stanza) => (
        <p key={stanza[0]}>
          {stanza.map((text) => {
            line += 1;
            return (
              <span key={text}>
                <small>{String(line).padStart(2, "0")}</small>
                {text}
              </span>
            );
          })}
        </p>
      ))}
      <p className="guide-poem-loop">
        ↻ the ellipsis runs straight into line 01
      </p>
    </div>
  );
}

function PunctuationTable() {
  return (
    <table className="guide-table guide-table-compact">
      <thead>
        <tr>
          <th>Mark</th>
          <th>Name</th>
          <th>Count</th>
        </tr>
      </thead>
      <tbody>
        {PUNCTUATION.map((item) => (
          <tr key={item.mark}>
            <td className="guide-mark">{item.mark}</td>
            <td>{item.name}</td>
            <td>{item.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function GuideBlocks({ blocks }: { blocks: readonly GuideBlock[] }) {
  return (
    <>
      {blocks.map((block, index) => {
        const key = `${block.kind}-${index}`;
        switch (block.kind) {
          case "p":
            return <p key={key}>{block.text}</p>;
          case "h":
            return <h3 key={key}>{block.text}</h3>;
          case "ul":
            return (
              <ul key={key}>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={key}>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            );
          case "table":
            return (
              <table className="guide-table" key={key}>
                {block.caption && <caption>{block.caption}</caption>}
                <thead>
                  <tr>
                    {block.head.map((cell) => (
                      <th key={cell}>{cell}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row) => (
                    <tr key={row[0]}>
                      {row.map((cell, cellIndex) => (
                        <td key={block.head[cellIndex] ?? cellIndex}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          case "note":
            return (
              <aside
                className={`guide-note ${block.tone === "warn" ? "is-warn" : ""}`}
                key={key}
              >
                <strong>{block.title}</strong>
                <p>{block.text}</p>
              </aside>
            );
          case "figure":
            return (
              <figure
                className={
                  SHEET_FIGURES.has(block.figure)
                    ? "guide-figure-sheets"
                    : "guide-figure-inline"
                }
                key={key}
              >
                <figcaption>{block.caption}</figcaption>
                <Figure id={block.figure} />
              </figure>
            );
          case "steps":
            return (
              <ol className="guide-steps" key={key}>
                {block.steps.map((step, stepIndex) => (
                  <li key={step.title}>
                    <span className="guide-step-number">
                      {String(stepIndex + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3>{step.title}</h3>
                      <p>{step.body}</p>
                      <p className="guide-step-check">
                        <span>Check</span> {step.check}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            );
          case "poem":
            return <ExactPoem key={key} />;
          case "punctuation":
            return <PunctuationTable key={key} />;
          case "checklist":
            return (
              <ul className="guide-checklist" key={key}>
                {block.items.map((item) => (
                  <li key={item}>
                    <span aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            );
          default:
            return null;
        }
      })}
    </>
  );
}
