# Deployment (hosting)

The UI image only contains the static app and an nginx that proxies `/api/` to the existing
Gramps Web container. Gramps Web itself (API, Celery, Redis, data volumes) stays as it is.

## Image

Built by the **Build Docker image** workflow (GitHub → Actions → *Run workflow*, manual only):
`ghcr.io/b21-agency/gramps-ui:latest` and `:<commit sha>`. Tick *deploy* to call the hosting
webhook afterwards (secrets `DEPLOY_WEBHOOK`, `DEPLOY_TOKEN`).

The repo is private, so the image is private: hosting needs a registry login for `ghcr.io`
(username + a GitHub token with `read:packages`).

## Compose service

Add next to the existing `grampsweb` service in the same hosting compose:

```yaml
  ui:
    image: ghcr.io/b21-agency/gramps-ui:latest
    restart: unless-stopped
    environment:
      GRAMPSWEB_UPSTREAM: http://grampsweb:5000   # default
      CLIENT_MAX_BODY_SIZE: 1g                    # media / tree imports
    depends_on: [grampsweb]
```

Domains:
- `gramps.example.org` → `ui:80` (new UI, API under `/api/` on the same origin)
- `gramps-classic.example.org` → `grampsweb:5000` (classic UI, keep for fallback)

Set `GRAMPSWEB_BASE_URL=https://gramps.example.org` on grampsweb. Password-reset and
e-mail-confirmation links point to pages the API serves itself
(`/api/users/-/password/reset/?jwt=...`), so they work through the proxy unchanged.

Health check: `GET /healthz` → `ok`.
