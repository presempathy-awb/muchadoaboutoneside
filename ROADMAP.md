# Roadmap

This roadmap separates working studio features from proposed platform work. See [project intent](INTENT.md), [recorded decisions](docs/decisions.md), and [development guidance](docs/runbook/development.md).

## Available studio

- Original model viewer, assembly map, source downloads and manifest-derived dimensions.
- Canonical and extended poem views, browser-local drafts, and an optional explicitly enabled file-backed shared relay.
- Large-scale conceptual marking studies and a separate 180 mm print/foil system with digital provenance checks.
- Making, aluminum-on-wood, packing, and CoLab iani handoff guidance.
- Six-foot indoor display options and a proposed full-sculpture projection/score plan.

Physical fabrication tests, final hand-lettering, display engineering, projector surveys, production media, and the score remain outstanding. Existing tests do not approve these physical tasks.

## Phase 0 — reproducible development and public source

**Implemented and locally verified 2026-09-16.** The Phase 0 work establishes generated agent instructions, pinned development/security tools, runnable checks, container development and CI setup, contributor documents, and a complete sanitized public snapshot. Completion requires fresh check/build/HTTP smoke evidence, deterministic instruction checks, security checks, and a credential-free public install/build/setup path. Container validation must prove startup and health with the documented configuration.

These repository foundations do not activate account, database, storage, telemetry, or hostname infrastructure. Read the commands and validation boundaries in the [development runbook](docs/runbook/development.md).

## Later phases — proposed, not available

| Phase | Intended capability | Evidence before release |
| --- | --- | --- |
| 1 | Isolated service prerequisites and operational readiness | Provisioning review, least privilege, restore and rollback proof |
| 2 | Server foundation: validated configuration, migrations, identity/session primitives and telemetry | Boot/config tests, migration/rollback proof, telemetry privacy and outage checks |
| 3 | Users, organizations, projects and sharing | Verified-email enrollment, denial cases, membership, tenant isolation and independent authorization review |
| 4 | Versioned sketches, models and personal files | Concurrent uploads, immutable-byte checks, authorization and partial-failure recovery |
| 5 | Entitled project URLs | Host allocation/reassignment, routing, login handoff, session and cache isolation |
| 6 | Inventory and procurement integration | Published consumer contract, delegated authority, workspace isolation and retry proof |
| 7 | Hardening and launch | Accessibility, performance, restore/rollback, privacy and operations release gates |

Phase order can change through reviewed decisions. Detailed acceptance cases are design requirements until the corresponding executable validators exist and pass; current studio tests do not prove future platform features.

## Artistic and fabrication work

Measure the actual prepared wood and overlapping scales before revising large fabrication patterns. Sample the two leading six-foot material systems, reproof the lettering, and resolve the base and transport design. Survey the installation for projector coverage and contrast; produce original Enceladus/chimera media and compose the score before assigning cue timings. Keep score playback and ignition authority separate.
