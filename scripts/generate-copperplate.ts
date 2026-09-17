import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  createSheetPdf,
  DEFAULT_SHEET_SETTINGS,
  type SheetSettings,
} from "../shared/copperplate-sheet";

const root = resolve(import.meta.dir, "..");
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    lines: { type: "string" },
    paper: { type: "string" },
    orientation: { type: "string" },
    margin: { type: "string" },
    weight: { type: "string" },
    darkness: { type: "string" },
    output: { type: "string" },
    check: { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
  strict: true,
});

if (values.help) {
  console.log(`Generate a one-page Copperplate PDF with horizontal lines only.

Usage: bun run generate:copperplate [options]
  --lines <2..100>                 Default: 24
  --paper <letter|a4>              Default: letter
  --orientation <portrait|landscape>  Default: landscape
  --margin <5..50>                 All margins, mm. Default: 12.7
  --weight <0.1..2>                Line weight, pt. Default: 0.5
  --darkness <10..100>             Black percentage. Default: 40
  --output <path.pdf>              Write a custom PDF to this path
  --check                          Verify committed default PDF and maker
  --help                           Show this help

Without --output, regenerates public/guide/copperplate-24-lines.pdf and the
self-contained copperplate-maker.html. Custom settings require --output.
The HTML maker opens offline and exports custom PDFs without a server.`);
  process.exit(0);
}

const hasCustomSettings = [
  values.lines,
  values.paper,
  values.orientation,
  values.margin,
  values.weight,
  values.darkness,
].some((value) => value !== undefined);
if (hasCustomSettings && !values.output)
  throw new Error("Use --output <path.pdf> for custom settings.");
if (values.check && (hasCustomSettings || values.output))
  throw new Error("--check verifies default artifacts; omit custom options.");

function numeric(value: string | undefined, fallback: number) {
  return value === undefined
    ? fallback
    : value.trim() === ""
      ? Number.NaN
      : Number(value);
}

const settings: SheetSettings = {
  lineCount: numeric(values.lines, DEFAULT_SHEET_SETTINGS.lineCount),
  paper: (values.paper ??
    DEFAULT_SHEET_SETTINGS.paper) as SheetSettings["paper"],
  orientation: (values.orientation ??
    DEFAULT_SHEET_SETTINGS.orientation) as SheetSettings["orientation"],
  marginMm: numeric(values.margin, DEFAULT_SHEET_SETTINGS.marginMm),
  lineWidthPt: numeric(values.weight, DEFAULT_SHEET_SETTINGS.lineWidthPt),
  darkness: numeric(values.darkness, DEFAULT_SHEET_SETTINGS.darkness),
};
// The shared generator validates CLI values before anything is written.
const pdf = createSheetPdf(settings);
const pdfPath = values.output
  ? resolve(values.output)
  : resolve(root, "public/guide/copperplate-24-lines.pdf");

async function emit(path: string, content: string | Uint8Array<ArrayBuffer>) {
  if (values.check) {
    const existing = Bun.file(path);
    if (
      !(await existing.exists()) ||
      !Buffer.from(await existing.arrayBuffer()).equals(Buffer.from(content))
    )
      throw new Error(`${path} is stale; run bun run generate:copperplate`);
  } else {
    await mkdir(dirname(path), { recursive: true });
    await Bun.write(path, content);
    console.log(`Wrote ${path}`);
  }
}

if (values.output) {
  await emit(pdfPath, pdf);
} else {
  const build = await Bun.build({
    entrypoints: [resolve(root, "src/copperplate-standalone.tsx")],
    target: "browser",
    format: "iife",
    minify: true,
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
  });
  if (!build.success || build.outputs.length !== 1)
    throw new Error(`Standalone maker build failed: ${build.logs.join("\n")}`);
  const js = (await build.outputs[0]?.text()) ?? "";
  const css = await Bun.file(resolve(root, "src/copperplate.css")).text();
  const notices = await Promise.all(
    ["react", "react-dom", "scheduler"].map(
      async (name) =>
        `${name}\n${await Bun.file(resolve(root, "node_modules", name, "LICENSE")).text()}`,
    ),
  );
  const html = `<!doctype html>
<!-- Bundled third-party software notices\n${notices.join("\n\n")} -->
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Copperplate practice sheet maker</title>
  <style>body{margin:0;background:#f4f5ec} ${css.replaceAll("</style", "<\\/style")}</style>
</head>
<body>
  <div id="root"></div>
  <noscript>Enable JavaScript to configure your practice sheet. <a href="copperplate-24-lines.pdf">Download the default 24-line PDF</a>.</noscript>
  <script>${js.replaceAll("</script", "<\\/script")}</script>
</body>
</html>
`;
  await emit(pdfPath, pdf);
  await emit(resolve(root, "public/guide/copperplate-maker.html"), html);
}
if (values.check)
  console.log("Copperplate PDF and standalone maker match their source.");
