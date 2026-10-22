# syntax=docker/dockerfile:1

# Two variants of the same UI:
#   default ("drop-in"): the official Gramps Web image with this UI in place of the classic one.
#                        Swap `image:` of the grampsweb (and grampsweb_celery) service — nothing else.
#   --target proxy:      a small nginx image that serves the UI and proxies /api/ to an existing
#                        Gramps Web container (keeps the classic UI running side by side).

ARG GRAMPSWEB_VERSION=latest

# ---- build the UI ----
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ---- variant: nginx proxy next to an existing Gramps Web ----
FROM nginx:1.27-alpine AS proxy
ENV GRAMPSWEB_UPSTREAM=http://grampsweb:5000 \
    CLIENT_MAX_BODY_SIZE=1g
COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz || exit 1

# ---- variant (default): drop-in replacement for the official Gramps Web image ----
FROM ghcr.io/gramps-project/grampsweb:${GRAMPSWEB_VERSION} AS dropin
# Gramps Web serves whatever is in GRAMPSWEB_STATIC_PATH (/app/static) as its frontend,
# with SPA fallback for client-side routes. Replace the classic UI with this one.
RUN rm -rf /app/static && mkdir -p /app/static
COPY --from=build /app/dist /app/static
LABEL org.opencontainers.image.title="Gramps Web with the Family Archive UI" \
      org.opencontainers.image.description="Official Gramps Web (API, worker, everything) with a modern React frontend" \
      org.opencontainers.image.source="https://github.com/b21-agency/gramps-ui" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later"
