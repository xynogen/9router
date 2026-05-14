# syntax=docker/dockerfile:1.7
ARG NODE_IMAGE=node:22-alpine

# ---------- Base ----------
FROM ${NODE_IMAGE} AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---------- Dependencies (cached layer) ----------
FROM base AS deps
RUN --mount=type=cache,target=/var/cache/apk \
    apk add python3 make g++ linux-headers

# Copy only files needed for dependency resolution
# This layer only invalidates when package.json/lock changes
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit --no-fund

# ---------- Builder ----------
FROM deps AS builder
COPY . ./
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# ---------- Runner ----------
FROM base AS runner

LABEL org.opencontainers.image.title="9router"

ENV NODE_ENV=production \
    PORT=20128 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/app/data

# Install runtime deps in single layer (cached when packages don't change)
RUN --mount=type=cache,target=/var/cache/apk \
    apk add su-exec && \
    mkdir -p /app/data /app/data-home && \
    chown -R node:node /app/data /app/data-home && \
    ln -sf /app/data-home /root/.9router 2>/dev/null || true

# Copy entrypoint as static file (better layer caching than printf)
COPY --chmod=755 docker/entrypoint.sh /entrypoint.sh

# Copy build artifacts (ordered: least → most frequently changing)
COPY --from=builder /app/node_modules/node-forge ./node_modules/node-forge
COPY --from=builder /app/node_modules/next ./node_modules/next
COPY --from=builder /app/open-sse ./open-sse
COPY --from=builder /app/src/mitm ./src/mitm
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 20128

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
