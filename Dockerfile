# syntax=docker/dockerfile:1

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ---- serve ----
FROM nginx:1.27-alpine
# Where the Gramps Web API container is reachable (same hosting compose network by default).
ENV GRAMPSWEB_UPSTREAM=http://grampsweb:5000 \
    CLIENT_MAX_BODY_SIZE=1g
COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz || exit 1
