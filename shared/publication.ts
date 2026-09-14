// A content fingerprint is retained so both release formats reject the private
// reference even if it is accidentally copied under another filename.
export const PRIVATE_REFERENCE_SHA256 =
  "904edf635f229cf4bcc98efe61849cf3e113e0efa9eae040a126b3de73e94625";

export const PRIVATE_REFERENCE_NAMES = new Set([
  "PXL_20260914_180707651.RAW-01.jpg",
  "jill-calligraphy.jpg",
]);

const publicRootFiles = new Set([
  ".env.example",
  ".gitignore",
  ".gitattributes",
  "README.md",
  "LICENSE",
  "LICENSE-MIT",
  "LICENSE-APACHE",
  "REUSE.md",
  "THIRD_PARTY_NOTICES.md",
  "biome.json",
  "bun.lock",
  "components.json",
  "index.html",
  "mise.toml",
  "package.json",
  "tsconfig.json",
  "vite.config.ts",
  "source/README.md",
  "deploy/package-release.ts",
]);

const publicPrefixes = [
  ".github/workflows/",
  "src/",
  "shared/",
  "server/",
  "scripts/",
  "public/",
  "source/assets/",
  "source/poem/",
];

export function isPublicSourcePath(path: string): boolean {
  const parts = path.split("/");
  if (
    path.includes("\\") ||
    parts.some((part) =>
      ["", ".", "..", ".git", "node_modules"].includes(part),
    ) ||
    parts.some((part) => PRIVATE_REFERENCE_NAMES.has(part)) ||
    parts.some((part) => part.startsWith(".env") && path !== ".env.example")
  )
    return false;
  return (
    publicRootFiles.has(path) ||
    publicPrefixes.some((prefix) => path.startsWith(prefix))
  );
}
