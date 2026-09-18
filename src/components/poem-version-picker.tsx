import { usePoemVersion } from "@/lib/poem-version";

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
          const selected = versions.find(
            (item) => item.id === event.target.value,
          );
          if (selected) setVersionId(selected.id);
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
