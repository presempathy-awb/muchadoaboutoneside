// A content fingerprint is retained so both release formats reject the private
// reference even if it is accidentally copied under another filename.
export const PRIVATE_REFERENCE_SHA256 =
  "904edf635f229cf4bcc98efe61849cf3e113e0efa9eae040a126b3de73e94625";

export const PRIVATE_REFERENCE_NAMES = new Set([
  "PXL_20260914_180707651.RAW-01.jpg",
  "jill-calligraphy.jpg",
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
