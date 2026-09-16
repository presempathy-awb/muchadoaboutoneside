# Local containers

The runtime image serves the existing anonymous sculpture site and API. It bundles the server and frontend and includes only the four original model downloads and their manifest. Bun 1.4.2 image manifests are pinned by digest for both supported architectures. The runtime uses UID/GID 1000, a read-only filesystem, dropped Linux capabilities, and no writable volume. Live collaborative drafts remain disabled because `COLLAB_DIR` is absent.

```sh
docker compose up --build --wait
curl --fail http://127.0.0.1:3001/api/health
docker compose down
```

Set `MUCHADO_PORT=3002` before the first command if port 3001 is already in use. Compose publishes only on host loopback. Run the disposable build, health, download, privacy, and runtime hardening checks with:

```sh
bun scripts/container-smoke.ts
```

The verifier creates a uniquely named container and image, publishes an ephemeral loopback port, and removes only those resources in a `finally` block. It requires an already running Docker-compatible daemon; it never starts desktop applications. Docker builds install the public npm dependencies with the committed frozen Bun lockfile.

The `.dockerignore` starts by excluding everything and admits only build inputs. Private reference files, archived conversation data, infrastructure documents, Git/jj history, and environment files are excluded from the build context. Do not add broad `COPY . .` or private registry credentials.

The Gitea container job checks an already built image with `bun scripts/container-ci-smoke.ts --image <image>`. Its HTTP checks run inside the target container so CI does not need access to the Docker host's loopback interface. It verifies the host binding through Docker inspection and removes its uniquely named container; image ownership stays with the caller.

## Development container

The VS Code Dev Containers definition pins the tested Bookworm image manifest, mise 2026.9.9, and the mise feature OCI lockfile emitted by `mise generate devcontainer`. Creating it installs the versions in `mise.toml`, runs `just setup`, and verifies the toolchain. Opening the devcontainer is an explicit developer action and mounts the selected checkout; use a sanitized public checkout if private source is unnecessary. It does not mount the host Docker socket or start services. `just dev` binds loopback inside the container; VS Code forwards the API and frontend ports.

## Future service profiles

Postgres 18, SeaweedFS, LakeFS, and mock OIDC services are deferred until the corresponding database, file, and identity adapters and integration tests exist. The current application does not consume them. Phase 0's original proposed `dev`/`ci` infrastructure profiles would create untested services and imply a working platform integration. The app-only Compose setup provides the current verified runtime; future integration profiles need isolated credentials, actual migrations, readiness tests, and teardown proof. This local setup does not change the existing slim-release production deployment.
