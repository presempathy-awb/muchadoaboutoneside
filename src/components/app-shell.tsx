import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Box,
  Feather,
  FolderOpen,
  GitFork,
  MoveUpRight,
} from "lucide-react";

const links = [
  {
    to: "/" as const,
    icon: Feather,
    label: "Foil edition",
    index: "01",
  },
  {
    to: "/studio" as const,
    icon: Box,
    label: "Sculpture studio",
    index: "02",
  },
  {
    to: "/assembly" as const,
    icon: GitFork,
    label: "Assembly map",
    index: "03",
  },
  {
    to: "/archive" as const,
    icon: FolderOpen,
    label: "Files & source",
    index: "04",
  },
];

export function AppShell() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link
          to="/"
          className="brand"
          aria-label="Much Ado About One Side home"
        >
          <span className="brand-mark" aria-hidden="true">
            ∞
          </span>
          <span>
            much ado<span className="brand-subtitle">about one side</span>
          </span>
        </Link>
        <p className="sidebar-caption">A STUDY IN CONNECTION</p>
        <nav aria-label="Main navigation" className="main-nav">
          {links.map(({ to, icon: Icon, label, index }) => {
            const active =
              pathname === to || (to === "/" && pathname === "/foil");
            return (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: true }}
                className={active ? "nav-link active" : "nav-link"}
              >
                <Icon size={18} strokeWidth={1.6} />
                <span>{label}</span>
                <span className="nav-index">{index}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-note">
          <span className="eyebrow">THE PROJECT</span>
          <p>
            One continuous idea.
            <br />
            Many connected parts.
          </p>
          <div className="fine-rule" />
          <span className="muted text-xs">
            Figure-eight snake
            <br />
            Construction model · Study 01
          </span>
        </div>
        <a
          className="repo-link"
          href="https://github.com/presempathy-awb/muchadoaboutoneside"
          target="_blank"
          rel="noreferrer"
        >
          Public GitHub repository <ArrowUpRight size={15} />
        </a>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            The workshop <span>/</span> Much Ado About One Side
          </div>
          <Link to="/archive" className="saved-status">
            <span className="status-dot" />4 source files preserved{" "}
            <MoveUpRight size={13} />
          </Link>
        </header>
        <main id="main" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="page-footer">
          <span>Much Ado About One Side</span>
          <span className="page-footer-links">
            <a href="/licenses/REUSE.txt">Open reuse</a>
            <span aria-hidden="true">·</span>
            <a href="/licenses/LICENSE-MIT.txt">MIT</a>
            <span aria-hidden="true">or</span>
            <a href="/licenses/LICENSE-APACHE.txt">Apache-2.0</a>
          </span>
        </footer>
      </div>
    </div>
  );
}
