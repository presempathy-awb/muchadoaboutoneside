import { Link } from "@tanstack/react-router";
import Scales from "@/pages/scales";
import "./home.css";

export default function Home() {
  return (
    <>
      <Scales presentation="home" />
      <section className="home-workshop" aria-labelledby="home-workshop-title">
        <div>
          <span className="eyebrow">FROM POEM TO OBJECT</span>
          <h2 id="home-workshop-title">Make something worth passing on.</h2>
          <p>
            A study in connection, shaped around a poem. Explore the surface
            here, then take the lettering, materials, and making guides to your
            bench.
          </p>
        </div>
        <div className="home-workshop-links">
          <Link to="/foil">
            <strong>Continuous foil edition</strong>
            <span>
              The wrapped poem, source dimensions, and fabrication files.
            </span>
          </Link>
          <Link to="/calligraphy/practice">
            <strong>Calligraphy practice sheets</strong>
            <span>
              Choose your paper, ruling, fonts, and colors. Print or save a PDF.
            </span>
          </Link>
          <Link to="/instructions">
            <strong>Making & handoff</strong>
            <span>
              Materials, assembly, packing, and the CoLab iani handoff.
            </span>
          </Link>
          <Link to="/references">
            <strong>Original reference images</strong>
            <span>
              The complete photographs and screenshots behind this study.
            </span>
          </Link>
        </div>
      </section>
    </>
  );
}
