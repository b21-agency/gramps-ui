# Local Gramps Web backend

A disposable Gramps Web instance (API + classic UI) seeded with the Gramps example tree,
used as backend for `pnpm dev`.

```sh
docker compose -p gramps-dev -f dev/docker-compose.yml up -d
./dev/seed.sh            # first run only: users + example tree + media
pnpm dev                 # http://localhost:5173, /api proxied to http://localhost:5055
```

Users: `owner/owner` (owner), `editor/editor` (editor), `guest/guest` (guest).
Classic UI for comparison: http://localhost:5055.

Against another Gramps Web instance: `GRAMPS_API_TARGET=https://your-gramps-web.example pnpm dev`.

Reset everything: `docker compose -p gramps-dev -f dev/docker-compose.yml down -v`.
