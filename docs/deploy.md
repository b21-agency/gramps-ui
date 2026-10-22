# Deployment

The **Build Docker image** workflow (GitHub → Actions → *Run workflow*, manual only) builds two variants
and pushes them to GitHub Container Registry: `ghcr.io/b21-agency/gramps-ui:{latest,<sha>,<branch>}` and
`…:{latest,<sha>,<branch>}-proxy`. Deploying them is up to you; the workflow has no deployment step.

## A) Drop-in (recommended)

The official Gramps Web image with this UI in `/app/static`. In an existing Gramps Web compose stack change
the image of `grampsweb` **and** `grampsweb_celery` to `ghcr.io/b21-agency/gramps-ui:latest` and redeploy.
Nothing else changes (same env, volumes, ports). Verified by swapping the image in the official
docker-compose: login, data, photos, editing, search and a Celery report job all work.

The workflow input `grampsweb_version` pins the Gramps Web base image (default `latest`).

## B) Proxy variant (classic UI side by side)

`ghcr.io/b21-agency/gramps-ui:latest-proxy`: nginx serving the UI and proxying `/api/` to
`GRAMPSWEB_UPSTREAM` (default `http://grampsweb:5000`); `CLIENT_MAX_BODY_SIZE` (default `1g`).

```yaml
  ui:
    image: ghcr.io/b21-agency/gramps-ui:latest-proxy
    restart: unless-stopped
    depends_on: [grampsweb]
```

Route your UI domain to `ui:80` and keep the classic UI on `grampsweb:5000` if you still want it.
Health check: `GET /healthz` → `ok`.

## Notes

- While the package is private, servers need a `ghcr.io` registry login (token with `read:packages`).
- Password-reset and e-mail-confirmation links point to pages the API serves itself
  (`/api/users/-/password/reset/?jwt=…`), so they work with both variants.
