import { Link } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Box,
  FileArchive,
  FileCode2,
  Maximize,
  Pause,
  Play,
  RotateCcw,
  ScanLine,
  Sparkles,
  ZoomIn,
} from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { ArtistReuse } from "@/components/artist-reuse";
import { DimensionsOverview } from "@/components/dimensions-overview";
import FabricationPreview from "@/components/fabrication-preview";
import FlatFoilPreview from "@/components/flat-foil-preview";
import { FABRICATION_DOWNLOADS } from "../../shared/fabrication-downloads";
import { POEM_STANZAS, POEM_TITLE } from "../../shared/poem";
import "../foil.css";

const SculptureViewer = lazy(() => import("@/components/sculpture-viewer"));

export default function FoilEdition() {
  const [showLettering, setShowLettering] = useState(true);
  const [showSeams, setShowSeams] = useState(false);
  const [readingView, setReadingView] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [plainText, setPlainText] = useState(false);

  function resetView() {
    setReadingView(false);
    setAutoRotate(false);
    setResetKey((value) => value + 1);
  }

  return (
    <div className="foil-page">
      <header className="foil-intro">
        <div>
          <span className="foil-kicker">
            <span /> EDITION STUDY / ENDLESS INSCRIPTION
          </span>
          <h1>
            A poem with <em>no reverse.</em>
          </h1>
        </div>
        <div className="foil-intro-note">
          <p>
            Calligraphy circles an aluminum-foil skin. Follow the words around
            the sculpture, unfold them into flat marking artwork, or explore the
            same marked foil wrapped around a small printed form. The ending
            returns to the beginning.
          </p>
          <span>
            Lettering study inspired by Jill’s sample ·{" "}
            <Link to="/calligraphy" className="foil-brief-link">
              read the hand-lettering brief
            </Link>
          </span>
        </div>
      </header>

      <nav className="project-paths" aria-label="Start making">
        <Link to="/instructions" hash="make">
          <span className="path-number">01</span>
          <span>
            <strong>Make the small edition</strong>
            <small>Dimensions, materials & a clear order of work</small>
          </span>
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
        <Link to="/calligraphy">
          <span className="path-number">02</span>
          <span>
            <strong>Letter the poem</strong>
            <small>Jill’s brief & actual-size paper templates</small>
          </span>
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
        <Link to="/instructions" hash="pack">
          <span className="path-number">03</span>
          <span>
            <strong>Pack & send to CoLab iani</strong>
            <small>Protect the work & prepare the handoff</small>
          </span>
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </nav>

      <nav className="section-nav" aria-label="On this page">
        <span>EXPLORE</span>
        <a href="#sculpture">The sculpture</a>
        <a href="#dimensions">Dimensions</a>
        <a href="#fabrication">Making & artwork</a>
        <a href="#downloads">Downloads</a>
      </nav>

      <section
        id="sculpture"
        className="foil-workbench"
        aria-label="Inscription edition study"
      >
        <div className="foil-viewer-panel">
          <div className="foil-viewer-labels">
            <span className="foil-chip">
              <Sparkles size={12} aria-hidden="true" /> ALUMINUM FOIL STUDY
            </span>
            <span className="foil-state">
              <i aria-hidden="true" />
              {showLettering ? "Marked foil" : "Unmarked foil"}
            </span>
          </div>

          <Suspense
            fallback={
              <div className="foil-viewer-loading" role="status">
                Preparing the inscription study…
              </div>
            }
          >
            <SculptureViewer
              className="foil-viewer"
              edition="inscription"
              showLettering={showLettering}
              showSeams={showSeams}
              readingView={readingView}
              autoRotate={autoRotate}
              resetKey={resetKey}
            />
          </Suspense>

          <button
            type="button"
            className="foil-reading-zoom"
            aria-pressed={readingView}
            onClick={() => {
              setShowLettering(true);
              setAutoRotate(false);
              setReadingView((value) => !value);
            }}
          >
            {readingView ? <Maximize size={15} /> : <ZoomIn size={15} />}
            {readingView ? "Whole sculpture" : "Read poem on foil"}
          </button>

          <div className="foil-viewer-controls">
            <span className="foil-orbit-note">
              <Maximize size={13} aria-hidden="true" /> Drag to orbit · Scroll
              to zoom
            </span>
            <fieldset
              className="foil-control-group"
              aria-label="Model view options"
            >
              <button
                type="button"
                className={showLettering ? "is-active" : ""}
                aria-pressed={showLettering}
                onClick={() => setShowLettering((value) => !value)}
              >
                <Sparkles size={14} aria-hidden="true" />
                Lettering
              </button>
              <button
                type="button"
                className={showSeams ? "is-active" : ""}
                aria-pressed={showSeams}
                onClick={() => setShowSeams((value) => !value)}
              >
                <ScanLine size={14} aria-hidden="true" /> Seams
              </button>
              <button
                type="button"
                className={autoRotate ? "is-active" : ""}
                aria-pressed={autoRotate}
                onClick={() => setAutoRotate((value) => !value)}
              >
                {autoRotate ? (
                  <Pause size={14} aria-hidden="true" />
                ) : (
                  <Play size={14} aria-hidden="true" />
                )}
                {autoRotate ? "Pause" : "Turn"}
              </button>
              <button type="button" onClick={resetView}>
                <RotateCcw size={14} aria-hidden="true" /> Reset
              </button>
            </fieldset>
          </div>
        </div>

        <aside className="foil-reading" aria-labelledby="foil-reading-title">
          <span className="foil-reading-index">
            THE INSCRIPTION · CONTINUOUS
          </span>
          <button
            type="button"
            className="poem-reading-toggle"
            aria-pressed={plainText}
            onClick={() => setPlainText((value) => !value)}
          >
            {plainText ? "Show script lettering" : "Read in plain type"}
          </button>
          <h2 id="foil-reading-title">{POEM_TITLE}</h2>
          <div className={`foil-poem${plainText ? " foil-poem-plain" : ""}`}>
            {POEM_STANZAS.map((stanza, stanzaIndex) => (
              <p key={stanza[0]}>
                {stanza.map((line) => (
                  <span key={line}>{line}</span>
                ))}
                {stanzaIndex === POEM_STANZAS.length - 1 && (
                  <span className="foil-loop-mark">
                    ↻ continues at the first line
                  </span>
                )}
              </p>
            ))}
          </div>
        </aside>
      </section>

      <div id="dimensions">
        <DimensionsOverview compact />
      </div>

      <section className="foil-loop" aria-labelledby="foil-loop-title">
        <div className="foil-loop-copy">
          <span className="foil-kicker">READING THE SURFACE</span>
          <h2 id="foil-loop-title">The tail returns to the first word.</h2>
          <p>
            The layout places the final ellipsis beside the opening “Come,” so
            the inscription has no fixed end. Follow a line along the body,
            around the nose, back along the other face, and around the tail. The
            jaw carries its own repeating inscription.
          </p>
          <p>
            The skin follows the original ribs and head. The reference facets
            below preserve its dimensions and lettering placement; side seams
            and crossing clearance still require a physical fit test.
          </p>
        </div>
        <div
          className="foil-loop-diagram"
          role="img"
          aria-label="End-to-start reading loop"
        >
          <span>come, palindove…</span>
          <i aria-hidden="true">∞</i>
          <span>…let edges twine</span>
        </div>
      </section>

      <section
        id="fabrication"
        className="fabrication-section"
        aria-labelledby="fabrication-title"
      >
        <header className="fabrication-heading">
          <div>
            <span className="foil-kicker">FROM SURFACE TO SHOP</span>
            <h2 id="fabrication-title">
              One inscription at <em>two scales.</em>
            </h2>
          </div>
          <p>
            The large sculpture above and the 180 mm model both receive marked
            foil. Switch the flat view between their artwork, then orbit the
            foil-covered model to see the small version in hand.
          </p>
        </header>

        <div className="fabrication-previews">
          <article className="fabrication-preview-card fabrication-flat-card">
            <div className="fabrication-card-heading">
              <span>02 / FLAT LASER ARTWORK</span>
              <strong>Large surface + 180 mm sheets</strong>
            </div>
            <FlatFoilPreview />
            <p>
              Outlined calligraphy shown flat for either scale. The large view
              is a surface-mapping reference; the 180 mm view is laid out in
              actual millimetres. Both still need a material test and physical
              fit before the complete set is marked.
            </p>
          </article>

          <article className="fabrication-preview-card fabrication-print-card">
            <div className="fabrication-card-heading">
              <span>03 / FOIL-COVERED MAQUETTE</span>
              <strong>180 mm tall · marked foil</strong>
            </div>
            <FabricationPreview />
            <p>
              The print remains smooth beneath its marked foil; the lettering is
              not embossed. Print the substrate, test the very fine lettering on
              the chosen stock, then fit the small foil pattern around it.
            </p>
          </article>
        </div>
      </section>

      <section className="fabrication-downloads" aria-labelledby="files-title">
        <div className="fabrication-download-intro">
          <span className="foil-kicker">DENHAC WORKSHOP SET</span>
          <h2 id="files-title">Mark, fit, then assemble.</h2>
          <p>
            Prepared for a test on Denhac’s OMTech Pro Quantum 60W RF CO₂ using
            candidate .005 in (0.127 mm) silver AlumaMark. Start with the coupon
            on the exact stock: material acceptance, settings, and the full-size
            and 180 mm fits still need shop verification. Mark flat, then trim
            mechanically; these files contain no laser-cut perimeter.
          </p>
        </div>
        <div id="downloads" className="fabrication-file-groups">
          <section
            className="fabrication-file-group"
            aria-labelledby="large-files-title"
          >
            <header>
              <span>FULL SCALE</span>
              <h3 id="large-files-title">Large sculpture</h3>
              <p>Reference patterns · physical fit still required</p>
            </header>
            <div className="fabrication-file-list">
              <a href="/fabrication/laser/denhac-test-coupon.svg" download>
                <FileCode2 aria-hidden="true" />
                <span>
                  <strong>Large sculpture test coupon</strong>
                  <small>SVG · outlined marks · millimetres · test first</small>
                </span>
                <ArrowDownToLine aria-hidden="true" />
              </a>
              <a href={FABRICATION_DOWNLOADS.bodyMaster} download>
                <FileCode2 aria-hidden="true" />
                <span>
                  <strong>Large inscription master</strong>
                  <small>SVG · normalized UV artwork · design reference</small>
                </span>
                <ArrowDownToLine aria-hidden="true" />
              </a>
              <a href="/fabrication/laser/README.txt" download>
                <FileArchive aria-hidden="true" />
                <span>
                  <strong>Large sculpture workshop notes</strong>
                  <small>TXT · order, scale, and test guidance</small>
                </span>
                <ArrowDownToLine aria-hidden="true" />
              </a>
              <a href={FABRICATION_DOWNLOADS.largeFitKit} download>
                <FileArchive aria-hidden="true" />
                <span>
                  <strong>Large sculpture: jaw fit sample</strong>
                  <small>
                    ZIP · neighboring facets and a matching-edge guide
                  </small>
                </span>
                <ArrowDownToLine aria-hidden="true" />
              </a>
              <a href={FABRICATION_DOWNLOADS.largeKit} download>
                <FileArchive aria-hidden="true" />
                <span>
                  <strong>Large sculpture foil kit</strong>
                  <small>
                    ZIP · dimensioned marks, trim guides, map, and notes
                  </small>
                </span>
                <ArrowDownToLine aria-hidden="true" />
              </a>
              <a href="/fabrication/laser/assembly-map.svg" download>
                <FileCode2 aria-hidden="true" />
                <span>
                  <strong>Facet reference map</strong>
                  <small>SVG · facet locations on the inscription</small>
                </span>
                <ArrowDownToLine aria-hidden="true" />
              </a>
            </div>
          </section>

          <section
            className="fabrication-file-group"
            aria-labelledby="small-files-title"
          >
            <header>
              <span>MAQUETTE SCALE</span>
              <h3 id="small-files-title">180 mm model</h3>
              <p>Actual-size patterns · test very fine lettering first</p>
            </header>
            <div className="fabrication-file-list">
              <a href={FABRICATION_DOWNLOADS.smallKit} download>
                <FileArchive aria-hidden="true" />
                <span>
                  <strong>Complete 180 mm foil kit</strong>
                  <small>
                    ZIP · marking sheets, pattern, manifest, and notes
                  </small>
                </span>
                <ArrowDownToLine aria-hidden="true" />
              </a>
              <a href="/fabrication/small-foil/test-coupon.svg" download>
                <FileCode2 aria-hidden="true" />
                <span>
                  <strong>180 mm lettering coupon</strong>
                  <small>SVG · actual-size marks · material test first</small>
                </span>
                <ArrowDownToLine aria-hidden="true" />
              </a>
              <a href="/fabrication/small-foil/marking-master.svg" download>
                <FileCode2 aria-hidden="true" />
                <span>
                  <strong>180 mm inscription master</strong>
                  <small>
                    SVG · outlined reading ribbon · design reference
                  </small>
                </span>
                <ArrowDownToLine aria-hidden="true" />
              </a>
              <a href={FABRICATION_DOWNLOADS.smallModel} download>
                <Box aria-hidden="true" />
                <span>
                  <strong>Foil-covered model</strong>
                  <small>GLB · marked foil preview · Y-up metres</small>
                </span>
                <ArrowDownToLine aria-hidden="true" />
              </a>
              <a href="/fabrication/print/muchado-maquette-180mm.stl" download>
                <Box aria-hidden="true" />
                <span>
                  <strong>Printable substrate</strong>
                  <small>STL · 180 mm tall · smooth surface for wrapping</small>
                </span>
                <ArrowDownToLine aria-hidden="true" />
              </a>
              <a href="/fabrication/small-foil/README.txt" download>
                <FileArchive aria-hidden="true" />
                <span>
                  <strong>180 mm foil notes</strong>
                  <small>
                    TXT · scale, marking, trimming, and fit guidance
                  </small>
                </span>
                <ArrowDownToLine aria-hidden="true" />
              </a>
              <a href="/fabrication/small-foil/manifest.json" download>
                <FileCode2 aria-hidden="true" />
                <span>
                  <strong>180 mm file manifest</strong>
                  <small>
                    JSON · dimensions, checksums, and file inventory
                  </small>
                </span>
                <ArrowDownToLine aria-hidden="true" />
              </a>
              <a href="/fabrication/print/README.txt" download>
                <FileArchive aria-hidden="true" />
                <span>
                  <strong>3D-print setup notes</strong>
                  <small>
                    TXT · units, orientation, supports, and validation
                  </small>
                </span>
                <ArrowDownToLine aria-hidden="true" />
              </a>
            </div>
          </section>
        </div>
        <p className="fabrication-fit-note">
          The full-scale panels are dimensioned from the conceptual surface
          envelope. Test-fit before marking the complete set; overlap and
          crossing clearances are not yet certified for installation.
          <a href="/fabrication/laser/manifest.json">View file manifest</a>
        </p>
      </section>

      <ArtistReuse />

      <footer className="foil-actions">
        <Link
          to="/studio"
          search={{ part: undefined }}
          className="foil-back-link"
        >
          <ArrowLeft size={15} aria-hidden="true" /> Original model
        </Link>
        <a
          href="/editions/endless-inscription-study.svg"
          download
          className="foil-download-link"
        >
          <ArrowDownToLine size={15} aria-hidden="true" />
          Download vector layout study
          <small>For design review · not machine-ready</small>
        </a>
      </footer>
    </div>
  );
}
