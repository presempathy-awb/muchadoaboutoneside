import { Button } from "@/components/ui/button";
import type { CalligraphyTool } from "./calligraphy-cockpit";

export const CALLIGRAPHY_SECTIONS = {
  paper: ["Paper size", "Margins & spacing", "Lines & slants"],
  templates: ["Practice templates", "Saved sheets"],
  script: ["Browse scripts", "My fonts"],
  size: ["Size & spacing", "Letterforms", "Characters", "Advanced"],
  words: ["Write & fit", "Poem versions"],
  materials: ["Mixing tips", "Paper & ink", "My tools & notes"],
} as const;

/** Keep one group of controls in view while retaining the whole draft. */
export function CalligraphySubnav({
  tool,
  selected,
  onSelect,
}: {
  tool: CalligraphyTool;
  selected: number;
  onSelect: (section: number) => void;
}) {
  const choices =
    CALLIGRAPHY_SECTIONS[tool as keyof typeof CALLIGRAPHY_SECTIONS];
  if (!choices) return null;
  return (
    <nav className="ck-subnav" aria-label="Selected tool sections">
      {choices.map((label, index) => (
        <Button
          type="button"
          key={label}
          variant="ghost"
          aria-pressed={selected === index}
          onClick={() => onSelect(index)}
        >
          {label}
        </Button>
      ))}
    </nav>
  );
}
