# Security

The current studio has no account or project-permission system. Browser-local poem drafts are the default. If a maintainer enables `COLLAB_DIR`, anyone who can reach that deployment can edit its shared drafts. Do not enable that relay for confidential work or treat its room names as authorization.

## Reporting a concern

A private security-reporting contact has not yet been established for this project. Contact a maintainer through an existing project channel to arrange a private report. A public issue may request a private reporting route without including exploit details, private files, credentials, or personal data. Do not upload those materials to a public issue or pull request.

No response-time promise or supported-version policy is established yet. Maintainers should triage reports against the current deployed release and public source, agree on a private channel, and record a tested fix and disclosure decision.

## Maintainer checks

Use the security commands in the [development runbook](docs/runbook/development.md). Review scanner findings rather than assuming a clean scan proves the application secure. Keep tool/action versions pinned, dependency installation frozen, and public publication confined to the reviewed exporter selection.

Do not commit credentials or real recipient details. Keep private reference photography out of public build contexts, exported source, and release packages. Inspect the destination remote before publishing. Preserve unknown-file rejection, archival HTML attachment headers, production HTTP smoke coverage, and the default-disabled shared relay.

Future accounts, access-controlled files, claimed project hosts, and procurement require their own authorization and recovery tests before activation; the [roadmap](ROADMAP.md) describes their gates.

See the [incident response runbook](docs/runbook/incident.md) for evidence, containment, verification and communication guidance.
