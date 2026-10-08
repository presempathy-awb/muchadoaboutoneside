import { ArrowUpRight, FileType2, PenTool } from "lucide-react";
import type { JSX } from "react";

/** Guide reviewed outlines through font assembly and import the finished font. */
export function WorksheetFontFinish({
  onImportFont,
}: {
  onImportFont: (file?: File) => void;
}): JSX.Element {
  return (
    <details className="ws-font-finish">
      <summary>
        <PenTool size={22} aria-hidden="true" />
        Make your handwriting a font
        <span>Samples → reviewed SVGs → FontForge → TTF/OTF</span>
      </summary>
      <div className="ws-detail-body">
        <p>
          Start with clean letter samples. Where a VecGlypher profile is
          available, use it to propose missing letters and review each result.
          Assemble the approved SVG outlines in FontForge, then bring your font
          back here.
        </p>
        <ol>
          <li>
            <strong>Keep your best letters.</strong> Save the originals and
            compare proposed letters with them. Check counters, stroke weight
            and flourishes before accepting an outline.
          </li>
          <li>
            <strong>Assemble in FontForge.</strong> Import each SVG into its
            character slot. Align the baseline and lowercase height, then set
            side bearings and spacing in real words.
          </li>
          <li>
            <strong>Proof the joins.</strong> For cursive, align entry and exit
            strokes. Add ligatures for combinations needing a special shape;
            test repeated letters, punctuation and variants in a short poem.
          </li>
          <li>
            <strong>Export and try it on paper.</strong> Validate in FontForge
            and generate TTF or OTF. Import below, check supported features,
            then proof the preview and PDF at your intended size.
          </li>
        </ol>
        <div className="ws-font-finish__actions">
          <a
            href="https://fontforge.org/docs/tutorial/importexample.html"
            target="_blank"
            rel="noreferrer"
          >
            FontForge SVG guide <ArrowUpRight size={18} aria-hidden="true" />
          </a>
          <a
            href="https://fontforge.org/docs/ui/dialogs/generate.html"
            target="_blank"
            rel="noreferrer"
          >
            FontForge export guide <ArrowUpRight size={18} aria-hidden="true" />
          </a>
          <label className="ws-file">
            <FileType2 size={19} aria-hidden="true" /> Import finished TTF / OTF
            <input
              type="file"
              accept=".ttf,.otf"
              onChange={(event) => {
                onImportFont(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
        </div>
        <p>
          Prefer a drawn template?{" "}
          <a
            href="https://www.calligraphr.com/en/docs/tutorial1/"
            target="_blank"
            rel="noreferrer"
          >
            Use Calligraphr’s marked alphabet template
          </a>
          , capture all four corner markers, then review and build there.
          Character variants are available; ligatures require its Pro plan.
        </p>
        <p className="ws-hint">
          Font assembly happens outside this studio. It does not launch
          FontForge or send photos to Calligraphr. Imported fonts stay in this
          browser and your digital backups; use fonts you have permission to
          embed.
        </p>
      </div>
    </details>
  );
}
