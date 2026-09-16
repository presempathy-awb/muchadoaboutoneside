# Project decisions

These decisions describe the current public project contract. Proposals are identified separately and become operational decisions only after review and implementation evidence.

| Decision | Current contract | Reason |
| --- | --- | --- |
| Runtime and UI | Bun, Elysia, Vite/React, TypeScript 7 and Biome; pinned direct dependencies and Bun lockfile | Preserve the working stack and reproducible installs |
| Source ownership | Private Gitea archive is canonical; GitHub receives sanitized independent snapshots | Share reusable source while protecting private references and archive history |
| Reuse | Project-authored work is MIT OR Apache-2.0; retain third-party licenses | Permit artistic and commercial adaptation with clear notices |
| Credits | iani schrodinger for 3D design; Claude and ChatGPT for poem/website assistance | Preserve attribution across the website and source |
| Anonymous use | Existing studio works without an account; local drafts are default | Keep access simple and avoid silent shared editing |
| Shared drafts | File-backed relay only when `COLLAB_DIR` is explicitly enabled | Make today's publicly editable shared behavior an operator choice |
| Dimensions | Original geometry in inches/Y-up; separate maquette in millimeters/Z-up | Prevent accidental unit/axis and shipping-envelope confusion |
| Fabrication evidence | Digital studies remain distinct from physical fit and material approval | Geometry and hash tests cannot establish installation feasibility |
| Instructions | Explicit managed outputs from `agents.toml`, verified for deterministic generation | Keep agent guidance aligned and preserve project boundaries |
| Containers | Development/CI distribution path; hosted release uses its existing slim-release workflow | Provide reproducible local setup without an incidental production migration |

## Proposals requiring later review

Voluntary verified-email accounts, organizations/projects, deny-by-default relationship permissions, versioned files, entitled project hosts, telemetry, and inventory/procurement integration are [roadmap](../ROADMAP.md) proposals. Authorization semantics, URL allocation, private reporting contacts, retention and deletion policy, published integration contracts, and operational recovery need explicit evidence before dependent features ship.

## Recording changes

For a consequential change, record the selected behavior, rejected tradeoffs when useful, scope, review, and executable evidence in its pull request. Update this file when the public contract changes. Keep private infrastructure inventories and internal security review packets out of public export.
