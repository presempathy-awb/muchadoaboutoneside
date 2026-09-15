/**
 * Renders Jill's lettering brief to public/guide/: a self-contained HTML
 * document and, when a Chrome binary is available, the printable PDF.
 *
 *   bun run generate:guide            write HTML and PDF
 *   bun run generate:guide --check    verify the HTML matches the source
 *
 * The PDF is rendered by headless Chrome and is not byte-checked, because
 * Chrome stamps creation dates into it. Set CHROME_BIN to choose the browser.
 */
import { access, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { PrintableGuide } from "../src/components/calligraphy/printable";

const root = resolve(import.meta.dir, "..");
const outputDir = resolve(root, "public/guide");
const htmlPath = resolve(outputDir, "calligraphy-guide.html");
const pdfPath = resolve(outputDir, "calligraphy-guide.pdf");
const checkOnly = Bun.argv.includes("--check");
const skipPdf = Bun.argv.includes("--no-pdf");

const css = await Bun.file(resolve(root, "src/calligraphy.css")).text();
const html = `<!doctype html>\n${renderToStaticMarkup(
  <PrintableGuide css={css} fontUrl="../fonts/GreatVibes-Regular.ttf" />,
)}\n`;

if (checkOnly) {
  const existing = Bun.file(htmlPath);
  if (!(await existing.exists()) || (await existing.text()) !== html)
    throw new Error(
      "public/guide/calligraphy-guide.html is stale; run bun run generate:guide",
    );
  if (!(await Bun.file(pdfPath).exists()))
    throw new Error("public/guide/calligraphy-guide.pdf is missing");
  console.log("Calligraphy guide HTML matches its source.");
  process.exit(0);
}

await mkdir(outputDir, { recursive: true });
await Bun.write(htmlPath, html);
console.log(`Wrote ${htmlPath}`);

if (skipPdf) process.exit(0);

const candidates = [
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter((path): path is string => Boolean(path));

let chrome: string | undefined;
for (const candidate of candidates) {
  try {
    await access(candidate);
    chrome = candidate;
    break;
  } catch {}
}

if (!chrome) {
  console.warn(
    "No Chrome binary found; the HTML was written but the PDF was not rendered. Set CHROME_BIN or pass --no-pdf.",
  );
  process.exit(2);
}

const render = Bun.spawn(
  [
    chrome,
    "--headless=new",
    "--disable-gpu",
    "--allow-file-access-from-files",
    "--no-pdf-header-footer",
    "--virtual-time-budget=8000",
    `--print-to-pdf=${pdfPath}`,
    `file://${htmlPath}`,
  ],
  { stdout: "ignore", stderr: "pipe" },
);
const stderr = await new Response(render.stderr).text();
const exitCode = await render.exited;
if (exitCode !== 0 || !(await Bun.file(pdfPath).exists())) {
  console.error(stderr);
  throw new Error(`Chrome failed to render the PDF (exit ${exitCode})`);
}
console.log(
  `Wrote ${pdfPath} (${(Bun.file(pdfPath).size / 1024).toFixed(0)} KB)`,
);
