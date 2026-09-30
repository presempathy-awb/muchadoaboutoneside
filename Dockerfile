FROM oven/bun:1.4.2@sha256:9114c058aeae42162ee16dd5084b95fe9473970bb6bcb5b232ab1630f0546895 AS build
WORKDIR /app
COPY package.json bun.lock .npmrc ./
# The registry token is a BuildKit secret, not a layer. CI passes the Actions
# token; a local build passes the same npm token used for `bun install`.
RUN --mount=type=secret,id=npm_token,required=true \
    sh -c 'printf "//git.telpher.stream/api/packages/awb/npm/:_authToken=%s\n" "$(cat /run/secrets/npm_token)" >> .npmrc && bun install --frozen-lockfile && sed -i "/_authToken/d" .npmrc'
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY shared ./shared
COPY server ./server
COPY public ./public
COPY source/assets ./source/assets
COPY source/poem ./source/poem
COPY scripts/verify-typography-bundle.ts ./scripts/verify-typography-bundle.ts
RUN bun run build && bun build server/index.ts --target=bun --outdir=/bundle/server --define 'process.env.NODE_ENV="production"'

FROM oven/bun:1.4.2-distroless@sha256:1a0c31c7c5f9d193aedf60fe1cebdeb76ac8f6e29f24be8dd8cbd6df72df26ec AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
COPY --from=build --chown=1000:1000 /bundle/server ./server
COPY --from=build --chown=1000:1000 /app/dist ./dist
COPY --from=build --chown=1000:1000 /app/source/assets ./source/assets
USER 1000:1000
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 CMD ["/usr/local/bin/bun", "-e", "const r=await fetch('http://127.0.0.1:3001/api/health'); if(!r.ok || (await r.json()).status!=='ok') process.exit(1)"]
ENTRYPOINT ["/usr/local/bin/bun", "server/index.js"]
