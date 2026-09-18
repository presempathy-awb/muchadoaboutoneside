import { ArrowDownToLine, ArrowUpRight, ImageIcon } from "lucide-react";
import {
  REFERENCE_GALLERY,
  REFERENCE_IMAGES,
  REFERENCE_MANIFEST_PATH,
  referenceFileSize,
} from "../../shared/reference-gallery";
import "../references.css";

const suppliedDate = new Intl.DateTimeFormat("en", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export default function ReferenceGallery() {
  return (
    <div className="reference-gallery-page">
      <header className="reference-gallery-intro">
        <span className="reference-gallery-kicker">
          <ImageIcon size={16} aria-hidden="true" /> From the making of the work
        </span>
        <h1>The reference shelf.</h1>
        <p>
          The sculpture photographs and calligraphy sample that guide this
          project, kept here as complete originals. Open an image to look
          closely, or download it to keep beside your work.
        </p>
        <nav className="reference-gallery-links" aria-label="Continue making">
          <a href="/scales">
            Explore the 3D scales <ArrowUpRight size={16} aria-hidden="true" />
          </a>
          <a href="/calligraphy/practice">
            Make a practice sheet <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </nav>
      </header>

      <section aria-labelledby="reference-gallery-title">
        <div className="reference-gallery-heading">
          <h2 id="reference-gallery-title">Supplied images</h2>
          <span>{REFERENCE_IMAGES.length} originals · preserved uncropped</span>
        </div>
        <div className="reference-gallery-grid">
          {REFERENCE_IMAGES.map((reference) => (
            <figure className="reference-gallery-card" key={reference.id}>
              <a
                className="reference-gallery-image"
                href={reference.path}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open complete original: ${reference.title} (new tab)`}
              >
                <img
                  src={reference.path}
                  alt={reference.alt}
                  width={reference.width}
                  height={reference.height}
                  loading="lazy"
                  decoding="async"
                />
                <span>
                  View complete original
                  <ArrowUpRight size={16} aria-hidden="true" />
                </span>
              </a>
              <figcaption>
                <span className="reference-gallery-category">
                  {reference.category === "sculpture"
                    ? "Form & construction"
                    : "Lettering & gesture"}
                </span>
                <h3>{reference.title}</h3>
                <p>{reference.caption}</p>
                <p className="reference-gallery-meta">
                  Supplied{" "}
                  <time dateTime={reference.suppliedOn}>
                    {suppliedDate.format(
                      new Date(`${reference.suppliedOn}T00:00:00Z`),
                    )}
                  </time>
                  <br />
                  {reference.width} × {reference.height} px ·{" "}
                  {referenceFileSize(reference.bytes)} ·{" "}
                  {reference.mediaType === "image/png" ? "PNG" : "JPEG"}
                </p>
                <div className="reference-gallery-actions">
                  <a href={reference.path} download={reference.file}>
                    <ArrowDownToLine size={16} aria-hidden="true" /> Download
                    original
                  </a>
                  {reference.sourceUrl && (
                    <a
                      href={reference.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Source video
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </a>
                  )}
                </div>
                <details className="reference-gallery-checksum">
                  <summary>File fingerprint</summary>
                  <p>SHA-256</p>
                  <code>{reference.sha256}</code>
                </details>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <footer className="reference-gallery-note">
        <p>
          The screenshots retain the surrounding windows exactly as supplied.
          They show the construction’s character and surface detail; physical
          measurements are still needed to fit the scale plates.
        </p>
        <p>{REFERENCE_GALLERY.rights}</p>
        <a href={REFERENCE_MANIFEST_PATH} download="reference-images.json">
          <ArrowDownToLine size={15} aria-hidden="true" /> Download image
          inventory & fingerprints
        </a>
      </footer>
    </div>
  );
}
