/**
 * Renders Jill's lettering brief and the poem sheets to public/: one
 * self-contained HTML document per wording of the poem and, when a Chrome
 * binary is available, the printable PDFs.
 *
 *   bun run generate:guide            write the HTML and every PDF
 *   bun run generate:guide --check    verify the HTML matches the source
 *
 * The PDFs are rendered by headless Chrome and are not byte-checked, because
 * Chrome stamps creation dates into them. Set CHROME_BIN to choose the browser.
 */
import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, relative, resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { POEM_VERSIONS } from "../shared/poem";
import {
  PrintableGuide,
  PrintablePoemSheet,
} from "../src/components/calligraphy/printable";

const root = resolve(import.meta.dir, "..");
const publicDir = resolve(root, "public");
const checkOnly = Bun.argv.includes("--check");
const skipPdf = Bun.argv.includes("--no-pdf");
const publicPath = (path: string) => resolve(publicDir, `.${path}`);

const css = await Bun.file(resolve(root, "src/calligraphy.css")).text();
const document = (markup: string) => `<!doctype html>\n${markup}\n`;
const documents = POEM_VERSIONS.map((version) => ({
  version,
  htmlPath: publicPath(version.guideHtmlPath),
  pdfPath: publicPath(version.guidePdfPath),
  sheetPdfPath: publicPath(version.scriptPdfPath),
  html: document(
    renderToStaticMarkup(
      <PrintableGuide
        css={css}
        fontUrl="../fonts/GreatVibes-Regular.ttf"
        version={version}
      />,
    ),
  ),
}));

if (checkOnly) {
  for (const entry of documents) {
    const existing = Bun.file(entry.htmlPath);
    if (!(await existing.exists()) || (await existing.text()) !== entry.html)
      throw new Error(
        `${relative(root, entry.htmlPath)} is stale; run bun run generate:guide`,
      );
    for (const pdf of [entry.pdfPath, entry.sheetPdfPath]) {
      if (!(await Bun.file(pdf).exists()))
        throw new Error(`${relative(root, pdf)} is missing`);
    }
  }
  console.log("Calligraphy guide HTML matches its source.");
  process.exit(0);
}

for (const entry of documents) {
  await mkdir(resolve(entry.htmlPath, ".."), { recursive: true });
  await Bun.write(entry.htmlPath, entry.html);
  console.log(`Wrote ${entry.htmlPath}`);
}

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
    "No Chrome binary found; the HTML was written but the PDFs were not rendered. Set CHROME_BIN or pass --no-pdf.",
  );
  process.exit(2);
}

async function renderPdf(browser: string, htmlPath: string, pdfPath: string) {
  await mkdir(resolve(pdfPath, ".."), { recursive: true });
  const render = Bun.spawn(
    [
      browser,
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
}

for (const entry of documents)
  await renderPdf(chrome, entry.htmlPath, entry.pdfPath);

// The poem sheets are rendered from a temporary page; only their PDFs are kept.
const temporary = await mkdtemp(resolve(tmpdir(), "muchado-poem-sheet-"));
try {
  const fontUrl = `file://${resolve(publicDir, "fonts/GreatVibes-Regular.ttf")}`;
  for (const entry of documents) {
    const sheetHtml = resolve(
      temporary,
      basename(entry.sheetPdfPath).replace(/\.pdf$/, ".html"),
    );
    await Bun.write(
      sheetHtml,
      document(
        renderToStaticMarkup(
          <PrintablePoemSheet fontUrl={fontUrl} version={entry.version} />,
        ),
      ),
    );
    await renderPdf(chrome, sheetHtml, entry.sheetPdfPath);
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
