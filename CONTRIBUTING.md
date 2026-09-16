# Contributing

Read the [README](README.md), [project intent](INTENT.md), and [development runbook](docs/runbook/development.md). Public contributions can use the [GitHub repository](https://github.com/presempathy-awb/muchadoaboutoneside); maintainers review canonical archive changes on [Gitea](https://git.telpher.stream/awb/muchadoaboutoneside), which currently requires access.

Follow the [community conduct policy](CODE_OF_CONDUCT.md) in project discussions.

## A reviewable change

1. Use a separate branch or jj change and inspect the remote before pushing.
2. Keep the change focused. Explain the user-facing result and any relevant dimensional, privacy, or fabrication effect.
3. Run `bun run check`, `bun run build`, and `bun run smoke`. Run the repository setup/security checks described in the runbook when changing tooling or publication.
4. Include fresh verification evidence and any gaps in the pull request. Identify a study or proposal as such.

Preserve original files in `source/assets/` byte for byte. Derive displayed dimensions from the manifests; distinguish source inches/Y-up from print millimeters/Z-up and from finished package measurements. Keep exact canonical wording in marking masters and keep screen typography separate from physical templates. Physical fit and structural claims require physical evidence.

Generated instructions are managed from `agents.toml`; follow the [instruction generation runbook](docs/runbook/instructions.md) and review the resulting diff. Generated shadcn components in `src/components/ui/` are registry output; put new product components elsewhere.

Do not commit private reference images, credentials, recipient details, browser captures, or private archive history to public source. The public exporter is the publication boundary, and its allowlist needs deliberate review when adding files. A private canonical branch must never be pushed wholesale to GitHub.

Browser or desktop automation follows the maintainer's explicit scoped consent instructions. Ordinary repository checks and HTTP smoke tests are suitable for routine verification.

## License and credit

Unless you explicitly state otherwise, contributions intentionally submitted for inclusion are licensed **MIT OR Apache-2.0**, without additional terms. Preserve the [reuse guidance](REUSE.md), [third-party notices](THIRD_PARTY_NOTICES.md), iani's 3D-design credit, and the Claude/ChatGPT assistance credit. Do not represent substitute-font output as the artist's hand lettering.
