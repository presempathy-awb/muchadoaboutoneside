import {
  BookOpen,
  Camera,
  Expand,
  LayoutTemplate,
  Minimize,
  Network,
  Paintbrush,
  PenTool,
  Printer,
  Ruler,
  Type,
} from "lucide-react";
import type { JSX } from "react";
import { Button } from "@/components/ui/button";

const tools = [
  { id: "paper", label: "Paper & guides", icon: LayoutTemplate },
  { id: "templates", label: "Templates", icon: BookOpen },
  { id: "script", label: "Find a script", icon: PenTool },
  { id: "size", label: "Letterforms", icon: Ruler },
  { id: "words", label: "Words & poems", icon: Type },
  { id: "font", label: "Make your own font", icon: PenTool },
  { id: "photo", label: "Photo & AI", icon: Camera },
  { id: "materials", label: "At the mixing table", icon: Paintbrush },
  { id: "output", label: "Print & checks", icon: Printer },
  { id: "learn", label: "Knowledge & guides", icon: BookOpen },
  { id: "flow", label: "Workflow", icon: Network },
] as const;
export type CalligraphyTool = (typeof tools)[number]["id"] | "help" | "library";

export function CalligraphyToolBar({
  active,
  onSelect,
  paperFocus,
  onTogglePaper,
  onCreateFont,
}: {
  active: CalligraphyTool;
  onSelect: (tool: CalligraphyTool) => void;
  paperFocus: boolean;
  onTogglePaper: () => void;
  onCreateFont: () => void;
}): JSX.Element {
  return (
    <nav className="ck-toolbar" aria-label="Calligraphy tools">
      <label className="ck-mobile-tool">
        <span className="ws-sr-only">Studio tool</span>
        <select
          value={
            active === "help"
              ? "flow"
              : active === "library"
                ? "templates"
                : active
          }
          onChange={(event) => onSelect(event.target.value as CalligraphyTool)}
        >
          {tools.map(({ id, label }) => (
            <option value={id} key={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="ck-tool-tabs">
        {tools.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            type="button"
            variant="ghost"
            className="ck-tool"
            aria-pressed={active === id && !paperFocus}
            onClick={() => onSelect(id)}
          >
            <Icon size={18} aria-hidden="true" />
            {label}
          </Button>
        ))}
      </div>
      <Button type="button" className="ck-create-font" onClick={onCreateFont}>
        <Camera size={20} aria-hidden="true" />
        <span>
          Make your own font
          <br />
          <small>Start from a photo</small>
        </span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="ck-tool ck-focus"
        aria-pressed={paperFocus}
        title={paperFocus ? "Restore tools" : "Focus paper"}
        onClick={onTogglePaper}
      >
        {paperFocus ? (
          <Minimize size={18} aria-hidden="true" />
        ) : (
          <Expand size={18} aria-hidden="true" />
        )}
        {paperFocus ? "Restore tools" : "Focus paper"}
      </Button>
    </nav>
  );
}

export { CalligraphyWorkflow } from "./calligraphy-workflow";
