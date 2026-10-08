import { Columns3, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

/** Remember appearance locally without changing the worksheet or its printed output. */
export function useStudioDisplay() {
  const [columns, setColumns] = useState(3);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("hot-pen-display");
      if (saved) {
        const value = JSON.parse(saved);
        if ([2, 3, 4].includes(value.columns)) setColumns(value.columns);
        if (value.theme === "dark" || value.theme === "light")
          setTheme(value.theme);
      } else if (window.matchMedia("(prefers-color-scheme: dark)").matches)
        setTheme("dark");
    } catch (error) {
      console.warn("Studio appearance could not be restored", error);
    }
  }, []);
  const update = (nextColumns: number, nextTheme: "light" | "dark") => {
    setColumns(nextColumns);
    setTheme(nextTheme);
    try {
      localStorage.setItem(
        "hot-pen-display",
        JSON.stringify({ columns: nextColumns, theme: nextTheme }),
      );
    } catch (error) {
      console.warn("Studio appearance will last for this visit only", error);
    }
  };
  return { columns, theme, update };
}

export function CalligraphyDisplayControls({
  display,
  fittedColumns,
}: {
  display: ReturnType<typeof useStudioDisplay>;
  fittedColumns: number;
}) {
  return (
    <div className="ck-display-controls">
      <label className="ck-column-choice">
        <Columns3 size={17} aria-hidden="true" />
        <span>Columns</span>
        <select
          aria-label="Workspace columns"
          value={display.columns}
          onChange={(event) =>
            display.update(Number(event.target.value), display.theme)
          }
        >
          <option value={2}>2 · tools + paper</option>
          <option value={3}>3 · add poem editor</option>
          <option value={4}>4 · add notes</option>
        </select>
        {fittedColumns !== display.columns && (
          <small className="ck-column-fit" role="status">
            {fittedColumns} fit here
          </small>
        )}
      </label>
      <button
        type="button"
        className="ck-theme-toggle"
        aria-label={`Switch to ${display.theme === "light" ? "dark" : "light"} mode`}
        onClick={() =>
          display.update(
            display.columns,
            display.theme === "light" ? "dark" : "light",
          )
        }
      >
        {display.theme === "light" ? (
          <Moon size={18} aria-hidden="true" />
        ) : (
          <Sun size={18} aria-hidden="true" />
        )}
        <span>{display.theme === "light" ? "Dark" : "Light"}</span>
      </button>
    </div>
  );
}
