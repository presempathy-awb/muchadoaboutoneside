# Local setup never installs hooks or starts infrastructure implicitly.
default:
    @just --list

setup:
    bun install --frozen-lockfile

dev:
    bun run dev

check:
    bun run check

build:
    bun run build

smoke:
    bun run smoke

security-check:
    trivy fs --config trivy.yaml .
    gitleaks dir --config .gitleaks.toml --redact --no-banner .
    ast-grep scan
    ast-grep test
    bun scripts/security-validation.ts

toolchain-check:
    bun scripts/toolchain-check.ts

hygiene-check:
    bun scripts/verify-publication.ts
    bun run verify:instructions

release-package output:
    bun deploy/package-release.ts --output {{quote(output)}}

export-public output:
    bun run export:public --output {{quote(output)}}

container-smoke:
    bun scripts/container-smoke.ts

# Optional, explicit checkout-local hook installation.
hooks-install:
    lefthook install

# Project literal renderer; no private tool required.
sync-agents:
    bun run generate:instructions --write
