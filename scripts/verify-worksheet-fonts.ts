import { createHash } from "node:crypto";
import { resolve } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import {
  WORKSHEET_FONT_CATALOG,
  type WorksheetBundledFontId,
} from "../shared/worksheet-font-catalog";

const root = resolve(import.meta.dir, "..");
const maximumFontBytes = 2 * 1024 * 1024;

interface ProvenanceFont {
  id: WorksheetBundledFontId;
  version: string;
  ttfPath: string;
  ttfSource: string;
  ttfBytes: number;
  ttfSha256: string;
  fontsourcePackage: string;
  fontsourceRevision: string;
  woff2Path: string;
  woff2Bytes: number;
  woff2Sha256: string;
  licensePath: string;
  licenseSha256: string;
}

interface Provenance {
  runtimePolicy: { maximumFontBytes: number };
  googleFonts: { commit: string };
  fontsource: { packageVersion: string };
  harfbuzz: {
    packageVersion: string;
    runtimeWasmBytes: number;
    runtimeWasmSha256: string;
  };
  fonts: ProvenanceFont[];
}

function fail(message: string): never {
  throw new Error(`Worksheet font verification failed: ${message}`);
}

async function fileBytes(path: string) {
  const file = Bun.file(path);
  if (!(await file.exists())) fail(`missing ${path}`);
  return new Uint8Array(await file.arrayBuffer());
}

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertBytes(
  label: string,
  bytes: Uint8Array,
  expectedLength: number,
  expectedHash: string,
) {
  if (bytes.byteLength !== expectedLength) {
    fail(`${label} is ${bytes.byteLength} bytes; expected ${expectedLength}`);
  }
  if (bytes.byteLength > maximumFontBytes) {
    fail(`${label} exceeds the 2 MB font limit`);
  }
  const actualHash = sha256(bytes);
  if (actualHash !== expectedHash) {
    fail(`${label} SHA-256 is ${actualHash}; expected ${expectedHash}`);
  }
}

const provenance = (await Bun.file(
  resolve(root, "public/fonts/worksheet-fonts.provenance.json"),
).json()) as Provenance;

if (provenance.runtimePolicy.maximumFontBytes !== maximumFontBytes) {
  fail("provenance and verifier size limits differ");
}
if (!/^[0-9a-f]{40}$/.test(provenance.googleFonts.commit)) {
  fail("Google Fonts source is not pinned to a full commit");
}
if (provenance.fontsource.packageVersion !== "5.3.0") {
  fail("unexpected Fontsource provenance version");
}
if (provenance.fonts.length !== WORKSHEET_FONT_CATALOG.length) {
  fail("catalog and provenance font counts differ");
}

const packageJson = (await Bun.file(resolve(root, "package.json")).json()) as {
  dependencies?: Record<string, string>;
};
if (packageJson.dependencies?.harfbuzzjs !== "1.6.1") {
  fail("harfbuzzjs must remain pinned to 1.6.1");
}
const harfbuzzPackage = (await Bun.file(
  resolve(root, "node_modules/harfbuzzjs/package.json"),
).json()) as { version?: string; dependencies?: Record<string, string> };
if (
  harfbuzzPackage.version !== provenance.harfbuzz.packageVersion ||
  Object.keys(harfbuzzPackage.dependencies ?? {}).length > 0
) {
  fail("the installed HarfBuzz package does not match its zero-dependency pin");
}

for (const definition of WORKSHEET_FONT_CATALOG) {
  const record = provenance.fonts.find((font) => font.id === definition.id);
  if (!record) fail(`missing provenance for ${definition.id}`);
  if (
    record.ttfPath !== definition.path ||
    record.ttfSha256 !== definition.sha256
  ) {
    fail(`${definition.id} catalog and provenance differ`);
  }
  if (!record.ttfSource.includes(provenance.googleFonts.commit)) {
    fail(`${definition.id} source URL is not pinned to the declared commit`);
  }
  if (packageJson.dependencies?.[record.fontsourcePackage] !== "5.3.0") {
    fail(`${record.fontsourcePackage} must remain pinned to 5.3.0`);
  }
  const fontsourceRoot = resolve(
    root,
    "node_modules",
    record.fontsourcePackage,
  );
  const fontsourcePackage = (await Bun.file(
    resolve(fontsourceRoot, "package.json"),
  ).json()) as { version?: string; dependencies?: Record<string, string> };
  const fontsourceMetadata = (await Bun.file(
    resolve(fontsourceRoot, "metadata.json"),
  ).json()) as { version?: string };
  if (
    fontsourcePackage.version !== provenance.fontsource.packageVersion ||
    Object.keys(fontsourcePackage.dependencies ?? {}).length > 0 ||
    fontsourceMetadata.version !== record.fontsourceRevision
  ) {
    fail(`${record.fontsourcePackage} does not match its zero-dependency pin`);
  }

  const ttf = await fileBytes(resolve(root, `public${record.ttfPath}`));
  assertBytes(`${definition.id} TTF`, ttf, record.ttfBytes, record.ttfSha256);
  const ttfFont = fontkit.create(ttf);
  if (
    ttfFont.familyName !== definition.family ||
    ttfFont.version !== record.version
  ) {
    fail(`${definition.id} TTF name or version differs from provenance`);
  }

  const packageDirectory = record.fontsourcePackage.replace("@fontsource/", "");
  const woff2 = await fileBytes(
    resolve(
      root,
      "node_modules/@fontsource",
      packageDirectory,
      record.woff2Path,
    ),
  );
  assertBytes(
    `${definition.id} preview WOFF2`,
    woff2,
    record.woff2Bytes,
    record.woff2Sha256,
  );
  const previewFont = fontkit.create(woff2);
  if (
    previewFont.familyName !== ttfFont.familyName ||
    previewFont.version !== ttfFont.version
  ) {
    fail(`${definition.id} preview and PDF font revisions differ`);
  }

  const license = await fileBytes(resolve(root, `public${record.licensePath}`));
  if (sha256(license) !== record.licenseSha256) {
    fail(`${definition.id} OFL license hash differs from provenance`);
  }
  if (
    !new TextDecoder()
      .decode(license)
      .includes("SIL OPEN FONT LICENSE Version 1.1")
  ) {
    fail(`${definition.id} license is not OFL-1.1 text`);
  }
}

const harfbuzzWasm = await fileBytes(
  resolve(root, "node_modules/harfbuzzjs/dist/harfbuzz.wasm"),
);
assertBytes(
  "HarfBuzz runtime WASM",
  harfbuzzWasm,
  provenance.harfbuzz.runtimeWasmBytes,
  provenance.harfbuzz.runtimeWasmSha256,
);

console.log(
  `Verified ${WORKSHEET_FONT_CATALOG.length} pinned worksheet TTFs, Latin-only Fontsource previews, licenses, and HarfBuzz runtime size.`,
);
