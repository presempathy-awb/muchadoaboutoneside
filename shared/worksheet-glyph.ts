const pathToken =
  /[MmLlHhVvCcSsQqTtAaZz]|[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/g;
const arity: Record<string, number> = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Q: 4,
  T: 2,
  A: 7,
  Z: 0,
};

function validPath(data: string): boolean {
  let end = 0;
  let command = "";
  let numbers: number[] = [];
  let draws = false;
  let tokens = 0;
  function validGroup(): boolean {
    if (command === "Z") return numbers.length === 0;
    if (!numbers.length || numbers.length % (arity[command] ?? 0) !== 0)
      return false;
    if (command === "A") {
      for (let i = 0; i < numbers.length; i += 7) {
        if (
          (numbers[i] ?? -1) < 0 ||
          (numbers[i + 1] ?? -1) < 0 ||
          ![0, 1].includes(numbers[i + 3] ?? -1) ||
          ![0, 1].includes(numbers[i + 4] ?? -1)
        )
          return false;
      }
    }
    return true;
  }
  for (const match of data.matchAll(pathToken)) {
    if (++tokens > 65_536 || !/^[\s,]*$/.test(data.slice(end, match.index)))
      return false;
    const token = match[0];
    end = match.index + token.length;
    if (/^[MmLlHhVvCcSsQqTtAaZz]$/.test(token)) {
      if ((!command && !/[Mm]/.test(token)) || (command && !validGroup()))
        return false;
      command = token.toUpperCase();
      numbers = [];
      if (command !== "M" && command !== "Z") draws = true;
    } else {
      const value = Number(token);
      if (
        !command ||
        command === "Z" ||
        !Number.isFinite(value) ||
        Math.abs(value) > 1e6
      )
        return false;
      numbers.push(value);
      if (command === "M" && numbers.length > 2) draws = true;
    }
  }
  return draws && tokens >= 3 && /^\s*$/.test(data.slice(end)) && validGroup();
}

/** Rebuild only inert SVG groups and bounded paths before preview or export. */
export function sanitizeWorksheetGlyphSvg(
  svg: string,
  width: number,
  height: number,
): string {
  const invalid = () => {
    throw new Error("The generated glyph is incomplete or unsafe to preview.");
  };
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 16 ||
    height < 16 ||
    width > 4096 ||
    height > 4096 ||
    typeof svg !== "string" ||
    new TextEncoder().encode(svg).length > 262_144 ||
    /[&!?]/.test(svg)
  )
    invalid();
  const stack: string[] = [];
  const output: string[] = [];
  let end = 0;
  let nodes = 0;
  let paths = 0;
  let closed = false;
  for (const match of svg.matchAll(/<([^<>]*)>/g)) {
    if (!/^\s*$/.test(svg.slice(end, match.index)) || closed) invalid();
    end = match.index + match[0].length;
    const tag = match[1] ?? "";
    if (tag.startsWith("/")) {
      const name = tag.slice(1).trim();
      if (stack.pop() !== name) invalid();
      output.push(`</${name}>`);
      if (!stack.length) closed = true;
      continue;
    }
    const start = /^(svg|g|path)(?=\s|\/|$)/.exec(tag);
    if (!start) invalid();
    const name = start?.[1] ?? "";
    const isRoot = nodes === 0;
    if (
      (isRoot && name !== "svg") ||
      (!isRoot && (name === "svg" || !stack.length)) ||
      stack.at(-1) === "path"
    )
      invalid();
    if (++nodes > 1024 || stack.length >= 16) invalid();
    const selfClosing = tag.endsWith("/");
    const rest = tag.slice(name.length, selfClosing ? -1 : undefined).trimEnd();
    let consumed = 0;
    const attrs = new Map<string, string>();
    const attribute =
      /\s+([A-Za-z][A-Za-z0-9:-]*)\s*=\s*(?:"([^"<>]*)"|'([^'<>]*)')/y;
    while (consumed < rest.length) {
      attribute.lastIndex = consumed;
      const attr = attribute.exec(rest);
      if (!attr) {
        invalid();
        break;
      }
      consumed = attribute.lastIndex;
      const key = attr[1] ?? "";
      let value = attr[2] ?? attr[3] ?? "";
      if (attrs.has(key)) invalid();
      if (key === "xmlns") {
        if (!isRoot || value !== "http://www.w3.org/2000/svg") invalid();
      } else if (key === "viewBox") {
        const words = value.trim().split(/\s+/);
        const values = words.map(Number);
        if (
          !isRoot ||
          words.some(
            (word) =>
              !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(word),
          ) ||
          values.length !== 4 ||
          values.some((v, i) => v !== [0, 0, width, height][i])
        )
          invalid();
        value = `0 0 ${width} ${height}`;
      } else if (key === "d") {
        if (name !== "path" || !validPath(value)) invalid();
      } else if (key === "fill" || key === "stroke") {
        if (!/^(none|black|white|#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})$/.test(value))
          invalid();
      } else if (key === "fill-rule") {
        if (value !== "evenodd" && value !== "nonzero") invalid();
      } else if (key === "stroke-width") {
        if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) || Number(value) > 4096)
          invalid();
      } else invalid();
      attrs.set(key, value);
    }
    if (!/^\s*$/.test(rest.slice(consumed))) invalid();
    if (isRoot && (!attrs.has("viewBox") || !attrs.has("xmlns"))) invalid();
    if (name === "path") {
      if (!attrs.has("d")) invalid();
      paths++;
    }
    output.push(
      `<${name}${[...attrs].map(([key, value]) => ` ${key}="${value}"`).join("")}${selfClosing ? "/" : ""}>`,
    );
    if (!selfClosing) stack.push(name);
    else if (isRoot) closed = true;
  }
  if (!closed || stack.length || !paths || !/^\s*$/.test(svg.slice(end)))
    invalid();
  return output.join("");
}
