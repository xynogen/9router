# syntax=docker/dockerfile:1.7
ARG NODE_IMAGE=node:22.23.4-slim
FROM ${NODE_IMAGE} AS base
WORKDIR /app

FROM base AS builder

# Build deps for native modules (better-sqlite3, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip make g++ \
  && pip3 install --no-cache-dir --break-system-packages fonttools brotli \
  && rm -rf /var/lib/apt/lists/*

# Match upstream build strategy: no lockfile in builder, resolve fresh each build.
COPY package.json ./
RUN --mount=type=cache,target=/root/.npm \
  npm install --no-audit

COPY . ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN rm -rf .next && npm run build

# https://github.com/decolua/9router/issues/5245
# wreq-js and playwright-core are lazy runtime dependencies (loaded by
# lazyRuntime.js via createRequire). Next standalone tracing does not include
# them, so OpenCode Free fails with HTTP 502 ("resolve is undefined").
# Install them (with their native bindings/transitive deps) in an isolated dir
# so the runner stage can copy them into /app/node_modules.
RUN --mount=type=cache,target=/root/.npm \
    mkdir -p /opt/lazy-runtime && cd /opt/lazy-runtime && \
    npm init -y >/dev/null && \
    npm install --no-save \
      --registry="${NPM_REGISTRY}" \
      --fetch-retries=5 \
      --fetch-retry-factor=2 \
      --fetch-retry-mintimeout=10000 \
      --fetch-retry-maxtimeout=120000 \
      --fetch-timeout=300000 \
      wreq-js playwright-core

FROM ${NODE_IMAGE} AS runner
WORKDIR /app

LABEL org.opencontainers.image.title="9router"

ENV NODE_ENV=production
ENV PORT=20128
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATA_DIR=/app/data

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/custom-server.js ./custom-server.js
COPY --from=builder /app/open-sse ./open-sse
# Next file tracing can omit sibling files; MITM runs server.js as a separate process.
COPY --from=builder /app/src/mitm ./src/mitm
# Standalone node_modules may omit deps only required by the MITM child process.
COPY --from=builder /app/node_modules/node-forge ./node_modules/node-forge
# Ensure `next` is available at runtime in case tracing did not include it.
COPY --from=builder /app/node_modules/next ./node_modules/next
# sql.js loads dist/sql-wasm.wasm by path at runtime; tracing only follows JS imports,
# so the last-resort DB driver would abort with ENOENT on the missing binary.
COPY --from=builder /app/node_modules/sql.js ./node_modules/sql.js
# node-machine-id is createRequire-loaded at runtime; tracing omits it.
COPY --from=builder /app/node_modules/node-machine-id ./node_modules/node-machine-id
# wreq-js + playwright-core (and deps) are lazy-loaded at runtime and omitted by
# tracing. See https://github.com/decolua/9router/issues/5245
COPY --from=builder /opt/lazy-runtime/node_modules/. ./node_modules/

# ffmpeg: Codex STT transcoding. gosu = drop-in for su-exec on Debian; create non-root user (node user not in slim image)
RUN apt-get update && apt-get install -y --no-install-recommends gosu ffmpeg \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd -r node -g 1000 && useradd -r -u 1000 -g node node \
  && mkdir -p /app/data /app/data-home \
  && chown -R node:node /app/data /app/data-home \
  && ln -sf /app/data-home /root/.9router 2>/dev/null || true \
  && printf '#!/bin/sh\n[ -z "$(ls -A /app/data 2>/dev/null)" ] || chown -R node:node /app/data 2>/dev/null\n[ -z "$(ls -A /app/data-home 2>/dev/null)" ] || chown -R node:node /app/data-home 2>/dev/null\nexec gosu node "$@"\n' > /entrypoint.sh \
  && chmod +x /entrypoint.sh

EXPOSE 20128

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "custom-server.js"]
