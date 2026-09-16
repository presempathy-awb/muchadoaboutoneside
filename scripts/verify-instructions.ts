import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const banner =
  "<!-- AUTO-GENERATED from agents.toml; do not edit directly. Run `just sync-agents` to regenerate. -->\n\n";
const targets = { codex: "AGENTS.md", claude: "CLAUDE.md" } as const;

/** Project-owned literal subset; not the general Coroidinator schema or renderer. */
export async function instructionOutputs(
  root: string,
): Promise<Map<string, string>> {
  const document = Bun.TOML.parse(
    await readFile(resolve(root, "agents.toml"), "utf8"),
  ) as {
    meta?: { schema?: string };
    managed_files?: Record<string, Record<string, unknown>>;
  };
  if (
    Object.keys(document).sort().join(",") !==
    "agents,managed_files,meta,project"
  ) {
    throw new Error(
      "Unsupported source tables; use Coroidinator for general schema validation",
    );
  }
  if (document.meta?.schema !== "agents.core.v1") {
    throw new Error("Instruction source must declare agents.core.v1");
  }
  if (
    !document.managed_files ||
    Object.keys(document.managed_files).sort().join(",") !== "claude,codex"
  ) {
    throw new Error(
      "Only the declared codex and claude targets are supported by this verifier",
    );
  }
  const outputs = new Map<string, string>();
  let canonicalBody: string | undefined;
  for (const [name, output] of Object.entries(targets)) {
    const target = document.managed_files[name];
    if (
      !target ||
      Object.keys(target).sort().join(",") !== "content,output,schema" ||
      target.schema !== "managed-target.v1" ||
      target.output !== output ||
      typeof target.content !== "string" ||
      !target.content.trim() ||
      /\{[^}]*\}/.test(target.content)
    ) {
      throw new Error(`Unsupported literal instruction declaration: ${name}`);
    }
    const body = target.content.trim();
    if (canonicalBody !== undefined && body !== canonicalBody) {
      throw new Error(
        "Both assistants must receive the complete same project rules",
      );
    }
    canonicalBody = body;
    outputs.set(output, `${banner}${body}\n`);
  }
  return outputs;
}

export async function verifyInstructions(root: string): Promise<void> {
  for (const [output, expected] of await instructionOutputs(root)) {
    const actual = await readFile(resolve(root, output), "utf8");
    if (actual !== expected) {
      throw new Error(
        `${output} differs from its canonical agents.toml rules; run bun run generate:instructions --write`,
      );
    }
  }
}

if (import.meta.main) {
  await verifyInstructions(resolve(import.meta.dir, ".."));
  console.log(
    "Both generated instruction files match the canonical literal rules.",
  );
}
