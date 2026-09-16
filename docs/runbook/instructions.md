# Generated project instructions

`agents.toml` is the canonical instruction source. Its supported Coroidinator
schema is `agents.core.v1`; its two explicit `managed-target.v1` declarations
write `AGENTS.md` and `CLAUDE.md`. Both assistants receive the complete same
project rules. No Cursor target is declared.

## Public generation and verification

After installing the pinned Bun toolchain and dependencies, run:

```sh
bun run generate:instructions --check
bun run generate:instructions --write
bun run verify:instructions
bun test scripts/verify-instructions.test.ts
```

The project-owned literal generator and verifier use only Bun and repository
files. Their shared validation accepts exactly the two declared outputs with
literal content, the standard generated banner, and one final newline. It
rejects unsupported schemas/tables, extra managed targets, changed output paths,
differing assistant rules, and interpolation. This is a deliberately limited
project implementation; it does not implement the general Coroidinator schema,
layer resolution, templates, or reconciliation engine.

Generation checks without writing by default; `--check` is explicit. `--write`
validates every source target and rejects existing non-regular output files
before writing either declared output. It writes only `AGENTS.md` and
`CLAUDE.md`. Public contributors can edit both canonical literal rule bodies,
regenerate, and review the source and outputs together. `just sync-agents` is
the convenient project generation command.

This verification is part of `bun run check`. It requires no private paths,
registry credentials, or access to the canonical private forge.

## Maintainer regeneration

The complete supported schema can additionally be validated and rendered with
the actual Coroidinator CLI. The Phase 0 compatibility proof used source
revision `59d3e80090a953894564f4d173da06dedb8c7395`. In an authorized checkout of
that source, with its declared Go toolchain available, build it as follows:

```sh
git checkout --detach 59d3e80090a953894564f4d173da06dedb8c7395
go build -o ./coroidinator ./cmd/coroidinator
./coroidinator version --json
```

Make the resulting binary available as `coroidinator` on your command path.
From this project's root, validate and preview before replacing declared files:

```sh
coroidinator validate --strict-ci --json agents.toml
coroidinator render --strict-ci --json agents.toml
coroidinator sync --strict-ci --json agents.toml
coroidinator sync --strict-ci --execute --force agents.toml
coroidinator check --strict-ci --json agents.toml
bun run verify:instructions
```

`--strict-ci` ignores user configuration layers. `--force` explicitly replaces
drifted declared targets after the preview; schema validation and path confinement
still apply. Coroidinator may create its own local reconciliation backups.
Review the two generated files and the source change together.

As of the Phase 0 review, Coroidinator's GitHub mirror is private and offers no
releases. This project does not distribute its source or binary. Public
contributors can generate and verify this project's literal subset with Bun.
They cannot yet independently install the full Coroidinator schema validator
and general renderer solely from publicly available dependencies.
The older installed CLI used during inspection lacked `--strict-ci`; use the
source revision above rather than assuming any local binary is compatible.

## Recorded proof and remaining gate

The initial replacement was validated and rendered in a temporary directory
with the actual CLI before the project's instruction files were replaced. Both
outputs retain the full prior instruction body. A second render/sync produced
identical bytes, and an official drift check reported two current targets with
no missing or drifted files. A temporary source-rule edit changed exactly the
two declared outputs and preserved an unmanaged sentinel file.

These are local maintainer proofs. The public Bun tests prove drift detection, two identical generations,
source-rule edits affecting only the intended targets, validation before
writing, and generation/verification without private dependencies. The actual
Coroidinator renderer was also used as a compatibility oracle: both original
and changed literal fixtures produced byte-identical expected outputs.

Public generation of this project is reproducible. Public installation of the
full Coroidinator tool remains unavailable; that separate distribution
limitation does not prevent the project-owned literal generator from running.
Changes that require interpolation, extra targets, or general schema features
must update this contract and its compatibility proofs first.
