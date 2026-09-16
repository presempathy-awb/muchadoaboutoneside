import { lstat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { instructionOutputs, verifyInstructions } from "./verify-instructions";

/** Generate only this project's two literal targets after validating the full source. */
export async function generateInstructions(root: string): Promise<void> {
  const outputs = await instructionOutputs(root);
  for (const output of outputs.keys()) {
    const path = resolve(root, output);
    const stat = await lstat(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    if (stat && !stat.isFile()) {
      throw new Error(
        `Refusing to replace a non-regular instruction file: ${output}`,
      );
    }
  }
  for (const [output, content] of outputs) {
    await writeFile(resolve(root, output), content);
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (
    args.length > 1 ||
    (args.length === 1 && !["--check", "--write"].includes(args[0] ?? ""))
  ) {
    throw new Error(
      "Usage: bun scripts/generate-instructions.ts [--check | --write]",
    );
  }
  const root = resolve(import.meta.dir, "..");
  if (args[0] === "--write") {
    await generateInstructions(root);
    console.log("Generated the two declared literal instruction targets.");
  } else {
    await verifyInstructions(root);
    console.log("Generated instruction targets are current.");
  }
}
