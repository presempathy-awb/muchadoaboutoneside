import { expect, test } from "bun:test";
import { isPublicSourcePath } from "./publication";

test("public source selection excludes private archives, history, credentials, and host configuration", () => {
  for (const path of [
    "docs/plans/001-studio-platform.md",
    "docs/security/threat-model.md",
    "docs/prds/001-platform-validation.md",
    "docs/runbook/secrets.md",
    "inbox/suggestions-to-claude.md",
    "suggestions-to-programer.md",
    "source/reference/jill-calligraphy.jpg",
    "source/reference/provenance.json",
    "source/claude/share-page.html",
    "source/claude/snapshot-response.html",
    "source/claude/import-status.json",
    "deploy/README.md",
    "deploy/systemd/muchadoaboutoneside.service",
    "deploy/traefik/muchadoaboutoneside.yml",
    ".git/config",
    ".env",
    ".env.production",
    "public/.env",
    "public/../source/reference/x.jpg",
    "public/jill-calligraphy.jpg",
    "public/PXL_20260914_180707651.RAW-01.jpg",
    "public/node_modules/x",
    "src\\..\\secret",
    "/public/x",
    ".omx/state.json",
  ])
    expect(isPublicSourcePath(path)).toBeFalse();
  for (const path of [
    "AGENTS.md",
    "CLAUDE.md",
    "agents.toml",
    "Dockerfile",
    "docs/runbook/development.md",
    ".env.example",
    "LICENSE-MIT",
    "LICENSE-APACHE",
    "REUSE.md",
    "package.json",
    ".github/workflows/site.yml",
    "src/main.tsx",
    "shared/poem.ts",
    "server/app.ts",
    "scripts/generate-small-foil.py",
    "public/fabrication/small-foil/foil-kit-180mm.zip",
    "source/assets/snake_build.stl",
    "source/poem/much-ado-about-one-side.txt",
    "deploy/package-release.ts",
  ])
    expect(isPublicSourcePath(path)).toBeTrue();
});

test("website license downloads preserve the project license texts", async () => {
  for (const name of ["LICENSE-MIT", "LICENSE-APACHE"]) {
    const root = await Bun.file(new URL(`../${name}`, import.meta.url)).text();
    const download = await Bun.file(
      new URL(`../public/licenses/${name}.txt`, import.meta.url),
    ).text();
    expect(download).toBe(root);
  }
  expect(
    await Bun.file(
      new URL("../public/licenses/THIRD-PARTY-NOTICES.txt", import.meta.url),
    ).text(),
  ).toBe(
    await Bun.file(
      new URL("../THIRD_PARTY_NOTICES.md", import.meta.url),
    ).text(),
  );
});
