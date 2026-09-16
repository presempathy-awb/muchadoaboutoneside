import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { generateInstructions } from "./generate-instructions";
import { verifyInstructions } from "./verify-instructions";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
async function fixture(): Promise<string> {
  const root = await mkdtemp(resolve(tmpdir(), "muchado-instructions-test-"));
  roots.push(root);
  for (const path of ["agents.toml", "AGENTS.md", "CLAUDE.md"]) {
    await writeFile(
      resolve(root, path),
      await readFile(resolve(import.meta.dir, "..", path)),
    );
  }
  return root;
}

test("public verification needs only exported files and Bun", async () => {
  await verifyInstructions(await fixture());
});
test("assistant output edits are rejected", async () => {
  const root = await fixture();
  await writeFile(resolve(root, "CLAUDE.md"), "changed rules");
  await expect(verifyInstructions(root)).rejects.toThrow("differs");
});
test("canonical rule edits require regeneration", async () => {
  const root = await fixture();
  const path = resolve(root, "agents.toml");
  await writeFile(
    path,
    (await readFile(path, "utf8")).replaceAll(
      "# Much Ado About One Side",
      "# Revised project",
    ),
  );
  await expect(verifyInstructions(root)).rejects.toThrow("differs");
});
test("undeclared output paths and unsupported schema are rejected", async () => {
  const root = await fixture();
  const path = resolve(root, "agents.toml");
  const original = await readFile(path, "utf8");
  await writeFile(
    path,
    original.replace('output = "AGENTS.md"', 'output = "../AGENTS.md"'),
  );
  await expect(verifyInstructions(root)).rejects.toThrow("Unsupported");
  await writeFile(
    path,
    original.replace(
      'schema = "agents.core.v1"',
      'schema = "agents.legacy.v2"',
    ),
  );
  await expect(verifyInstructions(root)).rejects.toThrow("agents.core.v1");
});

test("public literal generation is repeatable and changes only its two targets", async () => {
  const root = await fixture();
  await writeFile(resolve(root, "unmanaged.txt"), "keep this file\n");
  const source = resolve(root, "agents.toml");
  await writeFile(
    source,
    (await readFile(source, "utf8")).replaceAll(
      "# Much Ado About One Side",
      "# Revised project",
    ),
  );
  await generateInstructions(root);
  await verifyInstructions(root);
  const first = await readFile(resolve(root, "AGENTS.md"), "utf8");
  expect(first).toContain("# Revised project");
  expect(await readFile(resolve(root, "CLAUDE.md"), "utf8")).toBe(first);
  await generateInstructions(root);
  expect(await readFile(resolve(root, "AGENTS.md"), "utf8")).toBe(first);
  expect(await readFile(resolve(root, "unmanaged.txt"), "utf8")).toBe(
    "keep this file\n",
  );
});

test("all source targets are validated before either output is written", async () => {
  const root = await fixture();
  const output = resolve(root, "AGENTS.md");
  const before = await readFile(output, "utf8");
  const source = resolve(root, "agents.toml");
  await writeFile(
    source,
    (await readFile(source, "utf8")).replace(
      'output = "CLAUDE.md"',
      'output = "other.md"',
    ),
  );
  await expect(generateInstructions(root)).rejects.toThrow("Unsupported");
  expect(await readFile(output, "utf8")).toBe(before);
});
