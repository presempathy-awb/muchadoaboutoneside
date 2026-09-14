import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import {
  escapeXml,
  INSCRIPTION_LAYOUT as layout,
  POEM_LOOP,
  POEM_TITLE,
} from "../shared/poem";

const root = resolve(import.meta.dir, "..");
const fontLicense = await Bun.file(
  resolve(root, "public/fonts/OFL.txt"),
).text();
const font = Buffer.from(
  await Bun.file(
    resolve(root, "public/fonts/GreatVibes-Regular.ttf"),
  ).arrayBuffer(),
).toString("base64");
const rows = Array.from({ length: layout.rows }, (_, index) => {
  const y = layout.firstBaseline + index * layout.rowSpacing;
  return `<text x="${layout.left}" y="${y}" textLength="${layout.textWidth}" lengthAdjust="spacingAndGlyphs">${escapeXml(POEM_LOOP)}</text>`;
}).join("\n");
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8192 2048" width="8192" height="2048" role="img" aria-labelledby="title desc">
<title id="title">${escapeXml(POEM_TITLE)} — endless inscription study</title>
<desc id="desc">Editable normalized UV lettering study. Each horizontal row is the complete poem around a closed surface reading circuit. The right edge continues at the left. This is not a dimensioned foil cutting template or a laser toolpath. Font: Great Vibes, SIL Open Font License. Inspired by Jill’s lettering reference; not her final hand-lettered master.</desc>
<metadata id="font-license">${escapeXml(fontLicense)}</metadata>
<defs><style>@font-face{font-family:GreatVibes;src:url(data:font/ttf;base64,${font}) format('truetype')}text{font-family:GreatVibes,serif;font-size:${layout.fontSize}px;fill:#17201c}</style></defs>
<rect width="8192" height="2048" fill="#e1e3df"/>
<g id="inscription">${rows}</g>
<g id="registration-guides" fill="none" stroke="#7b847e" stroke-width="2" stroke-dasharray="12 12"><path d="M48 60V1988M8144 60V1988M48 60H8144M48 1988H8144"/></g>
<text x="96" y="1980" style="font-family:sans-serif;font-size:24px;fill:#616960">UV layout study · one poem per reading circuit · wrap right edge to left · no physical scale</text>
</svg>\n`;
const outputs = [
  ["endless-inscription-study.svg", svg],
  [
    "much-ado-about-one-side.txt",
    await Bun.file(
      resolve(root, "source/poem/much-ado-about-one-side.txt"),
    ).text(),
  ],
] as const;
const checkOnly = Bun.argv.includes("--check");
if (!checkOnly)
  await mkdir(resolve(root, "public/editions"), { recursive: true });
for (const [name, content] of outputs) {
  const path = resolve(root, "public/editions", name);
  if (checkOnly) {
    if (
      !(await Bun.file(path).exists()) ||
      (await Bun.file(path).text()) !== content
    )
      throw new Error(`${name} is stale; run bun run generate:inscription`);
  } else await Bun.write(path, content);
}
console.log(
  checkOnly
    ? "Inscription downloads match their source."
    : "Generated the editable inscription SVG and original poem download.",
);
