# Deployment

Two image variants are built by the **Build Docker image** workflow (GitHub → Actions → *Run workflow*,
manual only). Tags: `ghcr.io/b21-agency/gramps-ui:{latest,<sha>,0.x}` and `…:{latest,<sha>,0.x}-proxy`.

## A) Drop-in (recommended)

The official Gramps Web image with this UI in `/app/static`. In the existing compose/hosting stack change
the image of `grampsweb` **and** `grampsweb_celery` to `ghcr.io/b21-agency/gramps-ui:latest` and redeploy.
Nothing else changes (same env, volumes, ports). Verified locally by swapping the image in the official
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
Domains then: `gramps.example.org` → `ui:80`, `gramps-classic.example.org` → `grampsweb:5000`.
Health check: `GET /healthz` → `ok`.

## Notes

- The repo is private, so the images are private: the server needs a `ghcr.io` registry login
  (username + a token with `read:packages`). Make the package public to drop that requirement.
- Optional automatic deploy: tick *deploy* when running the workflow; needs repository secrets
  `DEPLOY_WEBHOOK` and `DEPLOY_TOKEN`.
- Password-reset and e-mail-confirmation links point to pages the API serves itself
  (`/api/users/-/password/reset/?jwt=…`), so they work with both variants.
