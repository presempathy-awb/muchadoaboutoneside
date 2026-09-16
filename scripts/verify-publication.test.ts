import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { REQUIRED_PUBLIC_FILES } from "../shared/publication";
import { verifyPublication } from "./verify-publication";

const fixtures: string[] = [];
afterEach(async () => {
  for (const fixture of fixtures.splice(0))
    await rm(fixture, { recursive: true, force: true });
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "muchado-publication-"));
  fixtures.push(root);
  for (const path of REQUIRED_PUBLIC_FILES) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), "");
  }
  return root;
}

test("a self-contained public checkout passes; a missing setup file fails", async () => {
  const root = await fixture();
  await writeFile(
    join(root, "README.md"),
    "[Setup](docs/runbook/development.md#local-application)\n",
  );
  await verifyPublication(root);
  await rm(join(root, "Dockerfile"));
  await expect(verifyPublication(root)).rejects.toThrow();
});

test("links to existing private files fail before publication", async () => {
  const root = await fixture();
  await mkdir(join(root, "docs/plans"), { recursive: true });
  await writeFile(join(root, "docs/plans/private.md"), "Private fixture");
  await writeFile(join(root, "README.md"), "[Plan](docs/plans/private.md)");
  await expect(verifyPublication(root)).rejects.toThrow(
    "outside the public selection",
  );
});

test("missing public targets and escaping links fail", async () => {
  const root = await fixture();
  await writeFile(join(root, "README.md"), "[Asset](public/missing.png)");
  await expect(verifyPublication(root)).rejects.toThrow(
    "missing relative link",
  );
  await writeFile(join(root, "README.md"), "[Escape](../private.md)");
  await expect(verifyPublication(root)).rejects.toThrow(
    "outside the public selection",
  );
});

test("reference, angle-wrapped and HTML links cannot bypass public boundaries", async () => {
  const root = await fixture();
  await writeFile(
    join(root, "README.md"),
    "[Setup](<docs/runbook/development.md>)\n[Help][setup]\n[setup]: docs/runbook/development.md\n<a href='INTENT.md'>Intent</a>",
  );
  await verifyPublication(root);
  for (const link of [
    "[Private][private]\n[private]: docs/plans/private.md",
    "<a href='docs/plans/private.md'>Private</a>",
    "![Private](<docs/plans/private.md>)",
  ]) {
    await writeFile(join(root, "README.md"), link);
    await expect(verifyPublication(root)).rejects.toThrow(
      "outside the public selection",
    );
  }
});
