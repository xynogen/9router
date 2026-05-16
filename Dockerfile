# syntax=docker/dockerfile:1.7
ARG NODE_IMAGE=node:22-slim
FROM ${NODE_IMAGE} AS base
WORKDIR /app

FROM base AS builder

# Build deps for native modules (better-sqlite3, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Match upstream build strategy: no lockfile in builder, resolve fresh each build.
COPY package.json ./
RUN --mount=type=cache,target=/root/.npm \
  npm install --no-audit

COPY . ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN rm -rf .next && npm run build

FROM ${NODE_IMAGE} AS runner
WORKDIR /app

LABEL org.opencontainers.image.title="9router"

ENV NODE_ENV=production
ENV PORT=20128
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATA_DIR=/app/data

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/open-sse ./open-sse
# Next file tracing can omit sibling files; MITM runs server.js as a separate process.
COPY --from=builder /app/src/mitm ./src/mitm
# Standalone node_modules may omit deps only required by the MITM child process.
COPY --from=builder /app/node_modules/node-forge ./node_modules/node-forge
# Ensure `next` is available at runtime in case tracing did not include it.
COPY --from=builder /app/node_modules/next ./node_modules/next

# gosu = drop-in for su-exec on Debian; create non-root user (node user not in slim image)
RUN apt-get update && apt-get install -y --no-install-recommends gosu \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd -r node -g 1000 && useradd -r -u 1000 -g node node \
  && mkdir -p /app/data /app/data-home \
  && chown -R node:node /app/data /app/data-home \
  && ln -sf /app/data-home /root/.9router 2>/dev/null || true \
  && printf '#!/bin/sh\nchown -R node:node /app/data /app/data-home 2>/dev/null\nexec gosu node "$@"\n' > /entrypoint.sh \
  && chmod +x /entrypoint.sh

EXPOSE 20128

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
