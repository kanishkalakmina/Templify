# syntax=docker/dockerfile:1
#
# Templify — self-hosted report server.
#
# One image, one port, one volume: the editor UI and the render API are served
# together, and templates persist to /data. Nothing else to configure.
#
#   docker build -t templify/report-server .
#   docker run -d -p 8080:8080 -v templify:/data templify/report-server

# ---------------------------------------------------------------- build stage
FROM node:22-bookworm-slim AS build

WORKDIR /build

# Chromium is a runtime concern; skip any browser download during install.
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig*.json vite.config.ts tailwind.config.js postcss.config.js index.html ./
COPY scripts ./scripts
COPY src ./src
COPY server ./server

# Frontend -> dist/, server bundle -> dist-server/
RUN npm run build && npm run build:server

# Production dependency tree only.
RUN npm prune --omit=dev

# -------------------------------------------------------------- runtime stage
FROM node:22-bookworm-slim AS runtime

# Chromium for PDF rendering. The document fonts are NOT installed here — they
# are embedded per document from pinned npm packages (see server/fonts.ts), so
# rendering needs no fontconfig and is identical on any host. DejaVu and
# Liberation remain only as a last-resort fallback for unlisted families.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-dejavu-core \
      fonts-liberation \
      ca-certificates \
      tini \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    TEMPLIFY_DATA_DIR=/data \
    TEMPLIFY_STATIC_DIR=/app/public \
    PORT=8080

WORKDIR /app

COPY --from=build /build/node_modules ./node_modules
COPY --from=build /build/dist-server ./dist-server
COPY --from=build /build/dist ./public
COPY package.json ./

# Run unprivileged. The node image ships a `node` user; give it the volume.
RUN mkdir -p /data && chown -R node:node /data /app
USER node

VOLUME ["/data"]
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# tini reaps the zombie processes Chromium leaves behind.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist-server/index.cjs"]
