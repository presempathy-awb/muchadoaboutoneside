// Retain the former private reference fingerprint alongside the approved
// screenshots. Andrew approved complete originals on 2026-09-18 at the reviewed
// gallery locations; renamed copies remain excluded from both release formats.
export const PRIVATE_REFERENCE_SHA256 =
  "904edf635f229cf4bcc98efe61849cf3e113e0efa9eae040a126b3de73e94625";

export const APPROVED_REFERENCE_PUBLICATIONS: Readonly<Record<string, string>> =
  {
    "public/references/jill-calligraphy.jpg": PRIVATE_REFERENCE_SHA256,
    "public/references/iani-sculpture-video-reference-01.png":
      "f7ddeef71331dbee8100f35c8ae4a130495451eafa829f9ec4f3e87dcb109e21",
    "public/references/iani-sculpture-video-reference-02.png":
      "836062958b46de2532fffefbf96df7bfdd3b3c6c76ac9726931b7cdf29292b85",
  };

const approvedReferenceHashes = new Set(
  Object.values(APPROVED_REFERENCE_PUBLICATIONS),
);

export const PRIVATE_REFERENCE_NAMES = new Set([
  "PXL_20260914_180707651.RAW-01.jpg",
  "jill-calligraphy.jpg",
  "iani-sculpture-video-reference-01.png",
  "iani-sculpture-video-reference-02.png",
]);

export const REQUIRED_PUBLIC_FILES = [
  "README.md",
  "INTENT.md",
  "ROADMAP.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CHANGELOG.md",
  "CODE_OF_CONDUCT.md",
  "PRIVACY.md",
  "docs/runbook/incident.md",
  "LICENSE",
  "LICENSE-MIT",
  "LICENSE-APACHE",
  "REUSE.md",
  "THIRD_PARTY_NOTICES.md",
  "agents.toml",
  "AGENTS.md",
  "CLAUDE.md",
  "package.json",
  "bun.lock",
  "mise.toml",
  "justfile",
  "biome.json",
  "tsconfig.json",
  "vite.config.ts",
  "index.html",
  ".env.example",
  "Dockerfile",
  ".dockerignore",
  "compose.yaml",
  ".devcontainer/devcontainer.json",
  ".devcontainer/devcontainer-lock.json",
  "lefthook.yml",
  "trivy.yaml",
  ".trivyignore.yaml",
  ".gitleaks.toml",
  "sgconfig.yml",
  ".editorconfig",
  ".codex/config.toml",
  "repo-profile.json",
  ".github/workflows/site.yml",
  "docs/decisions.md",
  "docs/calligraphy-studio.md",
  "docs/calligraphy-font-security.md",
  "docs/scale-studio.md",
  "docs/runbook/development.md",
  "docs/runbook/containers.md",
  "docs/runbook/instructions.md",
  "scripts/verify-instructions.ts",
  "scripts/verify-publication.ts",
  "scripts/toolchain-check.ts",
  "scripts/container-smoke.ts",
  "scripts/container-ci-smoke.ts",
  "scripts/generate-instructions.ts",
  "scripts/security-validation.ts",
  "rules/security/no-server-console.yml",
  "rules/security/no-domain-cookie.yml",
  "tests/security/no-server-console-test.yml",
  "tests/security/no-domain-cookie-test.yml",
  "tests/security/__snapshots__/no-server-console-snapshot.yml",
  "tests/security/__snapshots__/no-domain-cookie-snapshot.yml",
  "deploy/package-release.ts",
] as const;

const publicRootFiles = new Set<string>([
  ...REQUIRED_PUBLIC_FILES,
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
  "rules/security/",
  "tests/security/",
  ".github/workflows/",
  "src/",
  "shared/",
  "server/",
  "scripts/",
  "public/",
  "source/assets/",
  "source/poem/",
];

function isSafeRelativePath(path: string): boolean {
  const parts = path.split("/");
  return (
    !path.includes("\\") &&
    !parts.some((part) =>
      ["", ".", "..", ".git", "node_modules"].includes(part),
    )
  );
}

/** Require both the reviewed location and the original bytes for an exception. */
export function assertReferencePublication(
  path: string,
  sha256: string,
  format: "source" | "release",
): void {
  if (!isSafeRelativePath(path))
    throw new Error(`Unsafe publication path: ${path}`);
  const sourcePath =
    format === "release" && path.startsWith("dist/")
      ? `public/${path.slice("dist/".length)}`
      : format === "source"
        ? path
        : undefined;
  const approvedHash = sourcePath
    ? APPROVED_REFERENCE_PUBLICATIONS[sourcePath]
    : undefined;
  if (approvedHash) {
    if (sha256 !== approvedHash)
      throw new Error(`Approved reference bytes changed: ${path}`);
    return;
  }
  if (
    path.startsWith("source/reference/") ||
    path.includes("/source/reference/") ||
    path.split("/").some((part) => PRIVATE_REFERENCE_NAMES.has(part)) ||
    approvedReferenceHashes.has(sha256)
  )
    throw new Error(`Unapproved reference publication: ${path}`);
}

export function isPublicSourcePath(path: string): boolean {
  const parts = path.split("/");
  if (
    !isSafeRelativePath(path) ||
    (parts.some((part) => PRIVATE_REFERENCE_NAMES.has(part)) &&
      !Object.hasOwn(APPROVED_REFERENCE_PUBLICATIONS, path)) ||
    parts.some((part) => part.startsWith(".env") && path !== ".env.example")
  )
    return false;
  return (
    publicRootFiles.has(path) ||
    publicPrefixes.some((prefix) => path.startsWith(prefix))
  );
}
