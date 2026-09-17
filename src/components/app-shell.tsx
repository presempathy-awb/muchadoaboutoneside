import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Box,
  ClipboardList,
  Feather,
  FolderOpen,
  GitFork,
  MoveUpRight,
  NotebookPen,
  PenLine,
  Projector,
  Ruler,
  SquarePen,
} from "lucide-react";
import { useEffect } from "react";
import { AssistanceCredit } from "@/components/assistance-credit";
import { DesignCredit } from "@/components/design-credit";
import { PoemVersionPicker } from "@/components/poem-version-picker";

const links = [
  {
    to: "/" as const,
    icon: Feather,
    label: "Foil edition",
    index: "01",
  },
  {
    to: "/poem" as const,
    icon: SquarePen,
    label: "Poem editor",
    index: "02",
  },
  {
    to: "/instructions" as const,
    icon: ClipboardList,
    label: "Project instructions",
    index: "03",
  },
  {
    to: "/calligraphy" as const,
    icon: PenLine,
    label: "Calligraphy guide",
    index: "04",
  },
  {
    to: "/calligraphy/practice" as const,
    icon: NotebookPen,
    label: "Practice sheets",
    index: "05",
  },
  {
    to: "/projection" as const,
    icon: Projector,
    label: "Projection & score",
    index: "06",
  },
  {
    to: "/six-foot" as const,
    icon: Ruler,
    label: "6-foot indoor",
    index: "07",
  },
  {
    to: "/studio" as const,
    icon: Box,
    label: "Sculpture studio",
    index: "08",
  },
  {
    to: "/assembly" as const,
    icon: GitFork,
    label: "Assembly map",
    index: "09",
  },
  {
    to: "/archive" as const,
    icon: FolderOpen,
    label: "Files & source",
    index: "10",
  },
];

export function AppShell() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const currentPage =
    links.find(({ to }) => pathname === to) ??
    links.find(({ to }) =>
      to === "/"
        ? pathname === "/" || pathname === "/foil"
        : pathname === to || pathname.startsWith(`${to}/`),
    );
  useEffect(() => {
    document.title = `${currentPage?.label ?? "Page not found"} · Much Ado About One Side`;
  }, [currentPage]);

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
            const active = currentPage?.to === to;
            return (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: true }}
                className={active ? "nav-link active" : "nav-link"}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={18} strokeWidth={1.6} />
                <span>{label}</span>
                <span className="nav-index">{index}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-note">
          <span className="eyebrow">FROM STUDIO TO COLAB</span>
          <p>
            Make something
            <br />
            worth passing on.
          </p>
          <div className="fine-rule" />
          <Link to="/instructions" hash="pack" className="text-link">
            Packing & mailing <MoveUpRight size={15} aria-hidden="true" />
          </Link>
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
            <Link to="/">The workshop</Link> <span aria-hidden="true">/</span>{" "}
            <strong>{currentPage?.label ?? "Page not found"}</strong>
          </div>
          <div className="topbar-tools">
            <PoemVersionPicker />
            <Link to="/instructions" hash="send" className="saved-status">
              CoLab iani handoff <MoveUpRight size={13} />
            </Link>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="page-footer">
          <div className="page-footer-credit">
            <span>Much Ado About One Side</span>
            <DesignCredit />
            <AssistanceCredit />
          </div>
          <span className="page-footer-links">
            <a
              href="https://github.com/presempathy-awb/muchadoaboutoneside"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="https://git.telpher.stream/awb/muchadoaboutoneside"
              target="_blank"
              rel="noopener noreferrer"
            >
              Gitea (sign-in)
            </a>
            <span aria-hidden="true">·</span>
            <Link to="/instructions" hash="send">
              Mailing & handoff
            </Link>
            <span aria-hidden="true">·</span>
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
