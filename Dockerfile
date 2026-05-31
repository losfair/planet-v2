# syntax=docker/dockerfile:1

# Planet v2 — Bun + SvelteKit (adapter-node) + bun:sqlite.
# The server is run with Bun (not Node) because it imports the `bun:sqlite`
# built-in, which the SvelteKit build leaves as an external import.

# ---------- build ----------
FROM oven/bun:1 AS build
WORKDIR /app
# Install all dependencies (including dev) needed to build.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# ---------- production dependencies ----------
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
# Only runtime dependencies (adapter-node externalizes them, so they must
# be present at runtime).
RUN bun install --frozen-lockfile --production

# ---------- runtime ----------
FROM oven/bun:1-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_PATH=/app/data/planet.sqlite \
    BODY_SIZE_LIMIT=64M \
    # adapter-node uses ORIGIN for CSRF on form posts (login/signup). It MUST
    # match the public URL — override when deploying to a real domain.
    ORIGIN=http://localhost:3000

COPY --from=deps  --chown=bun:bun /app/node_modules ./node_modules
COPY --from=build --chown=bun:bun /app/build        ./build
COPY --from=build --chown=bun:bun /app/package.json ./package.json

# Persistent state: SQLite database + local image fallback (data/img).
RUN mkdir -p /app/data && chown bun:bun /app/data
VOLUME ["/app/data"]

USER bun
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "./build/index.js"]
