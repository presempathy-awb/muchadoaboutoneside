import { usePoemVersion } from "@/lib/poem-version";
import { isPoemVersionId } from "../../shared/poem";

/** Switches every page, render, and download to one wording of the poem. */
export function PoemVersionPicker() {
  const { version, base, versions, setVersionId } = usePoemVersion();
  return (
    <label className="poem-version-picker" title={version.summary}>
      <span>Poem version</span>
      {version.draft && <span className="poem-version-draft">draft</span>}
      <select
        value={base.id}
        onChange={(event) => {
          if (isPoemVersionId(event.target.value))
            setVersionId(event.target.value);
        }}
      >
        {versions.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label} · {item.lines.length} lines
          </option>
        ))}
      </select>
    </label>
  );
}
