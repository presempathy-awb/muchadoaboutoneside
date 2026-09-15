import { ArrowDownToLine, Maximize2 } from "lucide-react";
import { useState } from "react";
import { FABRICATION_DOWNLOADS } from "../../shared/fabrication-downloads";

const ARTWORK = {
  large: {
    label: "Large sculpture",
    path: FABRICATION_DOWNLOADS.bodyMaster,
    toolbar: "LARGE SURFACE / CONTINUOUS UV ARTWORK",
    alt: "Continuous outlined calligraphy mapped across the large sculpture surface",
    download: "Download large artwork",
  },
  small: {
    label: "180 mm model",
    path: "/fabrication/small-foil/marking-preview.svg",
    toolbar: "180 MM LAYOUT / MARKS + TRIM REFERENCE",
    alt: "Dimensioned layout preview for the 180 millimetre model, combining black calligraphy marks and gray mechanical trim references",
    download: "Download layout preview",
  },
} as const;

export default function FlatFoilPreview() {
  const [scale, setScale] = useState<keyof typeof ARTWORK>("large");
  const artwork = ARTWORK[scale];

  return (
    <div className="flat-foil-preview">
      <fieldset className="flat-foil-scale" aria-label="Foil artwork scale">
        {(Object.keys(ARTWORK) as Array<keyof typeof ARTWORK>).map((key) => (
          <button
            type="button"
            key={key}
            className={scale === key ? "is-active" : ""}
            aria-pressed={scale === key}
            onClick={() => setScale(key)}
          >
            {ARTWORK[key].label}
          </button>
        ))}
      </fieldset>
      <div className="flat-foil-toolbar">
        <span>{artwork.toolbar}</span>
        <a href={artwork.path} target="_blank" rel="noreferrer">
          <Maximize2 size={13} aria-hidden="true" /> Open full size
        </a>
      </div>
      <a
        className="flat-foil-artwork"
        href={artwork.path}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open ${artwork.label.toLowerCase()} outlined inscription artwork`}
      >
        <img src={artwork.path} alt={artwork.alt} loading="lazy" />
      </a>
      <a className="flat-foil-download" href={artwork.path} download>
        <ArrowDownToLine size={14} aria-hidden="true" /> {artwork.download}
      </a>
      {scale === "small" && (
        <p className="flat-foil-marking-note">
          This preview includes mechanical trim guides. For laser marking, use
          only the marking sheets in the{" "}
          <a href={FABRICATION_DOWNLOADS.smallKit} download>
            180 mm foil kit
          </a>
          .
        </p>
      )}
    </div>
  );
}
