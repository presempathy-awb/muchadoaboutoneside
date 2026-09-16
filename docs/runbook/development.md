# Development runbook

The [README](../../README.md) describes studio features and fabrication provenance. This runbook covers repository setup and verification; it does not provision production services.

## Local application

Use the versions in `mise.toml`. With mise installed, `mise install` installs the declared tools; `mise exec -- <command>` uses them. Existing compatible runtimes can run the Bun commands directly.

```sh
bun install --frozen-lockfile
bun run dev
```

Vite listens on `127.0.0.1:5173` and proxies `/api` to Elysia at `127.0.0.1:3001`. Occupied development ports cause startup to fail. Ctrl-C stops both processes.

```sh
bun run check
bun run build
bun run smoke
bun run start
```

`start` serves the build and API together on loopback port 3001. `HOST` and `PORT` override server defaults. `/api/health` is the HTTP health endpoint. `smoke` starts a temporary production server on an ephemeral loopback port and checks routes, downloads, private-file rejection and API behavior.

## Repository recipes

The `justfile` supplies `setup`, `dev`, `check`, `build`, `smoke`, `security-check`, `toolchain-check`, `hygiene-check`, and `release-package`. Use `just --list` to inspect recipes and their arguments. `setup` installs frozen application dependencies; it does not install global Git hooks or activate services. The Bun scripts remain usable directly.

```sh
just setup
just check
just build
just smoke
just security-check
just toolchain-check
just hygiene-check
just release-package /tmp/muchado-releases
```

`release-package` requires an output-directory argument and packages a reviewed clean commit; it does not publish or deploy. Security checks require the declared scanner tools and may download their vulnerability databases. Read failures and review findings; do not suppress failures to obtain a green gate. Hook configuration is opt-in: inspect `lefthook.yml` before explicitly installing hooks in your own checkout.

## Agent instructions

`agents.toml` is the source for explicitly managed `AGENTS.md` and `CLAUDE.md`. Public contributors can generate and verify this project's literal supported subset using Bun alone:

```sh
bun run generate:instructions --check
bun run generate:instructions --write
bun run verify:instructions
```

Generation checks without writing by default. `just sync-agents` deliberately regenerates the two managed outputs. Review their diff after editing the two canonical literal rule bodies. The [instruction runbook](instructions.md) explains the supported subset, validation, targeted tests, and the actual Coroidinator compatibility oracle. Full Coroidinator distribution remains unavailable publicly; public project generation and checks require no private tool or credentials.

## Generated and public files

Preserve original asset bytes. Regenerate lettering only after deliberate source changes. `bun run check` checks generated inscription and guide HTML without starting a browser; the committed PDF has a separate rendering path described in the README. Browser/PDF automation follows scoped consent requirements.

For public publication, use a clean reviewed commit:

```sh
bun run export:public --output /tmp/muchado-public-snapshot
```

The destination must be a new directory outside the canonical checkout. The exporter copies a reviewed allowlist, writes `PUBLIC_SNAPSHOT.json`, and omits private history. In that fresh snapshot, repeat frozen install, checks, build, smoke and setup/security verification before updating the independent public repository. New documentation links and managed instruction targets must resolve there without private credentials or sibling repositories.

## Container setup

With a working Docker daemon and Compose plugin:

```sh
docker compose up --build --wait
curl --fail http://127.0.0.1:3001/api/health
docker compose down
```

`MUCHADO_PORT=3002 docker compose up --build --wait` selects another host port; check that port's health URL. The container serves the production build and API, runs as a non-root user with a read-only filesystem, and exposes its host port on loopback. `bun scripts/container-smoke.ts` builds and checks a disposable container and cleans it up. See [the container runbook](containers.md) for the full contract and devcontainer setup.

Database, file-storage and OIDC dependency profiles are deferred: today's application has no consumers, adapters or migrations for them. Container startup does not prove those future services or a devcontainer editor session works. Opening desktop container/editor applications follows the scoped consent instructions.

## Troubleshooting and limits

If ports are occupied, stop the process you own or change the production server port deliberately. A health response does not prove WebGL rendering or a physical fabrication fit. If a scanner or container runtime is unavailable, record that validation gap and use CI to obtain fresh evidence before claiming the relevant gate passed. Do not open or automate logged-in browser/desktop apps as an incidental setup step.

Live shared editing remains off unless `COLLAB_DIR` names a writable directory. When deliberately enabled it is publicly editable, file-backed storage; it is not the proposed account/project authorization system. Keep its data outside releases and establish backup/retention procedures before use.
