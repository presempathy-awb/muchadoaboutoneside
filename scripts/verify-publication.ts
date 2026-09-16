import { lstat, readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import {
  isPublicSourcePath,
  REQUIRED_PUBLIC_FILES,
} from "../shared/publication";

async function walk(root: string, directory = root): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if ([".git", ".jj", "node_modules", "dist", ".cache"].includes(entry.name))
      continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(root, path)));
    else files.push(relative(root, path).split(sep).join("/"));
  }
  return files;
}

/** Check the selected public tree, including links that exist only privately. */
export async function verifyPublication(root: string): Promise<void> {
  for (const path of REQUIRED_PUBLIC_FILES) {
    if (
      !isPublicSourcePath(path) ||
      !(await lstat(resolve(root, path))).isFile()
    ) {
      throw new Error(`Required public file unavailable: ${path}`);
    }
  }
  for (const path of (await walk(root)).filter(isPublicSourcePath)) {
    if (!path.endsWith(".md")) continue;
    const text = await readFile(resolve(root, path), "utf8");
    const targets = [
      ...text.matchAll(/\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g),
      ...text.matchAll(/^\s{0,3}\[[^\]]+\]:\s*(<[^>]+>|\S+)/gm),
      ...text.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi),
    ];
    for (const match of targets) {
      const target = match[1]?.replace(/^<|>$/g, "");
      if (!target || /^(?:[a-z][a-z\d+.-]*:|#)/i.test(target)) continue;
      const clean = decodeURIComponent(target.split(/[?#]/)[0] ?? "");
      const absolute = resolve(dirname(resolve(root, path)), clean);
      const destination = relative(root, absolute).split(sep).join("/");
      if (!isPublicSourcePath(destination)) {
        throw new Error(
          `${path} links outside the public selection: ${target}`,
        );
      }
      try {
        await lstat(absolute);
      } catch {
        throw new Error(`${path} has a missing relative link: ${target}`);
      }
    }
  }
}

if (import.meta.main) {
  await verifyPublication(resolve(import.meta.dir, ".."));
  console.log("Required public files and relative Markdown links verified.");
}
