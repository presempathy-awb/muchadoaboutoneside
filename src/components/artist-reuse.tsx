import type { LucideIcon } from "lucide-react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Box,
  FileArchive,
  FileCode2,
  FileText,
  Sparkles,
} from "lucide-react";
import { FABRICATION_DOWNLOADS } from "../../shared/fabrication-downloads";

interface ReuseDownload {
  href: string;
  label: string;
  detail: string;
  icon: LucideIcon;
  external?: boolean;
}

const downloads: readonly ReuseDownload[] = [
  {
    href: FABRICATION_DOWNLOADS.largeKit,
    label: "Large foil kit",
    detail: "Patterns, marking art, maps, and notes",
    icon: FileArchive,
  },
  {
    href: FABRICATION_DOWNLOADS.smallKit,
    label: "180 mm foil kit",
    detail: "Small-scale patterns and marking art",
    icon: FileArchive,
  },
  {
    href: "/fabrication/print/muchado-maquette-180mm.stl",
    label: "Printable model",
    detail: "180 mm smooth wrapping substrate",
    icon: Box,
  },
  {
    href: "/api/assets/snake_build.obj",
    label: "Editable sculpture",
    detail: "OBJ geometry with named groups",
    icon: Box,
  },
  {
    href: "/editions/much-ado-about-one-side.txt",
    label: "The poem",
    detail: "Plain text for reading and adaptation",
    icon: FileText,
  },
  {
    href: "https://github.com/presempathy-awb/muchadoaboutoneside/archive/refs/heads/main.zip",
    label: "Complete source",
    detail: "Website, generators, tests, and assets",
    icon: FileCode2,
    external: true,
  },
] as const;

export function ArtistReuse() {
  return (
    <section className="artist-reuse" aria-labelledby="artist-reuse-title">
      <div className="artist-reuse-copy">
        <span className="artist-reuse-kicker">
          <Sparkles size={13} aria-hidden="true" /> OPEN TO INTERPRETATION
        </span>
        <h2 id="artist-reuse-title">Take a side. Make another.</h2>
        <p>
          Artists, makers, teachers, fabricators, and curious people are invited
          to use any part of this project. Remix it, rebuild it, translate it,
          teach with it, exhibit it, or sell what you make.
        </p>
        <p className="artist-reuse-license">
          Choose the <a href="/licenses/LICENSE-MIT.txt">MIT License</a> or the{" "}
          <a href="/licenses/LICENSE-APACHE.txt">Apache License 2.0</a>, at your
          option, and keep the notices each license requires. Linking back is
          warmly welcomed, never an extra condition. Third-party fonts and
          dependencies retain their own licenses;{" "}
          <a href="/licenses/REUSE.txt">read the reuse notes</a>.
        </p>
        <a
          className="artist-reuse-repository"
          href="https://github.com/presempathy-awb/muchadoaboutoneside"
          target="_blank"
          rel="noreferrer"
        >
          Browse the public project on GitHub
          <ArrowUpRight size={15} aria-hidden="true" />
        </a>
      </div>

      <nav
        className="artist-reuse-downloads"
        aria-label="Open project downloads"
      >
        {downloads.map(({ href, label, detail, icon: Icon, ...item }) => (
          <a
            href={href}
            key={href}
            download={item.external ? undefined : true}
            target={item.external ? "_blank" : undefined}
            rel={item.external ? "noreferrer" : undefined}
          >
            <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
            <span>
              <strong>{label}</strong>
              <small>{detail}</small>
            </span>
            {item.external ? (
              <ArrowUpRight size={15} aria-hidden="true" />
            ) : (
              <ArrowDownToLine size={15} aria-hidden="true" />
            )}
          </a>
        ))}
      </nav>
    </section>
  );
}
